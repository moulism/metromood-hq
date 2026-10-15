import { sb, q } from "../supabase.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";
import { h, state, modal, form, toast, errToast, confirmDialog, pageHead, loading, avatar } from "../ui.js";

const COLORS = ["#e8e2d4", "#7aa2ff", "#ff8fb1", "#f2c230", "#4fc59a", "#c58cff", "#ff9a4d", "#59c8e0"];

async function refreshMembers() {
  state.members = await q(sb.from("members").select("*").eq("status", "active").order("created_at"));
}

function openMember(m, onSaved) {
  const isNew = !m?.id;
  const f = form([
    { name: "display_name", label: "Jméno", required: true, half: true },
    { name: "role_title", label: "Role v týmu", half: true, placeholder: "např. web a reklamy" },
    { name: "email", label: "E-mail (když se s ním zaregistruje, propojí se sám)", type: "email" },
    { name: "color", label: "Barva", type: "select", options: COLORS.map((c) => [c, c]), half: true },
    { name: "app_role", label: "Oprávnění", type: "select", options: [["member", "Člen – úkoly, soubory, chat…"], ["owner", "Majitel – vidí i čísla a rozpočet"]], half: true },
    ...(isNew ? [] : [{ name: "status", label: "Stav", type: "select", options: [["active", "Aktivní"], ["pending", "Čeká na schválení"], ["disabled", "Vypnutý (nemá přístup)"]] }]),
  ], { color: COLORS[Math.floor(Math.random() * COLORS.length)], app_role: "member", ...m });
  const sw = h("div.color-row", COLORS.map((c) => h("button.color-dot", { type: "button", style: { background: c }, "aria-label": c,
    onclick: () => { f.elements.color.value = c; } })));
  f.elements.color.closest("label").after(sw);
  const save = async () => {
    if (!f.validate()) return;
    const v = f.values();
    if (m?.id === state.me.id && (v.app_role !== "owner" || v.status !== "active")) return toast("Sám sobě nemůžeš vzít přístup.", "err");
    try {
      if (isNew) await q(sb.from("members").insert({ ...v, status: "active" }));
      else await q(sb.from("members").update(v).eq("id", m.id));
      await refreshMembers();
      dlg.close(); toast("Uloženo"); onSaved();
    } catch (e) { errToast(e); }
  };
  const actions = [h("span.spacer"), h("button.btn.primary", { onclick: save }, isNew ? "Přidat člena" : "Uložit")];
  if (!isNew && m.user_id && m.id !== state.me.id) actions.unshift(h("button.btn.ghost", { onclick: () => resetPassword(m) }, "Nastavit nové heslo"));
  const dlg = modal(isNew ? "Nový člen" : m.display_name, [
    isNew ? h("p.muted", "Člen bez účtu. Vyplň e-mail – jakmile se s ním zaregistruje, rovnou se propojí a nemusíš nic schvalovat.") : null, f], { actions });
}

function resetPassword(m) {
  const f = form([{ name: "password", label: `Nové heslo pro ${m.display_name}`, type: "text", required: true, placeholder: "aspoň 8 znaků" }]);
  const dlg = modal("Nové heslo", [f, h("p.muted.small", "Pošli mu heslo osobně. Pak si ho může změnit v profilu.")], {
    actions: [h("span.spacer"), h("button.btn.primary", { onclick: async () => {
      const { password } = f.values();
      if (!password || password.length < 8) return toast("Heslo musí mít aspoň 8 znaků.", "err");
      try {
        const { data } = await sb.auth.getSession();
        const r = await fetch(`${SUPABASE_URL}/functions/v1/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${data.session.access_token}` },
          body: JSON.stringify({ member_id: m.id, password }),
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Nepovedlo se.");
        dlg.close(); toast("Heslo nastaveno");
      } catch (e) { errToast(e); }
    } }, "Nastavit")],
  });
}

export default async function view(root) {
  const body = h("div", loading());
  root.append(pageHead("Tým", "Kdo má přístup, role a schvalování nových účtů.",
    h("button.btn.primary", { onclick: () => openMember(null, load) }, "Přidat člena")), body);

  async function load() {
    try { draw(await q(sb.from("members").select("*").order("created_at"))); } catch (e) { errToast(e); }
  }

  async function approve(p, mergeInto) {
    try {
      await q(sb.rpc("approve_member", { pending_id: p.id, merge_into: mergeInto || null }));
      await refreshMembers();
      toast(`${p.display_name} schválen(a)`); load();
    } catch (e) { errToast(e); }
  }

  function draw(all) {
    const pending = all.filter((m) => m.status === "pending");
    const active = all.filter((m) => m.status === "active");
    const disabled = all.filter((m) => m.status === "disabled" && (m.user_id || m.email));
    const unlinked = active.filter((m) => !m.user_id);

    body.replaceChildren(
      pending.length ? h("section.panel.pending",
        h("h2", `Čekají na schválení (${pending.length})`),
        pending.map((p) => {
          const sel = h("select", { "aria-label": "Propojit s členem" },
            h("option", { value: "" }, "jako nový člen"),
            unlinked.map((u) => h("option", { value: u.id }, `je to ${u.display_name}`)));
          return h("div.pend",
            h("div", h("strong", p.display_name), h("small", p.email)),
            sel,
            h("button.btn.primary.small", { onclick: () => approve(p, sel.value) }, "Schválit"),
            h("button.btn.ghost.small", { onclick: async () => {
              if (!(await confirmDialog(`Zamítnout ${p.email}? Nebude mít přístup.`, "Zamítnout"))) return;
              try { await q(sb.from("members").update({ status: "disabled" }).eq("id", p.id)); load(); } catch (e) { errToast(e); }
            } }, "Zamítnout"));
        })) : null,
      h("section.members", active.map((m) => h("button.member", { onclick: () => openMember(m, load) },
        avatar(m, "lg"),
        h("span.member-text",
          h("strong", m.display_name),
          h("span", m.role_title || ""),
          h("small", m.user_id ? (m.email || "") : m.email ? `čeká na registraci (${m.email})` : "zatím bez účtu – doplň e-mail")),
        h("span.tag", { class: m.app_role === "owner" ? "hot" : "" }, m.app_role === "owner" ? "majitel" : "člen")))),
      unlinked.length ? h("p.muted.small", "Tip: pošli Jirkovi a Rozi odkaz na appku. Když jim předem vyplníš e-mail, po registraci se propojí sami. Jinak je tady schválíš a vybereš „je to Jirka“.") : null,
      disabled.length ? h("details.panel", h("summary", `Vypnuté účty (${disabled.length})`),
        disabled.map((m) => h("div.pend", h("div", h("strong", m.display_name), h("small", m.email || "")),
          h("button.btn.ghost.small", { onclick: () => openMember(m, load) }, "Upravit")))) : null);
  }
  await load();
}
