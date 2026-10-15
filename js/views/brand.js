import { sb, q } from "../supabase.js";
import { h, state, modal, form, toast, errToast, pageHead, loading } from "../ui.js";
import { previewFile, thumb } from "./files.js";

export default async function view(root) {
  const body = h("div", loading());
  const editBtn = state.isOwner ? h("button.btn", { onclick: () => edit() }, "Upravit brand kit") : null;
  root.append(pageHead("Brand kit", "Jak MetroMood vypadá a mluví. Drž se toho ve všem, co děláš.", editBtn), body);
  let kit = {};

  async function load() {
    try {
      const row = (await q(sb.from("app_settings").select("value").eq("key", "brand_kit")))[0];
      kit = row?.value || {};
      const folder = (await q(sb.from("folders").select("id").eq("name", "Loga & brand").is("parent_id", null).limit(1)))[0];
      const logos = folder ? await q(sb.from("files").select("*").eq("folder_id", folder.id).order("created_at")) : [];
      draw(logos, folder);
    } catch (e) { errToast(e); }
  }

  function lines(s) { return (s || "").split("\n").map((x) => x.trim()).filter(Boolean); }

  function draw(logos, folder) {
    body.replaceChildren(h("div.brand",
      h("section.brand-hero",
        h("p.brand-tag", kit.tagline || "Doplň hlavní větu"),
        kit.positioning ? h("p.brand-pos", kit.positioning) : null),
      h("section.brand-grid",
        h("div.panel", h("h2", "Pro koho"), h("p", kit.audience || "–")),
        h("div.panel", h("h2", "Jak mluvíme"), h("p", kit.tone || "–")),
        h("div.panel", h("h2", "Děláme"), h("ul.ticks", lines(kit.dos).map((l) => h("li", l)))),
        h("div.panel", h("h2", "Neděláme"), h("ul.crosses", lines(kit.donts).map((l) => h("li", l))))),
      h("section.panel",
        h("h2", "Barvy"),
        h("div.swatches", (kit.colors || []).map((c) => h("button.swatch", {
          onclick: async () => { try { await navigator.clipboard.writeText(c.hex); toast(`${c.hex} zkopírováno`); } catch { toast(c.hex); } },
          "aria-label": `Zkopírovat ${c.name} ${c.hex}` },
          h("span.sw", { style: { background: c.hex } }), h("strong", c.name), h("small", c.hex)))),
        h("p.muted.small", "Klikni na barvu a zkopíruje se kód.")),
      h("section.brand-grid",
        h("div.panel", h("h2", "Písmo"), h("p", kit.fonts || "–")),
        h("div.panel", h("h2", "Účty a web"), h("p", kit.handles || "–"))),
      h("section.panel",
        h("div.panel-head", h("h2", "Loga a podklady"), folder ? h("a.more", { href: `#/soubory/${folder.id}` }, "Otevřít složku") : null),
        logos.length ? h("div.logo-grid", logos.map((f) => h("button.logo-tile", { onclick: () => previewFile(f) }, thumb(f), h("small", f.name))))
          : h("p.muted", "Nahraj loga do složky „Loga & brand“ v Souborech a objeví se tady."))));
  }

  function edit() {
    const f = form([
      { name: "tagline", label: "Hlavní věta" },
      { name: "positioning", label: "Pozicování", type: "textarea", rows: 3 },
      { name: "audience", label: "Pro koho", type: "textarea", rows: 2 },
      { name: "tone", label: "Jak mluvíme", type: "textarea", rows: 2 },
      { name: "dos", label: "Děláme (co řádek, to bod)", type: "textarea", rows: 3 },
      { name: "donts", label: "Neděláme (co řádek, to bod)", type: "textarea", rows: 3 },
      { name: "colors", label: "Barvy (řádek: Název #HEX)", type: "textarea", rows: 3 },
      { name: "fonts", label: "Písmo" },
      { name: "handles", label: "Účty a web" },
    ], { ...kit, colors: (kit.colors || []).map((c) => `${c.name} ${c.hex}`).join("\n") });
    const m = modal("Upravit brand kit", f, { wide: true, actions: [h("span.spacer"), h("button.btn.primary", { onclick: async () => {
      const v = f.values();
      v.colors = lines(v.colors).map((l) => { const mm = l.match(/^(.*?)\s*(#[0-9a-f]{3,8})$/i); return mm ? { name: mm[1] || mm[2], hex: mm[2] } : null; }).filter(Boolean);
      try {
        await q(sb.from("app_settings").upsert({ key: "brand_kit", value: v, updated_at: new Date().toISOString() }));
        m.close(); toast("Brand kit uložen"); load();
      } catch (e) { errToast(e); }
    } }, "Uložit")] });
  }
  await load();
}
