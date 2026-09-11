import type { Standing, StandingHistory } from "./types";

export type Beweging = "op" | "neer" | "gelijk";

/** Beweging per ploeg ten opzichte van de laatst vastgelegde vorige stand (zelfde seizoen, reeks en bron).
 *  Ploegen zonder vorige stand krijgen geen beweging. */
export function standBeweging(rijen: Standing[], geschiedenis: StandingHistory[]): Map<number, Beweging> {
  const uit = new Map<number, Beweging>();
  for (const r of rijen) {
    const vorige = geschiedenis
      .filter((g) => g.seizoen === r.seizoen && g.reeks === r.reeks && g.bron === r.bron && g.ploegid === r.ploegid)
      .sort((a, b) => b.vastgelegd_op.localeCompare(a.vastgelegd_op))[0];
    if (!vorige) continue;
    uit.set(r.ploegid, vorige.positie > r.positie ? "op" : vorige.positie < r.positie ? "neer" : "gelijk");
  }
  return uit;
}
