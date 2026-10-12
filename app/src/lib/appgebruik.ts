// Alleen vaste paginacategorieën; nooit zoekteksten, namen, URL-parameters of formulierinhoud.
export const PAGINAS: Record<string, string> = {
  '/': 'Home', '/kalender': 'Kalender', '/klassement': 'Klassement',
  '/opstelling': 'Opstelling', '/kantine': 'Kantine', '/leden': 'Leden',
  '/leden/:id': 'Lid bekijken', '/profiel': 'Mijn profiel', '/ploegen': 'Ploegen',
  '/ploegen/:id': 'Ploeg bekijken', '/match/:key': 'Wedstrijdverslag',
  '/meldingen': 'Meldingen', '/drive': 'Drivebeheer',
  '/supporter-klassement': 'Supportersklassement', '/supporter-profiel/:id': 'Supporter bekijken',
};
export function paginaCategorie(path: string): string | null {
  if (PAGINAS[path]) return path;
  for (const prefix of ['/leden/', '/ploegen/', '/match/', '/supporter-profiel/']) {
    if (path.startsWith(prefix) && path.slice(prefix.length) && !path.slice(prefix.length).includes('/')) {
      return prefix + (prefix === '/match/' ? ':key' : ':id');
    }
  }
  return null;
}
export const INACTIEF_MS = 60_000;
export const SESSIE_MS = 30 * 60_000;
export function actieveMillis(van: number, tot: number, laatsteActie: number, zichtbaar: boolean): number {
  // Een slapende computer / vertraagde timer telt niet als actieve tijd.
  if (!zichtbaar || tot - van > 15_000) return 0;
  return Math.max(0, Math.min(tot, laatsteActie + INACTIEF_MS) - van);
}
export function brusselseDag(date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(date);
}
export function duur(seconden: number): string {
  const s = Math.round(seconden);
  if (s < 60) return `${s} sec`;
  if (s < 3600) return `${Math.floor(s / 60)} min ${s % 60} sec`;
  return `${Math.floor(s / 3600)} u ${Math.floor(s % 3600 / 60)} min`;
}
export type GebruikRij = { gebruikers: number; bezoeken: number; paginaweergaven: number; seconden: number };
export type GebruikRapport = {
  gestart: string; overzicht: GebruikRij;
  acties: { actie: string; aantal: number; gebruikers: number }[];
  dagen: (GebruikRij & { dag: string })[];
  gebruikers: (GebruikRij & { user_id: string; naam: string; functie: string; laatst: string | null })[];
  paginas: (GebruikRij & { pagina: string })[];
};
