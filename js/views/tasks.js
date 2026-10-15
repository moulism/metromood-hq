import { sb, q } from "../supabase.js";
import { h, state, modal, form, toast, errToast, confirmDialog, pageHead, chips, avatar, fmtRelDue, daysFrom,
  memberOptions, empty, loading, startOfWeek, ymd, fmtDate } from "../ui.js";

const STATUS = [["todo", "Na řadě"], ["doing", "Rozpracované"], ["done", "Hotovo"]];
const PRIO = [["low", "Nízká"], ["normal", "Normální"], ["high", "Vysoká"]];

export async function openTask(task, onSaved) {
  const drops = await q(sb.from("drops").select("id,name").order("sort"));
  const isNew = !task?.id;
  const f = form([
    { name: "title", label: "Co je potřeba udělat", required: true },
    { name: "description", label: "Detaily", type: "textarea", rows: 3 },
    { name: "assignee_id", label: "Kdo", type: "select", options: memberOptions(), half: true },
    { name: "due_date", label: "Termín", type: "date", half: true },
    { name: "status", label: "Stav", type: "select", options: STATUS, half: true },
    { name: "priority", label: "Priorita", type: "select", options: PRIO, half: true },
    { name: "drop_id", label: "Patří k dropu", type: "select", options: [["", "— žádný —"], ...drops.map((d) => [d.id, d.name])] },
  ], { status: "todo", priority: "normal", assignee_id: isNew ? state.me.id : "", ...task });
  const save = async () => {
    if (!f.validate()) return;
    const v = f.values();
    if (v.status === "done" && task?.status !== "done") v.completed_at = new Date().toISOString();
    if (v.status !== "done") v.completed_at = null;
    try {
      if (isNew) await q(sb.from("tasks").insert({ ...v, created_by: state.me.id }));
      else await q(sb.from("tasks").update(v).eq("id", task.id));
      m.close(); toast(isNew ? "Úkol přidán" : "Úkol uložen"); onSaved?.();
    } catch (e) { errToast(e); }
  };
  const m = modal(isNew ? "Nový úkol" : "Upravit úkol", f, {
    actions: [
      !isNew ? h("button.btn.ghost.danger-text", { onclick: async () => {
        if (!(await confirmDialog(`Smazat úkol „${task.title}“?`))) return;
        try { await q(sb.from("tasks").delete().eq("id", task.id)); m.close(); toast("Úkol smazán"); onSaved?.(); } catch (e) { errToast(e); }
      } }, "Smazat") : null,
      h("span.spacer"),
      h("button.btn.primary", { onclick: save }, isNew ? "Přidat úkol" : "Uložit"),
    ],
  });
  f.addEventListener("submit", save);
}

export async function toggleDone(t) {
  const done = t.status !== "done";
  await q(sb.from("tasks").update({ status: done ? "done" : "todo", completed_at: done ? new Date().toISOString() : null }).eq("id", t.id));
}

export function taskRow(t, { onChange, showWho = true, drops = [] } = {}) {
  const n = daysFrom(t.due_date);
  const late = t.status !== "done" && n != null && n < 0;
  const drop = drops.find((d) => d.id === t.drop_id);
  return h("div.task", { class: `${t.status} ${late ? "late" : ""}` },
    h("button.check", { "aria-label": t.status === "done" ? "Označit jako nehotové" : "Označit jako hotové",
      "aria-pressed": String(t.status === "done"),
      onclick: async (e) => { e.stopPropagation(); try { await toggleDone(t); onChange?.(); } catch (er) { errToast(er); } } }),
    h("button.task-main", { onclick: () => openTask(t, onChange) },
      h("span.task-title", t.title),
      h("span.task-meta",
        t.due_date ? h("span.due", { class: late ? "late" : n === 0 ? "soon" : "" }, fmtRelDue(t.due_date)) : null,
        t.status === "doing" ? h("span.tag", "rozpracované") : null,
        t.priority === "high" ? h("span.tag.hot", "důležité") : null,
        drop ? h("span.tag.drop", drop.name) : null)),
    showWho ? avatar(state.member(t.assignee_id), "sm") : null);
}

export default async function view(root) {
  let who = "me", mode = "list", dropFilter = "";
  let all = [], drops = [];
  const body = h("div");
  root.append(
    pageHead("Úkoly", "Co musí kdo splnit. Hotové odškrtni kolečkem.",
      h("button.btn.primary", { onclick: () => openTask(null, load) }, "Nový úkol")),
    h("div.toolbar",
      chips([["me", "Moje"], ["all", "Všichni"], ...state.members.filter((m) => m.id !== state.me.id).map((m) => [m.id, m.display_name])],
        who, (v) => { who = v; draw(); }),
      h("span.spacer"),
      chips([["list", "Seznam"], ["board", "Tabule"]], mode, (v) => { mode = v; draw(); })),
    body);

  async function load() {
    body.replaceChildren(loading());
    try {
      [all, drops] = await Promise.all([
        q(sb.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }).order("created_at")),
        q(sb.from("drops").select("id,name").order("sort")),
      ]);
      draw();
    } catch (e) { errToast(e); }
  }

  function filtered() {
    return all.filter((t) =>
      (who === "all" || t.assignee_id === (who === "me" ? state.me.id : who)) &&
      (!dropFilter || t.drop_id === dropFilter));
  }

  function draw() {
    const list = filtered();
    body.replaceChildren();
    if (!list.length) return body.append(empty(who === "me" ? "Nemáš žádné úkoly. Užij si to." : "Tady nejsou žádné úkoly.",
      h("button.btn", { onclick: () => openTask(null, load) }, "Přidat úkol")));
    const opts = { onChange: load, showWho: who !== "me" || true, drops };
    if (mode === "board") {
      body.append(h("div.board", STATUS.map(([s, label]) => {
        const items = list.filter((t) => t.status === s);
        return h("section.col", h("h3", label, h("span.count", items.length)), items.map((t) => taskRow(t, opts)));
      })));
      return;
    }
    // seznam: po termínu / tento týden / další týdny / bez termínu / hotovo
    const open = list.filter((t) => t.status !== "done");
    const done = list.filter((t) => t.status === "done").sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || ""));
    const wk = startOfWeek();
    const groups = new Map();
    const late = [], none = [];
    for (const t of open) {
      if (!t.due_date) { none.push(t); continue; }
      if (daysFrom(t.due_date) < 0) { late.push(t); continue; }
      const ws = startOfWeek(new Date(t.due_date + "T12:00"));
      const key = ymd(ws);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(t);
    }
    const section = (title, items, cls = "") => items.length
      ? h("section.task-group", { class: cls }, h("h3", title, h("span.count", items.length)), items.map((t) => taskRow(t, opts))) : null;
    body.append(section("Po termínu", late, "late"));
    for (const [key, items] of groups) {
      const d = new Date(key + "T12:00");
      const end = new Date(d); end.setDate(end.getDate() + 6);
      const isThis = ymd(wk) === key;
      const title = isThis ? "Tento týden" : `Týden ${fmtDate(ymd(d))} – ${fmtDate(ymd(end))}`;
      body.append(section(title, items));
    }
    body.append(section("Bez termínu", none));
    if (done.length) {
      const det = h("details.task-group.done-group", h("summary", `Hotovo (${done.length})`), done.map((t) => taskRow(t, opts)));
      body.append(det);
    }
  }

  await load();
  const sub = sb.channel("tasks-view").on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => load()).subscribe();
  return () => sub.unsubscribe();
}
