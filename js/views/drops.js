import { sb, q } from "../supabase.js";
import { h, state, modal, form, toast, errToast, confirmDialog, pageHead, loading, fmtDate, kc, empty } from "../ui.js";
import { taskRow, openTask } from "./tasks.js";

export const STAGES = [
  ["napad", "Nápad"], ["navrh", "Návrh"], ["vzorek", "Vzorek"], ["vyroba", "Výroba"],
  ["foceni", "Focení"], ["launch", "V prodeji"], ["hotovo", "Hotovo"],
];

function openDrop(d, onSaved) {
  const isNew = !d?.id;
  const fields = [
    { name: "name", label: "Název", required: true, placeholder: "Drop 04 „…“" },
    { name: "stage", label: "Fáze", type: "select", options: STAGES, half: true },
    { name: "launch_date", label: "Start prodeje", type: "date", half: true },
    { name: "pieces", label: "Kusy", placeholder: "2 × 50 ks", half: true },
    ...(state.isOwner ? [{ name: "budget", label: "Rozpočet (Kč)", type: "number", half: true }] : []),
    { name: "description", label: "Popis, poznámky", type: "textarea", rows: 4 },
  ];
  const f = form(fields, { stage: "napad", ...d });
  const save = async () => {
    if (!f.validate()) return;
    try {
      const v = f.values();
      if (isNew) await q(sb.from("drops").insert({ ...v, sort: Date.now() % 100000 }));
      else await q(sb.from("drops").update(v).eq("id", d.id));
      m.close(); toast("Drop uložen"); onSaved();
    } catch (e) { errToast(e); }
  };
  const m = modal(isNew ? "Nový drop" : d.name, f, {
    actions: [
      !isNew ? h("button.btn.ghost.danger-text", { onclick: async () => {
        if (!(await confirmDialog(`Smazat „${d.name}“? Úkoly zůstanou, jen se odpojí.`))) return;
        try { await q(sb.from("drops").delete().eq("id", d.id)); m.close(); onSaved(); } catch (e) { errToast(e); }
      } }, "Smazat") : null,
      h("span.spacer"),
      h("button.btn.primary", { onclick: save }, isNew ? "Přidat drop" : "Uložit"),
    ],
  });
}

export default async function view(root) {
  const body = h("div", loading());
  root.append(pageHead("Dropy", "Každý drop od nápadu po prodej. Posuň ho šipkou, když se pohne dál.",
    h("button.btn.primary", { onclick: () => openDrop(null, load) }, "Nový drop")), body);

  async function load() {
    try {
      const [drops, tasks] = await Promise.all([
        q(sb.from("drops").select("*").order("sort")),
        q(sb.from("tasks").select("*").not("drop_id", "is", null).order("due_date")),
      ]);
      draw(drops, tasks);
    } catch (e) { errToast(e); }
  }

  async function move(d, dir) {
    const i = STAGES.findIndex(([s]) => s === d.stage) + dir;
    if (i < 0 || i >= STAGES.length) return;
    try { await q(sb.from("drops").update({ stage: STAGES[i][0] }).eq("id", d.id)); toast(`${d.name}: ${STAGES[i][1]}`); load(); }
    catch (e) { errToast(e); }
  }

  function draw(drops, tasks) {
    if (!drops.length) return body.replaceChildren(empty("Zatím žádný drop.", h("button.btn", { onclick: () => openDrop(null, load) }, "Přidat drop")));
    body.replaceChildren(h("div.drops", drops.map((d) => {
      const idx = STAGES.findIndex(([s]) => s === d.stage);
      const dt = tasks.filter((t) => t.drop_id === d.id);
      const open = dt.filter((t) => t.status !== "done");
      return h("article.drop-card",
        h("header",
          h("div", h("h2", d.name),
            h("p.muted", [d.launch_date ? `Start ${fmtDate(d.launch_date, { year: true })}` : "Bez termínu", d.pieces, state.isOwner && d.budget ? kc(d.budget) : null].filter(Boolean).join(" · "))),
          h("button.btn.ghost.small", { onclick: () => openDrop(d, load) }, "Upravit")),
        h("ol.track", { "aria-label": "Fáze dropu" }, STAGES.map(([s, label], i) =>
          h("li", { class: i < idx ? "past" : i === idx ? "now" : "", "aria-current": i === idx ? "step" : null }, h("span.stop"), h("span.lbl", label)))),
        h("div.track-move",
          h("button.btn.ghost.small", { disabled: idx === 0, onclick: () => move(d, -1) }, "◀ Zpět"),
          h("strong", STAGES[idx]?.[1]),
          h("button.btn.small", { disabled: idx === STAGES.length - 1, onclick: () => move(d, 1) }, "Další fáze ▶")),
        d.description ? h("p.drop-desc", d.description) : null,
        h("div.drop-tasks",
          h("h3", "Úkoly", h("span.count", `${dt.length - open.length}/${dt.length}`)),
          open.slice(0, 6).map((t) => taskRow(t, { onChange: load, drops })),
          !open.length && dt.length ? h("p.muted", "Všechny úkoly hotové.") : null,
          h("button.btn.ghost.small", { onclick: () => openTask({ drop_id: d.id }, load) }, "Přidat úkol k dropu")));
    })));
  }
  await load();
}
