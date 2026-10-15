// Majitel nastaví členovi nové heslo (bez e-mailu). Ověřuje, že volající je aktivní majitel.
// Deploy: supabase functions deploy reset-password
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u, error: ue } = await admin.auth.getUser(token);
  if (ue || !u?.user) return json({ error: "Nejsi přihlášený." }, 401);
  const { data: me } = await admin.from("members").select("id").eq("user_id", u.user.id)
    .eq("status", "active").eq("app_role", "owner").maybeSingle();
  if (!me) return json({ error: "Jen pro majitele." }, 403);

  let body: { member_id?: string; password?: string };
  try { body = await req.json(); } catch { return json({ error: "Neplatný požadavek" }, 400); }
  const password = String(body.password || "");
  if (password.length < 8) return json({ error: "Heslo musí mít aspoň 8 znaků." }, 400);
  const { data: target } = await admin.from("members").select("user_id").eq("id", body.member_id || "").maybeSingle();
  if (!target?.user_id) return json({ error: "Člen nemá účet." }, 400);
  const { error } = await admin.auth.admin.updateUserById(target.user_id, { password });
  if (error) return json({ error: "Nepovedlo se nastavit heslo." }, 400);
  return json({ ok: true });
});
