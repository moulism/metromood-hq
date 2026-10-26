// Nahrání celé složky z počítače i s podsložkami (např. Desktop/FOLDER/work/MetroMood).
// – zachová strukturu složek, přeskočí systémové soubory (.DS_Store, ~$…)
// – soubory, které už v dané složce jsou (stejný název + velikost), přeskočí → dá se kdykoli spustit znovu a dokončit
// – hlídá limit 50 MB na soubor a celkové místo ve storage
import { sb, q } from "./supabase.js";
import { h, state, modal, toast, errToast, fmtSize } from "./ui.js";
import { uploadFile } from "./storage.js";
const cnt = (n) => `${n} ${n === 1 ? "soubor" : n >= 2 && n <= 4 ? "soubory" : "souborů"}`;
import { MAX_FILE_BYTES, STORAGE_LIMIT_BYTES } from "./config.js";

const JUNK = /(^|\/)(\.DS_Store|\.localized|Thumbs\.db|desktop\.ini|~\$[^/]*|\._[^/]*)$/i;
const PARALLEL = 3;

/** Z <input webkitdirectory> → [{ file, path: "MetroMood/pics/x.jpg" }] */
export function fromInput(fileList) {
  return [...fileList].map((file) => ({ file, path: file.webkitRelativePath || file.name }));
}

/** Z drag & drop (DataTransferItemList) → stejné pole; projde i podsložky. */
export async function fromDrop(items) {
  const entries = [...items].map((i) => i.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.some((e) => e.isDirectory)) return null; // obyčejné soubory řeší běžný upload
  const out = [];
  const readAll = (reader) => new Promise((res, rej) => {
    const acc = [];
    const next = () => reader.readEntries((batch) => { if (!batch.length) return res(acc); acc.push(...batch); next(); }, rej);
    next();
  });
  async function walk(entry, prefix) {
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ file, path: prefix + entry.name });
    } else if (entry.isDirectory) {
      for (const child of await readAll(entry.createReader())) await walk(child, `${prefix}${entry.name}/`);
    }
  }
  for (const e of entries) await walk(e, "");
  return out;
}

async function usedBytes() {
  const rows = await q(sb.from("files").select("size"));
  return rows.reduce((s, r) => s + (Number(r.size) || 0), 0);
}

/** Otevře náhled importu a po potvrzení nahraje. parentId = složka, do které se to vloží (null = kořen). */
export async function importFolder(items, parentId, onDone) {
  items = items.filter((x) => !JUNK.test(x.path) && x.file.size > 0);
  if (!items.length) return toast("Ve složce nejsou žádné soubory.", "err");

  const tooBig = items.filter((x) => x.file.size > MAX_FILE_BYTES);
  const ok = items.filter((x) => x.file.size <= MAX_FILE_BYTES);
  const rootName = items[0].path.split("/")[0];

  // skupiny podle první podsložky (pics, vids, designs…)
  const groups = new Map();
  for (const x of ok) {
    const parts = x.path.split("/");
    const key = parts.length > 2 ? parts[1] : "(soubory v hlavní složce)";
    const g = groups.get(key) || { key, items: [], bytes: 0, on: true };
    g.items.push(x); g.bytes += x.file.size; groups.set(key, g);
  }
  const used = await usedBytes().catch(() => 0);
  const free = Math.max(0, STORAGE_LIMIT_BYTES - used);

  const sumEl = h("p.import-sum");
  const startBtn = h("button.btn.primary", { onclick: start }, "Nahrát");
  const list = h("div.import-groups", [...groups.values()].sort((a, b) => a.key.localeCompare(b.key, "cs")).map((g) =>
    h("label.import-group",
      h("input", { type: "checkbox", checked: true, onchange: (e) => { g.on = e.target.checked; recalc(); } }),
      h("span.import-name", g.key),
      h("span.muted.small", `${cnt(g.items.length)} · ${fmtSize(g.bytes)}`))));

  function selected() { return [...groups.values()].filter((g) => g.on).flatMap((g) => g.items); }
  function recalc() {
    const bytes = selected().reduce((s, x) => s + x.file.size, 0);
    const over = bytes > free;
    sumEl.replaceChildren(
      h("strong", `Vybráno: ${cnt(selected().length)} · ${fmtSize(bytes)}`),
      h("br"),
      h("span", { class: over ? "danger-text" : "muted" },
        `Volné místo: ${fmtSize(free)} z ${fmtSize(STORAGE_LIMIT_BYTES)}` + (over ? " – nevejde se, odškrtni některé složky." : "")));
    startBtn.disabled = over || !selected().length;
  }
  recalc();

  const m = modal(`Nahrát složku „${rootName}“`, [
    h("p", "Složka se nahraje i s podsložkami, struktura zůstane stejná. Soubory, které už v HQ jsou, se přeskočí – když se nahrávání přeruší, stačí ho spustit znovu."),
    list, sumEl,
    tooBig.length ? h("details.import-skip",
      h("summary", `${cnt(tooBig.length)} nad ${fmtSize(MAX_FILE_BYTES)} – takhle velké soubory free plán Supabase nepustí, přeskočí se (${fmtSize(tooBig.reduce((s, x) => s + x.file.size, 0))})`),
      h("ul.small", tooBig.map((x) => h("li", `${x.path} – ${fmtSize(x.file.size)}`)))) : null,
  ], { wide: true, actions: [h("span.spacer"), startBtn] });

  async function start() {
    const todo = selected();
    m.close();
    await run(todo, parentId, rootName, onDone);
  }
}

