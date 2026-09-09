# Brief: webapp Steca Juniors

Versie 2026-09-08. Doel: één plek voor spelers, staf en supporters van Steca Juniors met kalender,
uitslagen, klassement, aanwezigheden, opstelling, statistieken en ledenlijst. Mobile-first website,
toe te voegen aan het beginscherm van de telefoon. Nederlands. Seizoen 2026-2027; alles wordt per
seizoen opgeslagen zodat volgende seizoenen erbij kunnen.

## 1. Accounts en toegang

- De hele app zit achter een login (e-mailadres + wachtwoord).
- **Registreren**: iedereen kan een account aanmaken via de registratiepagina. Een QR-code naar die
  pagina wordt meegeleverd om te delen in de kleedkamer of groepschat. Na registratie staat het
  account op "wacht op goedkeuring" en ziet de persoon alleen dat scherm.
- **Spelerslijst als basis**: de leden staan in de database, ook zonder account (geïmporteerd uit de
  spelerslijst of door een admin toegevoegd). Een account is een koppeling aan zo'n lid. Bij registratie
  met hetzelfde e-mailadres als in de lijst wordt het account meteen gekoppeld en actief; met dezelfde
  voor- en achternaam maar een ander e-mailadres wordt het gekoppeld maar moet een admin eerst goedkeuren
  (tot dan blijven de persoonlijke gegevens onzichtbaar). Wordt een account verwijderd, dan blijven de
  gegevens van het lid staan en wordt een latere registratie er opnieuw aan gekoppeld.
- **Goedkeuren**: een admin keurt goed, kent de functie toe en kan gegevens aanpassen. Admins kunnen ook
  zelf leden toevoegen zonder account.
- **Wachtwoorden** kiest iedereen zelf bij registratie. Ze worden gehasht opgeslagen door Supabase
  Auth; niemand kan ze lezen, ook admins niet. Iedereen kan zijn eigen wachtwoord wijzigen. Een
  admin kan voor elk lid een nieuw wachtwoord instellen, ook voor andere admins, maar niet voor de
  hoofdadmin; elke keer wordt gelogd wie dat deed en voor wie.
- **Admins**: Arthur is hoofdadmin. Admins kunnen andere leden admin maken en adminrechten afnemen,
  maar niet van de hoofdadmin. De hoofdadmin kan alles. Admin is een vlag los van de functie
  (een coach kan ook admin zijn).
- **Geen e-mailbevestiging bij registratie**: de goedkeuring door een admin in de app is de poort.
  "Wachtwoord vergeten" verstuurt wel een e-mail (beperkt aantal per uur; volstaat voor een club).

## 2. Functies en rechten

Functies: speler, spelercoach, coach, verantwoordelijke, supporter. Spelercoach heeft de rechten
van coach én telt mee als speler (aanwezigheid, opstelling, statistieken). Een verantwoordelijke
telt ook altijd mee als speler; een coach en een supporter niet.

| Wat | speler | spelercoach / coach / verantwoordelijke | admin | supporter |
|---|---|---|---|---|
| Kalender, uitslagen, klassement, ploegen bekijken | ja | ja | ja | ja |
| Contactgegevens andere clubs (terrein, secretaris, verantwoordelijke) | ja | ja | ja | ja |
| Eigen aanwezigheid zetten | ja | ja | ja | nee |
| Aanwezigheid van anderen zetten | nee | ja | ja | nee |
| Lijst "wie komt er" bekijken | ja | ja | ja | ja |
| Lijst zoals ze 24 u voor de match was | nee | nee | ja | nee |
| Opstelling bekijken (huidige en vorige) | ja | ja | ja | ja |
| Opstelling maken/wijzigen | nee | ja | ja | nee |
| Statistieken bekijken (topschutter enz.) | ja | ja | ja | ja |
| Statistieken invoeren/wijzigen | nee | ja | ja | nee |
| Ledenlijst: naam en functie | ja | ja | ja | ja |
| Ledenlijst: telefoon, geboortedatum, adres, e-mail | ja | ja | ja | nee |
| Eigen gegevens en wachtwoord wijzigen | ja | ja | ja | ja |
| Leden goedkeuren, functie/gegevens wijzigen, wachtwoord zetten | nee | nee | ja | nee |
| Admin maken of afnemen | nee | nee | ja (niet van hoofdadmin) | nee |

Rechten worden in de database afgedwongen (row level security en beveiligde functies), niet alleen
in de schermen.

## 3. Schermen

1. **Inloggen / Registreren / Wacht op goedkeuring / Wachtwoord vergeten.**
2. **Home**: volgende match (datum, uur, tegenstander, thuis of uit, terreinadres met knop naar
   Google Maps, eigen aanwezigheid direct te zetten), laatste uitslag, stand van Steca Juniors in
   DERDE AFDELING B (positie, gespeeld, punten). Onderaan klein: "laatst bijgewerkt op …" of
   "niet bijgewerkt sinds …" als de sync faalde.
