import { sb, q } from "../supabase.js";
import { h, state, modal, form, toast, errToast, confirmDialog, pageHead, loading, avatar, memberOptions, fmtDate, startOfWeek, ymd, parseDate } from "../ui.js";

const STATUS = [["napad", "Nápad"], ["natoceno", "Natočeno"], ["sestrihano", "Sestříháno"], ["venku", "Venku"]];
const PLATFORM = [["oboje", "TikTok + Reels"], ["tiktok", "TikTok"], ["instagram", "Instagram"]];
const FORMAT = [["video", "Video"], ["foto", "Fotka / carousel"], ["story", "Story"]];

function openPost(p, onSaved) {
  const isNew = !p?.id;
  const f = form([
    { name: "title", label: "O čem to je", required: true },
    { name: "platform", label: "Kam", type: "select", options: PLATFORM, half: true },
    { name: "format", label: "Formát", type: "select", options: FORMAT, half: true },
    { name: "planned_date", label: "Kdy publikovat", type: "date", half: true },
    { name: "status", label: "Stav", type: "select", options: STATUS, half: true },
    { name: "owner_id", label: "Kdo to má na starosti", type: "select", options: memberOptions() },
    { name: "link", label: "Odkaz na příspěvek", type: "url", placeholder: "https://…" },
    { name: "notes", label: "Scénář, poznámky", type: "textarea", rows: 4 },
  ], { platform: "oboje", format: "video", status: "napad", ...p });
  const save = async () => {
    if (!f.validate()) return;
    try {
      if (isNew) await q(sb.from("content_posts").insert(f.values()));
      else await q(sb.from("content_posts").update(f.values()).eq("id", p.id));
      m.close(); toast("Uloženo"); onSaved();
    } catch (e) { errToast(e); }
  };
  const m = modal(isNew ? "Nový příspěvek" : "Upravit příspěvek", f, { actions: [
    !isNew ? h("button.btn.ghost.danger-text", { onclick: async () => {
      if (!(await confirmDialog(`Smazat „${p.title}“?`))) return;
      try { await q(sb.from("content_posts").delete().eq("id", p.id)); m.close(); onSaved(); } catch (e) { errToast(e); }
    } }, "Smazat") : null,
    h("span.spacer"), h("button.btn.primary", { onclick: save }, isNew ? "Přidat" : "Uložit")] });
}

export default async function view(root) {
  const body = h("div", loading());
  const weekBox = h("div.content-week");
  root.append(pageHead("Obsah", "Plán videí na TikTok a Reels. Cíl podle plánu: 4 videa týdně.",
    h("button.btn.primary", { onclick: () => openPost(null, load) }, "Nový příspěvek")), weekBox, body);

  async function load() {
    try { draw(await q(sb.from("content_posts").select("*").order("planned_date", { nullsFirst: false }).order("created_at"))); }
    catch (e) { errToast(e); }
  }

  async function setStatus(p, dir) {
    const i = STATUS.findIndex(([s]) => s === p.status) + dir;
    if (i < 0 || i >= STATUS.length) return;
    try { await q(sb.from("content_posts").update({ status: STATUS[i][0] }).eq("id", p.id)); load(); } catch (e) { errToast(e); }
  }

  function draw(posts) {
    // týdenní pás: 4 týdny dozadu + tento + 3 dopředu
    const wk = startOfWeek();
    const weeks = [];
    for (let i = -3; i <= 3; i++) {
      const s = new Date(wk); s.setDate(s.getDate() + i * 7);
      const e = new Date(s); e.setDate(s.getDate() + 7);
      const inW = posts.filter((p) => p.planned_date && parseDate(p.planned_date) >= s && parseDate(p.planned_date) < e);
      const out = inW.filter((p) => p.status === "venku").length;
      weeks.push(h("div.wk", { class: `${i === 0 ? "now" : ""} ${i < 0 ? "past" : ""}` },
        h("span.wk-bar", h("span", { style: { height: `${Math.min(100, (Math.max(out, i > 0 ? inW.length : out) / 4) * 100)}%` }, class: out >= 4 ? "ok" : "" })),
        h("strong", i > 0 ? `${inW.length}` : `${out}`),
        h("small", i === 0 ? "tento týden" : fmtDate(ymd(s)))));
    }
    weekBox.replaceChildren(h("p.muted.small", "Venku za týden (budoucí týdny: naplánováno). Linka = cíl 4."), h("div.wk-strip", weeks));

    body.replaceChildren(h("div.board.board-4", STATUS.map(([s, label], si) => {
      const items = posts.filter((p) => p.status === s);
      return h("section.col", h("h3", label, h("span.count", items.length)),
        items.map((p) => h("article.post", { class: `st-${p.status}` },
          h("button.post-main", { onclick: () => openPost(p, load) },
            h("span.post-title", p.title),
            h("span.task-meta",
              p.planned_date ? h("span.due", fmtDate(p.planned_date, { weekday: true })) : h("span.due.muted", "bez data"),
              h("span.tag", PLATFORM.find(([k]) => k === p.platform)?.[1] || p.platform))),
          h("div.post-foot",
            avatar(state.member(p.owner_id), "sm"),
            h("span.spacer"),
            si > 0 ? h("button.icon-btn", { "aria-label": "O krok zpět", onclick: () => setStatus(p, -1) }, "◀") : null,
            si < STATUS.length - 1 ? h("button.icon-btn", { "aria-label": `Posunout na ${STATUS[si + 1][1]}`, onclick: () => setStatus(p, 1) }, "▶") : null,
            p.link ? h("a.icon-btn", { href: p.link, target: "_blank", rel: "noopener", "aria-label": "Otevřít příspěvek" }, "↗") : null))));
    })));
  }
  await load();
}
