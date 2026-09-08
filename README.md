# steca-competitie: klassement, uitslagen en kalender van kavvv-vb-ov.be

Python-module die de competitiepagina's van https://www.kavvv-vb-ov.be ophaalt, parset,
het klassement herberekent volgens het reglement en alles naar Supabase synct.
Onze ploeg: **Steca Juniors** (ploegid 152, DERDE AFDELING B, seizoen 2026-2027).

## Overzicht

```
competition/
  config.py          instellingen uit .env / omgevingsvariabelen
  fetch.py           HttpSource (site, met cache) en FixtureSource (opgeslagen HTML)
  parsers.py         parse_klassement / parse_uitslagen / parse_kalender / parse_club / parse_seizoen
  teams.py           naamnormalisatie en koppeling naam -> ploegid
  standings.py       klassement berekenen (reglement art. 159) en vergelijken met het officiële
  sync.py            orkestratie: ophalen -> parsen -> rijen -> diff -> upsert; statusvlag bij fouten
  supabase_client.py PostgREST-client (SupabaseRest) en in-memory variant (MemoryDatabase)
  cli.py             sync-competition
supabase/schema.sql  tabellen, trigger voor manual_override, view standings_current, leesrechten
tests/               pytest, uitsluitend op tests/fixtures (nooit tegen het internet)
tools/dump_parse.py  parse-output van de fixtures tonen
.github/workflows/   geplande job op GitHub Actions
```

## Gebruik

```bash
pip install -e ".[dev]"
python -m pytest                                   # tests op de fixtures
python -m competition.cli --dry-run --offline tests/fixtures   # zonder internet, zonder database
python -m competition.cli --dry-run                # live pagina's, toont wat er zou wijzigen
python -m competition.cli                          # echte sync naar Supabase
```

`pip install -e .` maakt ook het commando `sync-competition` aan (zelfde opties).

