import { sb, q } from "./supabase.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, BUCKET, SEED_FILES } from "./config.js";
import { h, state, toast, errToast, modal, form, avatar } from "./ui.js";

import dashboard from "./views/dashboard.js";
import tasks from "./views/tasks.js";
import calendar from "./views/calendar.js";
import chat from "./views/chat.js";
import files from "./views/files.js";
import drops from "./views/drops.js";
import content from "./views/content.js";
import ideas from "./views/ideas.js";
import contacts from "./views/contacts.js";
import brand from "./views/brand.js";
import plan from "./views/plan.js";
import numbers from "./views/numbers.js";
import budget from "./views/budget.js";
import team from "./views/team.js";

// Stanice "linky" v bočním menu. owner = jen pro majitele.
const ROUTES = [
  { id: "prehled", label: "Přehled", view: dashboard, mobile: true },
  { id: "ukoly", label: "Úkoly", view: tasks, mobile: true },
  { id: "kalendar", label: "Kalendář", view: calendar, mobile: true },
  { id: "chat", label: "Chat", view: chat, mobile: true },
  { id: "soubory", label: "Soubory", view: files, mobile: true },
  { id: "dropy", label: "Dropy", view: drops },
  { id: "obsah", label: "Obsah", view: content },
  { id: "napady", label: "Nápady", view: ideas },
  { id: "kontakty", label: "Kontakty", view: contacts },
  { id: "brand", label: "Brand kit", view: brand },
  { id: "plan", label: "Plán restartu", view: plan },
  { id: "cisla", label: "Čísla", view: numbers, owner: true },
  { id: "rozpocet", label: "Rozpočet", view: budget, owner: true },
  { id: "tym", label: "Tým", view: team, owner: true },
];

const root = document.getElementById("app");
let cleanup = null;
let unread = 0;

// ---------------- theme ----------------
function applyTheme(t) {
  try { localStorage.setItem("mm-theme", t); } catch {}
  if (t === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", t);
}

// ---------------- auth ----------------
async function boot() {
  const { data } = await sb.auth.getSession();
  state.user = data.session?.user || null;
  if (!state.user) return renderLogin();
  await loadMe();
}

async function loadMe() {
  try {
    const rows = await q(sb.from("members").select("*").eq("user_id", state.user.id).limit(1));
    state.me = rows[0] || null;
    if (!state.me || state.me.status !== "active") return renderPending();
    state.members = await q(sb.from("members").select("*").eq("status", "active").order("created_at"));
    renderShell();
    route();
    if (state.isOwner) seedFiles();
    listenChat();
  } catch (e) {
    errToast(e);
    renderLogin();
  }
}

sb.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") { state.user = null; state.me = null; renderLogin(); }
});

function renderLogin() {
  cleanup?.(); cleanup = null;
  let mode = "login";
  const box = h("div.login-card");
  const draw = () => {
    box.replaceChildren();
    const isReg = mode === "register";
    const f = form([
      ...(isReg ? [{ name: "name", label: "Jméno", required: true, placeholder: "Jak ti máme říkat" }] : []),
      { name: "email", label: "E-mail", type: "email", required: true },
      { name: "password", label: "Heslo", type: "password", required: true, placeholder: isReg ? "aspoň 8 znaků" : "" },
    ]);
    const err = h("p.form-error", { role: "alert" });
    const btn = h("button.btn.primary.block", { type: "submit" }, isReg ? "Vytvořit účet" : "Přihlásit se");
    f.appendChild(err); f.appendChild(btn);
    f.addEventListener("submit", async () => {
      if (!f.validate()) return;
      const v = f.values();
      btn.disabled = true; err.textContent = "";
      try {
        if (isReg) {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
            body: JSON.stringify(v),
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error || "Registrace se nepovedla.");
        }
        const { data, error } = await sb.auth.signInWithPassword({ email: v.email, password: v.password });
        if (error) throw new Error(error.message === "Invalid login credentials" ? "Špatný e-mail nebo heslo." : error.message);
        state.user = data.user;
        await loadMe();
      } catch (e) { err.textContent = e.message; btn.disabled = false; }
    });
    box.append(
      h("div.login-mark", logo()),
      h("h1", isReg ? "Nový účet" : "Přihlášení"),
      h("p.muted", isReg ? "Po registraci tě Matthew schválí a uvidíš všechno." : "Týmový prostor MetroMood."),
      f,
      h("button.linklike", { onclick: () => { mode = isReg ? "login" : "register"; draw(); } },
        isReg ? "Už mám účet – přihlásit" : "Nemám účet – registrovat"),
    );
  };
  draw();
  root.replaceChildren(h("main.login", h("div.login-line", { "aria-hidden": "true" }), box));
}

function renderPending() {
  root.replaceChildren(h("main.login", h("div.login-card",
    h("div.login-mark", logo()),
    h("h1", "Čekáš na schválení"),
    h("p", "Účet je vytvořený. Jakmile tě Matthew v sekci Tým schválí, uvidíš úkoly, soubory, chat i kalendář."),
    h("div.row",
      h("button.btn.primary", { onclick: () => loadMe() }, "Zkusit znovu"),
      h("button.btn.ghost", { onclick: () => sb.auth.signOut() }, "Odhlásit")),
  )));
}

