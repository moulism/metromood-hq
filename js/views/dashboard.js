import { sb, q } from "../supabase.js";
import { h, state, errToast, loading, fmtDate, fmtTime, daysFrom, startOfWeek, ymd, kc, num, avatar, fmtLong, parseDate, MONTHS } from "../ui.js";
import { taskRow, openTask } from "./tasks.js";
import { STAGES } from "./drops.js";

export default async function view(root) {
  const now = new Date();
  const hour = now.getHours();
  const hello = hour < 10 ? "Dobré ráno" : hour < 18 ? "Ahoj" : "Dobrý večer";
  const body = h("div.dash", loading());
  root.append(
    h("header.page-head.dash-head",
      h("div", h("h1", `${hello}, ${state.me.display_name}`), h("p.sub", fmtLong(ymd(now))))),
    body);

  async function load() {
    try {
      const wk = startOfWeek();
      const wkEnd = new Date(wk); wkEnd.setDate(wk.getDate() + 7);
      const [tasks, events, drops, msgs, posts] = await Promise.all([
        q(sb.from("tasks").select("*").order("due_date", { nullsFirst: false })),
        q(sb.from("events").select("*").gte("starts_at", ymd(now)).order("starts_at").limit(8)),
        q(sb.from("drops").select("*").order("sort")),
        q(sb.from("messages").select("*, channels(name)").order("created_at", { ascending: false }).limit(4)),
        q(sb.from("content_posts").select("id,status,planned_date").gte("planned_date", ymd(wk)).lt("planned_date", ymd(wkEnd))),
      ]);
      let ownerData = null;
      if (state.isOwner) {
        const [kpi, exp, parts] = await Promise.all([
          q(sb.from("kpi_months").select("*").order("month")),
          q(sb.from("expenses").select("amount")),
          q(sb.from("funding_parts").select("*").order("n")),
        ]);
        ownerData = { kpi, exp, parts };
      }
      draw({ tasks, events, drops, msgs, posts, ownerData, wk, wkEnd });
    } catch (e) { errToast(e); }
  }

  function draw({ tasks, events, drops, msgs, posts, ownerData, wk, wkEnd }) {
    const mine = tasks.filter((t) => t.assignee_id === state.me.id && t.status !== "done");
    const lateAll = tasks.filter((t) => t.status !== "done" && t.due_date && daysFrom(t.due_date) < 0);
    const doneWeek = tasks.filter((t) => t.status === "done" && t.completed_at && new Date(t.completed_at) >= wk);
    const dueWeek = tasks.filter((t) => t.status !== "done" && t.due_date && daysFrom(t.due_date) >= 0 && parseDate(t.due_date) < wkEnd);
    const postedWeek = posts.filter((p) => p.status === "venku").length;

    const week = h("section.panel.week",
      h("h2", "Tento týden"),
      h("div.week-stats",
        stat(doneWeek.length, "splněno", "ok"),
        stat(dueWeek.length, "na řadě"),
        stat(lateAll.length, "po termínu", lateAll.length ? "bad" : ""),
        stat(`${postedWeek}/4`, "videí venku", postedWeek >= 4 ? "ok" : "")),
      lateAll.length ? h("div.late-list",
        h("p.muted", "Po termínu v týmu:"),
        lateAll.slice(0, 5).map((t) => h("button.late-item", { onclick: () => openTask(t, load) },
          avatar(state.member(t.assignee_id), "sm"), h("span", t.title), h("small", fmtDate(t.due_date))))) : null);

    const myPanel = h("section.panel.my",
      h("div.panel-head", h("h2", "Tvoje úkoly"), h("a.more", { href: "#/ukoly" }, "Všechny úkoly")),
      mine.length ? mine.slice(0, 7).map((t) => taskRow(t, { onChange: load, showWho: false, drops }))
        : h("p.muted", "Nic tě nečeká. Přidej si úkol, nebo pomoz ostatním."),
      h("button.btn.ghost.small", { onclick: () => openTask(null, load) }, "Nový úkol"));

    const evPanel = h("section.panel.events",
      h("div.panel-head", h("h2", "Co nás čeká"), h("a.more", { href: "#/kalendar" }, "Kalendář")),
      events.length ? h("ul.agenda", events.filter((e, i) => e.kind !== "schuzka" || i === events.findIndex((x) => x.kind === "schuzka")).slice(0, 6).map((e) => {
        const n = daysFrom(ymd(e.starts_at));
        return h("li", { class: `k-${e.kind}` },
          h("span.ag-date", h("strong", new Date(e.starts_at).getDate()), h("small", MONTHS[new Date(e.starts_at).getMonth()].slice(0, 3))),
          h("span.ag-body", h("span", e.title), h("small", [n === 0 ? "dnes" : n === 1 ? "zítra" : `za ${n} dní`, e.venue ? ` · ${e.venue}` : "", !e.all_day ? ` · ${fmtTime(e.starts_at)}` : ""].join(""))));
      })) : h("p.muted", "Nic naplánovaného."));

    const dropPanel = h("section.panel.drops-mini",
      h("div.panel-head", h("h2", "Dropy"), h("a.more", { href: "#/dropy" }, "Pipeline")),
      drops.filter((d) => d.stage !== "hotovo").map((d) => {
        const idx = STAGES.findIndex(([s]) => s === d.stage);
        const dt = tasks.filter((t) => t.drop_id === d.id);
        const dd = dt.filter((t) => t.status === "done").length;
        return h("a.drop-line", { href: "#/dropy" },
          h("span.drop-name", d.name),
          h("span.mini-track", { "aria-label": `Fáze: ${STAGES[idx]?.[1]}` },
            STAGES.slice(0, 6).map(([s], i) => h("span.mini-stop", { class: i < idx ? "past" : i === idx ? "now" : "" }))),
          h("small", `${STAGES[idx]?.[1]}${dt.length ? ` · ${dd}/${dt.length} úkolů` : ""}${d.launch_date ? ` · ${fmtDate(d.launch_date)}` : ""}`));
      }));

    const chatPanel = h("section.panel.chat-mini",
      h("div.panel-head", h("h2", "Chat"), h("a.more", { href: "#/chat" }, "Otevřít")),
      msgs.length ? msgs.map((m) => h("div.msg-mini", avatar(state.member(m.author_id), "sm"),
        h("div", h("small", `#${m.channels?.name || ""} · ${fmtDate(m.created_at)} ${fmtTime(m.created_at)}`), h("p", m.body.slice(0, 140)))))
        : h("p.muted", "Zatím ticho. Napiš týmu první zprávu."));

    const panels = [week, myPanel, evPanel, dropPanel, chatPanel];

    if (ownerData) {
      const cur = ownerData.kpi.find((k) => { const d = parseDate(k.month); return d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear(); })
        || ownerData.kpi.find((k) => parseDate(k.month) > new Date()) || ownerData.kpi[0];
      const totalOrders = ownerData.kpi.reduce((s, k) => s + (k.orders || 0), 0);
      const spent = ownerData.exp.reduce((s, e) => s + Number(e.amount), 0);
      const released = ownerData.parts.filter((p) => p.released).reduce((s, p) => s + Number(p.amount), 0);
      panels.push(h("section.panel.owner",
        h("div.panel-head", h("h2", "Jen pro tebe"), h("a.more", { href: "#/cisla" }, "Čísla")),
        h("div.week-stats",
          stat(`${num(totalOrders)}/100`, "objednávek celkem"),
          cur ? stat(`${num(cur.orders ?? 0)}/${num(cur.target_orders)}`, `objednávek – ${MONTHS[parseDate(cur.month).getMonth()]}`) : null,
          stat(kc(spent), "utraceno"),
          stat(kc(released), "uvolněno od táty"))));
    }
    body.replaceChildren(...panels);
  }

  function stat(v, label, cls = "") { return h("div.stat", { class: cls }, h("strong", v), h("span", label)); }

  await load();
  const sub = sb.channel("dash-tasks").on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => load()).subscribe();
  return () => sub.unsubscribe();
}
