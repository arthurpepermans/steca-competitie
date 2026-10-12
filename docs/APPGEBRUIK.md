# Appgebruik

De hoofdadmin opent **Mijn profiel → Appgebruik** (`/#/appgebruik`). Het dashboard toont bezoeken, actieve tijd, unieke gebruikers, paginacategorieën, dagcijfers en geslaagde opslagacties voor aanwezigheid, stemmen en opstellingen. De periode is maximaal 90 dagen; eigen gebruik is standaard uitgesloten.

## Installatie

Voer `supabase/migraties/2026-10-12_appgebruik.sql` uit na `app_schema.sql`. De migratie is herhaalbaar, wijzigt geen bestaande clubgegevens en gebruikt de bestaande `members`- en `supporter_profiles`-accounts. Publiceer daarna de frontend via de bestaande `deploy-app` workflow.

De migratie plant met de reeds geïnstalleerde pg_cron-extensie dagelijks om 03:17 UTC de taak `steca-appgebruik-retentie`. Deze verwijdert alleen records ouder dan 90 dagen uit de nieuwe gebruikstabellen. Het rapport sluit die records direct na 90 dagen uit. Zonder pg_cron moet dezelfde functie dagelijks via een servertaak worden aangeroepen; controleer de planning na installatie.

## Meetdefinities en beperkingen

- Alleen actieve, ingelogde Juniors-leden en supporters in de beveiligde app. Geen openbare bezoekers, loginpagina's, vrouwenroutes of Appgebruik-dashboard.
- Bezoek = sessie per tabblad/account; nieuw na 30 minuten zonder actief gebruik. Herladen en pagina wisselen binnen dezelfde sessie tellen niet als nieuw bezoek. Een ander tabblad/toestel kan afzonderlijk tellen.
- Paginaweergave = openen van een ondersteunde route in een zichtbaar venster. Detailroutes worden geanonimiseerd tot vaste categorieën zoals `/leden/:id`. Geen queryparameters, specifieke profielen, namen of tekstinhoud in meetverzoeken.
- Actieve tijd = zichtbaar venster met focus, tot 60 seconden na de laatste interactie. Om de vijf seconden geteld en om de vijftien seconden opgeslagen. Slapende computers worden niet als actief beschouwd. Metingen zijn schattingen; offline gebruik en afsluiten kunnen de laatste seconden verliezen.
- Cumulatieve seconden en unieke bezoek-ID's maken herhaalde en omgekeerd binnenkomende meetverzoeken idempotent. De server neemt de gebruiker uit de ingelogde sessie en begrenst de tijd en het aantal nieuwe bezoeken.
- Een daggrens in Europe/Brussels begint een nieuw pagina-meetsegment. Dagcijfers tellen sessies die die dag activiteit hebben; optellen van unieke gebruikers of dagbezoeken is daardoor niet hetzelfde als de unieke periodetelling.
- Functiegebruik komt van databasetriggers op geslaagde wijzigingen. Opnieuw opslaan kan opnieuw tellen. Er worden geen match-ID's, gekozen spelers of inhoud gekopieerd.
- Alleen een actief lid met `is_hoofdadmin` mag de rapportfunctie uitvoeren. Directe toegang tot meettabellen is voor `anon` en `authenticated` ingetrokken en RLS staat aan. Alleen servertoegang mag de opschoonfunctie uitvoeren.
- De eenmalige uitleg en de permanente tekst in Mijn profiel beschrijven wat wordt gemeten. Geen IP-adressen, locaties, formulierinhoud of schermopnames. Accountverwijdering verwijdert de bijbehorende metingen via een foreign key.

## Controle

`npm test` bevat PostgreSQL-tests met PGlite voor rollen, herhaalde installatie, ongeldige pagina's, dubbele verzoeken, supporterstoegang, triggeracties, rapporten en retentie. De tijd- en routefuncties worden apart getest. `npm run build` voert TypeScript-controle en productiecompilatie uit.

Controleer na installatie dat `cron.job` één actieve taak met naam `steca-appgebruik-retentie` bevat. Controleer het dashboard met een hoofdadmin en een gewoon account. De eerste bezoeken verschijnen pas wanneer de bijgewerkte app wordt gebruikt; er is geen historische reconstructie.