function logo() {
  return h("span.logo", h("span.logo-dot"), h("span", "MetroMood"), h("span.logo-hq", "HQ"));
}

// ---------------- shell ----------------
function renderShell() {
  const routes = ROUTES.filter((r) => !r.owner || state.isOwner);
  const nav = h("nav.line", { "aria-label": "Sekce" },
    routes.map((r, i) => {
      const a = h("a.station", { href: `#/${r.id}`, "data-id": r.id },
        h("span.stop", { "aria-hidden": "true" }), h("span.station-name", r.label),
        r.id === "chat" ? h("span.badge#chat-badge", { hidden: true }) : null);
      if (r.owner && !routes[i - 1]?.owner) return [h("div.line-branch", { "aria-hidden": "true" }, "jen pro tebe"), a];
      return a;
    }));
  const me = state.me;
  const side = h("aside.sidebar",
    h("a.brand", { href: "#/prehled" }, logo()),
    nav,
    h("div.side-foot",
      h("button.me", { onclick: openProfile, "aria-label": "Profil" }, avatar(me), h("span", h("strong", me.display_name), h("small", me.role_title || "")))));
  const mob = h("nav.tabbar", { "aria-label": "Rychlá navigace" },
    routes.filter((r) => r.mobile).map((r) => h("a.tab", { href: `#/${r.id}`, "data-id": r.id }, h("span.stop"), r.label)),
    h("button.tab", { onclick: () => document.body.classList.toggle("nav-open") }, h("span.stop"), "Více"));
  const main = h("main#view", { tabindex: "-1" });
  root.replaceChildren(h("div.shell", side, main, mob, h("div.scrim", { onclick: () => document.body.classList.remove("nav-open") })));
}

function openProfile() {
  const f = form([
    { name: "theme", label: "Vzhled", type: "select", options: [["system", "Podle systému"], ["light", "Světlý"], ["dark", "Tmavý"]],
      value: (() => { try { return localStorage.getItem("mm-theme") || "system"; } catch { return "system"; } })() },
    { name: "password", label: "Nové heslo (nepovinné)", type: "password", placeholder: "aspoň 8 znaků" },
  ]);
  const m = modal("Profil", [h("p.muted", `${state.me.display_name} · ${state.user.email}`), f], {
    actions: [
      h("button.btn.ghost", { onclick: () => sb.auth.signOut() }, "Odhlásit"),
      h("button.btn.primary", { onclick: async () => {
        const v = f.values();
        applyTheme(v.theme);
        if (v.password) {
          if (v.password.length < 8) return toast("Heslo musí mít aspoň 8 znaků.", "err");
          const { error } = await sb.auth.updateUser({ password: v.password });
          if (error) return errToast(error);
          toast("Heslo změněno");
        }
        m.close();
      } }, "Uložit"),
    ],
  });
}

// ---------------- router ----------------
async function route() {
  const main = document.getElementById("view");
  if (!main) return;
  const [, id = "prehled", ...rest] = (location.hash || "#/prehled").split("/");
  let r = ROUTES.find((x) => x.id === id && (!x.owner || state.isOwner)) || ROUTES[0];
  document.querySelectorAll(".station,.tab[data-id]").forEach((a) => a.classList.toggle("active", a.dataset.id === r.id));
  document.body.classList.remove("nav-open");
  document.title = `${r.label} – MetroMood HQ`;
  cleanup?.(); cleanup = null;
  main.replaceChildren();
  main.scrollTop = 0; window.scrollTo(0, 0);
  if (r.id === "chat") setUnread(0);
  try {
    cleanup = (await r.view(main, rest.map(decodeURIComponent))) || null;
  } catch (e) { errToast(e); }
}
window.addEventListener("hashchange", () => { if (state.me?.status === "active") route(); });

// ---------------- chat badge (globální) ----------------
let chatSub = null;
function listenChat() {
  chatSub?.unsubscribe();
  chatSub = sb.channel("global-msgs")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
      if (p.new.author_id === state.me.id) return;
      if (!location.hash.startsWith("#/chat")) setUnread(unread + 1);
    }).subscribe();
}
function setUnread(n) {
  unread = n;
  const b = document.getElementById("chat-badge");
  if (b) { b.hidden = !n; b.textContent = n; }
}

// ---------------- seed: brand plán do Dokumentů ----------------
async function seedFiles() {
  for (const s of SEED_FILES) {
    try {
      const exists = await q(sb.from("files").select("id").eq("name", s.name).limit(1));
      if (exists.length) continue;
      const res = await fetch(s.local, { cache: "no-store" });
      if (!res.ok) continue; // na GitHub Pages seed složka není – nic se neděje
      const blob = await res.blob();
      const folder = (await q(sb.from("folders").select("id").eq("name", s.folder).is("parent_id", null).limit(1)))[0];
      const path = `files/${crypto.randomUUID()}/${s.name}`;
      const up = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || "application/pdf" });
      if (up.error) throw up.error;
      await q(sb.from("files").insert({ folder_id: folder?.id || null, name: s.name, storage_path: path, size: blob.size,
        mime: blob.type || "application/pdf", description: s.description, uploaded_by: state.me.id }));
      toast(`${s.name} nahrán do složky ${s.folder}`);
    } catch (e) { console.warn("seed", e); }
  }
}

// ---------------- start ----------------
boot();
