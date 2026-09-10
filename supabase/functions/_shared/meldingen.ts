export type Soort = 'aanwezig72' | 'aanwezig48' | 'stemmen' | 'stemherinnering' | 'wasmand';
export type Situatie = { aftrap: number; scoreAt: number | null; antwoord: boolean; aanwezig: boolean; gestemd: boolean; eersteVerzonden: number | null; deadline: number; wasmand?: boolean };
const UUR = 3600000;
export function verschuldigd(s: Situatie, nu: number): Soort[] {
  if (!Number.isFinite(s.aftrap)) return [];
  // De wasmand: één melding vanaf 100 minuten na de aftrap, tot een dag later.
  const wasmand: Soort[] = s.wasmand && nu >= s.aftrap + 100 * 60000 && nu < s.aftrap + 24 * UUR ? ['wasmand'] : [];
  return [...wasmand, ...stemEnAanwezig(s, nu)];
}

function stemEnAanwezig(s: Situatie, nu: number): Soort[] {
  if (!s.antwoord && nu >= s.aftrap - 72 * UUR && nu < s.aftrap) return [nu < s.aftrap - 48 * UUR ? 'aanwezig72' : 'aanwezig48'];
  if (s.scoreAt === null || !s.aanwezig || s.gestemd || nu >= s.deadline || nu < Math.max(s.aftrap + 80 * 60000, s.scoreAt)) return [];
  if (s.eersteVerzonden === null) return ['stemmen'];
  return nu >= s.eersteVerzonden + 3 * UUR ? ['stemherinnering'] : [];
}
export type Uitslag = { thuis_score: number | null; uit_score: number | null; steca_thuis: boolean };
export function bericht(soort: Soort, tegenstander: string, uitslag?: Uitslag) {
  if (soort === 'wasmand') return { title: 'KUISVROUW', body: 'De was is voor jou, vergeet de mand niet mee te pakken! Veel succes!' };
  if (soort === 'aanwezig72') return { title: 'Speel je mee?', body: `Nog 72 uur tot de match tegen ${tegenstander}, laat weten of je meedoet bok!` };
  if (soort === 'aanwezig48') return { title: 'Je aanwezigheid ontbreekt nog', body: `Nog 2 dagen tot de confrontatie met ${tegenstander}, laat weten of je erbij bent.` };
  if (uitslag && Number.isInteger(uitslag.thuis_score) && Number.isInteger(uitslag.uit_score)) {
    const thuis = uitslag.thuis_score!, uit = uitslag.uit_score!;
    const verschil = uitslag.steca_thuis ? thuis - uit : uit - thuis;
    const score = `${thuis}-${uit}`;
    if (soort === 'stemmen') {
      const body = verschil > 0
        ? `Wat een toppers! ${tegenstander} ${score} op hun metjn! De juniors doen het weer! Stem nu op je Junior van de match!`
        : verschil === 0
          ? `1 punt! ${score}, de juniors zijn gisterenavond weer iets te hard gegaan! Vergeet niet te stemmen op jouw junior van de match!`
          : `${score}, Sukkels! Steca Juniors verloren, en deze keer niet van de fles! Stem op jouw junior van de match!`;
      return { title: 'Wie wordt Junior van de match?', body };
    }
    if (verschil > 0) return { title: 'Jouw stem telt nog mee', body: 'De derde helft is bijna gedaan, tijd om te stemmen op je junior van de match!' };
    if (verschil < 0) return { title: 'Jouw stem telt nog mee', body: 'Verdriet aan het wegdrinken begrijpelijk, vergeet niet te stemmen op je junior van de match voor het te laat is!' };
  }
  if (soort === 'stemmen') return { title: 'Wie wordt Junior van de match?', body: `De uitslag tegen ${tegenstander} staat klaar. Breng je stem uit.` };
  return { title: 'Jouw stem telt nog mee', body: `Je hebt nog niet gestemd voor Junior van de match tegen ${tegenstander}.` };
}
// Geen zelf opgegeven tijdzones: aftraptijden worden in de database naar UTC omgerekend.
export const CLUB_PROJECT = 'https://odgrmhcmkvbdadjhphiz.supabase.co';
export const CLUB_ORIGIN = 'https://stecajuniors.app';
