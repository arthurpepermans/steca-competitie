# Automatische badges

De 40 badges worden servermatig berekend door `bereken_badges()` in
`supabase/app_schema.sql`, uit bestaande wedstrijdcijfers. `badges_met_volgorde`
voegt de persoonlijke weergavevolgorde toe. De app vernieuwt bij terugkeer en
elke 30 seconden. Geen cronjob of handmatige toekenning nodig.

## Regels

- Alleen Steca-matchen met score, status gespeeld en minstens 80 minuten na aftrap.
- Gedeelde leiders krijgen dezelfde titel; een maximum van nul levert geen badge op.
- Seizoensleiders worden per opgeslagen matchseizoen berekend. Oude seizoenen
  blijven op het profiel staan en verdwijnen op 1 juli van het truitje.
- Alltime en verzamelbadges tellen alle bewaarde seizoenen samen.
- Clean sheet volgt de bestaande appregel: gespeeld zonder tegendoelpunt.
- Fundering telt aanwezigheden, ook zonder selectie. Alleen afgelopen matchen tellen.
- Kuisvrouw telt de aangeduide wasbeurt van afgelopen matchen.
- Junior van de Match: gedeeld hoogste aantal stempunten, conform het klassement.
  Zolang stemmen wijzigen, kan de winnaar wijzigen. Eigen stembriefjes tellen niet mee.
- Hattricks en Junior van de Match hebben elk hun matchlink. Kaartreeksen gebruiken
  alleen gespeelde matchen; speel- en aanwezigheidsreeksen gebruiken de clubkalender.
- Correcties in de brongegevens corrigeren ook badges. Historische wedstrijdgegevens
  worden behouden om seizoenstitels en verzamelbadges te blijven tonen.
- Supporters krijgen geen spelersbadges. Voorkeuren zijn alleen door de eigenaar
  via de RPC te wijzigen. Publieke lezers krijgen geen individuele stembriefjes.

## Testomgeving

Alleen de testrepository voegt handmatige `test_badge_toewijzingen` toe aan de
view, met `automatisch=false`. Het testcentrum kan alleen deze voorbeelden
verwijderen; automatisch verdiende badges komen uit de matchgegevens. Productie
bevat deze tabellen, testknoppen en de uitzondering voor testbeheerders niet.

## Verificatie en installatie

`automatischeBadges.test.ts` voert de daadwerkelijke SQL uit in PGlite/PostgreSQL:
alle 40 badges, gedeelde leiders, nulstanden, correcties, oude seizoenen, 80-minutengrens,
clean sheets, herhaalde matchbadges, aanwezigheid, kaartreeksen en toegangsrechten.
Een controle met rollback is ook uitgevoerd in de Supabase-testdatabase.

Bij installatie het blok vanaf `-- Automatische badges:` uit app_schema.sql
uitvoeren in het bijbehorende project. De productieversie bevat uitsluitend de
berekening en voorkeuren, geen testdata. Openbare opstellingen geven ook member_id
mee als badgekoppeling. Daarna de frontend bouwen en publiceren.
