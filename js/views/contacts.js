import { sb, q } from "../supabase.js";
import { h, state, modal, form, toast, errToast, confirmDialog, pageHead, chips, loading, empty } from "../ui.js";

export const KINDS = [
  ["vyrobce", "Výrobce"], ["fotograf", "Fotograf"], ["model", "Model/ka"], ["influencer", "Influencer"],
  ["umelec", "Umělec"], ["dj", "DJ"], ["podnik", "Podnik"], ["ostatni", "Ostatní"],
];

function openContact(c, onSaved) {
  const isNew = !c?.id;
  const f = form([
    { name: "name", label: "Jméno", required: true, half: true },
    { name: "kind", label: "Typ", type: "select", options: KINDS, half: true },
    { name: "company", label: "Firma / značka", half: true },
    { name: "status", label: "Stav", placeholder: "poptáno, spolupráce, čekáme…", half: true },
    { name: "email", label: "E-mail", type: "email", half: true },
    { name: "phone", label: "Telefon", type: "tel", half: true },
    { name: "instagram", label: "Instagram", placeholder: "@…", half: true },
    { name: "website", label: "Web", type: "url", half: true },
    { name: "notes", label: "Poznámky (ceny, MOQ, termíny, co jsme řešili)", type: "textarea", rows: 4 },
  ], { kind: "ostatni", ...c });
  const save = async () => {
    if (!f.validate()) return;
    try {
      if (isNew) await q(sb.from("contacts").insert({ ...f.values(), created_by: state.me.id }));
      else await q(sb.from("contacts").update(f.values()).eq("id", c.id));
      m.close(); toast("Kontakt uložen"); onSaved();
    } catch (e) { errToast(e); }
  };
  const m = modal(isNew ? "Nový kontakt" : c.name, f, { wide: true, actions: [
    !isNew ? h("button.btn.ghost.danger-text", { onclick: async () => {
      if (!(await confirmDialog(`Smazat kontakt „${c.name}“?`))) return;
      try { await q(sb.from("contacts").delete().eq("id", c.id)); m.close(); onSaved(); } catch (e) { errToast(e); }
    } }, "Smazat") : null,
    h("span.spacer"), h("button.btn.primary", { onclick: save }, isNew ? "Přidat kontakt" : "Uložit")] });
}

export default async function view(root) {
  let kind = "", search = "", all = [];
  const body = h("div", loading());
  const s = h("input.search", { type: "search", placeholder: "Hledat jméno, firmu, poznámku…", "aria-label": "Hledat",
    oninput: (e) => { search = e.target.value.toLowerCase(); draw(); } });
  root.append(pageHead("Kontakty", "Výrobci, fotografové, modelové, influenceři – s poznámkou, co s nimi řešíme.",
    h("button.btn.primary", { onclick: () => openContact(null, load) }, "Nový kontakt")),
    h("div.toolbar", chips([["", "Všichni"], ...KINDS], kind, (v) => { kind = v; draw(); }), s), body);

  async function load() {
    try { all = await q(sb.from("contacts").select("*").order("name")); draw(); } catch (e) { errToast(e); }
  }
  function draw() {
    const list = all.filter((c) => (!kind || c.kind === kind) &&
      (!search || [c.name, c.company, c.notes, c.status, c.instagram].join(" ").toLowerCase().includes(search)));
    if (!list.length) return body.replaceChildren(empty("Nic tu není.", h("button.btn", { onclick: () => openContact(null, load) }, "Přidat kontakt")));
    body.replaceChildren(h("div.contacts", list.map((c) => h("article.contact",
      h("button.contact-main", { onclick: () => openContact(c, load) },
        h("span.kind", KINDS.find(([k]) => k === c.kind)?.[1]),
        h("strong", c.name),
        c.company && c.company !== c.name ? h("span.muted", c.company) : null,
        c.status ? h("span.tag", c.status) : null,
        c.notes ? h("p.small.clamp", c.notes) : null),
      h("div.contact-links",
        c.email ? h("a", { href: `mailto:${c.email}` }, c.email) : null,
        c.phone ? h("a", { href: `tel:${c.phone.replace(/\s/g, "")}` }, c.phone) : null,
        c.instagram ? h("a", { href: `https://instagram.com/${c.instagram.replace(/^@/, "")}`, target: "_blank", rel: "noopener" }, c.instagram) : null,
        c.website ? h("a", { href: c.website, target: "_blank", rel: "noopener" }, c.website.replace(/^https?:\/\/(www\.)?/, "")) : null)))));
  }
  await load();
}
