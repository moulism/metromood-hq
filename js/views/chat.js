import { sb, q } from "../supabase.js";
import { h, state, modal, form, toast, errToast, confirmDialog, avatar, fmtTime, fmtDate, ymd, linkify, loading } from "../ui.js";
import { uploadFile, folderByName, signedUrl, isImage } from "../storage.js";
import { previewFile, thumb } from "./files.js";

export default async function view(root, [channelId]) {
  const channels = await q(sb.from("channels").select("*").order("sort").order("created_at"));
  let current = channels.find((c) => c.id === channelId) || channels[0];
  let sub = null;
  const filesById = new Map();

  const list = h("div.msgs", { role: "log", "aria-live": "polite" });
  const ta = h("textarea", { rows: 1, placeholder: "Napiš zprávu…", "aria-label": "Zpráva" });
  const fileInput = h("input", { type: "file", hidden: true, onchange: (e) => sendFile(e.target.files[0]) });
  const head = h("header.chat-head");
  const side = h("nav.chan-list", { "aria-label": "Kanály" });

  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  });
  ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; });

  root.classList.add("view-chat");
  root.append(h("div.chat",
    side,
    h("section.chat-main", head, list,
      h("form.composer", { onsubmit: (e) => { e.preventDefault(); send(); } },
        h("button.icon-btn", { type: "button", "aria-label": "Přiložit soubor", onclick: () => fileInput.click() }, "+"),
        ta, fileInput,
        h("button.btn.primary", { type: "submit" }, "Odeslat")))));

  function drawSide() {
    side.replaceChildren(
      ...channels.map((c) => h("a.chan", { href: `#/chat/${c.id}`, class: c.id === current?.id ? "active" : "" }, `# ${c.name}`)),
      h("button.chan.add", { onclick: newChannel }, "+ nový kanál"));
    head.replaceChildren(h("div", h("h1", `# ${current?.name || ""}`), current?.description ? h("p.sub", current.description) : null));
  }

  function newChannel() {
    const f = form([{ name: "name", label: "Název kanálu", required: true, placeholder: "např. focení" }, { name: "description", label: "Popis" }]);
    const m = modal("Nový kanál", f, { actions: [h("span.spacer"), h("button.btn.primary", { onclick: async () => {
      if (!f.validate()) return;
      const v = f.values(); v.name = v.name.replace(/^#/, "").trim().toLowerCase().replace(/\s+/g, "-");
      try { const r = await q(sb.from("channels").insert({ ...v, sort: channels.length }).select()); m.close(); location.hash = `#/chat/${r[0].id}`; } catch (e) { errToast(e); }
    } }, "Vytvořit")] });
  }

  async function loadMsgs() {
    if (!current) return;
    list.replaceChildren(loading());
    const rows = await q(sb.from("messages").select("*").eq("channel_id", current.id).order("created_at", { ascending: false }).limit(200));
    rows.reverse();
    const fids = rows.map((r) => r.file_id).filter(Boolean);
    if (fids.length) (await q(sb.from("files").select("*").in("id", fids))).forEach((f) => filesById.set(f.id, f));
    list.replaceChildren();
    if (!rows.length) list.append(h("p.chat-empty", `Začátek kanálu #${current.name}. Napiš první zprávu.`));
    let prev = null;
    for (const m of rows) { list.append(msgEl(m, prev)); prev = m; }
    if (prev) { lastAuthor = prev.author_id; lastAt = prev.created_at; }
    list.scrollTop = list.scrollHeight;
  }

  function msgEl(m, prev) {
    const who = state.member(m.author_id);
    const grouped = prev && prev.author_id === m.author_id && new Date(m.created_at) - new Date(prev.created_at) < 5 * 60e3;
    const newDay = !prev || ymd(prev.created_at) !== ymd(m.created_at);
    const f = m.file_id ? filesById.get(m.file_id) : null;
    const mine = m.author_id === state.me.id;
    let attach = null;
    if (f) {
      if (isImage(f)) {
        attach = h("button.msg-img", { onclick: () => previewFile(f), "aria-label": `Otevřít ${f.name}` });
        signedUrl(f.storage_path).then((u) => attach.append(h("img", { src: u, alt: f.name, loading: "lazy" }))).catch(() => {});
      } else attach = h("button.msg-file", { onclick: () => previewFile(f) }, thumb(f), h("span", f.name));
    }
    return h("div.msg-wrap",
      newDay ? h("div.day-sep", h("span", fmtDate(m.created_at, { weekday: true }))) : null,
      h("div.msg", { class: `${grouped && !newDay ? "grouped" : ""} ${mine ? "mine" : ""}`, "data-id": m.id },
        grouped && !newDay ? h("span.avatar-space") : avatar(who),
        h("div.msg-body",
          grouped && !newDay ? null : h("div.msg-meta", h("strong", who?.display_name || "Bývalý člen"), h("small", fmtTime(m.created_at))),
          m.body ? h("div.msg-text", { html: linkify(m.body) }) : null,
          attach),
        mine || state.isOwner ? h("button.icon-btn.msg-del", { "aria-label": "Smazat zprávu", onclick: async () => {
          if (!(await confirmDialog("Smazat zprávu?"))) return;
          try { await q(sb.from("messages").delete().eq("id", m.id)); loadMsgs(); } catch (e) { errToast(e); }
        } }, "✕") : null));
  }

  async function send() {
    const body = ta.value.trim();
    if (!body || !current) return;
    ta.value = ""; ta.style.height = "auto";
    try { await q(sb.from("messages").insert({ channel_id: current.id, author_id: state.me.id, body })); }
    catch (e) { errToast(e); ta.value = body; }
  }

  async function sendFile(file) {
    if (!file) return;
    try {
      toast("Nahrávám přílohu…");
      const folder = await folderByName("Z chatu", "💬");
      const f = await uploadFile(file, folder.id);
      filesById.set(f.id, f);
      await q(sb.from("messages").insert({ channel_id: current.id, author_id: state.me.id, body: ta.value.trim() || "", file_id: f.id }));
      ta.value = "";
    } catch (e) { errToast(e); }
    fileInput.value = "";
  }

  function subscribe() {
    sub?.unsubscribe();
    sub = sb.channel(`chat-${current.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${current.id}` }, async (p) => {
        const m = p.new;
        if (m.file_id && !filesById.has(m.file_id)) {
          const r = await q(sb.from("files").select("*").eq("id", m.file_id)); if (r[0]) filesById.set(r[0].id, r[0]);
        }
        list.querySelector(".chat-empty")?.remove();
        const prevRow = lastAt ? { author_id: lastAuthor, created_at: lastAt } : null;
        list.append(msgEl(m, prevRow));
        lastAuthor = m.author_id; lastAt = m.created_at;
        list.scrollTop = list.scrollHeight;
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (p) => {
        list.querySelector(`.msg[data-id="${p.old.id}"]`)?.closest(".msg-wrap")?.remove();
      })
      .subscribe();
  }
  let lastAuthor = null, lastAt = null;

  drawSide();
  if (!current) { list.append(h("p.chat-empty", "Žádný kanál. Vytvoř první.")); return; }
  await loadMsgs();
  subscribe();
  ta.focus();
  return () => { sub?.unsubscribe(); root.classList.remove("view-chat"); };
}
