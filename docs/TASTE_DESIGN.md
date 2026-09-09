# Retro ontwerp voor Steca Juniors

Het ontwerp gebruikt warm papier, goudgele wedstrijdtickets, donkergrijze kaders en het bestaande clublogo. De kop toont alleen Steca Juniors in Graduate; dit is een benadering van retro sportletters, niet het exacte Boca-lettertype. Manrope en Barlow Condensed worden gebruikt voor de overige teksten.

Home bevat de volgende wedstrijd, aanwezigheid, rangschikking en het kader met Samen uit. Samen thuis. / De derde helft / Bacotime. De navigatie en overige pagina's delen de nieuwe basisstijl.

Opstelling toont elf shirts op het veld. Bij een formatiewissel blijven de basisspelers behouden en bewegen de icoontjes naar de nieuwe posities. De bank heeft vier plaatsen, een tas met vuurwerk, een bierbak en getekende voetballen. Spelersfoto's zijn nog niet toegevoegd.

## Lokaal bekijken

Voer in app `npm install` en `npm run dev -- --host 127.0.0.1 --port 5187 --strictPort` uit.
Open http://127.0.0.1:5187/steca-competitie/taste.html.

Deze aparte ontwikkelpagina gebruikt testgegevens en een voorbeeldrol als spelercoach. Aanwezigheid en opstellingen worden tijdelijk bewaard; herladen zet ze terug. Andere schrijfacties worden geblokkeerd. De standaard productiebuild bevat deze ontwikkelpagina niet. De productieapp behoudt haar bestaande authenticatie en rollen.

## Validatie

22 tests slagen, inclusief alle negen formatiewissels met behoud van basisspelers en bank. TypeScript, productiebuild en git diff --check slagen. Het ontwerp is bekeken op mobiel en desktop. Aanwezigheid, formatiewissel en opslaan zijn in het lokale voorbeeld gecontroleerd. Geen live Supabase-integratietest uitgevoerd; geen databaseschema gewijzigd.
