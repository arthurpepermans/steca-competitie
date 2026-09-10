import { describe, expect, it } from "vitest";
import { huidigSeizoen, matchesInBereik, seizoenVanDatum } from "./seizoen";
import type { Match } from "./types";

function match(key: string, seizoen: string): Match {
  return { match_key: key, seizoen, reeks: "DERDE AFDELING B", datum: null, uur: null, thuis_id: 152, uit_id: 1, thuis: "Steca Juniors", uit: "X", thuis_score: null, uit_score: null, status: "gepland", terrein: null, opmerking: null };
}

describe("seizoen", () => {
  it("leidt het seizoen af van een datum, met 1 juli als grens", () => {
    expect(seizoenVanDatum("2026-09-12")).toBe("2026-2027");
    expect(seizoenVanDatum("2027-03-01")).toBe("2026-2027");
    expect(seizoenVanDatum("2027-07-01")).toBe("2027-2028");
    expect(seizoenVanDatum("2027-06-30")).toBe("2026-2027");
  });

  it("neemt het hoogste seizoen uit de kalender als lopend seizoen", () => {
    expect(huidigSeizoen([match("a", "2025-2026"), match("b", "2026-2027")], "2026-09-10")).toBe("2026-2027");
    expect(huidigSeizoen([], "2026-09-10")).toBe("2026-2027");
  });

  it("filtert op seizoen of geeft alles terug", () => {
    const alle = [match("a", "2025-2026"), match("b", "2026-2027")];
    expect(matchesInBereik(alle, "seizoen", "2026-2027").map((m) => m.match_key)).toEqual(["b"]);
    expect(matchesInBereik(alle, "alles", "2026-2027")).toHaveLength(2);
  });
});
