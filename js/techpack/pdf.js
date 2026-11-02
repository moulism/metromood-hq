// Sestaví tisknutelný dokument (A4 na šířku) z tech packu a otevře dialog tisku → „Uložit jako PDF“.
// Vše je vektor (text, tabulky, SVG nákresy), fotky se vkládají přes podepsané URL ze Supabase.

import { flatSVG } from "./flats.js";
import { catLabel, srcLabel, SIZES } from "./defaults.js";

const e = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nl = (s) => e(s).replace(/\n/g, "<br>");
const dash = (s) => (s == null || String(s).trim() === "" ? '<span class="na">—</span>' : nl(s));
const tag = (s) => `<span class="tag t-${e(s || "P")}">${e(srcLabel(s || "P"))}</span>`;

export function sizesOf(d) {
  const s = (d.overview?.sizes || "").split(/[,\s/]+/).map((x) => x.trim()).filter(Boolean);
  return s.length ? s : SIZES;
}

export function flatsOf(tp) {
  const d = tp.data || {};
  return (d.flats || []).length ? d.flats : [{ kind: "tpl", view: "front", label: "Front" }, { kind: "tpl", view: "back", label: "Back" }];
}

/** Seznam všeho, co je potřeba potvrdit (TBC) – i do shrnutí v editoru. */
export function tbcList(tp) {
  const d = tp.data || {};
  const out = [];
  const add = (sec, txt) => out.push([sec, txt]);
  if (!tp.sku) add("Overview", "SKU / product code");
  if (!d.overview?.colorways) add("Overview", "Colorway(s)");
  if (!(d.photos || []).length) add("Overview", "Reference photos");
  (d.callouts || []).forEach((r, i) => r.src === "T" && add("Callouts", `${i + 1}. ${r.element || "detail"}`));
  (d.bom || []).forEach((r) => (r.src === "T" || /TBC/i.test(`${r.color} ${r.material} ${r.supplier}`)) && add("BOM", r.component || "component"));
  (d.colors || []).forEach((r) => (r.src === "T" || !r.hex) && add("Colours", `${r.element}${r.name ? ` – ${r.name}` : ""}`));
  if ((d.pom || []).some((r) => r.src !== "C")) add("Size chart", "Measurements are proposed – confirm on fit sample");
  (d.construction || []).forEach((r) => (r.src === "T" || /TBC/i.test(r.spec)) && add("Construction", r.area));
  (d.branding || []).forEach((r) => {
    if (r.src === "T" || /TBC/i.test(`${r.placement} ${r.size} ${r.colors} ${r.specs}`)) add("Branding", `${r.name} – placement / size / colours`);
    if (!r.artwork) add("Branding", `${r.name} – artwork file to be supplied`);
  });
  (d.labels || []).forEach((r) => r.src === "T" && add("Labels", r.type));
  (d.qc?.tests || []).forEach((r) => r.src === "T" && add("QC", r.test));
  return out;
}

function pinsFor(d, fi) {
  const pins = [];
  (d.callouts || []).forEach((r, i) => r.pin && r.pin.flat === fi && pins.push({ x: r.pin.x, y: r.pin.y, n: String(i + 1) }));
  (d.branding || []).forEach((r, i) => r.pin && r.pin.flat === fi && pins.push({ x: r.pin.x, y: r.pin.y, n: `L${i + 1}`, logo: true }));
  return pins;
}

function flatHTML(tp, f, fi, urls, { pins = true } = {}) {
  const d = tp.data || {};
  const art = f.kind === "img" ? `<img src="${e(urls[f.path] || "")}" alt="">` : flatSVG(tp.category, f.view);
  const p = pins ? pinsFor(d, fi).map((p) => `<span class="pin${p.logo ? " logo" : ""}" style="left:${p.x}%;top:${p.y}%">${e(p.n)}</span>`).join("") : "";
  return `<figure class="flat"><div class="flat-box">${art}${p}</div><figcaption>${e(f.label || f.view || "")}</figcaption></figure>`;
}

function table(cols, rows) {
  return `<table><thead><tr>${cols.map((c) => `<th${c.w ? ` style="width:${c.w}"` : ""}>${e(c.label)}</th>`).join("")}</tr></thead><tbody>${
    rows.length ? rows.map((r, i) => `<tr>${cols.map((c) => `<td${c.cls ? ` class="${c.cls}"` : ""}>${c.render ? c.render(r, i) : dash(r[c.key])}</td>`).join("")}</tr>`).join("")
      : `<tr><td colspan="${cols.length}" class="na">—</td></tr>`}</tbody></table>`;
}

