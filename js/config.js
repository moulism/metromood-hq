// Veřejná konfigurace. Anon klíč je bezpečné mít v prohlížeči —
// přístup k datům hlídá Row Level Security v databázi (jen schválení členové týmu).
export const SUPABASE_URL = "https://nogomyljbcpmteclpxny.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vZ29teWxqYmNwbXRlY2xweG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwOTU5MDIsImV4cCI6MjEwNzY3MTkwMn0.I0rgN4zD-LiatIKIBw7BoYTxsHXylPcf7B_wfadgwf4";

export const BUCKET = "team";

// Soubor, který se při prvním přihlášení majitele (lokálně z VS Code) sám nahraje
// do složky Dokumenty. Složka /seed je v .gitignore, takže nikdy nejde na GitHub.
export const SEED_FILES = [
  { local: "seed/MetroMood-BrandPlan.pdf", name: "MetroMood-BrandPlan.pdf", folder: "Dokumenty",
    description: "Plán restartu značky – start 1. 11. 2026 (verze z 26. 10. 2026)" },
];

// Limity Supabase (free plán): 50 MB na soubor, 1 GB celkem ve storage.
// Při přechodu na Pro plán stačí tady zvýšit (a v Supabase → Storage → Settings).
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const STORAGE_LIMIT_BYTES = 1024 * 1024 * 1024;
