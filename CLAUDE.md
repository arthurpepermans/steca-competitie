# steca-competitie

Webapp en sync voor de amateurvoetbalploeg **Steca Juniors** (KAVVV VB&OV, ploegid 152, DERDE AFDELING B,
seizoen 2026-2027). Alles in het Nederlands, ook code-commentaar en commitberichten. Geen gedachtestreepjes
(em-dashes) in teksten.

## Twee delen

1. **`competition/`** (Python): haalt klassement, uitslagen, kalender en ploegpagina's van
   https://www.kavvv-vb-ov.be, herberekent het klassement (reglement art. 159) en synct naar Supabase.
   Draait op GitHub Actions (`.github/workflows/sync-competition.yml`) op za 20u, zo 18u, ma 9u.
   Tests: `python -m pytest` in de repo-root, uitsluitend op `tests/fixtures/` (nooit tegen het internet).
   Details en eigenaardigheden van de site: `README.md`.
2. **`app/`** (React + Vite + TypeScript): mobile-first webapp voor spelers, staf en supporters.
   Supabase Auth + Postgres met row level security. Live op https://arthurpepermans.github.io/steca-competitie/
   via `.github/workflows/deploy-app.yml`. Functionele beschrijving, rollen en rechten: `docs/APP_BRIEF.md`.

## Database

- `supabase/schema.sql`: synctabellen (teams, matches, standings, standings_state, sync_status).
- `supabase/app_schema.sql`: leden, aanwezigheden, opstellingen, statistieken, logboek, adminfuncties, RLS.
  Idempotent: mag opnieuw uitgevoerd worden. Wijzig je het schema, pas dan dit bestand aan (geen losse
  migraties) en meld dat het opnieuw gedraaid moet worden in de SQL Editor.
- Rechten worden in de database afgedwongen (policies en triggers), niet alleen in de schermen.
  Sleutelfuncties: `is_admin()`, `is_staf()`, `is_supporter()`, `my_member_id()`.
- `members.naam` en `members.speelt` zijn afgeleid (trigger `members_naam`): naam = voornaam + achternaam,
  speelt = functie in (speler, spelercoach, verantwoordelijke).
- Elke wijziging aan members, attendance, lineups, lineup_players en match_stats komt in `audit_log`.

## Werkwijze

- Werk op een branch en maak een pull request: elke push naar `main` in `app/` gaat meteen live.
- Voor je pusht: `cd app && npm test && npm run build` (en `python -m pytest` bij wijzigingen in `competition/`).
- Lokaal draaien: `app/.env.local` met `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` (zie `app/.env.example`),
  dan `npm run dev`. De anon key staat in Supabase > Project Settings > API.
- Geen sleutels in de repo. `.env`, `app/.env.local` en `.cache/` staan in `.gitignore`.
- Fixtures met persoonsgegevens (ploegpagina's) alleen committen met fictieve contactgegevens.
- Ontwerp is bewust functioneel; stijl staat in `app/src/styles.css` met CSS-variabelen. Een echt ontwerp
  volgt later; hou logica en opmaak gescheiden.
- Data van de federatie (scores, klassement) is leidend en wordt nooit met de hand aangepast; handmatige
  correcties gebeuren met `manual_override = true` op de rij.
