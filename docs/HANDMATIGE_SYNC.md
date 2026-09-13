# Handmatig competitiegegevens vernieuwen

Actieve admins vinden **Wedstrijdgegevens beheren** op hun profiel. De knop start dezelfde productie-workflow als het automatische rooster, met `fresh=true` om alle bronpagina's opnieuw op te halen. Bestaande handmatige correcties blijven via de bestaande scraperregels beschermd.

## Installatie

1. Voer het onderdeel `-- Handmatige competitie-update:` uit `supabase/app_schema.sql` uit (of herhaal het volledige idempotente schema).
2. Maak een fine-grained GitHub-token voor uitsluitend `arthurpepermans/steca-competitie`, met Actions read/write en de verplichte Metadata read-only. Bewaar het uitsluitend als Edge Function-secret `COMPETITION_GITHUB_TOKEN` in productie.
3. Publiceer `competition-sync`. Bij gebruik van de dashboardeditor: plaats eerst `_shared/competition-sync.ts` en daarna `competition-sync/index.ts` in één bestand, zonder de import van de gedeelde module. De functie valideert zelf de JWT en actieve adminrechten; `verify_jwt=false` staat in `supabase/config.toml`.
4. Publiceer de workflow en app via een pull request. Test met een ingelogde admin; controleer de status en de nieuwe succesvolle synchronisatietijd.

De bestemming en branch staan vast op de server. De browser krijgt nooit het GitHub-token. Directe tabeltoegang en uitvoering van de claimfunctie zijn voor anon/authenticated ingetrokken. De server controleert adminrechten en reserveert de aanvraag atomair. Een nieuwe aanvraag is pas na vijf minuten mogelijk; een bestaande aanvraag moet ook afgelopen zijn. De workflow gebruikt daarnaast de bestaande GitHub-concurrencygroep.

Een verloren dispatchantwoord wordt teruggevonden via de unieke aanvraagnaam, zonder opnieuw te dispatchen. De status wordt elke vijftien seconden opgehaald zolang het profiel zichtbaar is. Als GitHub geen aanvraag terugvindt na tien minuten wordt die als mislukt gemarkeerd. Bij een onbereikbare GitHub-API blijft de reservering staan totdat de status weer te controleren is.

Het token kan worden ingetrokken in GitHub Developer settings. Vervang daarna het Supabase-secret. Er zijn geen rechten om broncode te veranderen of andere repositories te beheren. De testapp mag deze productiefunctie niet overnemen: voor test is een aparte bestemming en sleutel nodig.
