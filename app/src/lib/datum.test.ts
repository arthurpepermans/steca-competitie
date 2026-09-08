import { describe, expect, it } from "vitest";
import { EIGEN_PLOEGID } from "./config";
import { fmtDatum, laatsteUitslag, magAanwezigheidWijzigen, mapsUrl, resultaat, sorteerOpDatum, volgendeMatch } from "./datum";
import type { Match } from "./types";

function m(key: string, datum: string, status: "gepland" | "gespeeld", thuis = true, hs: number | null = null, us: number | null = null): Match {
  return {
    match_key: key, seizoen: "2026-2027", reeks: "R", datum, uur: "15:00",
    thuis_id: thuis ? EIGEN_PLOEGID : 7, uit_id: thuis ? 7 : EIGEN_PLOEGID, thuis: "T", uit: "U",
    thuis_score: hs, uit_score: us, status, terrein: "Oud Kerkhofstraat 124 - 9200 Dendermonde", opmerking: null,
  };
}

describe("datum", () => {
  it("formatteert Nederlands", () => {
    expect(fmtDatum("2026-09-12")).toBe("za 12 sep 2026");
    expect(fmtDatum(null)).toBe("datum onbekend");
  });

  it("volgende match is de eerste geplande vanaf vandaag, laatste uitslag de laatst gespeelde", () => {
    const matches = [m("c", "2026-09-26", "gepland"), m("a", "2026-09-05", "gespeeld", true, 4, 0), m("b", "2026-09-12", "gepland"), m("z", "2026-09-19", "gespeeld", false, 1, 1)];
    expect(volgendeMatch(matches, "2026-09-08")?.match_key).toBe("b");
    expect(volgendeMatch(matches, "2026-09-13")?.match_key).toBe("c");
    expect(laatsteUitslag(matches)?.match_key).toBe("z");
    expect(sorteerOpDatum(matches).map((x) => x.match_key)).toEqual(["a", "b", "z", "c"]);
  });

  it("resultaat vanuit Steca, thuis en uit", () => {
    expect(resultaat(m("a", "2026-09-05", "gespeeld", true, 4, 0))).toBe("W");
    expect(resultaat(m("a", "2026-09-05", "gespeeld", false, 4, 0))).toBe("V");
    expect(resultaat(m("a", "2026-09-05", "gespeeld", false, 1, 1))).toBe("G");
    expect(resultaat(m("a", "2026-09-05", "gepland"))).toBeNull();
  });

  it("aanwezigheid mag tot en met de dag zelf gewijzigd worden", () => {
    expect(magAanwezigheidWijzigen(m("a", "2026-09-12", "gepland"), "2026-09-12")).toBe(true);
    expect(magAanwezigheidWijzigen(m("a", "2026-09-12", "gepland"), "2026-09-13")).toBe(false);
    expect(magAanwezigheidWijzigen(m("a", "2026-09-12", "gespeeld", true, 1, 0), "2026-09-10")).toBe(false);
  });

  it("maps-link bevat het adres", () => {
    expect(mapsUrl("Oud Kerkhofstraat 124 - 9200 Dendermonde")).toContain("Oud%20Kerkhofstraat");
  });
});
