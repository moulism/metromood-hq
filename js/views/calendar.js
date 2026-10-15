import { sb, q } from "../supabase.js";
import { h, state, modal, form, toast, errToast, confirmDialog, pageHead, chips, loading, ymd, MONTHS, DAYS,
  fmtTime, fmtDate, fmtLong, parseDate, startOfWeek, avatar } from "../ui.js";
import { openTask, taskRow } from "./tasks.js";
import { openPost } from "./content.js";

const MAX_IN_CELL = 3;
const POST_STATUS = { napad: "nápad", natoceno: "natočeno", sestrihano: "sestříháno", venku: "venku" };

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
    pageHead("Kalendář", "Akce, dropy, schůzky, termíny úkolů a plán videí. Klikni na den a uvidíš všechno, co v něm je.",
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

  // Všechno, co patří k jednomu dni (podle filtrů nahoře).
  function dayData(key) {
    return {
      events: data.events.filter((e) => ymd(e.starts_at) === key && (show.meetings || e.kind !== "schuzka")),
      tasks: show.tasks ? data.tasks.filter((t) => t.due_date === key) : [],
      posts: show.content ? data.posts.filter((p) => p.planned_date === key) : [],
    };
  }

  function chipsFor(key) {
    const { events, tasks, posts } = dayData(key);
    const out = [];
    for (const e of events) out.push(h("button.ev", { class: `k-${e.kind}`, title: e.title, onclick: (x) => { x.stopPropagation(); openEvent(e, load); } },
      !e.all_day ? h("small", fmtTime(e.starts_at)) : null, e.title));
    for (const p of posts) out.push(h("button.ev.k-post", { class: p.status === "venku" ? "done" : "", title: p.title,
      onclick: (x) => { x.stopPropagation(); openPost(p, load); } }, p.title));
    for (const t of tasks) out.push(h("button.ev.k-task", { class: t.status === "done" ? "done" : "", title: t.title,
      onclick: (x) => { x.stopPropagation(); openTask(t, load); } }, avatar(state.member(t.assignee_id), "xs"), t.title));
    return out;
  }

  // Detail dne: všechny události, úkoly a videa + rychlé přidání.
  function openDay(key) {
    const box = h("div.day-detail");
    const refresh = async () => { await load(); drawDay(); };
    const drawDay = () => {
      const { events, tasks, posts } = dayData(key);
      const tasksSorted = [...tasks].sort((a, b) => (a.status === "done") - (b.status === "done"));
      box.replaceChildren(
        !events.length && !tasks.length && !posts.length ? h("p.muted", "Na tenhle den zatím nic není.") : null,
        events.length ? h("section.dd-sec", h("h3", "Události", h("span.count", events.length)),
          events.map((e) => h("button.dd-item", { class: `k-${e.kind}`, onclick: () => openEvent(e, refresh) },
            h("span.dd-bar"),
            h("span.dd-text", h("strong", e.title),
              h("small", [KINDS.find(([k]) => k === e.kind)?.[1], e.venue,
                e.all_day ? "celý den" : `${fmtTime(e.starts_at)}${e.ends_at ? `–${fmtTime(e.ends_at)}` : ""}`, e.location].filter(Boolean).join(" · ")),
              e.description ? h("span.dd-desc", e.description) : null)))) : null,
        tasks.length ? h("section.dd-sec", h("h3", "Úkoly s termínem", h("span.count", `${tasks.filter((t) => t.status === "done").length}/${tasks.length} hotovo`)),
          tasksSorted.map((t) => taskRow(t, { onChange: refresh }))) : null,
        posts.length ? h("section.dd-sec", h("h3", "Videa k publikování", h("span.count", posts.length)),
          posts.map((p) => h("button.dd-item.k-post", { onclick: () => openPost(p, refresh) },
            h("span.dd-bar"),
            h("span.dd-text", h("strong", p.title), h("small", [POST_STATUS[p.status], state.member(p.owner_id)?.display_name].filter(Boolean).join(" · ")))))) : null,
      );
    };
    drawDay();
    const d = parseDate(key);
    modal(`${["neděle","pondělí","úterý","středa","čtvrtek","pátek","sobota"][d.getDay()]} ${fmtLong(key)}`, box, {
      wide: true,
      actions: [
        h("button.btn.ghost", { onclick: () => openPost({ planned_date: key }, refresh) }, "Přidat video"),
        h("span.spacer"),
        h("button.btn", { onclick: () => openTask({ due_date: key }, refresh) }, "Přidat úkol"),
        h("button.btn.primary", { onclick: () => openEvent({ date: key }, refresh) }, "Přidat událost"),
      ],
    });
  }

  function draw() {
    const todayKey = ymd(new Date());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(data.from); d.setDate(d.getDate() + i);
      const key = ymd(d);
      const out = d.getMonth() !== cursor.getMonth();
      if (i === 35 && out) break;
      const items = chipsFor(key);
      const shown = items.slice(0, MAX_IN_CELL);
      const rest = items.length - shown.length;
      cells.push(h("div.day", {
        class: `${out ? "out" : ""} ${key === todayKey ? "today" : ""} ${items.length ? "has" : ""}`,
        onclick: () => openDay(key),
        role: "button", tabindex: "0", "aria-label": `${fmtDate(key, { weekday: true })}: ${items.length} položek, otevřít den`,
        onkeydown: (e) => { if (e.key === "Enter" && e.target === e.currentTarget) openDay(key); },
      }, h("span.dnum", d.getDate()), h("div.evs", shown,
        rest > 0 ? h("button.ev.more-ev", { onclick: (x) => { x.stopPropagation(); openDay(key); } }, `+ ${rest} další`) : null)));
    }
    grid.replaceChildren(
      h("div.dow", [1, 2, 3, 4, 5, 6, 0].map((i) => h("span", DAYS[i]))),
      h("div.days", cells));
    // mobil: seznam dnů tohoto měsíce, které něco obsahují
    const days = [];
    for (let i = 0; i < cells.length; i++) {
      const d = new Date(data.from); d.setDate(d.getDate() + i);
      if (d.getMonth() !== cursor.getMonth()) continue;
      const key = ymd(d);
      const { events, tasks, posts } = dayData(key);
      const n = events.length + tasks.length + posts.length;
      if (!n) continue;
      const titles = [...events.map((e) => e.title), ...posts.map((p) => p.title), ...tasks.map((t) => t.title)];
      days.push(h("li", { class: `${key === todayKey ? "is-today" : ""} ${events[0] ? `k-${events[0].kind}` : tasks.length ? "k-task" : "k-post"}` },
        h("button.ag-day", { onclick: () => openDay(key) },
          h("span.ag-date", h("strong", d.getDate()), h("small", DAYS[d.getDay()])),
          h("span.ag-body", h("span", titles.slice(0, 2).join(", ")),
            h("small", [events.length ? `${events.length} ${events.length === 1 ? "událost" : events.length < 5 ? "události" : "událostí"}` : null,
              tasks.length ? `${tasks.length} ${tasks.length === 1 ? "úkol" : tasks.length < 5 ? "úkoly" : "úkolů"}` : null,
              posts.length ? `${posts.length} ${posts.length === 1 ? "video" : posts.length < 5 ? "videa" : "videí"}` : null].filter(Boolean).join(" · "))))));
    }
    grid.append(h("ul.agenda.cal-agenda", days.length ? days : h("li.muted", "V tomhle měsíci nic.")));
  }
  await load();
}
