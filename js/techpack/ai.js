// Most mezi appkou a Claude: prompt (fotky + data) → JSON → zpět do tech packu.

import { catLabel, grade, SIZES } from "./defaults.js";
import { sizesOf } from "./pdf.js";

function strip(tp) {
  const d = structuredClone(tp.data || {});
  delete d.photos; delete d.flats;
  (d.callouts || []).forEach((r) => delete r.pin);
  (d.branding || []).forEach((r) => { delete r.pin; delete r.artwork; });
  (d.pom || []).forEach((r) => delete r.vals);
  return { name: tp.name, sku: tp.sku, category: tp.category, ...d };
}

export function buildPrompt(tp) {
  const sizes = sizesOf(tp.data || {});
  return `Act as a senior fashion technical designer and apparel product developer for METROMOOD (independent streetwear brand, Plzeň, Czech Republic).

I am attaching reference photos of this product. Below is the current tech pack data from our app (JSON). Improve and complete it so it becomes a professional, manufacturing-ready tech pack.

PRODUCT: ${tp.name} · SKU ${tp.sku || "TBC"} · ${catLabel(tp.category)}

BRAND RULES
- Minimalist, modern streetwear, vintage/retro references, relaxed/oversized silhouettes, premium everyday essentials.
- The CROWN is the main METROMOOD symbol, stars are secondary only. Never replace the crown. No third-party branding or look-alike designs.
- Never modify supplied artwork.

SOURCE TAGS – every row has "src": "C" = confirmed by me (already in data, do NOT change these values), "V" = clearly visible in the photos, "P" = your proposed manufacturing recommendation, "T" = unknown, must be confirmed (TBC).
Never mark your own assumptions as "C".

WHAT TO DO
1. Look at every photo carefully. Do not redesign the product. Do not skip small visible details (topstitching, bartacks, label tabs, rivets, washes, distressing, rib, drawcords…).
2. callouts: one row per visible design detail (location, dims in cm, construction method, material, colour, placement reference from HPS / CF / seam / hem).
3. bom: every material and trim, realistic composition + GSM / oz + consumption.
4. colors: HEX as screen reference; Pantone TCX only if reliably identifiable, otherwise "Match to physical swatch".
5. pom: measurements in cm for base size M fitting the stated fit, with grade increment per size and tolerance. Sizes: ${sizes.join(", ")}.
6. construction: seam + stitch types (ISO 4915: 301, 401, 406, 504, 514, 607), SPI, allowances, reinforcements, washes.
7. branding: every logo / print / embroidery – placement in cm, size w × h, method, colours, stitch or print spec, backing.
8. labels: main, size, care & composition (EU 1007/2011, ISO 3758), hangtag, packaging.
9. overview: description, features (one per line), colorways, dev_notes.
10. summary.special: special manufacturing instructions.

OUTPUT
Return ONLY one valid JSON object (no markdown, no comments) with exactly this structure – same keys as the input below:
{
  "name": "", "sku": "",
  "overview": { "collection": "", "fit": "", "colorways": "", "description": "", "features": "", "dev_notes": "", "target_customer": "" },
  "callouts": [{ "element": "", "location": "", "dims": "", "method": "", "material": "", "color": "", "placement": "", "src": "V" }],
  "bom": [{ "component": "", "material": "", "composition": "", "weight": "", "color": "", "supplier": "", "consumption": "", "src": "P" }],
  "colors": [{ "element": "", "name": "", "hex": "#000000", "pantone": "", "application": "", "src": "P" }],
  "pom": [{ "code": "A", "desc": "", "how": "", "base": 70, "grade": 2, "tol": 1, "src": "P" }],
  "construction": [{ "area": "", "spec": "", "stitch": "", "src": "P" }],
  "branding": [{ "name": "", "placement": "", "size": "", "method": "", "colors": "", "specs": "", "backing": "", "src": "P" }],
  "labels": [{ "type": "", "dims": "", "material": "", "method": "", "color": "", "placement": "", "src": "P" }],
  "summary": { "special": "", "approvals": "" }
}
Write all values in English technical vocabulary, metric units.

CURRENT DATA
${JSON.stringify(strip(tp), null, 1)}`;
}

/** Vloží JSON od AI do tech packu. Vrací počet změněných sekcí. */
export function mergeAI(tp, text) {
  let t = String(text || "").trim();
  t = t.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b < 0) throw new Error("V textu není JSON. Zkopíruj celou odpověď AI.");
  let j;
  try { j = JSON.parse(t.slice(a, b + 1)); } catch { throw new Error("JSON se nedá přečíst – zkontroluj, že je zkopírovaný celý."); }
  const d = tp.data;
  let n = 0;
  if (j.name) tp.name = j.name;
  if (j.sku) tp.sku = j.sku;
  if (j.overview && typeof j.overview === "object") { d.overview = { ...d.overview, ...clean(j.overview) }; n++; }
  if (Array.isArray(j.callouts)) {
    const old = d.callouts || [];
    d.callouts = j.callouts.map((r, i) => ({ ...r, src: r.src || "P", pin: (old.find((o) => o.element && o.element === r.element) || old[i])?.pin || null }));
    n++;
  }
  for (const k of ["bom", "colors", "construction", "labels"]) if (Array.isArray(j[k])) { d[k] = j[k].map((r) => ({ ...r, src: r.src || "P" })); n++; }
  if (Array.isArray(j.branding)) {
    const old = d.branding || [];
    d.branding = j.branding.map((r, i) => {
      const prev = old.find((o) => o.name === r.name) || old[i] || {};
      return { ...r, src: r.src || "P", artwork: prev.artwork || "", pin: prev.pin || null };
    });
    n++;
  }
  if (Array.isArray(j.pom)) {
    const sizes = sizesOf(d);
    d.pom = j.pom.map((r) => {
      const row = { ...r, src: r.src || "P" };
      row.vals = r.vals && typeof r.vals === "object" ? r.vals : grade(row, sizes, d.overview?.base || "M");
      return row;
    });
    n++;
  }
  if (j.summary && typeof j.summary === "object") { d.summary = { ...d.summary, ...clean(j.summary) }; n++; }
  return n;
}
function clean(o) { const x = {}; for (const [k, v] of Object.entries(o)) if (v != null && v !== "") x[k] = Array.isArray(v) ? v.join("\n") : String(v); return x; }
export { SIZES };
