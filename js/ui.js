// Drobné UI pomocníky: tvorba elementů, toasty, modaly, formátování.

// append/prepend/replaceChildren ignorují null/false (podmíněné bloky ve view).
for (const name of ["append", "prepend", "replaceChildren"]) {
  const orig = Element.prototype[name];
  Element.prototype[name] = function (...nodes) {
    return orig.apply(this, nodes.flat(Infinity).filter((n) => n != null && n !== false));
  };
}

export const state = {
  user: null,      // auth user
  me: null,        // řádek z members
  members: [],     // aktivní členové
  get isOwner() { return this.me?.app_role === "owner"; },
  member(id) { return this.members.find((m) => m.id === id); },
};

/** h("div.card#x", {onclick}, ...children) */
export function h(tag, attrs, ...children) {
  if (attrs == null || typeof attrs !== "object" || attrs instanceof Node || Array.isArray(attrs)) {
    if (attrs !== undefined && attrs !== null) children.unshift(attrs);
    attrs = {};
  }
  const [, name = "div", rest = ""] = tag.match(/^([a-z0-9-]*)(.*)$/i) || [];
  const el = document.createElement(name || "div");
  (rest.match(/[.#][^.#]+/g) || []).forEach((p) => {
    if (p[0] === ".") el.classList.add(p.slice(1));
    else el.id = p.slice(1);
  });
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className += (el.className ? " " : "") + v;
    else if (k === "style" && typeof v === "object") {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith("--")) el.style.setProperty(sk, sv); else el.style[sk] = sv;
      }
    }
    else if (k === "html") el.innerHTML = v;
    else if (k in el && k !== "list" && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  append(el, children);
  return el;
}
function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// ---------- toast ----------
export function toast(msg, kind = "ok") {
  let box = document.getElementById("toasts");
  if (!box) { box = h("div#toasts"); document.body.appendChild(box); }
  const t = h("div.toast", { class: kind, role: "status" }, msg);
  box.appendChild(t);
  setTimeout(() => t.classList.add("out"), 3200);
  setTimeout(() => t.remove(), 3700);
}
export function errToast(e) { console.error(e); toast(e?.message || String(e), "err"); }

// ---------- modal ----------
export function modal(title, body, { actions = [], wide = false, onClose } = {}) {
  const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); onClose?.(); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  const wrap = h("div.modal-wrap", { onclick: (e) => { if (e.target === wrap) close(); } },
    h("div.modal", { class: wide ? "wide" : "", role: "dialog", "aria-modal": "true", "aria-label": title },
      h("header.modal-head", h("h2", title), h("button.icon-btn", { "aria-label": "Zavřít", onclick: close }, "✕")),
      h("div.modal-body", body),
      actions.length ? h("footer.modal-foot", actions) : null));
  document.body.appendChild(wrap);
  document.addEventListener("keydown", onKey);
  setTimeout(() => wrap.querySelector("input,textarea,select")?.focus(), 30);
  return { close, el: wrap };
}

export function confirmDialog(text, okLabel = "Smazat") {
  return new Promise((res) => {
    const m = modal("Opravdu?", h("p", text), {
      actions: [
        h("button.btn.ghost", { onclick: () => { m.close(); res(false); } }, "Zpět"),
        h("button.btn.danger", { onclick: () => { m.close(); res(true); } }, okLabel),
      ],
      onClose: () => res(false),
    });
  });
}

