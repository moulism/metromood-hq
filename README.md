# MetroMood HQ

Týmový prostor pro MetroMood: úkoly, sdílené soubory, chat, kalendář, dropy, plán obsahu, nápady, kontakty, brand kit a plán restartu. Pro majitele navíc čísla, rozpočet a správa týmu.

Čisté HTML + CSS + JavaScript (ES moduly, bez buildu). Backend je Supabase projekt **metromood-hq** (`nogomyljbcpmteclpxny`).

## Spuštění ve VS Code

1. Otevři složku `metromood-hq` ve VS Code (nebo dvojklik na `metromood-hq.code-workspace`).
2. VS Code nabídne doporučená rozšíření – nainstaluj **Live Server**.
3. Vpravo dole klikni **Go Live** → appka běží na `http://127.0.0.1:5510`.
4. Klikni na **Registrovat**, zadej e-mail `matyas.moulis.mm@gmail.com` a heslo. Tenhle e-mail je předem nastavený jako majitel, takže jsi hned uvnitř.
5. Při prvním přihlášení se brand plán (`seed/MetroMood-BrandPlan.pdf`) sám nahraje do složky **Soubory → Dokumenty**.

## Synchronizace s GitHubem

Složka je už git repozitář s prvním commitem. Propojení s GitHubem:

1. Ve VS Code otevři **Source Control** (Ctrl/Cmd + Shift + G).
2. Klikni **Publish Branch** → vyber **Publish to GitHub public/private repository** → název `metromood-hq`.
   - Doporučuji **private** – appka je interní. GitHub Pages na private repu ale potřebuje GitHub Pro; jinak zvol public (data jsou stejně chráněná přihlášením a RLS, v repu nejsou žádná tajná data – `seed/` je v `.gitignore`).
3. Od té doby stačí v Source Control: napsat zprávu → **Commit** → **Sync Changes**.

### Nasazení na web (GitHub Pages)
Na GitHubu: repo → **Settings → Pages → Deploy from a branch → `main` / root**. Za chvíli běží na `https://moulism.github.io/metromood-hq/`. Tenhle odkaz pošli Jirkovi a Rozi.

## Jak se přidá tým

- **Varianta A (nejrychlejší):** v sekci **Tým** otevři Jirku/Rozi a vyplň jim e-mail. Když se s ním zaregistrují, propojí se sami a hned vidí svoje úkoly.
- **Varianta B:** pošli jim odkaz, zaregistrují se, v sekci **Tým** se objeví mezi čekajícími → vyber „je to Jirka“ → **Schválit**.
- Zapomenuté heslo: v sekci Tým otevři člena → **Nastavit nové heslo** (e-maily se neposílají).

## Co kdo vidí

| Sekce | Členové | Majitel |
|---|---|---|
| Přehled, Úkoly, Kalendář, Chat, Soubory, Dropy, Obsah, Nápady, Kontakty, Brand kit, Plán | ✔ | ✔ |
| Čísla, Rozpočet, Tým | – | ✔ |

Hlídá to databáze (Row Level Security), ne jen schované menu.

## Struktura

```
index.html            vstup
css/app.css           veškerý vzhled (světlý/tmavý režim)
js/app.js             přihlášení, menu, router
js/ui.js              pomocné funkce (formuláře, modaly, data)
js/storage.js         nahrávání souborů do Supabase Storage
js/views/*.js         jednotlivé sekce
js/vendor/            supabase-js (bez CDN)
supabase/functions/   edge funkce register + reset-password
supabase/schema.sql   popis databáze
seed/                 interní soubory k jednorázovému nahrání (NEJDE na GitHub)
```

## Supabase

- Dashboard: https://supabase.com/dashboard/project/nogomyljbcpmteclpxny
- Soubory jsou v soukromém bucketu `team` (max 50 MB na soubor, free plán má 1 GB celkem).
- Registrace jde přes edge funkci `register`, takže se neposílají žádné potvrzovací e-maily.
