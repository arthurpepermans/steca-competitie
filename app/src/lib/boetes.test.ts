import { describe, expect, it } from "vitest";
import { bedragVoor, boeteItems, boeteTotalen, fmtEuro, potTotaal } from "./boetes";
import type { Fine, Match, MatchStat } from "./types";

const match = (key: string, datum: string): Match => ({
  match_key: key, seizoen: "2026-2027", reeks: "DERDE AFDELING B", datum, uur: "15:00", thuis_id: 152, uit_id: 90,
  thuis: "Steca Juniors", uit: "VK Eeksken", thuis_score: 3, uit_score: 1, status: "gespeeld", terrein: null, opmerking: null,
});
const boete = (id: string, member: string, soort: string, aantal: number, cent: number, datum = "2026-09-05"): Fine => ({
  id, member_id: member, match_key: null, datum, soort, aantal, bedrag_cent: cent, bak_bier: 0, opmerking: null, ingevoerd_door: null,
});
const stat = (member: string, geel: number, rood: number): MatchStat => ({ match_key: "m1", member_id: member, gespeeld: true, goals: 0, assists: 0, geel, rood });

describe("boetes", () => {
  it("rekent tarief keer aantal, of het vrije bedrag", () => {
    expect(bedragVoor("bal_over_net", 1)).toBe(200);
    expect(bedragVoor("kledij_mee", 3)).toBe(1500);
    expect(bedragVoor("andere", 1, 730)).toBe(730);
    expect(bedragVoor("onbekend", 1)).toBe(0);
  });

  it("telt kaarten uit de statistieken mee: geel 5 euro, rood een bak bier", () => {
    const items = boeteItems([], [stat("a", 2, 0), stat("b", 0, 1)], [match("m1", "2026-09-05")]);
    const tot = boeteTotalen(items);
    expect(tot.map((t) => [t.member_id, t.cent, t.bakBier, t.aantal])).toEqual([["a", 1000, 0, 2], ["b", 0, 1, 1]]);
    expect(items.every((i) => i.uitStats && i.datum === "2026-09-05")).toBe(true);
  });

  it("sorteert op bedrag, dan bakken bier, en telt de pot op", () => {
    const fines = [boete("f1", "b", "afwezig", 1, 1000), boete("f2", "c", "kledij_mee", 2, 1000), boete("f3", "a", "bal_over_net", 1, 200)];
    const tot = boeteTotalen(boeteItems(fines, [stat("a", 0, 1)], [match("m1", "2026-09-05")]));
    // b en c staan gelijk op 10 euro; c heeft meer boetes (2 weken) en komt eerst
    expect(tot.map((t) => t.member_id)).toEqual(["c", "b", "a"]);
    expect(potTotaal(tot)).toEqual({ cent: 2200, bakBier: 1, aantal: 5 });
  });

  it("toont bedragen als euro met komma", () => {
    expect(fmtEuro(0)).toBe("€ 0,00");
    expect(fmtEuro(1250)).toBe("€ 12,50");
    expect(fmtEuro(200)).toBe("€ 2,00");
  });
});
