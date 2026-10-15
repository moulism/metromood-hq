import { sb, q } from "../supabase.js";
import { BUCKET } from "../config.js";
import { h, state, modal, form, toast, errToast, confirmDialog, pageHead, chips, loading, empty, avatar, fmtDate, linkify } from "../ui.js";
import { signedUrl } from "../storage.js";

const STATUS = [["novy", "Nový"], ["zvazujeme", "Zvažujeme"], ["delame", "Děláme"], ["zamitnuto", "Zamítnuto"]];

function openIdea(idea, onSaved) {
  const isNew = !idea?.id;
  const f = form([
    { name: "title", label: "Nápad", required: true },
    { name: "body", label: "Popis", type: "textarea", rows: 4 },
    { name: "link", label: "Odkaz na inspiraci", type: "url", placeholder: "https://…" },
    { name: "status", label: "Stav", type: "select", options: STATUS },
  ], { status: "novy", ...idea });
  const img = h("input", { type: "file", accept: "image/*" });
  f.append(h("label.field", h("span", isNew ? "Obrázek (nepovinný)" : "Nahradit obrázek"), img));
  const save = async () => {
    if (!f.validate()) return;
    const v = f.values();
    try {
      const file = img.files[0];
      if (file) {
        const path = `ideas/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
        const { error } = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type });
        if (error) throw error;
        v.image_path = path;
      }
      if (isNew) await q(sb.from("ideas").insert({ ...v, created_by: state.me.id }));
      else await q(sb.from("ideas").update(v).eq("id", idea.id));
      m.close(); toast("Nápad uložen"); onSaved();
    } catch (e) { errToast(e); }
  };
  const m = modal(isNew ? "Nový nápad" : "Upravit nápad", f, { actions: [
    !isNew ? h("button.btn.ghost.danger-text", { onclick: async () => {
      if (!(await confirmDialog(`Smazat nápad „${idea.title}“?`))) return;
      try { await q(sb.from("ideas").delete().eq("id", idea.id)); if (idea.image_path) await sb.storage.from(BUCKET).remove([idea.image_path]); m.close(); onSaved(); } catch (e) { errToast(e); }
    } }, "Smazat") : null,
    h("span.spacer"), h("button.btn.primary", { onclick: save }, isNew ? "Přidat nápad" : "Uložit")] });
}

export default async function view(root) {
  let filter = "open";
  const body = h("div", loading());
  root.append(pageHead("Nápady", "Inspirace, moodboard, návrhy na dropy a akce. Hlasuj pro to, co se ti líbí.",
    h("button.btn.primary", { onclick: () => openIdea(null, load) }, "Nový nápad")),
    h("div.toolbar", chips([["open", "Otevřené"], ["delame", "Děláme"], ["all", "Všechny"]], filter, (v) => { filter = v; load(); })),
    body);

  async function load() {
    try {
      const [ideas, votes] = await Promise.all([
        q(sb.from("ideas").select("*").order("created_at", { ascending: false })),
        q(sb.from("idea_votes").select("*")),
      ]);
      const list = ideas.filter((i) => filter === "all" || (filter === "open" ? ["novy", "zvazujeme"].includes(i.status) : i.status === filter))
        .map((i) => ({ ...i, votes: votes.filter((v) => v.idea_id === i.id) }))
        .sort((a, b) => b.votes.length - a.votes.length);
      draw(list);
    } catch (e) { errToast(e); }
  }

  async function vote(i) {
    const mine = i.votes.some((v) => v.member_id === state.me.id);
    try {
      if (mine) await q(sb.from("idea_votes").delete().eq("idea_id", i.id).eq("member_id", state.me.id));
      else await q(sb.from("idea_votes").insert({ idea_id: i.id, member_id: state.me.id }));
      load();
    } catch (e) { errToast(e); }
  }

  function draw(list) {
    if (!list.length) return body.replaceChildren(empty("Žádné nápady. Hoď sem první.", h("button.btn", { onclick: () => openIdea(null, load) }, "Přidat nápad")));
    body.replaceChildren(h("div.ideas", list.map((i) => {
      const mine = i.votes.some((v) => v.member_id === state.me.id);
      const imgBox = i.image_path ? h("div.idea-img") : null;
      if (imgBox) signedUrl(i.image_path).then((u) => imgBox.append(h("img", { src: u, alt: "", loading: "lazy" }))).catch(() => {});
      return h("article.idea", { class: `st-${i.status}` },
        imgBox,
        h("div.idea-body",
          h("h3", i.title),
          i.body ? h("p", { html: linkify(i.body) }) : null,
          i.link ? h("a.small", { href: i.link, target: "_blank", rel: "noopener" }, i.link.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)) : null),
        h("footer",
          h("button.vote", { "aria-pressed": String(mine), onclick: () => vote(i), "aria-label": mine ? "Zrušit hlas" : "Hlasovat" },
            h("span", "▲"), i.votes.length),
          h("span.vote-who", i.votes.map((v) => avatar(state.member(v.member_id), "xs"))),
          h("span.spacer"),
          h("span.tag", STATUS.find(([s]) => s === i.status)?.[1]),
          avatar(state.member(i.created_by), "sm"),
          h("button.icon-btn", { "aria-label": "Upravit", onclick: () => openIdea(i, load) }, "✎")));
    })));
  }
  await load();
}
