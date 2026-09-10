# Clubmeldingen

Actieve leden kunnen via de pop-up of Profiel > Meldingen beheren hun toestel koppelen. De native toestemming wordt pas op de knopklik gevraagd. Later verbergt de vraag zeven dagen per lid en toestel; expliciet uitzetten wordt onthouden. Op iPhone wordt eerst de installatiehulp getoond als de app nog niet zelfstandig geopend is.

Aanwezigheidsherinneringen gaan naar spelers met een pushabonnement die nog geen antwoord hebben gegeven, 72 en 48 uur voor de Belgische aftrap. Elke ingevulde aanwezigheidsstatus stopt deze herinneringen. Stemmeldingen gaan alleen naar aanwezige leden zonder stem: vanaf het maximum van het eerste scoremoment en aftrap + 80 minuten, daarna drie uur na de eerste succesvolle verzending. De bestaande stemdeadline blijft gelden.

De bevoegde staf kan via Kalender > Matchverslag bekijken de score opslaan. De eerste score_at blijft gelijk bij correcties. De match_reports-tabel houdt de handmatig ingevoerde score apart van de federatiegegevens. Goals/assists in het verslag wijzigen de bestaande seizoentotalen niet automatisch. Een melding gebruikt de nieuwste score in thuis-uitvolgorde, met winst/verlies bepaald vanuit Steca.

De verzender match-push accepteert uitsluitend een geldig actief ledenaccount voor status/subscribe/unsubscribe, of de private cron_secret voor verzending. De planning, jobs en abonnementsgegevens zijn ontoegankelijk voor anon/authenticated. pg_cron roept de verzender iedere minuut aan. push_config.enabled is standaard false en wordt na de installatie expliciet aangezet. VAPID-sleutels worden serverzijdig bij het eerste statusverzoek gegenereerd; private sleutels blijven in de database.

Uitsluitend productieproject odgrmhcmkvbdadjhphiz en stecajuniors.app. Geen testaccountbeperking, testscores, testmatches of scenarioacties. De Drive-koppeling en productiehosting blijven behouden.

Validatie: frontendtests en build, mobiele pop-upcontrole, SQL-controle supabase/tests/clubmeldingen.sql in een rollbacktransactie. Een geaccepteerde push bewijst ontvangst door de pushdienst, geen zichtbare banner op een specifiek toestel.
