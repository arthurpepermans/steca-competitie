# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Alle betrokkenen van de amateurvoetbalploeg Steca Juniors (KAVVV VB&OV, DERDE AFDELING B, Dendermonde), in gelijke mate: spelers, staf (coach, speler-coach, verantwoordelijke), supporters en ouders. Gebruik gebeurt op de telefoon, meestal in de week voor een match en op matchdag zelf, vaak vanuit de groepschat of via de QR-code in de kleedkamer. De app zit volledig achter een login; accounts worden door een admin goedgekeurd. Spelers, staf en verantwoordelijken tellen als "speler" voor aanwezigheden, opstelling en statistieken; supporters zien alleen namen en functies van leden.

## Product Purpose

Eén plek voor alles rond de match: kalender met terreinadres en route, aanwezigheden, opstelling, uitslagen, klassement, spelersstatistieken en de ledenlijst. De app vervangt de WhatsApp-rondvraag en de Excel-lijst. Succes: iedereen zet zijn aanwezigheid op tijd, de coach hoeft niet meer rond te bellen, en niemand hoeft nog te zoeken naar uur, terrein of stand.

## Positioning

De officiële competitiedata (kalender, uitslagen, klassement van alle 92 ploegen in 8 reeksen) komen automatisch van de federatiesite kavvv-vb-ov.be via een geplande sync (zaterdag 20u, zondag 18u, maandag 9u). Wat de federatie niet heeft (aanwezigheden, opstelling, goals, assists, kaarten, clean sheets, contactgegevens) beheert de club zelf in dezelfde app, met rechten per functie en een logboek van elke wijziging. Een generieke ploegapp heeft de officiële data niet; een federatiesite heeft de clubkant niet.

## Operating Context

- Matchen op zaterdagnamiddag; thuisterrein Oud Kerkhofstraat 124, 9200 Dendermonde; uitmatchen in Vlaams-Brabant en Oost-Vlaanderen, het terreinadres van de tegenstander is telkens anders en wordt met een routeknop geopend in Google Maps.
- Aanwezigheid mag tot op de dag zelf gewijzigd worden; admins zien de lijst zoals ze 24 uur voor de aftrap was.
- De staf maakt de opstelling (11 basisspelers plus 4 bank, formaties 4-3-3, 4-4-2, 3-4-3) en voert na de match per speler goals, assists, gele en rode kaarten in. Totalen zijn altijd de som per match; elke wijziging staat in het logboek en kan teruggezet worden.
- Klassement volgens reglement art. 159 (punten, gewonnen wedstrijden, doelsaldo). Loopt het officiële klassement achter op de uitslagen, dan toont de app een berekend klassement met label "voorlopig".
- Een sync-storing wordt getoond als "niet bijgewerkt sinds …".

## Capabilities and Constraints

- Stack: React + Vite + TypeScript in `app/`, Supabase (Auth, Postgres met row level security) als backend, gratis gehost op GitHub Pages via `.github/workflows/deploy-app.yml`. Mobile-first website die op het beginscherm van de telefoon gezet wordt (manifest aanwezig), geen native app.
- Schermen: Home, Kalender en uitslagen (met aanwezigheden), Klassement (alle reeksen, plus statistieken), Ploegen (terrein, kleuren, contact, uitslagen, stand), Opstelling (veld met spelers), Leden (lijst en beheer), Profiel, en de auth-schermen (inloggen, registreren, wacht op goedkeuring, wachtwoord vergeten).
- Functies: speler, spelercoach, coach, verantwoordelijke, supporter, plus een admin-vlag en één hoofdadmin. Rechten worden in de database afgedwongen; de schermen tonen alleen wat mag.
- Terminologie (Nederlands, formele toon met "u" is niet nodig maar de tekst blijft verzorgd en zonder kleedkamertaal): match, aanwezig / afwezig / onzeker, opstelling, bank, reeks, speeldag, klassement, stand, terrein.
- Data: 42 leden (41 uit de spelerslijst, plus registraties), 968 wedstrijden van het seizoen 2026-2027, klassementen van 8 reeksen. Geen rugnummers, geen spelersfoto's (nog niet beschikbaar).
- Taal: Nederlands. Geen em-dashes in teksten.
- Ontwerp staat los van de logica: één stijlbestand met CSS-variabelen (`app/src/styles.css`), componenten in `app/src/components`.
- Niet beslist: eigen domeinnaam (voorlopig arthurpepermans.github.io/steca-competitie); pushmeldingen; meerdere seizoenen naast elkaar.

## Brand Commitments

- Naam: Steca Juniors (afkorting SJ). Het officiële logo is bindend en mag niet aangepast worden: wit schild met zwarte rand en gouden bies, gevuld met zwarte sterren, de letters "SJ" en twee proostende glazen (`app/public/logo.svg`, `logo.png`, `logo-512.png`).
- Kleuren zijn vrij zolang het logo klopt; de clubkleuren op het veld zijn zwart en wit, het goud zit in het logo.
- Toon: formeel en verzorgd Nederlands, geen kleedkamerhumor, korte duidelijke teksten.
- De opdrachtgever wil een vooruitstrevende, dynamische app met beweging, geen standaard lijstjes-app.

## Evidence on Hand

- Echte data in Supabase: leden, wedstrijden met terreinadres en uur, klassementen, sync-status. Geen uitslagen van Steca Juniors nog dit seizoen (eerste match 12 september 2026), dus statistieken en vorm zijn nog leeg; toon geen verzonnen cijfers in productie.
- Logo als vector en PNG in `app/public/`.
- Functionele beschrijving en rechtenmatrix in `docs/APP_BRIEF.md`; werkende schermen in `app/src/pages`.
- Geen spelersfoto's, geen sponsors, geen testimonials.

## Product Principles

1. De volgende match staat altijd centraal: datum, uur, terrein, route en de eigen aanwezigheid in één oogopslag, ook voor supporters.
2. Eén handeling voor het belangrijkste: aanwezigheid zetten kost één tik, nooit meer.
3. Officiële data blijven herkenbaar officieel; wat de club zelf bijhoudt is duidelijk als zodanig gelabeld ("voorlopig", "ingevoerd door").
4. Rechten zijn onzichtbaar tot ze nodig zijn: wie iets niet mag, ziet de knop niet, maar de app voelt voor iedereen even compleet.
5. Ambitie in de uitstraling, nuchterheid in de inhoud: geen verzonnen cijfers, wel een beleving die bij een echte club past.

## Accessibility & Inclusion

Gebruik buiten, in de zon en in de kleedkamer, met één hand: grote tikdoelen (minstens 44 px), hoog contrast, leesbaar zonder inzoomen. Sommige ouders en supporters zijn ouder en minder digitaal vaardig: de kernhandelingen mogen geen uitleg nodig hebben.
