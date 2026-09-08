import { describe, expect, it } from "vitest";
import { EIGEN_PLOEGID } from "./config";
import { eigenScore, goalsControle, sorteerOp, totalen } from "./stats";
import type { Match, MatchStat } from "./types";

function match(key: string, thuis: boolean, voor: number | null, tegen: number | null): Match {
  return {
    match_key: key, seizoen: "2026-2027", reeks: "DERDE AFDELING B", datum: "2026-09-12", uur: "15:00",
    thuis_id: thuis ? EIGEN_PLOEGID : 1, uit_id: thuis ? 1 : EIGEN_PLOEGID, thuis: "A", uit: "B",
    thuis_score: thuis ? voor : tegen, uit_score: thuis ? tegen : voor,
    status: voor === null ? "gepland" : "gespeeld", terrein: null, opmerking: null,
  };
}

const stat = (key: string, member: string, extra: Partial<MatchStat> = {}): MatchStat => ({
  match_key: key, member_id: member, gespeeld: true, goals: 0, assists: 0, geel: 0, rood: 0, ...extra,
});

describe("stats", () => {
  it("eigenScore kijkt vanuit Steca, thuis of uit", () => {
    expect(eigenScore(match("m1", true, 3, 1))).toEqual({ voor: 3, tegen: 1 });
    expect(eigenScore(match("m2", false, 2, 0))).toEqual({ voor: 2, tegen: 0 });
    expect(eigenScore(match("m3", true, null, null))).toBeNull();
  });

  it("totalen zijn de som per match, clean sheet alleen als gespeeld zonder tegendoelpunt", () => {
    const matches = [match("m1", true, 3, 0), match("m2", false, 1, 2)];
    const stats = [
      stat("m1", "jan", { goals: 2, assists: 1 }),
      stat("m2", "jan", { goals: 1, geel: 1 }),
      stat("m1", "piet", { gespeeld: false }),
      stat("m2", "piet", { rood: 1 }),
    ];
    const t = Object.fromEntries(totalen(stats, matches).map((x) => [x.member_id, x]));
    expect(t.jan).toMatchObject({ gespeeld: 2, goals: 3, assists: 1, geel: 1, rood: 0, cleanSheets: 1 });
    expect(t.piet).toMatchObject({ gespeeld: 1, goals: 0, rood: 1, cleanSheets: 0 });
  });

  it("goalsControle vergelijkt met de officiële score", () => {
    const m = match("m1", false, 2, 2);
    expect(goalsControle([stat("m1", "a", { goals: 1 }), stat("m1", "b", { goals: 1 })], m)).toEqual({ ingevoerd: 2, officieel: 2 });
    expect(goalsControle([stat("m1", "a", { goals: 3 })], m)).toEqual({ ingevoerd: 3, officieel: 2 });
    expect(goalsControle([], match("m9", true, null, null))).toBeNull();
  });

  it("sorteerOp sorteert aflopend met goals als tweede sleutel", () => {
    const rows = totalen([stat("m1", "a", { assists: 2 }), stat("m1", "b", { assists: 2, goals: 1 }), stat("m1", "c", { assists: 5 })], [match("m1", true, 1, 0)]);
    expect(sorteerOp(rows, "assists").map((r) => r.member_id)).toEqual(["c", "b", "a"]);
  });
});
