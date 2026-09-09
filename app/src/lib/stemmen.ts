import { naarDate, vandaagIso } from "./datum";
import type { Attendance, Match, VotePoints } from "./types";

/** Punten voor de eerste, tweede en derde plaats op een stembrief. */
export const PUNTEN = [3, 2, 1] as const;

export type SeizoenRij = {
  member_id: string;
  punten: number;
  /** aantal matchen waarin de speler punten kreeg */
  matchen: number;
  /** aantal keer Junior van de match (gedeelde eerste plaats telt mee) */
  gewonnen: number;
};

/** Ranglijst van één match: meeste punten eerst, dan meeste stemmen. */
export function matchRanglijst(punten: VotePoints[], matchKey: string): VotePoints[] {
  return punten.filter((p) => p.match_key === matchKey).sort((a, b) => b.punten - a.punten || b.stemmen - a.stemmen);
}

/** Winnaar(s) van een match: iedereen met het hoogste puntenaantal. */
export function juniorVanDeMatch(punten: VotePoints[], matchKey: string): VotePoints[] {
  const lijst = matchRanglijst(punten, matchKey);
  if (lijst.length === 0) return [];
  return lijst.filter((p) => p.punten === lijst[0].punten);
}

/** Junior d'or: som van de punten over het seizoen, dan aantal keer junior van de match. */
export function seizoenRanglijst(punten: VotePoints[]): SeizoenRij[] {
  const out = new Map<string, SeizoenRij>();
  for (const p of punten) {
    const r = out.get(p.member_id) ?? { member_id: p.member_id, punten: 0, matchen: 0, gewonnen: 0 };
    r.punten += p.punten;
    r.matchen += 1;
    out.set(p.member_id, r);
  }
  for (const key of new Set(punten.map((p) => p.match_key))) {
    for (const w of juniorVanDeMatch(punten, key)) {
      const r = out.get(w.member_id);
      if (r) r.gewonnen += 1;
    }
  }
  return [...out.values()].sort((a, b) => b.punten - a.punten || b.gewonnen - a.gewonnen || b.matchen - a.matchen);
}

/** De stemming sluit 7 dagen na de match. */
export const STEM_DAGEN = 7;

/** Laatste dag waarop gestemd kan worden ('JJJJ-MM-DD'), of null zonder matchdatum. */
export function stemDeadline(match: Match): string | null {
  if (!match.datum) return null;
  const d = naarDate(match.datum);
  d.setDate(d.getDate() + STEM_DAGEN);
  return vandaagIso(d);
}

/** Open zodra de match gespeeld is, tot en met 7 dagen na de matchdatum. */
export function stemmingOpen(match: Match, vandaag: string = vandaagIso()): boolean {
  const deadline = stemDeadline(match);
  return match.status === "gespeeld" && deadline !== null && vandaag <= deadline;
}

/** Stemmen mag wie op de match als aanwezig stond, zolang de stemming open is. */
export function magStemmen(match: Match, aanwezigheden: Attendance[], lidId: string | null, vandaag: string = vandaagIso()): boolean {
  if (!lidId || !stemmingOpen(match, vandaag)) return false;
  return aanwezigheden.some((a) => a.match_key === match.match_key && a.member_id === lidId && a.status === "aanwezig");
}

/** Kandidaten: alle spelers die aanwezig waren. Jezelf staat erbij; wie op zichzelf stemt, is een egotripper en de stem telt niet. */
export function kandidaten<T extends { id: string }>(match: Match, aanwezigheden: Attendance[], spelers: T[]): T[] {
  const aanwezig = new Set(aanwezigheden.filter((a) => a.match_key === match.match_key && a.status === "aanwezig").map((a) => a.member_id));
  return spelers.filter((p) => aanwezig.has(p.id));
}

export function stemtOpZichzelf(lidId: string | null, keuzes: string[]): boolean {
  return lidId !== null && keuzes.includes(lidId);
}
