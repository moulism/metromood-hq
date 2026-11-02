// Tech packy – technická dokumentace ke každému kusu + export do PDF pro výrobce.
import { sb, q } from "../supabase.js";
import { BUCKET } from "../config.js";
import { h, state, modal, form, toast, errToast, confirmDialog, pageHead, loading, empty, fmtDate } from "../ui.js";
import { CATEGORIES, catLabel, FITS, SRC, STATUSES, defaultsFor, grade, SIZES } from "../techpack/defaults.js";
import { flatSVG, hasTemplate } from "../techpack/flats.js";
import { buildHTML, printInWindow, tbcList, sizesOf, flatsOf } from "../techpack/pdf.js";
import { buildPrompt, mergeAI } from "../techpack/ai.js";

const TABS = [
  ["prehled", "Přehled & fotky"], ["nakresy", "Nákresy & callouty"], ["materialy", "Materiály (BOM)"], ["barvy", "Barvy"],
  ["velikosti", "Velikosti"], ["konstrukce", "Konstrukce"], ["branding", "Logo & branding"], ["stitky", "Štítky & balení"],
  ["kvalita", "Kontrola kvality"], ["shrnuti", "Shrnutí & export"],
];

// ---------- storage ----------
const urlCache = new Map();
async function signUrls(paths) {
  const need = [...new Set(paths.filter((p) => p && !(urlCache.get(p)?.exp > Date.now())))];
  if (need.length) {
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrls(need, 3600);
    if (error) throw error;
    data.forEach((r) => r.signedUrl && urlCache.set(r.path, { url: r.signedUrl, exp: Date.now() + 55 * 60e3 }));
  }
  const out = {};
  paths.forEach((p) => { if (p && urlCache.get(p)) out[p] = urlCache.get(p).url; });
  return out;
}
const urlOf = (p) => urlCache.get(p)?.url || "";

async function shrink(file, max = 2200) {
  if (!/^image\/(jpeg|png|webp|heic)/.test(file.type) || file.type === "image/png" && file.size < 1.5e6) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 2.5e6) return file;
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.86));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }) : file;
  } catch { return file; }
}
async function upload(tpId, file) {
  const f = await shrink(file);
  const ext = (f.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `techpacks/${tpId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type || "application/octet-stream" });
  if (error) throw new Error(error.message?.includes("exceeded") ? `${file.name} je moc velký (max 50 MB).` : error.message);
  await signUrls([path]);
  return path;
}
// Smaže soubor jen když na něj neodkazuje jiný tech pack (kopie sdílí fotky).
async function releasePath(path, selfId) {
  try {
    const rows = await q(sb.from("tech_packs").select("id,data").neq("id", selfId));
    if (rows.some((r) => JSON.stringify(r.data).includes(path))) return;
    await sb.storage.from(BUCKET).remove([path]);
  } catch (e) { console.warn(e); }
}
/** Smaže tech pack; soubory uklidí na pozadí (kopie můžou sdílet fotky). */
async function deletePack(tp) {
  const d = tp.data || {};
  const own = [...(d.photos || []).map((p) => p.path), ...(d.flats || []).map((f) => f.path), ...(d.branding || []).map((b) => b.artwork)].filter(Boolean);
  const gone = await q(sb.from("tech_packs").delete().eq("id", tp.id).select("id"));
  if (!gone?.length) throw new Error("Tech pack se nepodařilo smazat (nemáš oprávnění, nebo už neexistuje).");
  toast(`„${tp.name}“ smazán`);
  (async () => { for (const p of own) await releasePath(p, tp.id); })();
}
function pickFiles(accept, multiple, cb) {
  const i = h("input", { type: "file", accept, multiple, hidden: true, onchange: () => { cb([...i.files]); i.remove(); } });
  document.body.appendChild(i); i.click();
}

// ---------- vstup ----------
export default async function view(root, params = []) {
  if (params[0]) return editor(root, params[0]);
  return list(root);
}

// ---------- seznam ----------
async function list(root) {
  const body = h("div", loading());
  root.append(pageHead("Tech packy", "Technická dokumentace ke každému kusu. Vyplníš, nahraješ fotky a exportuješ PDF pro výrobce.",
    h("button.btn.primary", { onclick: () => create() }, "Nový tech pack")), body);
  let drops = [];

  async function create(src) {
    const f = form([
      { name: "name", label: "Název kusu", required: true, placeholder: "Crown Hoodie" },
      { name: "sku", label: "SKU / kód", placeholder: "MM-D02-HD01", half: true },
      { name: "category", label: "Kategorie", type: "select", options: CATEGORIES, half: true },
      { name: "drop_id", label: "Drop", type: "select", options: [["", "— bez dropu —"], ...drops.map((d) => [d.id, d.name])] },
    ], src ? { name: `${src.name} (kopie)`, sku: src.sku, category: src.category, drop_id: src.drop_id } : { category: "hoodie" });
    const m = modal(src ? "Duplikovat tech pack" : "Nový tech pack", [
      src ? h("p.muted", "Kopie převezme všechny údaje i fotky – hodí se na další barevnou variantu.") : h("p.muted", "Podle kategorie se předvyplní nákresy, velikostní tabulka, materiály a konstrukce jako návrh (PROPOSED)."),
      f], {
      actions: [h("span.spacer"), h("button.btn.primary", { onclick: async () => {
        if (!f.validate()) return;
        const v = f.values();
        try {
          const data = src ? structuredClone(src.data) : defaultsFor(v.category);
          if (!src && hasTemplate(v.category)) data.flats = [{ kind: "tpl", view: "front", label: "Front" }, { kind: "tpl", view: "back", label: "Back" }];
          const row = (await q(sb.from("tech_packs").insert({ ...v, data, version: "v1.0", created_by: state.me.id }).select()))[0];
          m.close(); location.hash = `#/techpack/${row.id}`;
        } catch (e) { errToast(e); }
      } }, src ? "Duplikovat" : "Vytvořit")],
    });
  }

  async function load() {
    try {
      const [rows, ds] = await Promise.all([
        q(sb.from("tech_packs").select("*").order("updated_at", { ascending: false })),
        q(sb.from("drops").select("id,name").order("sort")),
      ]);
      drops = ds;
      const covers = rows.map((r) => { const p = r.data?.photos || []; return (p.find((x) => x.main) || p[0])?.path; }).filter(Boolean);
      if (covers.length) await signUrls(covers);
      draw(rows);
    } catch (e) { errToast(e); }
  }

  function draw(rows) {
    if (!rows.length) return body.replaceChildren(empty("Zatím žádný tech pack. Začni prvním kusem.", h("button.btn", { onclick: () => create() }, "Nový tech pack")));
    body.replaceChildren(h("div.tp-grid", rows.map((r) => {
      const p = r.data?.photos || [];
      const cover = (p.find((x) => x.main) || p[0])?.path;
      const tbc = tbcList(r).length;
      return h("article.tp-card",
        h("a.tp-cover", { href: `#/techpack/${r.id}`, "aria-label": `Otevřít ${r.name}` },
          cover ? h("img", { src: urlOf(cover), alt: "", loading: "lazy" }) : h("div.tp-cover-flat", { html: flatSVG(r.category, "front") })),
        h("div.tp-card-body",
          h("div.tp-card-top", h("span.tp-status", { class: `s-${r.status}` }, (STATUSES.find(([k]) => k === r.status) || [, r.status])[1]), h("span.muted.small", r.version)),
          h("h2", h("a", { href: `#/techpack/${r.id}` }, r.name)),
          h("p.muted.small", [r.sku, catLabel(r.category), drops.find((d) => d.id === r.drop_id)?.name].filter(Boolean).join(" · ")),
          h("div.tp-card-foot",
            h("span.small", { class: tbc ? "tp-tbc" : "tp-ok" }, tbc ? `${tbc} k potvrzení` : "Vše potvrzeno"),
            h("span.muted.small", `upraveno ${fmtDate(r.updated_at)}`),
            h("button.btn.ghost.small", { onclick: () => create(r) }, "Duplikovat"),
            h("button.icon-btn", { title: "Smazat tech pack", "aria-label": `Smazat ${r.name}`, onclick: async () => {
              if (!(await confirmDialog(`Smazat tech pack „${r.name}“? Nedá se vrátit.`))) return;
              try { await deletePack(r); load(); } catch (e) { errToast(e); }
            } }, "✕"))));
    })));
  }
  await load();
}

