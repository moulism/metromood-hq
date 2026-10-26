import { sb, q } from "../supabase.js";
import { h, state, modal, form, toast, errToast, confirmDialog, pageHead, loading, empty, fmtDate, fmtSize, avatar } from "../ui.js";
import { signedUrl, uploadFile, deleteFile, isImage, isPdf, isVideo, fileIcon } from "../storage.js";
import { importFolder, fromInput, fromDrop } from "../folder-import.js";

export async function previewFile(f) {
  try {
    const url = await signedUrl(f.storage_path);
    const dl = await signedUrl(f.storage_path, { download: true });
    let body;
    if (isImage(f)) body = h("img.preview-img", { src: url, alt: f.name });
    else if (isPdf(f)) body = h("iframe.preview-pdf", { src: url, title: f.name });
    else if (isVideo(f)) body = h("video.preview-img", { src: url, controls: true });
    else body = h("p.muted", "Tenhle typ souboru se nedá zobrazit v prohlížeči. Stáhni si ho.");
    const who = state.member(f.uploaded_by);
    modal(f.name, [body, h("p.muted.small", [fmtSize(f.size), who ? `nahrál(a) ${who.display_name}` : null, fmtDate(f.created_at, { year: true })].filter(Boolean).join(" · ")),
      f.description ? h("p", f.description) : null], {
      wide: true,
      actions: [h("span.spacer"), h("a.btn", { href: url, target: "_blank", rel: "noopener" }, "Otevřít v nové záložce"), h("a.btn.primary", { href: dl }, "Stáhnout")],
    });
  } catch (e) { errToast(e); }
}

export function thumb(f) {
  const el = h("span.thumb", h("span.ext", fileIcon(f)));
  if (isImage(f)) signedUrl(f.storage_path).then((u) => { el.replaceChildren(h("img", { src: u, alt: "", loading: "lazy" })); }).catch(() => {});
  return el;
}

