import { sb, q } from "../supabase.js";
import { h, modal, form, toast, errToast, confirmDialog, pageHead, loading, kc, fmtDate, MONTHS, parseDate, ymd } from "../ui.js";

const CATS = ["Výroba", "Reklama", "Obsah", "Ostatní"];

function openExpense(x, onSaved) {
  const isNew = !x?.id;
  const f = form([
    { name: "amount", label: "Částka (Kč)", type: "number", required: true, half: true, step: "any" },
    { name: "spent_on", label: "Datum", type: "date", required: true, half: true },
    { name: "category", label: "Kategorie", type: "select", options: CATS },
    { name: "note", label: "Za co", placeholder: "např. Meta Ads – teaser Drop 02" },
  ], { spent_on: ymd(new Date()), category: "Reklama", ...x });
  const save = async () => {
    if (!f.validate()) return;
    try {
      if (isNew) await q(sb.from("expenses").insert(f.values()));
      else await q(sb.from("expenses").update(f.values()).eq("id", x.id));
      m.close(); toast("Výdaj uložen"); onSaved();
    } catch (e) { errToast(e); }
  };
  const m = modal(isNew ? "Nový výdaj" : "Upravit výdaj", f, { actions: [
    !isNew ? h("button.btn.ghost.danger-text", { onclick: async () => {
      if (!(await confirmDialog("Smazat výdaj?"))) return;
      try { await q(sb.from("expenses").delete().eq("id", x.id)); m.close(); onSaved(); } catch (e) { errToast(e); }
    } }, "Smazat") : null,
    h("span.spacer"), h("button.btn.primary", { onclick: save }, isNew ? "Přidat výdaj" : "Uložit")] });
}

export default async function view(root) {
  const body = h("div", loading());
  root.append(pageHead("Rozpočet", "Plán vs. skutečné výdaje a peníze od táty po částech.",
    h("button.btn.primary", { onclick: () => openExpense(null, load) }, "Přidat výdaj")), body);

  async function load() {
    try {
      const [lines, exp, parts, checks] = await Promise.all([
        q(sb.from("budget_lines").select("*").order("month")),
        q(sb.from("expenses").select("*").order("spent_on", { ascending: false })),
        q(sb.from("funding_parts").select("*").order("n")),
        q(sb.from("checkpoints").select("*").order("part_n").order("sort")),
      ]);
      draw(lines, exp, parts, checks);
    } catch (e) { errToast(e); }
  }

  async function toggle(table, id, field, value) {
    try { await q(sb.from(table).update({ [field]: value }).eq("id", id)); load(); } catch (e) { errToast(e); }
  }

  function draw(lines, exp, parts, checks) {
    const planned = lines.reduce((s, l) => s + Number(l.planned), 0);
    const spent = exp.reduce((s, e) => s + Number(e.amount), 0);
    const released = parts.filter((p) => p.released).reduce((s, p) => s + Number(p.amount), 0);
    const months = [...new Set(lines.map((l) => l.month))].sort();
    const monthKey = (d) => d.slice(0, 7);

    const catRows = CATS.map((c) => {
      const p = lines.filter((l) => l.category === c).reduce((s, l) => s + Number(l.planned), 0);
      const sp = exp.filter((e) => e.category === c).reduce((s, e) => s + Number(e.amount), 0);
      return h("div.cat",
        h("div.goal-top", h("strong", c), h("span", `${kc(sp)} z ${kc(p)}`)),
        h("div.meter", { class: sp > p ? "over" : "" }, h("span", { style: { width: `${p ? Math.min(100, (sp / p) * 100) : 0}%` } })));
    });

    body.replaceChildren(
      h("section.week-stats.big",
        h("div.stat", h("strong", kc(planned)), h("span", "plán celkem (max.)")),
        h("div.stat", h("strong", kc(released)), h("span", "uvolněno od táty")),
        h("div.stat", { class: spent > released ? "bad" : "" }, h("strong", kc(spent)), h("span", "utraceno")),
        h("div.stat", h("strong", kc(released - spent)), h("span", "zbývá z uvolněného"))),
      h("section.panel", h("h2", "Podle kategorií"), h("div.cats", catRows)),
      h("section.panel",
        h("h2", "Po měsících"),
        h("div.table-wrap", h("table",
          h("thead", h("tr", h("th", "Kategorie"), months.map((m) => h("th", MONTHS[parseDate(m).getMonth()].slice(0, 3))), h("th", "Celkem"))),
          h("tbody",
            CATS.map((c) => h("tr", h("th", c), months.map((m) => {
              const p = lines.find((l) => l.category === c && l.month === m)?.planned || 0;
              const sp = exp.filter((e) => e.category === c && monthKey(e.spent_on) === monthKey(m)).reduce((s, e) => s + Number(e.amount), 0);
              return h("td", { class: sp > p ? "miss" : "" }, h("strong", Number(p).toLocaleString("cs-CZ")), sp ? h("small", `utr. ${sp.toLocaleString("cs-CZ")}`) : null);
            }), h("td", h("strong", lines.filter((l) => l.category === c).reduce((s, l) => s + Number(l.planned), 0).toLocaleString("cs-CZ"))))),
            h("tr.total", h("th", "Celkem"), months.map((m) => h("td", h("strong", lines.filter((l) => l.month === m).reduce((s, l) => s + Number(l.planned), 0).toLocaleString("cs-CZ")))),
              h("td", h("strong", planned.toLocaleString("cs-CZ")))))))),
      h("section.parts", parts.map((p) => {
        const cps = checks.filter((c) => c.part_n === p.n);
        return h("article.panel.part", { class: p.released ? "released" : "" },
          h("div.panel-head", h("h2", `Část ${p.n}`), h("strong", kc(p.amount))),
          h("p.muted", `${fmtDate(p.due_date, { year: true })} · ${p.purpose}`),
          cps.length ? [h("h3", `Kontrolní bod ${p.n - 1}`), h("ul.checklist", cps.map((c) => h("li",
            h("label", h("input", { type: "checkbox", checked: c.done, onchange: (e) => toggle("checkpoints", c.id, "done", e.target.checked) }), c.label))))] : null,
          h("label.toggle.release", h("input", { type: "checkbox", checked: p.released, onchange: (e) => toggle("funding_parts", p.id, "released", e.target.checked) }),
            p.released ? "Uvolněno" : "Označit jako uvolněné"));
      })),
      h("section.panel",
        h("div.panel-head", h("h2", "Výdaje"), h("button.btn.ghost.small", { onclick: () => openExpense(null, load) }, "Přidat výdaj")),
        exp.length ? h("ul.expenses", exp.map((x) => h("li", h("button.exp", { onclick: () => openExpense(x, load) },
          h("span.exp-date", fmtDate(x.spent_on)), h("span.tag", x.category), h("span.exp-note", x.note || ""), h("strong", kc(x.amount))))))
          : h("p.muted", "Zatím žádné výdaje. Zapisuj každou platbu – na konci měsíce z toho máš report pro tátu.")));
  }
  await load();
}
