# Google Drive op productie

Admins openen Mijn profiel > Google Drive beheren (`/#/drive`). De server accepteert
alleen het Google-account arthur.pepermanss@gmail.com en maakt een eigen private map
Steca Juniors - Sfeerbeelden. De eerdere handmatig gemaakte map blijft ongewijzigd.

Google-project: steca-juniors-clubapp. Client: Steca Juniors Drive - productie.
Callback: https://odgrmhcmkvbdadjhphiz.supabase.co/functions/v1/drive-connect/callback.
Client-ID en clientsecret staan uitsluitend in Supabase Edge Function Secrets onder
GOOGLE_DRIVE_CLIENT_ID en GOOGLE_DRIVE_CLIENT_SECRET. Nooit opnemen in frontend of git.

Deploy supabase/functions/drive-connect/index.ts met verify_jwt=false zoals in
supabase/config.toml. De Google-callback heeft geen Supabase-JWT; POST-acties controleren
zelf de login, Origin en actuele adminrechten. OAuth gebruikt PKCE en eenmalige state.
De refresh token is AES-GCM-versleuteld met een sleutel afgeleid van het clientsecret.
Rotatie van het clientsecret vereist opnieuw verbinden. Beide tabellen zijn uitsluitend
voor service_role toegankelijk; de schema-aanvulling staat onderaan app_schema.sql.

Leden uploaden via Sfeerbeelden bij een wedstrijd, zonder eigen Google-login.
Nieuwe foto's en video's gaan naar de club-Drive (maximaal 50 MB per bestand).
De Drive-bestandsnaam bevat wedstrijddatum en ploegen; de app groepeert per match.
Bestaande Supabase-beelden blijven zichtbaar en verwijderbaar.
Admins verwijderen alle beelden, uploaders hun eigen beelden. Drive-bestanden gaan
naar de prullenbak; de clubbeheerder kan die in Drive leegmaken.

Deploy ook drive-media met verify_jwt=false en voer de drive_media-schema-aanvulling uit.
POST controleert login, actieve ledenstatus, clubwedstrijd en verwijderrechten.
GET vereist een ondertekende beeldlink (een uur geldig) en controleert het lid opnieuw.
Deze links bevatten geen Google-token. Vernieuwen in het album laadt nieuwe links.
Bestanden worden privé via de server gestreamd, met Range-ondersteuning voor video's.
Dit gebruikt Supabase Edge-aanvragen en dataverkeer, ook al staat de opslag op Drive.
Uploads zijn nog niet hervatbaar: bij onderbreking opnieuw uploaden.
Pending metadata blijft behouden voor diagnose. Bij een onderbreking na Google-opslag
kan de beheerder via appProperties.stecaMediaId reconciliëren. Bij een databasefout na
opslag probeert de functie het nieuwe bestand naar de prullenbak te verplaatsen.

Google OAuth staat voorlopig in Testing: de toestemming vervalt daardoor na zeven dagen.
Voor permanent gebruik moeten de Google-publicatievoorwaarden nog worden afgerond.

Validatie: apptests inclusief serverrechten, ondertekende links, upload, opruimen bij fout
en gemengde paginering; appbuild en Deno-typecontrole. Een echte upload via een ledenaccount
moet ook in drive_media en de clubmap worden gecontroleerd.
