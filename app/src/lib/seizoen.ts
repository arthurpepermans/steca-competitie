import type { Match } from "./types";

/** Een voetbalseizoen loopt van 1 juli tot 30 juni: '2026-09-12' -> '2026-2027', '2027-03-01' -> '2026-2027'. */
export function seizoenVanDatum(iso: string): string {
  const [j, m] = iso.split("-").map(Number);
  return m >= 7 ? `${j}-${j + 1}` : `${j - 1}-${j}`;
}

/** Het lopende seizoen: het hoogste seizoen in de kalender, anders afgeleid van vandaag. */
export function huidigSeizoen(matches: Match[], vandaag: string): string {
  const seizoenen = matches.map((m) => m.seizoen).filter(Boolean).sort();
  return seizoenen[seizoenen.length - 1] ?? seizoenVanDatum(vandaag);
}

export type Bereik = "seizoen" | "alles";

/** Matchen binnen het gekozen bereik. */
export function matchesInBereik(matches: Match[], bereik: Bereik, seizoen: string): Match[] {
  return bereik === "alles" ? matches : matches.filter((m) => m.seizoen === seizoen);
}
