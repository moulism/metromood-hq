import { sb, q } from "../supabase.js";
import { h, state, modal, form, toast, errToast, confirmDialog, pageHead, chips, loading, ymd, MONTHS, DAYS,
  fmtTime, fmtDate, parseDate, startOfWeek, avatar } from "../ui.js";
import { openTask } from "./tasks.js";

export const KINDS = [
  ["schuzka", "Schůzka"], ["akce", "Akce"], ["drop", "Drop"], ["obsah", "Obsah"], ["deadline", "Termín"], ["jine", "Jiné"],
];
const VENUES = [["", "—"], ["Anděl", "Anděl"], ["Republika", "Republika"], ["Kosatka", "Kosatka"], ["Jinde", "Jinde"]];

function toLocalInput(iso) {
  const d = new Date(iso);
  return `${ymd(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function openEvent(ev, onSaved) {
  const isNew = !ev?.id;
  const allDay = ev?.all_day ?? true;
  const f = form([
    { name: "title", label: "Název", required: true },
    { name: "kind", label: "Typ", type: "select", options: KINDS, half: true },
    { name: "venue", label: "Podnik", type: "select", options: VENUES, half: true },
    { name: "all_day", label: "Celý den", type: "checkbox" },
    { name: "date", label: "Datum", type: "date", half: true, required: true },
    { name: "start", label: "Začátek", type: "time", half: true },
    { name: "end", label: "Konec", type: "time", half: true },
    { name: "location", label: "Místo (adresa, odkaz)", half: true },
    { name: "description", label: "Popis", type: "textarea", rows: 3 },
  ], {
    kind: "jine", ...ev, all_day: allDay,
    date: ev?.starts_at ? ymd(ev.starts_at) : ev?.date || ymd(new Date()),
    start: ev?.starts_at && !allDay ? toLocalInput(ev.starts_at).slice(11) : "",
    end: ev?.ends_at && !allDay ? toLocalInput(ev.ends_at).slice(11) : "",
  });
  const sync = () => f.querySelectorAll('[name="start"],[name="end"]').forEach((i) => { i.closest("label").hidden = f.elements.all_day.checked; });
  f.elements.all_day.addEventListener("change", sync); sync();
  const save = async () => {
    if (!f.validate()) return;
    const v = f.values();
    const allDay = v.all_day || !v.start;
    const starts_at = allDay ? new Date(`${v.date}T00:00`).toISOString() : new Date(`${v.date}T${v.start}`).toISOString();
    const ends_at = !allDay && v.end ? new Date(`${v.date}T${v.end}`).toISOString() : null;
    const row = { title: v.title, kind: v.kind, venue: v.venue, location: v.location, description: v.description, all_day: allDay, starts_at, ends_at };
    try {
      if (isNew) await q(sb.from("events").insert({ ...row, created_by: state.me.id }));
      else await q(sb.from("events").update(row).eq("id", ev.id));
      m.close(); toast("Uloženo do kalendáře"); onSaved?.();
    } catch (e) { errToast(e); }
  };
  const m = modal(isNew ? "Nová událost" : "Upravit událost", f, {
    actions: [
      !isNew ? h("button.btn.ghost.danger-text", { onclick: async () => {
        if (!(await confirmDialog(`Smazat „${ev.title}“?`))) return;
        try { await q(sb.from("events").delete().eq("id", ev.id)); m.close(); onSaved?.(); } catch (e) { errToast(e); }
      } }, "Smazat") : null,
      h("span.spacer"),
      h("button.btn.primary", { onclick: save }, isNew ? "Přidat" : "Uložit"),
    ],
  });
}

export default async function view(root) {
  let cursor = new Date(); cursor.setDate(1); cursor.setHours(0, 0, 0, 0);
  let show = { tasks: true, content: true, meetings: true };
  let data = { events: [], tasks: [], posts: [] };
  const title = h("h2.cal-title");
  const grid = h("div.cal");
  const legend = h("div.legend", KINDS.map(([k, l]) => h("span", { class: `k-${k}` }, h("i"), l)), h("span.k-task", h("i"), "Úkol"), h("span.k-post", h("i"), "Video"));
  root.append(
    pageHead("Kalendář", "Akce, dropy, schůzky, termíny úkolů a plán videí na jednom místě.",
      h("button.btn.primary", { onclick: () => openEvent(null, load) }, "Nová událost")),
    h("div.toolbar.cal-bar",
      h("button.btn.ghost.small", { onclick: () => { cursor.setMonth(cursor.getMonth() - 1); load(); }, "aria-label": "Předchozí měsíc" }, "◀"),
      title,
      h("button.btn.ghost.small", { onclick: () => { cursor.setMonth(cursor.getMonth() + 1); load(); }, "aria-label": "Další měsíc" }, "▶"),
      h("button.btn.ghost.small", { onclick: () => { cursor = new Date(); cursor.setDate(1); cursor.setHours(0, 0, 0, 0); load(); } }, "Dnes"),
      h("span.spacer"),
      h("label.toggle", h("input", { type: "checkbox", checked: true, onchange: (e) => { show.tasks = e.target.checked; draw(); } }), "Úkoly"),
      h("label.toggle", h("input", { type: "checkbox", checked: true, onchange: (e) => { show.content = e.target.checked; draw(); } }), "Videa"),
      h("label.toggle", h("input", { type: "checkbox", checked: true, onchange: (e) => { show.meetings = e.target.checked; draw(); } }), "Schůzky")),
    grid, legend);

  async function load() {
    title.textContent = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;
    const from = startOfWeek(cursor);
    const to = new Date(from); to.setDate(from.getDate() + 42);
    grid.replaceChildren(loading());
    try {
      const [events, tasks, posts] = await Promise.all([
        q(sb.from("events").select("*").gte("starts_at", from.toISOString()).lt("starts_at", to.toISOString()).order("starts_at")),
        q(sb.from("tasks").select("*").gte("due_date", ymd(from)).lt("due_date", ymd(to))),
        q(sb.from("content_posts").select("*").gte("planned_date", ymd(from)).lt("planned_date", ymd(to))),
      ]);
      data = { events, tasks, posts, from };
      draw();
    } catch (e) { errToast(e); }
  }

  function itemsFor(day) {
    const key = ymd(day);
    const out = [];
    for (const e of data.events) {
      if (ymd(e.starts_at) !== key) continue;
      if (e.kind === "schuzka" && !show.meetings) continue;
      out.push(h("button.ev", { class: `k-${e.kind}`, title: e.title, onclick: (x) => { x.stopPropagation(); openEvent(e, load); } },
        !e.all_day ? h("small", fmtTime(e.starts_at)) : null, e.title));
    }
    if (show.content) for (const p of data.posts) if (p.planned_date === key)
      out.push(h("a.ev.k-post", { href: "#/obsah", title: p.title, class: p.status === "venku" ? "done" : "" }, p.title));
    if (show.tasks) for (const t of data.tasks) if (t.due_date === key)
      out.push(h("button.ev.k-task", { class: t.status === "done" ? "done" : "", title: t.title, onclick: (x) => { x.stopPropagation(); openTask(t, load); } },
        avatar(state.member(t.assignee_id), "xs"), t.title));
    return out;
  }

  function draw() {
    const todayKey = ymd(new Date());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(data.from); d.setDate(d.getDate() + i);
      const items = itemsFor(d);
      const out = d.getMonth() !== cursor.getMonth();
      if (i === 35 && out) break;
      cells.push(h("div.day", {
        class: `${out ? "out" : ""} ${ymd(d) === todayKey ? "today" : ""} ${items.length ? "has" : ""}`,
        onclick: () => openEvent({ date: ymd(d) }, load),
        role: "button", tabindex: "0", "aria-label": `${fmtDate(ymd(d), { weekday: true })}, ${items.length} položek – přidat událost`,
        onkeydown: (e) => { if (e.key === "Enter") openEvent({ date: ymd(d) }, load); },
      }, h("span.dnum", d.getDate()), h("div.evs", items)));
    }
    grid.replaceChildren(
      h("div.dow", [1, 2, 3, 4, 5, 6, 0].map((i) => h("span", DAYS[i]))),
      h("div.days", cells));
    // agenda pro mobil
    const upcoming = data.events.filter((e) => parseDate(ymd(e.starts_at)).getMonth() === cursor.getMonth() && (show.meetings || e.kind !== "schuzka"));
    grid.append(h("ul.agenda.cal-agenda", upcoming.length ? upcoming.map((e) =>
      h("li", { class: `k-${e.kind}`, onclick: () => openEvent(e, load) },
        h("span.ag-date", h("strong", new Date(e.starts_at).getDate()), h("small", DAYS[new Date(e.starts_at).getDay()])),
        h("span.ag-body", h("span", e.title), h("small", [e.venue, !e.all_day ? fmtTime(e.starts_at) : null].filter(Boolean).join(" · ") || KINDS.find(([k]) => k === e.kind)?.[1]))))
      : h("li.muted", "V tomhle měsíci nic.")));
  }
  await load();
}
