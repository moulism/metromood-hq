// Registrace bez potvrzovacího e-mailu (žádné SMTP ani limity na e-maily).
// Nový účet je v tabulce members jako 'pending', dokud ho majitel neschválí v sekci Tým.
// Deploy: supabase functions deploy register --no-verify-jwt
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
  let body: { email?: string; password?: string; name?: string };
  try { body = await req.json(); } catch { return json({ error: "Neplatný požadavek" }, 400); }
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const name = String(body.name || "").trim().slice(0, 60);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Zadej platný e-mail." }, 400);
  if (password.length < 8) return json({ error: "Heslo musí mít aspoň 8 znaků." }, 400);
  if (!name) return json({ error: "Zadej jméno." }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name },
  });
  if (error) {
    const msg = /already|registered|exists/i.test(error.message)
      ? "Účet s tímto e-mailem už existuje – přihlas se."
      : "Registrace se nepovedla. Zkus to znovu.";
    return json({ error: msg }, 400);
  }
  return json({ ok: true });
});