export function buildHTML(tp, urls, { logoUrl = "", dropName = "" } = {}) {
  const d = tp.data || {};
  const o = d.overview || {};
  const date = new Date(tp.updated_at || Date.now()).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const sizes = sizesOf(d);
  const flats = flatsOf(tp);
  const photos = d.photos || [];
  const main = photos.find((p) => p.main) || photos[0];
  const title = `${tp.name}`;
  const pageTotal = 11;
  let pageNo = 0;

  const head = (sec) => {
    pageNo++;
    return `<header class="ph">
      <div class="ph-brand">${logoUrl ? `<img src="${e(logoUrl)}" alt="">` : ""}<b>METROMOOD</b></div>
      <div class="ph-cell"><small>Product</small>${e(title)}</div>
      <div class="ph-cell"><small>SKU</small>${e(tp.sku || "TBC")}</div>
      <div class="ph-cell"><small>Version</small>${e(tp.version || "v1.0")}</div>
      <div class="ph-cell"><small>Date</small>${e(date)}</div>
      <div class="ph-sec"><small>${String(pageNo).padStart(2, "0")} / ${pageTotal}</small>${e(sec)}</div>
    </header>`;
  };
  const page = (sec, body) => `<section class="page">${head(sec)}<div class="pb">${body}</div><footer class="pf"><span>METROMOOD · Plzeň, Czech Republic · Confidential – for manufacturing use only</span><span>${e(tp.sku || "")} · ${e(tp.version || "")} · Page ${pageNo} / ${pageTotal}</span></footer></section>`;

  const legend = `<p class="legend"><span><i class="sw solid"></i>Seam / outline</span><span><i class="sw dash"></i>Topstitch</span><span><i class="pin s">1</i>Callout</span><span><i class="pin s logo">L1</i>Logo / branding</span></p>`;
  const srcLegend = `<p class="legend">${["C", "V", "P", "T"].map((s) => tag(s)).join(" ")} <span class="muted">CONFIRMED = stated by METROMOOD · VISIBLE = seen on reference · PROPOSED = recommendation, needs approval · TBC = to be confirmed before sampling</span></p>`;

  // 1 — overview
  const info = [
    ["Product name", tp.name], ["SKU", tp.sku], ["Collection / drop", o.collection || dropName], ["Category", catLabel(tp.category)],
    ["Fit", o.fit], ["Size range", sizes.join(" / ") + ` (base ${o.base || "M"})`], ["Colorway(s)", o.colorways], ["Target customer", o.target_customer],
    ["Target FOB / MOQ", [o.price, o.moq].filter(Boolean).join(" · ")], ["Factory", o.factory], ["Status", { draft: "Development", review: "In review", sent: "Sent for quotation / proto", approved: "Approved" }[tp.status || "draft"] || tp.status],
  ];
  const p1 = `<div class="ov">
    <div class="ov-img">${main ? `<img src="${e(urls[main.path] || "")}" alt="">` : `<div class="ph-empty">Main product image</div>`}${main?.caption ? `<p class="cap">${e(main.caption)}</p>` : ""}</div>
    <div class="ov-info">
      <table class="kv">${info.map(([k, v]) => `<tr><th>${e(k)}</th><td>${dash(v)}</td></tr>`).join("")}</table>
      <h3>Description</h3><p>${dash(o.description)}</p>
      <h3>Key design features</h3>${o.features ? `<ul>${o.features.split("\n").filter((x) => x.trim()).map((x) => `<li>${e(x.replace(/^[-•]\s*/, ""))}</li>`).join("")}</ul>` : "<p>—</p>"}
      <h3>Development notes</h3><p>${dash(o.dev_notes)}</p>
    </div></div>
    ${photos.length > 1 ? `<div class="thumbs">${photos.filter((p) => p !== main).slice(0, 6).map((p) => `<figure><img src="${e(urls[p.path] || "")}" alt=""><figcaption>${e(p.caption || "")}</figcaption></figure>`).join("")}</div>` : ""}
    ${srcLegend}`;

  // 2 — flats
  const p2 = `<div class="flats n${Math.min(flats.length, 4)}">${flats.map((f, i) => flatHTML(tp, f, i, urls)).join("")}</div>${legend}`;

  // 3 — callouts
  const p3 = `<div class="split"><div class="mini-flats">${flats.slice(0, 2).map((f, i) => flatHTML(tp, f, i, urls)).join("")}</div><div>${table([
    { label: "#", w: "4%", render: (r, i) => `<b>${i + 1}</b>` }, { label: "Detail", key: "element", w: "14%" }, { label: "Location", key: "location" },
    { label: "Dimensions", key: "dims", w: "11%" }, { label: "Construction / method", key: "method" }, { label: "Material", key: "material" },
    { label: "Colour", key: "color", w: "9%" }, { label: "Placement reference", key: "placement" }, { label: "Source", w: "9%", render: (r) => tag(r.src) },
  ], d.callouts || [])}</div></div>`;

  // 4 — BOM
  const p4 = table([
    { label: "#", w: "3%", render: (r, i) => i + 1 }, { label: "Component", key: "component", w: "13%" }, { label: "Material / description", key: "material" },
    { label: "Composition", key: "composition" }, { label: "Weight / size", key: "weight", w: "9%" }, { label: "Colour", key: "color", w: "9%" },
    { label: "Supplier spec / notes", key: "supplier" }, { label: "Consumption", key: "consumption", w: "8%" }, { label: "Source", w: "8%", render: (r) => tag(r.src) },
  ], d.bom || []);

  // 5 — colours
  const p5 = table([
    { label: "Swatch", w: "7%", render: (r) => /^#?[0-9a-f]{3,8}$/i.test(r.hex || "") ? `<span class="chip" style="background:${e(r.hex.startsWith("#") ? r.hex : "#" + r.hex)}"></span>` : '<span class="chip empty"></span>' },
    { label: "Element", key: "element" }, { label: "Colour name", key: "name" }, { label: "HEX (screen ref.)", key: "hex", w: "11%" },
    { label: "Pantone TCX", key: "pantone" }, { label: "Application", key: "application" }, { label: "Source", w: "8%", render: (r) => tag(r.src) },
  ], d.colors || []) + `<p class="note">HEX values are on-screen references only and are not Pantone matches. Final colour approval is against a physical lab dip / swatch under D65 light.</p>`;

  // 6 — size chart
  const pom = d.pom || [];
  const p6 = `<table class="pom"><thead><tr><th style="width:4%">POM</th><th style="width:15%">Description</th><th>How to measure</th>${sizes.map((s) => `<th class="num${s === (o.base || "M") ? " base" : ""}">${e(s)}</th>`).join("")}<th class="num">Tol ±</th><th class="num">Grade</th><th style="width:8%">Source</th></tr></thead><tbody>${
    pom.map((r) => `<tr><td><b>${e(r.code)}</b></td><td>${dash(r.desc)}</td><td class="muted">${dash(r.how)}</td>${sizes.map((s) => `<td class="num${s === (o.base || "M") ? " base" : ""}">${dash(r.vals?.[s])}</td>`).join("")}<td class="num">${dash(r.tol)}</td><td class="num">${dash(r.grade)}</td><td>${tag(r.src)}</td></tr>`).join("")
  }</tbody></table><p class="note">All measurements in cm, garment measured flat. Base size ${e(o.base || "M")}. ${pom.some((r) => r.src !== "C") ? "<b>Measurements marked PROPOSED must be confirmed on the fit sample before grading is final.</b>" : ""}</p>`;

  // 7 — construction
  const p7 = table([
    { label: "Area / operation", key: "area", w: "18%" }, { label: "Specification", key: "spec" }, { label: "Stitch / seam type", key: "stitch", w: "16%" }, { label: "Source", w: "8%", render: (r) => tag(r.src) },
  ], d.construction || []) + `<p class="note">Stitch classes per ISO 4915 (301 lockstitch, 401 chainstitch, 406 coverstitch, 504/514 overlock, 607 flatlock). Seam allowance 1 cm unless specified.</p>`;

  // 8 — branding
  const br = d.branding || [];
  const p8 = `<div class="split"><div class="mini-flats">${flats.slice(0, 2).map((f, i) => flatHTML(tp, f, i, urls)).join("")}</div><div class="brand-blocks">${
    br.length ? br.map((r, i) => `<div class="bb"><div class="bb-art">${r.artwork ? `<img src="${e(urls[r.artwork] || "")}" alt="">` : `<span>ARTWORK FILE<br>TO BE SUPPLIED</span>`}</div>
      <div><h3><span class="pin s logo">L${i + 1}</span> ${e(r.name)} ${tag(r.src)}</h3>
      <table class="kv">${[["Placement", r.placement], ["Size (w × h)", r.size], ["Method", r.method], ["Thread / ink colours", r.colors], ["Stitch / print spec", r.specs], ["Backing", r.backing]].map(([k, v]) => `<tr><th>${k}</th><td>${dash(v)}</td></tr>`).join("")}</table></div></div>`).join("")
      : "<p>—</p>"}<p class="note">Supplied artwork must not be modified. Crown logo is the main METROMOOD mark – do not replace or redraw.</p></div></div>`;

  // 9 — labels
  const p9 = table([
    { label: "Item", key: "type", w: "14%" }, { label: "Dimensions", key: "dims", w: "11%" }, { label: "Material", key: "material" }, { label: "Method", key: "method" },
    { label: "Colours", key: "color" }, { label: "Placement", key: "placement" }, { label: "Source", w: "8%", render: (r) => tag(r.src) },
  ], d.labels || []) + `<p class="note">Care & composition label per EU Regulation 1007/2011 (fibre names in the language of the selling country) with ISO 3758 care symbols and country of origin.</p>`;

  // 10 — QC
  const qc = d.qc || {};
  const p10 = `<div class="cols2"><div><h3>Inspection checklist</h3><ul class="checks">${(qc.checks || []).filter((c) => c.on !== false).map((c) => `<li><i></i>${e(c.text)}</li>`).join("")}</ul></div>
    <div><h3>Required tests</h3>${table([{ label: "Test", key: "test" }, { label: "Method", key: "standard" }, { label: "Requirement", key: "req" }], qc.tests || [])}
    <h3>Sample approval stages</h3><p>${dash(qc.stages)}</p></div></div>`;

  // 11 — summary
  const tbc = tbcList(tp);
  const fab = (d.bom || []).find((r) => /main fabric/i.test(r.component)) || (d.bom || [])[0] || {};
  const p11 = `<div class="cols2"><div><table class="kv">${[
    ["Product / SKU", `${tp.name} · ${tp.sku || "TBC"}`], ["Category / fit", `${catLabel(tp.category)} · ${o.fit || ""}`],
    ["Main fabric", [fab.material, fab.composition, fab.weight].filter(Boolean).join(", ")], ["Colorway(s)", o.colorways],
    ["Size range", sizes.join(" / ")], ["Key construction", (d.construction || []).slice(1, 4).map((r) => `${r.area}: ${r.stitch || r.spec}`).join("\n")],
    ["Branding", br.map((r) => `${r.name} – ${r.method || "TBC"}, ${r.placement || "TBC"}`).join("\n")],
    ["Special instructions", o.dev_notes && !d.summary?.special ? o.dev_notes : d.summary?.special],
  ].map(([k, v]) => `<tr><th>${k}</th><td>${dash(v)}</td></tr>`).join("")}</table>
    <h3>Approval required before bulk</h3><ul>${(d.summary?.approvals || "").split("\n").filter((x) => x.trim()).map((x) => `<li>${e(x)}</li>`).join("")}</ul></div>
    <div><h3>Open items – to be confirmed (${tbc.length})</h3>${tbc.length ? `<table><thead><tr><th style="width:24%">Section</th><th>Item</th></tr></thead><tbody>${tbc.map(([s, t]) => `<tr><td>${e(s)}</td><td>${e(t)}</td></tr>`).join("")}</tbody></table>` : "<p>None – all specifications confirmed.</p>"}
    <div class="sign"><div><small>Approved by METROMOOD</small></div><div><small>Factory acknowledgement</small></div></div></div></div>`;

  const body = [
    page("Product overview", p1), page("Technical flats", p2), page("Design details & callouts", p3), page("Bill of materials", p4),
    page("Colour specifications", p5), page("Size specification / POM", p6), page("Construction", p7), page("Logo, print & embroidery", p8),
    page("Labels & packaging", p9), page("Quality control", p10), page("Production summary", p11),
  ].join("");

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>METROMOOD_${e((tp.sku || tp.name).replace(/\s+/g, "-"))}_TechPack_${e(tp.version || "v1")}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..900&display=swap">
<style>${CSS}</style></head><body>
<div class="toolbar"><b>Tech pack připraven.</b> V dialogu tisku zvol <b>Uložit jako PDF</b>, orientace <b>na šířku</b> a vypni „Záhlaví a zápatí“. <button onclick="print()">Uložit jako PDF</button></div>
${body}</body></html>`;
}

const CSS = `
@page { size: A4 landscape; margin: 9mm 10mm; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; color: #111; }
body { font-family: "Archivo", "Helvetica Neue", Arial, sans-serif; font-size: 8.6pt; line-height: 1.38; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.toolbar { position: sticky; top: 0; z-index: 9; background: #1a1b1d; color: #fff; padding: 10px 16px; font-size: 13px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.toolbar button { margin-left: auto; background: #f2c230; border: 0; border-radius: 99px; padding: 8px 16px; font: inherit; font-weight: 700; cursor: pointer; }
@media screen { body { background: #d9d8d3; } .page { width: 297mm; min-height: 210mm; margin: 14px auto; padding: 9mm 10mm; background: #fff; box-shadow: 0 4px 20px rgba(0,0,0,.15); } }
@media print { .toolbar { display: none; } .page { break-after: page; } .page:last-child { break-after: auto; } }
.page { display: flex; flex-direction: column; position: relative; }
.ph { display: grid; grid-template-columns: 1.3fr 2fr .9fr .6fr .8fr 1.6fr; border: 1px solid #111; margin-bottom: 5mm; }
.ph > div { padding: 5px 8px; border-right: 1px solid #111; font-weight: 600; font-size: 9pt; display: flex; flex-direction: column; justify-content: center; }
.ph > div:last-child { border-right: 0; }
.ph small { display: block; font-size: 6.2pt; text-transform: uppercase; letter-spacing: .08em; color: #777; font-weight: 600; }
.ph-brand { flex-direction: row !important; align-items: center; justify-content: flex-start !important; gap: 6px; background: #111; color: #fff; }
.ph-brand img { height: 18px; width: auto; filter: invert(1); }
.ph-brand b { font-weight: 900; font-stretch: 125%; letter-spacing: .04em; font-size: 10.5pt; }
.ph-sec { background: #f2f2ef; font-size: 10.5pt !important; font-weight: 800 !important; text-transform: uppercase; letter-spacing: .02em; }
.pb { flex: 1; }
.pf { display: flex; justify-content: space-between; border-top: 1px solid #bbb; margin-top: 4mm; padding-top: 2mm; font-size: 6.8pt; color: #777; }
h3 { font-size: 8.4pt; text-transform: uppercase; letter-spacing: .06em; margin: 10px 0 4px; font-weight: 800; }
p { margin: 0 0 6px; }
ul { margin: 0 0 6px; padding-left: 14px; }
table { width: 100%; border-collapse: collapse; font-size: 8pt; }
th, td { border: .6pt solid #9a9a9a; padding: 3.5px 5px; text-align: left; vertical-align: top; }
thead th { background: #111; color: #fff; font-weight: 700; font-size: 7pt; text-transform: uppercase; letter-spacing: .04em; border-color: #111; }
thead { display: table-header-group; } tr { break-inside: avoid; }
tbody tr:nth-child(even) td { background: #f7f7f5; }
table.kv th { background: #f2f2ef; width: 30%; font-weight: 700; font-size: 7.4pt; color: #333; text-transform: none; letter-spacing: 0; }
table.kv td { background: #fff !important; }
.num { text-align: center; white-space: nowrap; }
td.base, th.base { background: #fff3c4 !important; color: #111 !important; font-weight: 800; }
.muted, .na { color: #888; }
.note { font-size: 7.2pt; color: #555; margin-top: 6px; }
.tag { display: inline-block; font-size: 6pt; font-weight: 800; letter-spacing: .05em; padding: 1px 4px; border-radius: 2px; border: .6pt solid; white-space: nowrap; }
.t-C { color: #0b6b3a; border-color: #0b6b3a; } .t-V { color: #1f4fb8; border-color: #1f4fb8; }
.t-P { color: #8a6a00; border-color: #b08a00; background: #fff8dc; } .t-T { color: #fff; background: #c22; border-color: #c22; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; font-size: 7.2pt; margin-top: 6px; }
.legend .sw { display: inline-block; width: 22px; border-top: 1.6px solid #111; vertical-align: middle; margin-right: 5px; }
.legend .sw.dash { border-top: 1px dashed #111; }
.ov { display: grid; grid-template-columns: 42% 1fr; gap: 7mm; }
.ov-img { border: .6pt solid #bbb; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4mm; height: 112mm; }
.ov-img img { max-width: 100%; max-height: 100%; object-fit: contain; min-height: 0; flex: 1; }
.ov-img .cap { font-size: 7pt; color: #666; margin: 4px 0 0; }
.ph-empty { color: #aaa; }
.thumbs { display: flex; gap: 3mm; margin-top: 4mm; }
.thumbs figure { margin: 0; width: 34mm; } .thumbs img { width: 34mm; height: 26mm; object-fit: cover; border: .6pt solid #bbb; display: block; }
.thumbs figcaption { font-size: 6.4pt; color: #666; }
.flats { display: grid; gap: 6mm; justify-content: center; }
.flats.n1 { grid-template-columns: 110mm; } .flats.n2 { grid-template-columns: repeat(2, 105mm); } .flats.n3 { grid-template-columns: repeat(3, 1fr); } .flats.n4 { grid-template-columns: repeat(4, 1fr); }
.flat { margin: 0; text-align: center; }
.flat-box { position: relative; }
.flat-box svg, .flat-box img { width: 100%; height: auto; max-height: 128mm; display: block; margin: 0 auto; object-fit: contain; }
.flats .flat-box svg, .flats .flat-box img { max-height: 140mm; }
.flat figcaption { font-weight: 800; text-transform: uppercase; letter-spacing: .1em; font-size: 8pt; margin-top: 3px; }
.pin { position: absolute; transform: translate(-50%, -50%); min-width: 15px; height: 15px; padding: 0 3px; border-radius: 99px; background: #111; color: #fff; font-size: 7pt; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; font-style: normal; border: 1.2px solid #fff; }
.pin.logo { background: #f2c230; color: #111; border-color: #111; }
.pin.s { position: static; transform: none; vertical-align: middle; }
.split { display: grid; grid-template-columns: 30% 1fr; gap: 5mm; align-items: start; }
.mini-flats { display: grid; gap: 3mm; } .mini-flats svg, .mini-flats img { max-height: 70mm !important; }
.chip { display: inline-block; width: 28px; height: 18px; border: .6pt solid #555; vertical-align: middle; }
.chip.empty { background: repeating-linear-gradient(45deg, #fff 0 3px, #ddd 3px 6px); }
.brand-blocks { display: grid; gap: 4mm; }
.bb { display: grid; grid-template-columns: 38mm 1fr; gap: 4mm; border: .6pt solid #bbb; padding: 3mm; break-inside: avoid; }
.bb-art { border: .6pt dashed #999; display: flex; align-items: center; justify-content: center; height: 34mm; text-align: center; font-size: 7pt; color: #999; font-weight: 700; }
.bb-art img { max-width: 100%; max-height: 100%; object-fit: contain; }
.bb h3 { margin-top: 0; display: flex; gap: 6px; align-items: center; }
.cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: 7mm; }
.checks { list-style: none; padding: 0; } .checks li { display: flex; gap: 6px; padding: 2.5px 0; border-bottom: .5pt solid #ddd; }
.checks i { flex: none; width: 9px; height: 9px; border: .8pt solid #111; margin-top: 2px; }
.sign { display: grid; grid-template-columns: 1fr 1fr; gap: 5mm; margin-top: 8mm; }
.sign div { border-top: 1pt solid #111; padding-top: 2px; height: 18mm; }
.sign small { font-size: 6.8pt; text-transform: uppercase; letter-spacing: .06em; color: #555; }
`;

/** Otevře okno a pošle do tisku. `win` musí být otevřené synchronně v kliknutí (popup blocker). */
export async function printInWindow(win, html) {
  win.document.open();
  win.document.write(html);
  win.document.close();
  const doc = win.document;
  const imgs = [...doc.images].map((img) => img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })).filter(Boolean);
  await Promise.race([Promise.all(imgs), new Promise((r) => setTimeout(r, 15000))]);
  try { await doc.fonts?.ready; } catch {}
  setTimeout(() => { win.focus(); win.print(); }, 300);
}