Opties: `--dry-run` (niets schrijven), `--offline MAP` (HTML uit een map lezen), `--no-cache`
(alles opnieuw ophalen), `--skip-clubs` (de 92 ploegpagina's overslaan), `--env BESTAND`, `-v`.

Exitcodes: 0 = gelukt, 1 = parse- of ophaalfout (statusvlag gezet, HTML bewaard), 2 = configuratie ontbreekt.

## Instellen

1. **Supabase**: maak een project, open SQL Editor en voer `supabase/schema.sql` uit.
2. **Sleutels**: kopieer `.env.example` naar `.env` en vul `SUPABASE_URL` en `SUPABASE_SERVICE_KEY`
   (Project Settings > API > service_role) in. De service-role key omzeilt row level security; alleen
   server-side gebruiken, nooit in een app of website zetten. `.env` staat in `.gitignore`.
3. **Contactadres**: `SYNC_CONTACT` is een e-mailadres of URL dat in de User-Agent-header meegaat.
   Zo kan de sitebeheerder je bereiken als de sync ooit voor last zorgt. Zonder waarde stuurt de
   sync `StecaJuniorsCompetitionSync/1.0 (kavvv-vb-ov.be competitie-sync)`.
4. **Geplande job**: `.github/workflows/sync-competition.yml` draait op GitHub Actions, gratis binnen
   de maandelijkse minuten. Zet in de repo onder Settings > Secrets and variables > Actions de secrets
   `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` en optioneel `SYNC_CONTACT`.
   Tijden: zaterdag 20:00, zondag 18:00 en maandag 09:00 Brusselse wintertijd; in zomertijd
   loopt elke run één uur later. Handmatig starten kan via Actions > sync-competition > Run workflow
   (met vinkje voor dry-run).

Lokaal op een Windows-pc met Norton of een andere virusscanner die HTTPS onderschept: de CLI gebruikt
via het pakket `truststore` de certificaten van Windows, anders faalt elke verbinding met
`CERTIFICATE_VERIFY_FAILED`.

## Wat de sync doet

1. Haalt klassement, uitslagen en kalender op (één request per pagina, cache 6 uur) en de
   92 ploegpagina's (cache 6 dagen, dus in de praktijk wekelijks; 0,5 s tussen requests).
2. Parset alles; elke structuurafwijking gooit `ParseError`.
3. Koppelt ploegnamen uit de uitslagen aan ploegids (uitslagen tonen alleen namen; klassement en
   kalender hebben links met ploegid).
4. Bouwt één wedstrijdentabel `matches` met geplande én gespeelde wedstrijden, met het terrein van
   de thuisploeg en het uur als `HH:MM`.
5. Berekent het klassement per reeks uit de uitslagen (3-1-0; reglement art. 159: punten, dan
   gewonnen wedstrijden, dan doelsaldo) en vergelijkt per ploeg de cijfers met het officiële
   klassement. In `standings_state` staat per reeks welk klassement de app toont:
   - `gelijk`: officieel is actueel, toon `kavvv`;
   - `officieel_loopt_achter`: toon `berekend` met label `voorlopig`;
   - `officieel_loopt_voor` of `afwijking`: toon `kavvv`, verschillen staan in `verschillen`.
6. Upsert naar Supabase. Rijen met `manual_override = true` worden nooit overschreven
   (databasetrigger, en de sync slaat ze ook zelf over).
7. Zet `sync_status`: bij succes `laatste_succes_at`, bij een fout `status = 'fout'` met de
   foutmelding en de pagina, terwijl `laatste_succes_at` blijft staan. De app toont dan
   "niet bijgewerkt sinds …". De HTML die niet geparset kon worden, wordt bewaard in
   `tests/fixtures/incoming/` (in GitHub Actions als artifact van de run) zodat de parser
   bijgewerkt kan worden.

## Voor de app

Lezen kan met de anon key (row level security laat lezen toe, schrijven niet).

- `standings_current` (view): het te tonen klassement per reeks, met kolom `label`
  (`voorlopig` of null) en `vergelijking_status`.
- `matches`: kalender en uitslagen in één tabel; filter op `datum`, `reeks`, `thuis_id`/`uit_id`
  (Steca Juniors = 152). `status` is `gepland` of `gespeeld`, `uur` staat als `15:00`,
  `terrein` is het adres van de thuisploeg.
- `teams`: naam, reeks, terrein, kleuren, secretariaat (naam, adres, tel, gsm, e-mail) en
  verantwoordelijke, zoals gepubliceerd op de ploegpagina's van de site.
- `sync_status` (id `kavvv`): toon "niet bijgewerkt sinds `laatste_succes_at`" als `status <> 'ok'`.
- Handmatige correctie: pas de rij aan en zet `manual_override = true`.

## Eigenaardigheden van de site

- Klassement-kolommen zijn Pos, Team, Gesp, W, V, G, DV, DT, Pt. **V is verlies, G is gelijk.**
- De kalender toont alleen nog te spelen wedstrijden; gespeelde verhuizen naar Uitslagen.
  Kalender plus uitslagen vormen samen exact het volledige programma (n × (n-1) per reeks).
- De kalender heeft geen terrein-kolom; het terrein staat op de ploegpagina van de thuisploeg.
- Het uur staat meestal als `15:00`, soms als `15.00`. De parser maakt er altijd `HH:MM` van.
- Ploegpagina's (`club_uniek`) antwoorden met HTTP 500 maar bevatten de volledige inhoud;
  de fetcher accepteert 500 voor die pagina's en de parser controleert de structuur.
- De ploeglinks in het klassement sluiten met `</z>` in plaats van `</a>`; lxml vangt dat op.
- De Excel-export `/pdf/xls_klassement.php` levert 12 bytes rommel, ook met sessiecookie; niet bruikbaar.
- Reglement art. 159: punten, gewonnen wedstrijden, doelsaldo. De site zelf sorteert bij gelijke
  punten en zeges op doelpunten voor (historiek 2022-2026). Omdat de vergelijking op cijfers per
  ploeg gebeurt en niet op positie, telt dat niet als verschil; het berekende klassement volgt het
  reglement.
- Forfaitscore is 5-0 (reglement); een forfait-aanduiding in de scorecellen blijft bewaard in
  `opmerking`. Er was op 8 september 2026 nog geen voorbeeld op de site.

## Parser bijwerken na een sitewijziging

1. Haal het bestand uit `tests/fixtures/incoming/` (lokaal) of het artifact van de mislukte run.
2. Vergelijk met de bestaande fixture, pas `competition/parsers.py` aan, vervang de fixture en draai `pytest`.
3. Fixtures met persoonsgegevens (ploegpagina's): vervang de secretariaatsregels door fictieve
   waarden voor je ze commit, zoals in `tests/fixtures/club_uniek_149.html`.