export default async function view(root, [folderId]) {
  const body = h("div", loading());
  const input = h("input", { type: "file", multiple: true, hidden: true, onchange: (e) => upload([...e.target.files]) });
  const dirInput = h("input", { type: "file", multiple: true, hidden: true, webkitdirectory: "", onchange: (e) => {
    const items = fromInput(e.target.files); dirInput.value = "";
    if (items.length) importFolder(items, current, load);
  } });
  let current = folderId || null;
  let folders = [], filesList = [];
  const crumbs = h("nav.crumbs", { "aria-label": "Cesta" });
  root.append(
    pageHead("Soubory", "Loga, návrhy, fotky, dokumenty. Přetáhni sem soubory nebo celou složku.",
      h("button.btn.ghost", { onclick: newFolder }, "Nová složka"),
      h("button.btn", { onclick: () => dirInput.click() }, "Nahrát složku"),
      h("button.btn.primary", { onclick: () => input.click() }, "Nahrát soubory"), input, dirInput),
    crumbs, body);

  const drop = async (e) => {
    e.preventDefault(); root.classList.remove("dragging");
    const files = [...e.dataTransfer.files];
    const tree = await fromDrop(e.dataTransfer.items || []).catch(() => null);
    if (tree) importFolder(tree, current, load);
    else if (files.length) upload(files);
  };
  const over = (e) => { e.preventDefault(); root.classList.add("dragging"); };
  const leave = (e) => { if (e.target === root) root.classList.remove("dragging"); };
  root.addEventListener("dragover", over); root.addEventListener("drop", drop); root.addEventListener("dragleave", leave);

  async function load() {
    try {
      [folders, filesList] = await Promise.all([
        q(sb.from("folders").select("*").order("sort").order("name")),
        q(current ? sb.from("files").select("*").eq("folder_id", current).order("created_at", { ascending: false })
          : sb.from("files").select("*").is("folder_id", null).order("created_at", { ascending: false })),
      ]);
      draw();
    } catch (e) { errToast(e); }
  }

  function path() {
    const out = [];
    let f = folders.find((x) => x.id === current);
    while (f) { out.unshift(f); f = folders.find((x) => x.id === f.parent_id); }
    return out;
  }

  function draw() {
    crumbs.replaceChildren(
      h("a", { href: "#/soubory" }, "Všechny složky"),
      path().map((f) => [h("span.sep", "/"), h("a", { href: `#/soubory/${f.id}` }, f.name)]));
    const sub = folders.filter((f) => (f.parent_id || null) === current);
    const here = folders.find((f) => f.id === current);
    body.replaceChildren(
      sub.length ? h("div.folders", sub.map((f) => h("a.folder", { href: `#/soubory/${f.id}` },
        h("span.folder-icon", f.icon || "▸"), h("span", f.name)))) : null,
      here ? h("div.folder-tools",
        h("button.btn.ghost.small", { onclick: () => renameFolder(here) }, "Přejmenovat složku"),
        h("button.btn.ghost.small.danger-text", { onclick: () => removeFolder(here) }, "Smazat složku")) : null,
      filesList.length ? h("div.files", filesList.map(fileRow))
        : current ? empty("Složka je prázdná. Přetáhni sem soubory.", h("button.btn", { onclick: () => input.click() }, "Nahrát soubory")) : null,
    );
  }

  function fileRow(f) {
    const who = state.member(f.uploaded_by);
    return h("div.file",
      h("button.file-main", { onclick: () => previewFile(f) }, thumb(f),
        h("span.file-text", h("span.file-name", f.name), h("small", [fmtSize(f.size), fmtDate(f.created_at)].join(" · ")))),
      who ? avatar(who, "sm") : null,
      h("button.icon-btn", { "aria-label": `Smazat ${f.name}`, onclick: async () => {
        if (!(await confirmDialog(`Smazat soubor „${f.name}“?`))) return;
        try { await deleteFile(f); toast("Soubor smazán"); load(); } catch (e) { errToast(e); }
      } }, "✕"));
  }

  async function upload(list) {
    if (!list.length) return;
    const bar = h("div.upload-bar", `Nahrávám ${list.length} ${list.length === 1 ? "soubor" : "souborů"}…`);
    body.prepend(bar);
    let ok = 0;
    for (const file of list) {
      try { await uploadFile(file, current); ok++; } catch (e) { errToast(e); }
    }
    toast(`Nahráno: ${ok}`);
    input.value = "";
    load();
  }

  function newFolder() {
    const f = form([{ name: "name", label: "Název složky", required: true }, { name: "icon", label: "Ikona (emoji, nepovinné)" }]);
    const m = modal("Nová složka", f, { actions: [h("span.spacer"), h("button.btn.primary", { onclick: async () => {
      if (!f.validate()) return;
      const v = f.values();
      try { await q(sb.from("folders").insert({ ...v, parent_id: current, created_by: state.me.id })); m.close(); load(); } catch (e) { errToast(e); }
    } }, "Vytvořit")] });
  }
  function renameFolder(fo) {
    const f = form([{ name: "name", label: "Název", required: true }, { name: "icon", label: "Ikona" }], fo);
    const m = modal("Přejmenovat složku", f, { actions: [h("span.spacer"), h("button.btn.primary", { onclick: async () => {
      if (!f.validate()) return;
      try { await q(sb.from("folders").update(f.values()).eq("id", fo.id)); m.close(); load(); } catch (e) { errToast(e); }
    } }, "Uložit")] });
  }
  async function removeFolder(fo) {
    const cnt = await q(sb.from("files").select("id", { count: "exact" }).eq("folder_id", fo.id));
    if (cnt.length || folders.some((x) => x.parent_id === fo.id)) return toast("Složka není prázdná. Nejdřív smaž soubory a podsložky.", "err");
    if (!(await confirmDialog(`Smazat složku „${fo.name}“?`))) return;
    try { await q(sb.from("folders").delete().eq("id", fo.id)); location.hash = fo.parent_id ? `#/soubory/${fo.parent_id}` : "#/soubory"; } catch (e) { errToast(e); }
  }

  await load();
  return () => { root.removeEventListener("dragover", over); root.removeEventListener("drop", drop); root.removeEventListener("dragleave", leave); root.classList.remove("dragging"); };
}