// ---------- editor ----------
async function editor(root, id) {
  root.append(loading());
  let tp, drops;
  try {
    [tp, drops] = await Promise.all([
      q(sb.from("tech_packs").select("*").eq("id", id).single()),
      q(sb.from("drops").select("id,name").order("sort")),
    ]);
  } catch (e) { root.replaceChildren(empty("Tech pack nenalezen.", h("a.btn", { href: "#/techpack" }, "Zpět na seznam"))); return; }
  const d = tp.data = { ...defaultsFor(tp.category), ...tp.data };
  d.overview = { ...defaultsFor(tp.category).overview, ...d.overview };
  const paths = [...(d.photos || []).map((p) => p.path), ...(d.flats || []).map((f) => f.path), ...(d.branding || []).map((b) => b.artwork)].filter(Boolean);
  try { if (paths.length) await signUrls(paths); } catch (e) { errToast(e); }

  let tab = (() => { try { return localStorage.getItem("mm-tp-tab") || "prehled"; } catch { return "prehled"; } })();
  let placing = null; // {list:'callouts'|'branding', i}
  let timer = null, saving = false, dirty = false;
  const saveState = h("span.tp-save", "Uloženo");

  function touch() {
    dirty = true; saveState.textContent = "Ukládám…"; saveState.className = "tp-save busy";
    clearTimeout(timer); timer = setTimeout(save, 900);
  }
  async function save() {
    if (saving) { timer = setTimeout(save, 400); return; }
    saving = true; dirty = false;
    try {
      const now = new Date().toISOString();
      await q(sb.from("tech_packs").update({ name: tp.name || "Bez názvu", sku: tp.sku, category: tp.category, status: tp.status, version: tp.version,
        drop_id: tp.drop_id || null, data: d, updated_at: now }).eq("id", tp.id));
      tp.updated_at = now;
      if (!dirty) { saveState.textContent = "Uloženo"; saveState.className = "tp-save"; }
    } catch (e) { saveState.textContent = "Neuloženo!"; saveState.className = "tp-save err"; errToast(e); }
    saving = false;
  }
  const onLeave = (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
  window.addEventListener("beforeunload", onLeave);

  // ---- hlavička ----
  const nameIn = h("input.tp-name", { value: tp.name, "aria-label": "Název kusu", oninput: (e) => { tp.name = e.target.value; touch(); } });
  const meta = h("div.tp-meta",
    lbl("SKU", h("input", { value: tp.sku || "", placeholder: "MM-…", oninput: (e) => { tp.sku = e.target.value.trim() || null; touch(); } })),
    lbl("Kategorie", h("select", { onchange: async (e) => {
      const c = e.target.value;
      const reset = await confirmDialog(`Změnit kategorii na ${catLabel(c)}? Nákresy se přepnou. Chceš i načíst výchozí velikosti, materiály a konstrukci pro tuto kategorii? (Tvoje vyplněné hodnoty v těchto sekcích se přepíšou.)`, "Ano, načíst výchozí");
      tp.category = c;
      if (reset) { const df = defaultsFor(c); Object.assign(d, { pom: df.pom, bom: df.bom, construction: df.construction, callouts: df.callouts, labels: df.labels }); }
      touch(); render();
    } }, CATEGORIES.map(([k, l]) => h("option", { value: k, selected: k === tp.category }, l)))),
    lbl("Stav", h("select", { onchange: (e) => { tp.status = e.target.value; touch(); } }, STATUSES.map(([k, l]) => h("option", { value: k, selected: k === tp.status }, l)))),
    lbl("Verze", h("input", { value: tp.version || "", style: { width: "5.5em" }, oninput: (e) => { tp.version = e.target.value; touch(); } })),
    lbl("Drop", h("select", { onchange: (e) => { tp.drop_id = e.target.value || null; touch(); } },
      h("option", { value: "" }, "—"), drops.map((x) => h("option", { value: x.id, selected: x.id === tp.drop_id }, x.name)))));

  const head = h("header.tp-head",
    h("div.tp-head-top", h("a.btn.ghost.small", { href: "#/techpack" }, "← Tech packy"), saveState, h("span.spacer"),
      h("button.btn.small", { onclick: aiPrompt }, "AI prompt"),
      h("button.btn.small", { onclick: aiImport }, "Vložit z AI"),
      h("button.btn.primary", { onclick: exportPdf }, "Export PDF")),
    nameIn, meta);

  const tabsEl = h("nav.tp-tabs", { "aria-label": "Sekce tech packu" });
  const sec = h("div.tp-sec");
  root.replaceChildren(head, tabsEl, sec);

  function drawTabs() {
    const tbc = tbcList(tp).length;
    tabsEl.replaceChildren(TABS.map(([k, l], i) => h("button.tp-tab", { type: "button", "aria-pressed": String(k === tab),
      onclick: () => { tab = k; try { localStorage.setItem("mm-tp-tab", k); } catch {} placing = null; render(); } },
      h("span.tp-tab-n", String(i + 1)), l, k === "shrnuti" && tbc ? h("span.badge", tbc) : null)));
  }
  function render() {
    drawTabs();
    const fn = { prehled: secOverview, nakresy: secFlats, materialy: secBom, barvy: secColors, velikosti: secPom, konstrukce: secCons,
      branding: secBranding, stitky: secLabels, kvalita: secQC, shrnuti: secSummary }[tab] || secOverview;
    sec.replaceChildren(fn());
  }

  // ---- pomocníci formuláře ----
  function lbl(text, input, cls = "") { return h("label.tp-f", { class: cls }, h("span", text), input); }
  function bind(obj, key, label, { type = "text", rows = 3, options, placeholder = "", cls = "", hint } = {}) {
    let input;
    if (type === "area") { input = h("textarea", { rows, placeholder }); input.value = obj[key] ?? ""; }
    else if (type === "select") input = h("select", options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h("option", { value: v, selected: String(obj[key] ?? "") === String(v) }, l); }));
    else { input = h("input", { type, placeholder }); input.value = obj[key] ?? ""; }
    input.addEventListener(type === "select" ? "change" : "input", () => { obj[key] = input.value; touch(); });
    return h("label.tp-f", { class: cls }, h("span", label), input, hint ? h("small.muted", hint) : null);
  }
  function srcSelect(row) {
    const s = h("select.tp-src", { "aria-label": "Zdroj údaje", "data-v": row.src || "P", onchange: () => { row.src = s.value; s.dataset.v = s.value; touch(); } },
      SRC.map(([k, l]) => h("option", { value: k, selected: (row.src || "P") === k }, l)));
    return s;
  }
  function autoGrow(t) { const f = () => { t.style.height = "auto"; t.style.height = t.scrollHeight + 2 + "px"; }; t.addEventListener("input", f); requestAnimationFrame(f); return t; }

  /** Editovatelná tabulka. cols: [{key,label,w,type:'text'|'src'|'hex'|'num', render}] */
  function editTable(rows, cols, { addLabel = "Přidat řádek", blank = {}, extra, numbered = false, onStruct } = {}) {
    const wrap = h("div.tp-table-wrap");
    const draw = () => {
      wrap.replaceChildren(h("table.tp-table",
        h("thead", h("tr", numbered ? h("th", { style: { width: "34px" } }, "#") : null, cols.map((c) => h("th", { style: c.w ? { width: c.w } : null }, c.label)), h("th", { style: { width: extra ? "120px" : "84px" } }))),
        h("tbody", rows.map((r, i) => h("tr",
          numbered ? h("td.tp-no", String(i + 1)) : null,
          cols.map((c) => h("td", cell(r, c))),
          h("td.tp-row-act",
            extra ? extra(r, i) : null,
            h("button.icon-btn", { type: "button", title: "Nahoru", disabled: i === 0, onclick: () => { [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; touch(); draw(); onStruct?.(); } }, "↑"),
            h("button.icon-btn", { type: "button", title: "Smazat řádek", onclick: () => { rows.splice(i, 1); touch(); draw(); onStruct?.(); } }, "✕")))))),
      h("button.btn.ghost.small", { type: "button", onclick: () => { rows.push({ src: "P", ...structuredClone(blank) }); touch(); draw(); onStruct?.(); } }, `+ ${addLabel}`));
    };
    function cell(r, c) {
      if (c.render) return c.render(r);
      if (c.type === "src") return srcSelect(r);
      if (c.type === "hex") {
        const txt = h("input", { value: r[c.key] || "", placeholder: "#1A1B1D", oninput: () => { r[c.key] = txt.value.trim(); sw.value = /^#[0-9a-f]{6}$/i.test(txt.value) ? txt.value : "#ffffff"; touch(); } });
        const sw = h("input.tp-sw", { type: "color", value: /^#[0-9a-f]{6}$/i.test(r[c.key] || "") ? r[c.key] : "#ffffff", oninput: () => { r[c.key] = sw.value.toUpperCase(); txt.value = r[c.key]; touch(); } });
        return h("div.tp-hex", sw, txt);
      }
      const t = autoGrow(h("textarea", { rows: 1, placeholder: c.ph || "" }));
      t.value = r[c.key] ?? "";
      t.addEventListener("input", () => { r[c.key] = t.value; touch(); });
      return t;
    }
    draw();
    return wrap;
  }
  function section(title, help, ...content) {
    return h("section.tp-panel", h("header.tp-panel-head", h("div", h("h2", title), help ? h("p.muted.small", help) : null)), content);
  }
  function resetBtn(key, label = "Načíst návrh pro kategorii") {
    return h("button.btn.ghost.small", { type: "button", onclick: async () => {
      if (!(await confirmDialog(`Přepsat sekci výchozím návrhem pro ${catLabel(tp.category)}?`, "Přepsat"))) return;
      const df = defaultsFor(tp.category);
      if (key === "qc") d.qc = df.qc; else d[key] = df[key];
      touch(); render();
    } }, label);
  }
  const srcHelp = h("p.tp-srchelp.small", "Každý řádek má zdroj: ", h("b.t-C", "CONFIRMED"), " = potvrdil jsi, ", h("b.t-V", "VISIBLE"), " = je vidět na fotce, ",
    h("b.t-P", "PROPOSED"), " = návrh, ", h("b.t-T", "TBC"), " = neznámé – v PDF se to vypíše do seznamu k potvrzení.");

  // ---- 1 přehled ----
  function secOverview() {
    const o = d.overview;
    const photos = d.photos || (d.photos = []);
    const grid = h("div.tp-photos");
    const drawPhotos = () => {
      grid.replaceChildren(
        photos.map((p, i) => h("figure.tp-photo", { class: p.main || (!photos.some((x) => x.main) && i === 0) ? "main" : "" },
          h("img", { src: urlOf(p.path), alt: p.caption || "" }),
          h("figcaption",
            h("input", { value: p.caption || "", placeholder: "Co je na fotce (front, detail loga…)", oninput: (e) => { p.caption = e.target.value; touch(); } }),
            h("div.row",
              h("button.btn.ghost.small", { type: "button", onclick: () => { photos.forEach((x) => (x.main = false)); p.main = true; touch(); drawPhotos(); } }, p.main ? "★ Hlavní" : "☆ Hlavní"),
              h("span.spacer"),
              h("button.btn.ghost.small.danger-text", { type: "button", onclick: async () => {
                if (!(await confirmDialog("Odebrat fotku z tech packu?", "Odebrat"))) return;
                photos.splice(i, 1); touch(); drawPhotos(); releasePath(p.path, tp.id);
              } }, "Odebrat"))))),
        h("button.tp-drop", { type: "button", onclick: () => pickFiles("image/*", true, addPhotos) }, h("strong", "+ Nahrát fotky"), h("span.muted.small", "nebo je sem přetáhni")));
    };
    async function addPhotos(files) {
      files = files.filter((f) => /^image\//.test(f.type));
      if (!files.length) return;
      toast(`Nahrávám ${files.length} ${files.length === 1 ? "fotku" : "fotek"}…`);
      for (const f of files) {
        try { photos.push({ path: await upload(tp.id, f), caption: f.name.replace(/\.\w+$/, ""), main: false }); drawPhotos(); touch(); }
        catch (e) { errToast(e); }
      }
    }
    grid.addEventListener("dragover", (e) => { e.preventDefault(); grid.classList.add("over"); });
    grid.addEventListener("dragleave", () => grid.classList.remove("over"));
    grid.addEventListener("drop", (e) => { e.preventDefault(); grid.classList.remove("over"); addPhotos([...e.dataTransfer.files]); });
    drawPhotos();
    return h("div",
      section("Referenční fotky", "Hlavní fotka (★) jde na titulní stranu PDF, další jako náhledy. Fotky se automaticky zmenší.", grid),
      section("Základní informace", null, h("div.tp-form",
        bind(o, "collection", "Kolekce / drop (text do PDF)", { placeholder: "Drop 02 – Winter", cls: "half" }),
        bind(o, "fit", "Střih (fit)", { type: "select", options: FITS, cls: "half" }),
        bind(o, "colorways", "Barevné varianty", { placeholder: "Washed Black / Bone", cls: "half" }),
        bind(o, "sizes", "Velikosti", { placeholder: "XS, S, M, L, XL, XXL", cls: "half", hint: "Oddělené čárkou. Mění sloupce ve velikostní tabulce." }),
        bind(o, "base", "Základní velikost", { cls: "third" }),
        bind(o, "target_customer", "Cílový zákazník", { cls: "third" }),
        bind(o, "factory", "Výrobce", { cls: "third" }),
        bind(o, "price", "Cílová cena (FOB)", { placeholder: "≤ 450 Kč / ks", cls: "half" }),
        bind(o, "moq", "Množství / MOQ", { placeholder: "50 ks", cls: "half" }),
        bind(o, "description", "Popis produktu (anglicky – jde do PDF)", { type: "area", rows: 3 }),
        bind(o, "features", "Hlavní prvky designu (každý na nový řádek)", { type: "area", rows: 4, placeholder: "Heavyweight 450 GSM fleece\nEmbroidered crown on left chest\nDouble-layer hood" }),
        bind(o, "dev_notes", "Poznámky k vývoji", { type: "area", rows: 3 }))));
  }

  // ---- 2 nákresy + callouty ----
  function secFlats() {
    if (!(d.flats || []).length) d.flats = flatsOf(tp).map((f) => ({ ...f }));
    const flats = d.flats;
    const banner = placing ? h("div.tp-placing", h("strong", `Klikni do nákresu, kam patří ${placing.list === "branding" ? "logo L" : "bod "}${placing.i + 1}.`),
      h("button.btn.small", { type: "button", onclick: () => { placing = null; render(); } }, "Zrušit")) : null;
    const grid = h("div.tp-flats", { class: placing ? "placing" : "" }, flats.map((f, fi) => flatCard(f, fi, true)),
      h("div.tp-flat-add",
        h("button.btn.small", { type: "button", onclick: () => pickFiles("image/*,.svg", true, async (files) => {
          for (const file of files) try { flats.push({ kind: "img", path: await upload(tp.id, file), label: file.name.replace(/\.\w+$/, "") }); } catch (e) { errToast(e); }
          touch(); render();
        }) }, "+ Nahrát vlastní nákres"),
        hasTemplate(tp.category) ? h("button.btn.ghost.small", { type: "button", onclick: () => { flats.push({ kind: "tpl", view: "front", label: "Detail" }); touch(); render(); } }, "+ Šablona přední") : null,
        hasTemplate(tp.category) ? h("button.btn.ghost.small", { type: "button", onclick: () => { flats.push({ kind: "tpl", view: "back", label: "Back" }); touch(); render(); } }, "+ Šablona zadní") : null,
        h("p.muted.small", "Šablona je obecný nákres podle kategorie. Pro přesnou dokumentaci nahraj vlastní nákres (SVG/PNG z Illustratoru, Procreate…). PDF i čísla bodů se přizpůsobí.")));
    const table = editTable(d.callouts || (d.callouts = []), [
      { key: "element", label: "Detail", w: "13%" }, { key: "location", label: "Umístění" }, { key: "dims", label: "Rozměr (cm)", w: "9%" },
      { key: "method", label: "Konstrukce / metoda" }, { key: "material", label: "Materiál" }, { key: "color", label: "Barva", w: "8%" },
      { key: "placement", label: "Reference umístění", ph: "x cm od HPS / CF" }, { key: "src", label: "Zdroj", type: "src", w: "110px" },
    ], { addLabel: "Přidat detail", numbered: true, extra: (r, i) => pinBtn("callouts", r, i), onStruct: () => render(), blank: { element: "", pin: null } });
    return h("div", banner,
      section("Technické nákresy", "Plná čára = šev / obrys, čárkovaná = prošití. Čísla bodů umístíš tlačítkem 📍 v tabulce níže.", grid),
      section("Detaily & callouty", "Každý viditelný detail = jeden řádek. Číslo řádku = číslo bodu na nákresu.", srcHelp, table));
  }
  function pinBtn(list, r, i) {
    return h("button.icon-btn", { type: "button", title: r.pin ? "Přesunout bod na nákresu (Shift = odebrat)" : "Umístit na nákres", class: r.pin ? "on" : "",
      onclick: (e) => {
        if (e.shiftKey && r.pin) { r.pin = null; touch(); render(); return; }
        placing = { list, i }; tab = list === "branding" ? "branding" : "nakresy"; render();
        document.querySelector(".tp-flats")?.scrollIntoView({ behavior: "smooth", block: "center" });
      } }, "📍");
  }
  function flatCard(f, fi, editable) {
    const box = h("div.tp-flat-box", { html: f.kind === "img" ? "" : flatSVG(tp.category, f.view) });
    if (f.kind === "img") box.appendChild(h("img", { src: urlOf(f.path), alt: f.label || "" }));
    (d.callouts || []).forEach((r, i) => r.pin?.flat === fi && box.appendChild(h("span.tp-pin", { style: { left: r.pin.x + "%", top: r.pin.y + "%" }, title: r.element }, String(i + 1))));
    (d.branding || []).forEach((r, i) => r.pin?.flat === fi && box.appendChild(h("span.tp-pin.logo", { style: { left: r.pin.x + "%", top: r.pin.y + "%" }, title: r.name }, `L${i + 1}`)));
    box.addEventListener("click", (e) => {
      if (!placing) return;
      const rc = box.getBoundingClientRect();
      const x = Math.round(((e.clientX - rc.left) / rc.width) * 1000) / 10, y = Math.round(((e.clientY - rc.top) / rc.height) * 1000) / 10;
      const row = d[placing.list][placing.i];
      if (row) row.pin = { flat: fi, x, y };
      placing = null; touch(); render();
    });
    if (!editable) return h("figure.tp-flat", box, h("figcaption", f.label));
    return h("figure.tp-flat", box, h("figcaption",
      h("input", { value: f.label || "", "aria-label": "Popisek nákresu", oninput: (e) => { f.label = e.target.value; touch(); } }),
      f.kind === "tpl" ? h("select", { "aria-label": "Pohled", onchange: (e) => { f.view = e.target.value; touch(); render(); } },
        h("option", { value: "front", selected: f.view === "front" }, "Přední"), h("option", { value: "back", selected: f.view === "back" }, "Zadní")) : null,
      h("button.icon-btn", { type: "button", title: "Odebrat nákres", onclick: async () => {
        if (!(await confirmDialog("Odebrat nákres? Body na něm se odepnou.", "Odebrat"))) return;
        d.flats.splice(fi, 1);
        for (const k of ["callouts", "branding"]) (d[k] || []).forEach((r) => { if (r.pin) { if (r.pin.flat === fi) r.pin = null; else if (r.pin.flat > fi) r.pin.flat--; } });
        if (f.kind === "img") releasePath(f.path, tp.id);
        touch(); render();
      } }, "✕")));
  }

  // ---- 3 BOM ----
  function secBom() {
    return section("Materiály & doplňky (BOM)", "Hlavní látka, žebrování, nitě, zipy, knoflíky, štítky… Gramáž v g/m² nebo oz.", srcHelp,
      editTable(d.bom || (d.bom = []), [
        { key: "component", label: "Komponent", w: "13%" }, { key: "material", label: "Materiál / popis" }, { key: "composition", label: "Složení" },
        { key: "weight", label: "Gramáž / velikost", w: "10%" }, { key: "color", label: "Barva", w: "9%" }, { key: "supplier", label: "Specifikace dodavatele" },
        { key: "consumption", label: "Spotřeba", w: "8%" }, { key: "src", label: "Zdroj", type: "src", w: "110px" },
      ], { addLabel: "Přidat materiál", numbered: true }), h("div.row", resetBtn("bom")));
  }

  // ---- 4 barvy ----
  function secColors() {
    return section("Barvy", "HEX je jen orientační barva na obrazovce. Pantone TCX vyplň jen když ho znáš – jinak „Match to physical swatch“.", srcHelp,
      editTable(d.colors || (d.colors = []), [
        { key: "element", label: "Prvek", w: "14%" }, { key: "name", label: "Název barvy" }, { key: "hex", label: "HEX", type: "hex", w: "150px" },
        { key: "pantone", label: "Pantone TCX" }, { key: "application", label: "Použití" }, { key: "src", label: "Zdroj", type: "src", w: "110px" },
      ], { addLabel: "Přidat barvu", blank: { element: "", hex: "" } }));
  }

  // ---- 5 velikosti ----
  function secPom() {
    const sizes = sizesOf(d), base = d.overview.base || "M";
    const rows = d.pom || (d.pom = []);
    const wrap = h("div.tp-table-wrap");
    const draw = () => wrap.replaceChildren(h("table.tp-table.tp-pom",
      h("thead", h("tr", h("th", { style: { width: "54px" } }, "POM"), h("th", { style: { width: "16%" } }, "Popis"), h("th", "Jak měřit"),
        h("th.num", { style: { width: "64px" } }, `Základ ${base}`), h("th.num", { style: { width: "58px" } }, "Gradace"), h("th.num", { style: { width: "54px" } }, "Tol ±"),
        sizes.map((s) => h("th.num", { class: s === base ? "base" : "", style: { width: "56px" } }, s)), h("th", { style: { width: "110px" } }, "Zdroj"), h("th", { style: { width: "60px" } }))),
      h("tbody", rows.map((r, i) => {
        r.vals ||= grade(r, sizes, base);
        const sizeIns = {};
        const regrade = () => { const g = grade(r, sizes, base); sizes.forEach((s) => { r.vals[s] = g[s]; sizeIns[s].value = g[s] ?? ""; }); };
        const inp = (key, cls, after) => { const x = h("input", { class: cls, value: r[key] ?? "", oninput: () => { r[key] = x.value; after?.(); touch(); } }); return x; };
        return h("tr",
          h("td", inp("code", "tp-code")), h("td", inp("desc")), h("td", inp("how")),
          h("td", inp("base", "num", regrade)), h("td", inp("grade", "num", regrade)), h("td", inp("tol", "num")),
          sizes.map((s) => h("td", { class: s === base ? "base" : "" }, sizeIns[s] = h("input.num", { value: r.vals[s] ?? "", oninput: (e) => { r.vals[s] = e.target.value; touch(); } }))),
          h("td", srcSelect(r)),
          h("td.tp-row-act", h("button.icon-btn", { type: "button", title: "Smazat", onclick: () => { rows.splice(i, 1); touch(); draw(); } }, "✕")));
      }))),
      h("div.row",
        h("button.btn.ghost.small", { type: "button", onclick: () => { rows.push({ code: String.fromCharCode(65 + rows.length), desc: "", how: "", base: "", grade: "", tol: 0.5, src: "P", vals: {} }); touch(); draw(); } }, "+ Přidat míru"),
        h("button.btn.ghost.small", { type: "button", onclick: () => { rows.forEach((r) => (r.vals = grade(r, sizes, base))); touch(); draw(); toast("Velikosti přepočítány z základu + gradace"); } }, "Přepočítat všechny velikosti"),
        resetBtn("pom")));
    draw();
    return section("Velikostní tabulka (POM)", `Vše v cm, měřeno naplocho. Vyplň základní velikost ${base} a gradaci – ostatní velikosti se dopočítají (můžeš je přepsat ručně). Výchozí hodnoty jsou návrh pro oversized/relaxed střih – potvrď na fit vzorku.`, wrap);
  }

  // ---- 6 konstrukce ----
  function secCons() {
    return section("Konstrukce", "Švy, typy stehů (ISO 4915: 301, 401, 406, 514, 607), hustota stehů, lemy, zpevnění, praní.", srcHelp,
      editTable(d.construction || (d.construction = []), [
        { key: "area", label: "Část / operace", w: "18%" }, { key: "spec", label: "Specifikace" }, { key: "stitch", label: "Typ stehu / švu", w: "16%" },
        { key: "src", label: "Zdroj", type: "src", w: "110px" },
      ], { addLabel: "Přidat operaci" }), h("div.row", resetBtn("construction")));
  }

  // ---- 7 branding ----
  function secBranding() {
    const rows = d.branding || (d.branding = []);
    const flats = d.flats?.length ? d.flats : flatsOf(tp);
    const banner = placing ? h("div.tp-placing", h("strong", `Klikni do nákresu, kam patří logo L${placing.i + 1}.`), h("button.btn.small", { type: "button", onclick: () => { placing = null; render(); } }, "Zrušit")) : null;
    const cards = rows.map((r, i) => {
      const art = h("button.tp-art", { type: "button", title: "Nahrát grafiku", onclick: () => pickFiles("image/*,.svg,.pdf", false, async ([f]) => {
        try { const old = r.artwork; r.artwork = await upload(tp.id, f); touch(); render(); if (old) releasePath(old, tp.id); } catch (e) { errToast(e); }
      }) }, r.artwork ? h("img", { src: urlOf(r.artwork), alt: "" }) : h("span", "+ Nahrát grafiku", h("br"), h("small.muted", "PNG / SVG")));
      return h("article.tp-brand",
        h("div.tp-brand-side", h("span.tp-pin.logo.static", `L${i + 1}`), art,
          h("div.row", pinBtn("branding", r, i), r.pin ? h("small.muted", "na nákresu ✓") : h("small.muted", "neumístěno"))),
        h("div.tp-form",
          bind(r, "name", "Název", { cls: "half" }), h("label.tp-f.half", h("span", "Zdroj"), srcSelect(r)),
          bind(r, "placement", "Umístění (cm od HPS / CF / švu / lemu)"),
          bind(r, "size", "Velikost š × v (cm)", { cls: "half" }),
          bind(r, "method", "Technika", { type: "select", cls: "half", options: ["", "Flat embroidery", "3D puff embroidery", "Chenille patch", "Woven patch", "Screen print", "Puff print", "DTG", "DTF", "Heat transfer", "Appliqué", "Debossed leather patch", "Other"] }),
          bind(r, "colors", "Barvy nití / barev", { cls: "half" }), bind(r, "backing", "Podklad (backing)", { cls: "half" }),
          bind(r, "specs", "Specifikace stehu / tisku", { type: "area", rows: 2 }),
          h("div.row", h("span.spacer"), h("button.btn.ghost.small.danger-text", { type: "button", onclick: async () => {
            if (!(await confirmDialog(`Smazat ${r.name || "prvek"}?`))) return;
            rows.splice(i, 1); touch(); render(); if (r.artwork) releasePath(r.artwork, tp.id);
          } }, "Smazat prvek"))));
    });
    return h("div", banner,
      section("Logo, potisk & výšivka", "Každé logo / grafika zvlášť. Nahraj originální soubor – v PDF se nikdy neupravuje. Bez souboru se vypíše „ARTWORK FILE TO BE SUPPLIED“.",
        h("div.tp-brands", cards),
        h("button.btn.ghost.small", { type: "button", onclick: () => { rows.push({ name: "Logo", placement: "", size: "", method: "", colors: "", specs: "", backing: "", artwork: "", src: "P", pin: null }); touch(); render(); } }, "+ Přidat logo / grafiku")),
      section("Umístění na nákresu", "Tlačítkem 📍 u loga vyber místo na nákresu.", h("div.tp-flats.small", { class: placing ? "placing" : "" }, flats.map((f, fi) => flatCard(f, fi, false)))));
  }

  // ---- 8 štítky ----
  function secLabels() {
    return section("Štítky & balení", "Hlavní štítek, velikost, prací štítek (EU 1007/2011 + ISO 3758 symboly), visačka, obal.", srcHelp,
      editTable(d.labels || (d.labels = []), [
        { key: "type", label: "Položka", w: "14%" }, { key: "dims", label: "Rozměr", w: "10%" }, { key: "material", label: "Materiál" }, { key: "method", label: "Technika" },
        { key: "color", label: "Barvy" }, { key: "placement", label: "Umístění" }, { key: "src", label: "Zdroj", type: "src", w: "110px" },
      ], { addLabel: "Přidat položku" }), h("div.row", resetBtn("labels")));
  }

  // ---- 9 kvalita ----
  function secQC() {
    const qc = d.qc || (d.qc = defaultsFor(tp.category).qc);
    const list = h("ul.tp-checks");
    const drawList = () => list.replaceChildren(qc.checks.map((c, i) => h("li",
      h("input", { type: "checkbox", checked: c.on !== false, "aria-label": "Zahrnout do PDF", onchange: (e) => { c.on = e.target.checked; touch(); } }),
      h("input.grow", { value: c.text, oninput: (e) => { c.text = e.target.value; touch(); } }),
      h("button.icon-btn", { type: "button", onclick: () => { qc.checks.splice(i, 1); touch(); drawList(); } }, "✕"))),
      h("li", h("button.btn.ghost.small", { type: "button", onclick: () => { qc.checks.push({ text: "", on: true }); touch(); drawList(); } }, "+ Přidat bod")));
    drawList();
    return h("div",
      section("Kontrolní seznam", "Zaškrtnuté body jdou do PDF.", list),
      section("Testy", null, editTable(qc.tests, [{ key: "test", label: "Test", w: "26%" }, { key: "standard", label: "Metoda / norma" }, { key: "req", label: "Požadavek" }, { key: "src", label: "Zdroj", type: "src", w: "110px" }], { addLabel: "Přidat test" })),
      section("Schvalování vzorků", null, h("div.tp-form", bind(qc, "stages", "Fáze", { type: "area", rows: 6 }))),
      h("div.row", resetBtn("qc", "Načíst výchozí kontrolu kvality")));
  }

  // ---- 10 shrnutí ----
  function secSummary() {
    const s = d.summary || (d.summary = {});
    const tbc = tbcList(tp);
    const go = (sectionName) => ({ Overview: "prehled", Callouts: "nakresy", BOM: "materialy", Colours: "barvy", "Size chart": "velikosti", Construction: "konstrukce", Branding: "branding", Labels: "stitky", QC: "kvalita" }[sectionName] || "prehled");
    return h("div.tp-sum",
      section("Shrnutí pro výrobu", null, h("div.tp-form",
        bind(s, "special", "Speciální instrukce pro výrobce (anglicky)", { type: "area", rows: 4, placeholder: "e.g. Garment dye after sewing. All trims must be nickel-free." }),
        bind(s, "approvals", "Co musí být schválené před velkovýrobou (každé na řádek)", { type: "area", rows: 4 }))),
      section(`K potvrzení (${tbc.length})`, "Tohle se v PDF vypíše jako otevřené body. Klikni a přejdi do sekce.",
        tbc.length ? h("ul.tp-tbc-list", tbc.map(([secName, txt]) => h("li", h("button.linklike", { type: "button", onclick: () => { tab = go(secName); render(); } }, h("b", secName), " – ", txt))))
          : h("p", "Vše potvrzeno ✓")),
      section("Export", "PDF má 11 stran: přehled, nákresy, callouty, BOM, barvy, velikosti, konstrukce, branding, štítky, kvalita, shrnutí.",
        h("div.row", h("button.btn.primary", { type: "button", onclick: exportPdf }, "Export PDF pro výrobce")),
        h("p.muted.small", "Otevře se náhled a dialog tisku. Zvol „Uložit jako PDF“, orientaci na šířku a vypni záhlaví a zápatí prohlížeče. Nejlépe v Chrome."),
        h("hr"),
        h("div.row", h("button.btn.ghost.small.danger-text", { type: "button", onclick: async () => {
          if (!(await confirmDialog(`Smazat tech pack „${tp.name}“? Nedá se vrátit.`))) return;
          dirty = false; clearTimeout(timer);
          try { await deletePack(tp); location.hash = "#/techpack"; } catch (e) { errToast(e); }
        } }, "Smazat tech pack"))));
  }

  // ---- export ----
  async function exportPdf() {
    const win = window.open("", "_blank");
    if (!win) return toast("Prohlížeč zablokoval nové okno – povol vyskakovací okna pro tuhle stránku.", "err");
    win.document.write("<p style='font-family:sans-serif;padding:24px'>Připravuji tech pack…</p>");
    try {
      clearTimeout(timer); if (dirty) await save();
      const flats = d.flats?.length ? d.flats : flatsOf(tp);
      const paths = [...(d.photos || []).map((p) => p.path), ...flats.map((f) => f.path), ...(d.branding || []).map((b) => b.artwork)].filter(Boolean);
      const urls = paths.length ? await signUrls(paths) : {};
      let logoUrl = "";
      try {
        const folder = (await q(sb.from("folders").select("id").eq("name", "Loga & brand").is("parent_id", null).limit(1)))[0];
        if (folder) {
          const logos = await q(sb.from("files").select("name,storage_path,mime").eq("folder_id", folder.id));
          const pick = logos.find((f) => /crown|koruna|logo/i.test(f.name) && /\.(svg|png)$/i.test(f.name)) || logos.find((f) => /\.(svg|png)$/i.test(f.name));
          if (pick) logoUrl = (await signUrls([pick.storage_path]))[pick.storage_path] || "";
        }
      } catch {}
      const html = buildHTML(tp, urls, { logoUrl, dropName: drops.find((x) => x.id === tp.drop_id)?.name || "" });
      await printInWindow(win, html);
    } catch (e) { win.close(); errToast(e); }
  }

  // ---- AI ----
  function aiPrompt() {
    const text = buildPrompt(tp);
    const ta = h("textarea.tp-ai", { rows: 14, readonly: true }); ta.value = text;
    const m = modal("AI prompt", [
      h("ol.tp-steps",
        h("li", "Zkopíruj prompt a vlož ho do Claude."),
        h("li", "Přilož k němu fotky kusu (front, back, detaily, štítky)."),
        h("li", "Odpověď (JSON) zkopíruj a dej sem ", h("b", "Vložit z AI"), ". Vyplní se všechny sekce, potvrzené údaje zůstanou.")),
      ta], { wide: true, actions: [h("span.spacer"),
        h("button.btn.primary", { onclick: async () => { try { await navigator.clipboard.writeText(text); toast("Prompt zkopírován"); m.close(); } catch { ta.select(); toast("Označeno – zkopíruj Cmd+C"); } } }, "Zkopírovat prompt")] });
  }
  function aiImport() {
    const ta = h("textarea.tp-ai", { rows: 14, placeholder: "Sem vlož odpověď od Claude (JSON)…" });
    const m = modal("Vložit z AI", [h("p.muted", "Přepíše sekce, které jsou v odpovědi. Fotky, nákresy, grafiky a umístění bodů zůstanou."), ta], {
      wide: true, actions: [h("span.spacer"), h("button.btn.primary", { onclick: () => {
        try {
          const n = mergeAI(tp, ta.value);
          nameIn.value = tp.name; meta.querySelector("input").value = tp.sku || "";
          touch(); render(); m.close(); toast(`Vyplněno ${n} sekcí z AI – zkontroluj označení zdrojů`);
        } catch (e) { toast(e.message, "err"); }
      } }, "Vložit")] });
  }

  render();
  return () => { window.removeEventListener("beforeunload", onLeave); if (dirty) save(); };
}