/** Jednoduchý formulář. fields: [{name,label,type,options,value,required,placeholder,rows}] */
export function form(fields, values = {}) {
  const el = h("form.form", { onsubmit: (e) => e.preventDefault() });
  for (const f of fields) {
    if (f.type === "hidden") continue;
    const v = values[f.name] ?? f.value ?? "";
    let input;
    if (f.type === "select") {
      input = h("select", { name: f.name },
        f.options.map((o) => {
          const [val, lab] = Array.isArray(o) ? o : [o, o];
          return h("option", { value: val ?? "", selected: String(val ?? "") === String(v ?? "") }, lab);
        }));
    } else if (f.type === "textarea") {
      input = h("textarea", { name: f.name, rows: f.rows || 4, placeholder: f.placeholder || "" });
      input.value = v ?? "";
    } else if (f.type === "checkbox") {
      input = h("input", { type: "checkbox", name: f.name, checked: !!v });
    } else {
      input = h("input", { type: f.type || "text", name: f.name, placeholder: f.placeholder || "", step: f.step });
      input.value = v ?? "";
    }
    if (f.required) input.required = true;
    el.appendChild(h("label.field", { class: f.half ? "half" : "" }, h("span", f.label), input));
  }
  el.values = () => {
    const out = {};
    for (const f of fields) {
      if (f.type === "hidden") continue;
      const i = el.elements[f.name];
      let v = f.type === "checkbox" ? i.checked : i.value.trim();
      if (v === "" && f.type !== "checkbox") v = null;
      if (f.type === "number" && v != null) v = Number(v);
      out[f.name] = v;
    }
    return out;
  };
  el.validate = () => el.reportValidity();
  return el;
}

// ---------- formátování ----------
const MONTHS = ["leden","únor","březen","duben","květen","červen","červenec","srpen","září","říjen","listopad","prosinec"];
const MONTHS_GEN = ["ledna","února","března","dubna","května","června","července","srpna","září","října","listopadu","prosince"];
const DAYS = ["ne","po","út","st","čt","pá","so"];
export { MONTHS, DAYS };

export function ymd(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}
export function parseDate(s) {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
  return new Date(s);
}
export const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export function daysFrom(s) { const d = parseDate(s); return d ? Math.round((d - today()) / 864e5) : null; }

export function fmtDate(s, { year = false, weekday = false } = {}) {
  const d = parseDate(s);
  if (!d) return "";
  let out = `${d.getDate()}. ${d.getMonth() + 1}.`;
  if (year || d.getFullYear() !== new Date().getFullYear()) out += ` ${d.getFullYear()}`;
  if (weekday) out = `${DAYS[d.getDay()]} ${out}`;
  return out;
}
export function fmtLong(s) { const d = parseDate(s); return `${d.getDate()}. ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`; }
export function fmtTime(s) { const d = new Date(s); return d.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" }); }
export function fmtRelDue(s) {
  const n = daysFrom(s);
  if (n == null) return "";
  if (n === 0) return "dnes";
  if (n === 1) return "zítra";
  if (n === -1) return "včera";
  if (n < 0) return `${-n} dní po termínu`;
  if (n < 7) return `za ${n} ${n < 5 ? "dny" : "dní"}`;
  return fmtDate(s);
}
export const kc = (n) => n == null || n === "" ? "–" : `${Number(n).toLocaleString("cs-CZ")} Kč`;
export const num = (n) => n == null || n === "" ? "–" : Number(n).toLocaleString("cs-CZ");
export function fmtSize(b) {
  if (b == null) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} kB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}
export function startOfWeek(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x;
}
export function monthName(d) { const x = parseDate(d); return `${MONTHS[x.getMonth()]} ${x.getFullYear()}`; }

// ---------- členové ----------
export function avatar(member, size = "") {
  if (!member) return h("span.avatar", { class: size, title: "Nepřiřazeno" }, "?");
  return h("span.avatar", { class: size, title: member.display_name, style: { "--c": member.color || "#888" } },
    (member.display_name || "?").slice(0, 1).toUpperCase());
}
export function memberOptions(withEmpty = true) {
  const opts = state.members.map((m) => [m.id, m.display_name]);
  return withEmpty ? [["", "— nikdo —"], ...opts] : opts;
}

export function pageHead(title, sub, ...actions) {
  return h("header.page-head",
    h("div", h("h1", title), sub ? h("p.sub", sub) : null),
    actions.length ? h("div.page-actions", actions) : null);
}

export function chips(options, value, onChange) {
  const wrap = h("div.chips", { role: "group" });
  const draw = (v) => {
    wrap.replaceChildren(...options.map(([val, label]) =>
      h("button.chip", { type: "button", "aria-pressed": String(val === v), onclick: () => { draw(val); onChange(val); } }, label)));
  };
  draw(value);
  return wrap;
}

export function empty(text, action) {
  return h("div.empty", h("p", text), action || null);
}
export function loading() { return h("div.loading", h("span.dot"), h("span.dot"), h("span.dot")); }

export function linkify(text) {
  return esc(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, "<br>");
}
