import { isThuis } from "./datum";
import type { Match, MatchStat } from "./types";

export type Totalen = {
  member_id: string;
  gespeeld: number;
  goals: number;
  assists: number;
  geel: number;
  rood: number;
  cleanSheets: number;
};

/** Doelpunten van Steca en van de tegenstander in een gespeelde match. */
export function eigenScore(m: Match): { voor: number; tegen: number } | null {
  if (m.status !== "gespeeld" || m.thuis_score === null || m.uit_score === null) return null;
  return isThuis(m) ? { voor: m.thuis_score, tegen: m.uit_score } : { voor: m.uit_score, tegen: m.thuis_score };
}

/** Totalen per speler: som over de matchen. Clean sheet = gespeeld in een match zonder tegendoelpunt. */
export function totalen(stats: MatchStat[], matches: Match[]): Totalen[] {
  const perMatch = new Map(matches.map((m) => [m.match_key, m]));
  const out = new Map<string, Totalen>();
  for (const s of stats) {
    const t = out.get(s.member_id) ?? { member_id: s.member_id, gespeeld: 0, goals: 0, assists: 0, geel: 0, rood: 0, cleanSheets: 0 };
    t.goals += s.goals;
    t.assists += s.assists;
    t.geel += s.geel;
    t.rood += s.rood;
    if (s.gespeeld) {
      t.gespeeld += 1;
      const m = perMatch.get(s.match_key);
      const sc = m ? eigenScore(m) : null;
      if (sc && sc.tegen === 0) t.cleanSheets += 1;
    }
    out.set(s.member_id, t);
  }
  return [...out.values()];
}

/** Vergelijkt ingevoerde goals met de officiële score; null als de match geen score heeft. */
export function goalsControle(stats: MatchStat[], m: Match): { ingevoerd: number; officieel: number } | null {
  const sc = eigenScore(m);
  if (!sc) return null;
  const ingevoerd = stats.filter((s) => s.match_key === m.match_key).reduce((n, s) => n + s.goals, 0);
  return { ingevoerd, officieel: sc.voor };
}

export function sorteerOp<K extends keyof Totalen>(rows: Totalen[], veld: K): Totalen[] {
  return [...rows].sort((a, b) => (b[veld] as number) - (a[veld] as number) || b.goals - a.goals);
}
