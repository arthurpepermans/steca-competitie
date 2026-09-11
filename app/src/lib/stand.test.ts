import { describe, expect, it } from "vitest";
import { standBeweging } from "./stand";
import type { Standing, StandingHistory } from "./types";

function rij(ploegid: number, positie: number, bron: Standing["bron"] = "kavvv"): Standing {
  return { seizoen: "2026-2027", reeks: "DERDE AFDELING B", ploegid, bron, positie, ploeg: `P${ploegid}`, gespeeld: 1, gewonnen: 0, gelijk: 0, verloren: 0, doelpunten_voor: 0, doelpunten_tegen: 0, saldo: 0, punten: 0, label: null, vergelijking_status: "gelijk" };
}
function vorige(ploegid: number, positie: number, op: string, bron: StandingHistory["bron"] = "kavvv"): StandingHistory {
  return { seizoen: "2026-2027", reeks: "DERDE AFDELING B", ploegid, bron, positie, punten: 0, gespeeld: 0, vastgelegd_op: op };
}

describe("standBeweging", () => {
  it("vergelijkt met de laatst vastgelegde vorige stand", () => {
    const b = standBeweging([rij(1, 2), rij(2, 5), rij(3, 3)], [
      vorige(1, 4, "2026-09-05T10:00:00Z"), vorige(1, 1, "2026-09-01T10:00:00Z"),
      vorige(2, 5, "2026-09-05T10:00:00Z"), vorige(3, 1, "2026-09-05T10:00:00Z"),
    ]);
    expect(b.get(1)).toBe("op");
    expect(b.get(2)).toBe("gelijk");
    expect(b.get(3)).toBe("neer");
  });
  it("geeft niets voor ploegen zonder geschiedenis of met een andere bron", () => {
    const b = standBeweging([rij(1, 2), rij(2, 3, "berekend")], [vorige(2, 1, "2026-09-05T10:00:00Z", "kavvv")]);
    expect(b.has(1)).toBe(false);
    expect(b.has(2)).toBe(false);
  });
});