async function run(todo, parentId, rootName, onDone) {
  const total = todo.length, totalBytes = todo.reduce((s, x) => s + x.file.size, 0);
  let done = 0, doneBytes = 0, skipped = 0, failed = [], cancelled = false;
  const bar = h("div.import-bar-fill");
  const label = h("span");
  const panel = h("div.import-progress", { role: "status", "aria-live": "polite" },
    h("div.import-head", h("strong", `Nahrávám „${rootName}“`),
      h("button.btn.ghost.small", { onclick: () => { cancelled = true; label.textContent = "Zastavuji…"; } }, "Zastavit")),
    h("div.import-bar", bar), label);
  document.body.append(panel);
  const guard = (e) => { e.preventDefault(); e.returnValue = ""; };
  window.addEventListener("beforeunload", guard);
  const paint = () => {
    bar.style.width = `${totalBytes ? (doneBytes / totalBytes) * 100 : 100}%`;
    label.textContent = `${done} / ${cnt(total)} · ${fmtSize(doneBytes)} z ${fmtSize(totalBytes)}` + (skipped ? ` · ${skipped} už tam bylo` : "") + (failed.length ? ` · ${failed.length} chyb` : "");
  };
  paint();

  try {
    // 1) složky – najdi existující, chybějící založ
    const all = await q(sb.from("folders").select("id,name,parent_id"));
    const idOf = new Map(); // "a/b/c" → id
    async function ensure(pathStr) {
      if (idOf.has(pathStr)) return idOf.get(pathStr);
      const parts = pathStr.split("/");
      const name = parts.pop();
      const parent = parts.length ? await ensure(parts.join("/")) : parentId || null;
      let f = all.find((x) => x.name === name && (x.parent_id || null) === parent);
      if (!f) {
        f = (await q(sb.from("folders").insert({ name, parent_id: parent, icon: parts.length ? null : "▸", sort: 60, created_by: state.me.id }).select("id,name,parent_id")))[0];
        all.push(f);
      }
      idOf.set(pathStr, f.id);
      return f.id;
    }
    const dirs = [...new Set(todo.map((x) => x.path.split("/").slice(0, -1).join("/")))].sort();
    for (const d of dirs) await ensure(d);

    // 2) co už je nahrané
    const ids = [...new Set(idOf.values())];
    const existing = new Set();
    for (let i = 0; i < ids.length; i += 100) {
      const rows = await q(sb.from("files").select("folder_id,name,size").in("folder_id", ids.slice(i, i + 100)));
      rows.forEach((r) => existing.add(`${r.folder_id}|${r.name}|${r.size}`));
    }

    // 3) nahrávání, 3 souběžně
    const queue = todo.slice();
    async function worker() {
      while (queue.length && !cancelled) {
        const x = queue.shift();
        const folderId = idOf.get(x.path.split("/").slice(0, -1).join("/"));
        if (existing.has(`${folderId}|${x.file.name}|${x.file.size}`)) skipped++;
        else {
          try { await uploadFile(x.file, folderId); }
          catch (e) {
            // jeden pokus navíc (výpadek sítě)
            try { await uploadFile(x.file, folderId); } catch (e2) { failed.push(`${x.path}: ${e2.message || e2}`); }
          }
        }
        done++; doneBytes += x.file.size; paint();
      }
    }
    await Promise.all(Array.from({ length: PARALLEL }, worker));
  } catch (e) { errToast(e); }
  finally {
    window.removeEventListener("beforeunload", guard);
    panel.remove();
  }

  const uploaded = done - skipped - failed.length;
  toast(cancelled ? `Zastaveno. Nahráno ${uploaded}, zbytek dokončíš novým spuštěním.` : `Hotovo: nahráno ${uploaded}${skipped ? `, přeskočeno ${skipped}` : ""}${failed.length ? `, chyby ${failed.length}` : ""}`, failed.length ? "err" : "ok");
  if (failed.length) modal("Tyhle soubory se nenahrály", [h("p", "Zkus nahrání složky spustit znovu – nahrají se jen chybějící."), h("ul.small", failed.map((f) => h("li", f)))]);
  onDone?.();
}
