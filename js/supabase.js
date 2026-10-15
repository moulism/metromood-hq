import { createClient } from "./vendor/supabase.esm.js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

// Malý wrapper: vrátí data, nebo vyhodí čitelnou chybu.
export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(error.message || "Chyba databáze");
  return data;
}
