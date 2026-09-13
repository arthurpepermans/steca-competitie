# Steca Vrouwen: eerste publieke versie

De route `#/vrouwen` draait binnen dezelfde origin als de Juniors. De ingang
`vrouwen.stecajuniors.app` verwijst hiernaar; het aparte repository
`arthurpepermans/steca-vrouwen` bevat uitsluitend deze doorverwijzing.
Zo verlaat de ploegwissel de geinstalleerde PWA niet en blijven accountsessies behouden.
De ploegwissel wordt voorlopig uitsluitend in de vrouwenomgeving getoond.
De mannenapp en het inlogscherm krijgen geen wisselknop en openen altijd zoals voordien.

## Wat werkt
- Eigen roze/wit/zwarte presentatie, licht en donker.
- Kalender voor het huidige seizoen, uitslagen, zalen en routeknoppen.
- Competitie en bekerklassement uit openbare Twizzit-widgets, zonder login.
- GitHub Pages bouwt vier keer per dag met verse gegevens (cron in UTC).
- Bij een ongeldige of onvolledige bron wordt geen half bijgewerkt bestand gepubliceerd.

## Bron
`scripts/sync_vrouwen.py` leest kalenderwidget 232450, rankingwidget 156007,
team 1342487, organisatie 34186. Alleen wedstrijdgegevens en teamklassementen
worden opgeslagen; geen contactgegevens, ledenlijsten of officials.
Jaartallen volgen het seizoen juli-juni; aftraptijden gebruiken Europe/Brussels.
Tests: `python -m unittest discover -s scripts -p "test_*.py"`.

## Nog uit te bouwen
De vrouwenomgeving heeft in deze fase uitsluitend publieke wedstrijdinformatie.
Aanwezigheden, ledenbeheer, opstellingen, badges, pronostieken en meldingen zijn
nog niet gekoppeld. Daarvoor moeten clubscoping en rechten in Postgres/RLS worden
uitgewerkt en getest: een visuele ploegfilter alleen is niet voldoende.
Bestaande mannenaccounts worden niet automatisch vrouwenleden of vrouwenbeheerders.

## Logo
`app/public/logo-vrouwen.png` is met de ingebouwde imagegen gemaakt op basis van
het door de gebruiker aangeleverde screenshot. Prompt: maak alleen het roze-zwarte
SV-schild vrij op een witte achtergrond; behoud letters, patroon en wijnglazen.
