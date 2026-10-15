import { sb, q } from "../supabase.js";
import { h, modal, form, toast, errToast, pageHead, loading, num, kc, MONTHS, parseDate, ymd } from "../ui.js";

const METRICS = [
  ["orders", "Objednávky", (v) => num(v)],
  ["revenue", "Tržby", (v) => kc(v)],
  ["strangers_pct", "Od cizích lidí", (v) => (v == null ? "–" : `${v} %`)],
  ["emails", "E-maily celkem", (v) => num(v)],
  ["followers", "Noví sledující celkem", (v) => (v == null ? "–" : `+${num(v)}`)],
];

function openMonth(k, onSaved) {
  const label = `${MONTHS[parseDate(k.month).getMonth()]} ${parseDate(k.month).getFullYear()}`;
  const f = form([
    ...METRICS.map(([key, l]) => ({ name: key, label: `${l} (cíl ${METRICS.find((x) => x[0] === key)[2](k["target_" + key])})`, type: "number", half: true, step: "any" })),
    { name: "note", label: "Co fungovalo, co ne", type: "textarea", rows: 4 },
  ], k);
  const m = modal(`Skutečnost – ${label}`, f, { actions: [h("span.spacer"), h("button.btn.primary", { onclick: async () => {
    try { await q(sb.from("kpi_months").update(f.values()).eq("month", k.month)); m.close(); toast("Čísla uložena"); onSaved(); } catch (e) { errToast(e); }
  } }, "Uložit")] });
}

export default async function view(root) {
  const body = h("div", loading());
  root.append(pageHead("Čísla", "Cíle z plánu vs. skutečnost. Hlavní měřítko: kolik objednávek přijde od lidí, které neznáš."), body);

  async function load() {
    try { draw(await q(sb.from("kpi_months").select("*").order("month"))); } catch (e) { errToast(e); }
  }

  function draw(rows) {
    const tot = (k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
    const totalOrders = tot("orders"), totalRevenue = tot("revenue");
    const lastWith = [...rows].reverse().find((r) => r.emails != null);
    const progress = (v, goal, label, fmt) => h("div.goal",
      h("div.goal-top", h("strong", fmt(v)), h("span", `z ${fmt(goal)} · ${label}`)),
      h("div.meter", { role: "meter", "aria-valuemin": "0", "aria-valuemax": String(goal), "aria-valuenow": String(v), "aria-label": label },
        h("span", { style: { width: `${Math.min(100, (v / goal) * 100)}%` } })));

    const maxOrders = Math.max(...rows.map((r) => Math.max(r.target_orders || 0, r.orders || 0)), 1);
    const chart = h("div.bars", { role: "img", "aria-label": "Objednávky po měsících: cíl a skutečnost" }, rows.map((r) => {
      const d = parseDate(r.month);
      return h("div.bar-col",
        h("div.bar-pair",
          h("span.bar.target", { style: { height: `${((r.target_orders || 0) / maxOrders) * 100}%` }, title: `Cíl ${r.target_orders}` }),
          h("span.bar.actual", { style: { height: `${((r.orders || 0) / maxOrders) * 100}%` }, title: `Skutečnost ${r.orders ?? "–"}`,
            class: r.orders != null && r.orders >= r.target_orders ? "ok" : "" })),
        h("small", MONTHS[d.getMonth()].slice(0, 3)));
    }));

    const nowKey = ymd(new Date()).slice(0, 7);
    body.replaceChildren(
      h("section.goals",
        progress(totalOrders, 100, "objednávek do konce dubna", num),
        progress(totalRevenue, 140000, "tržby", kc),
        progress(lastWith?.emails || 0, 500, "e-mailů v seznamu", num)),
      h("section.panel",
        h("div.panel-head", h("h2", "Objednávky po měsících"), h("div.legend", h("span.k-target", h("i"), "cíl"), h("span.k-actual", h("i"), "skutečnost"))),
        chart),
      h("section.panel",
        h("h2", "Měsíční report"),
        h("p.muted.small", "Klikni na měsíc a doplň skutečná čísla ze Shopify a sítí."),
        h("div.table-wrap", h("table.kpi",
          h("thead", h("tr", h("th", "Měsíc"), METRICS.map(([, l]) => h("th", l)), h("th", ""))),
          h("tbody", rows.map((r) => {
            const d = parseDate(r.month);
            return h("tr", { class: r.month.slice(0, 7) === nowKey ? "now" : "" },
              h("th", `${MONTHS[d.getMonth()]} ${d.getFullYear()}`),
              METRICS.map(([k, , fmt]) => {
                const v = r[k], t = r["target_" + k];
                const ok = v != null && t != null && Number(v) >= Number(t);
                return h("td", { class: v == null ? "" : ok ? "ok" : "miss" }, h("strong", fmt(v)), h("small", `cíl ${fmt(t)}`));
              }),
              h("td", h("button.btn.ghost.small", { onclick: () => openMonth(r, load) }, "Doplnit")));
          })))),
        rows.some((r) => r.note) ? h("div.notes", rows.filter((r) => r.note).map((r) =>
          h("p", h("strong", `${MONTHS[parseDate(r.month).getMonth()]}: `), r.note))) : null));
  }
  await load();
}
