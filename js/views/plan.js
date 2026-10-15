import { sb, q } from "../supabase.js";
import { h, state, modal, form, toast, errToast, pageHead, loading, esc, fmtLong } from "../ui.js";
import { previewFile } from "./files.js";

/** Minimalistický markdown: nadpisy, odstavce, seznamy, tabulky, tučné. */
export function md(src) {
  const inline = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  const lines = src.replace(/\r/g, "").split("\n");
  let out = "", i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)/))) {
      const lvl = Math.min(4, m[1].length + 0);
      const id = m[2].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
      out += `<h${lvl} id="${id}">${inline(m[2])}</h${lvl}>`; i++; continue;
    }
    if (/^\|/.test(l)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(lines[i]); i++; }
      const cells = (r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const [head, , ...rest] = rows;
      out += `<div class="table-wrap"><table><thead><tr>${cells(head).map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${
        rest.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      continue;
    }
    if (/^\s*[-*]\s+/.test(l)) {
      out += "<ul>";
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { out += `<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ""))}</li>`; i++; }
      out += "</ul>"; continue;
    }
    if (/^\s*\d+\.\s+/.test(l)) {
      out += "<ol>";
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { out += `<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`; i++; }
      out += "</ol>"; continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#|\||\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) { para.push(lines[i]); i++; }
    out += `<p>${para.map(inline).join("<br>")}</p>`;
  }
  return out;
}

export default async function view(root) {
  const body = h("div", loading());
  const actions = h("div.page-actions");
  root.append(pageHead("Plán restartu", null), body);
  root.querySelector(".page-head").append(actions);
  let plan = null;

  async function load() {
    try {
      const row = (await q(sb.from("app_settings").select("value").eq("key", "brand_plan")))[0];
      plan = row?.value || { title: "Plán", md: "" };
      const pdf = (await q(sb.from("files").select("*").ilike("name", "%BrandPlan%.pdf").limit(1)))[0];
      root.querySelector(".page-head h1").textContent = plan.title || "Plán restartu";
      root.querySelector(".page-head").querySelector(".sub")?.remove();
      root.querySelector(".page-head > div").append(h("p.sub", plan.date ? `Verze z ${fmtLong(plan.date)}` : ""));
      actions.replaceChildren(
        pdf ? h("button.btn", { onclick: () => previewFile(pdf) }, "Otevřít PDF") : null,
        state.isOwner ? h("button.btn.ghost", { onclick: edit }, "Upravit text") : null);
      const doc = h("article.doc", { html: md(plan.md || "") });
      const toc = h("nav.toc", { "aria-label": "Obsah plánu" },
        [...doc.querySelectorAll("h2")].map((x) => h("a", { href: "#", onclick: (e) => { e.preventDefault(); x.scrollIntoView({ behavior: "smooth", block: "start" }); } }, x.textContent)));
      body.replaceChildren(h("div.doc-wrap", toc, doc));
    } catch (e) { errToast(e); }
  }

  function edit() {
    const f = form([
      { name: "title", label: "Název" },
      { name: "date", label: "Datum verze", type: "date" },
      { name: "md", label: "Text (markdown: ## nadpis, - odrážka, | tabulka |, **tučně**)", type: "textarea", rows: 22 },
    ], plan);
    const m = modal("Upravit plán", f, { wide: true, actions: [h("span.spacer"), h("button.btn.primary", { onclick: async () => {
      try {
        await q(sb.from("app_settings").upsert({ key: "brand_plan", value: f.values(), updated_at: new Date().toISOString() }));
        m.close(); toast("Plán uložen"); load();
      } catch (e) { errToast(e); }
    } }, "Uložit")] });
  }
  await load();
}