3. **Kalender en uitslagen**: standaard alle matchen van Steca (gespeeld met score, gepland met uur
   en terreinadres met Maps-knop). Schakelaar naar de hele reeks, gegroepeerd per speeldag. Per
   Steca-match: aanwezigheid (aanwezig / afwezig / onzeker) en de lijst van wie wat aangaf, met
   tellers. Staf kan andermans aanwezigheid zetten. Aanpassen mag tot en met de dag zelf.
   Admins zien per match ook de lijst zoals ze 24 uur voor de aftrap was.
4. **Klassement**: standaard DERDE AFDELING B, andere reeksen kiesbaar. Label "voorlopig" als het
   berekende klassement getoond wordt. Tabblad **Statistieken** (Steca-spelers, per seizoen):
   topschutter, assistenkoning, gele en rode kaarten, clean sheets (matchen zonder tegendoelpunt,
   afgeleid uit de officiële uitslag) en gespeelde matchen.
5. **Ploegen**: alle ploegen van de reeks (andere reeksen kiesbaar) met terrein (Maps-knop),
   kleuren en contact van secretaris en verantwoordelijke. Per ploeg: laatste uitslagen en huidige stand.
6. **Opstelling**: de opstelling voor de volgende match op een veldje, of "opstelling voor volgende
   match nog niet gemaakt". Staf maakt ze via dropdowns: 11 basisspelers op de posities van de
   gekozen formatie (standaard 4-3-3, ook 4-4-2 en 3-4-3) plus 4 bankspelers; alleen goedgekeurde
   spelers en spelercoaches zijn kiesbaar, elke speler maximaal één keer. Vorige opstellingen
   per match te bekijken.
7. **Leden**: lijst met naam en functie, zoeken en filteren op functie. Detail met gegevens
   volgens de rechten hierboven. Admins: goedkeuren, functie en gegevens wijzigen, admin maken
   of afnemen, wachtwoord instellen, lid deactiveren.
8. **Profiel**: eigen gegevens en wachtwoord. Spelers, spelercoaches, coaches en verantwoordelijken
   moeten telefoonnummer, geboortedatum en adres invullen; zolang dat ontbreekt, vraagt de app
   erom bij elke start.

## 4. Statistieken en geschiedenis

- Statistieken worden **per match** ingevoerd: per speler goals, assists, gele kaarten, rode
  kaarten en "gespeeld". Totalen zijn altijd de som over de matchen; niets wordt apart opgeteld.
- Als het aantal ingevoerde goals niet klopt met de officiële score van de match, toont de app een
  waarschuwing (opslaan kan wel; de officiële score komt van de federatie en blijft leidend).
- **Logboek**: elke wijziging aan statistieken, opstellingen, aanwezigheden en ledengegevens wordt
  automatisch bewaard met wie, wanneer, oude en nieuwe waarde (databasetrigger, niet te omzeilen).
  Staf en admins zien per match de geschiedenis van de statistieken en kunnen een vorige versie
  terugzetten.
- De **24-uurslijst** wordt uit datzelfde logboek afgeleid: de laatste status van elk lid vóór
  (aftrap min 24 u). Er is dus geen aparte klok nodig en de lijst is achteraf altijd exact.

## 5. Gegevens

Bestaand (gevuld door de sync): `teams`, `matches`, `standings`, `standings_state`, `sync_status`.

Nieuw:

- `members`: gekoppeld aan het auth-account; naam, functie, e-mail, telefoon, geboortedatum,
  adres, status (wacht_op_goedkeuring / actief / inactief), is_admin, is_hoofdadmin, seizoen.
- `attendance`: per match en lid de huidige status (aanwezig / afwezig / onzeker), door wie gezet.
- `lineups`: per match één opstelling met formatie, gemaakt door, gepubliceerd op.
- `lineup_players`: per opstelling de spelers met positie (basis) of banknummer.
- `match_stats`: per match en speler goals, assists, geel, rood, gespeeld, ingevoerd door.
- `audit_log`: tabel, rij, actie, oude en nieuwe waarde, wie, wanneer (automatisch gevuld).

## 6. Techniek

- React + Vite + TypeScript, map `app/` in deze repo. Supabase JS-client met de anon key;
  Supabase Auth voor accounts; Postgres met row level security voor de rechten.
- Hosting gratis op GitHub Pages vanuit deze repo (eigen workflow), voorlopig op
  `https://stecajuniors.app/`. Arthur koopt een eigen domein; dat wordt
  daarna aan GitHub Pages gekoppeld (CNAME) en de QR-code wordt opnieuw gemaakt.
- PWA-manifest zodat de site op het beginscherm van de telefoon kan.
- In Supabase moet eenmalig ingesteld worden: Authentication > Providers > Email >
  "Confirm email" uit, en Authentication > URL Configuration > Site URL op het adres hierboven.
- Ontwerp: functioneel en consistent, met één stijlbestand, zodat een designtool of eigen ontwerp
  later de schermen kan overnemen zonder de logica te raken.

## 7. Later, niet nu

Ontwerp op maat, pushmeldingen (bv. "zet je aanwezigheid"), meerdere ploegen of seizoenen naast
elkaar, exporten, notities per speler.
