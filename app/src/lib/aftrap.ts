import type { Match } from './types';
/** Lokale Belgische aftraptijd, onafhankelijk van de tijdzone van de telefoon. */
export function aftrapTijd(m: Pick<Match,'datum'|'uur'>): number | null {
  if (!m.datum || !m.uur || !/^\d{4}-\d{2}-\d{2}$/.test(m.datum) || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(m.uur)) return null;
  const doel = Date.parse(`${m.datum}T${m.uur.length===5 ? m.uur+':00' : m.uur}Z`);
  if (!Number.isFinite(doel)) return null;
  let utc = doel;
  for(let i=0;i<3;i++) {
    const delen = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(utc)).replace(' ','T');
    utc += doel - Date.parse(delen+'Z');
  }
  return utc;
}
