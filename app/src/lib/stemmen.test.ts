import { describe, expect, it } from "vitest";
import { juniorVanDeMatch, kandidaten, magStemmen, matchRanglijst, seizoenRanglijst } from "./stemmen";
import type { Attendance, Match, VotePoints } from "./types";

const match = (key: string, status: Match["status"]): Match => ({
  match_key: key, seizoen: "2026-2027", reeks: "DERDE AFDELING B", datum: "2026-09-05", uur: "15:00", thuis_id: 152, uit_id: 90,
  thuis: "Steca Juniors", uit: "VK Eeksken", thuis_score: status === "gespeeld" ? 3 : null, uit_score: status === "gespeeld" ? 1 : null, status, terrein: null, opmerking: null,
});
const aanw = (key: string, member: string, status: Attendance["status"]): Attendance => ({ match_key: key, member_id: member, status, gezet_door: null, updated_at: "" });
const p = (match_key: string, member_id: string, punten: number, stemmen: number): VotePoints => ({ match_key, member_id, punten, stemmen });

describe("stemmen", () => {
  it("rangschikt per match op punten en dan op aantal stemmen", () => {
    const punten = [p("m1", "a", 5, 2), p("m1", "b", 6, 2), p("m1", "c", 5, 3), p("m2", "a", 3, 1)];
    expect(matchRanglijst(punten, "m1").map((x) => x.member_id)).toEqual(["b", "c", "a"]);
    expect(juniorVanDeMatch(punten, "m2").map((x) => x.member_id)).toEqual(["a"]);
  });

  it("deelt de titel bij gelijke punten", () => {
    const punten = [p("m1", "a", 4, 2), p("m1", "b", 4, 1), p("m1", "c", 1, 1)];
    expect(juniorVanDeMatch(punten, "m1").map((x) => x.member_id)).toEqual(["a", "b"]);
  });

  it("telt het seizoen op en het aantal keer junior van de match", () => {
    const punten = [p("m1", "a", 6, 2), p("m1", "b", 3, 1), p("m2", "b", 5, 2), p("m2", "a", 2, 1), p("m3", "c", 3, 1)];
    const r = seizoenRanglijst(punten);
    expect(r.map((x) => [x.member_id, x.punten, x.matchen, x.gewonnen])).toEqual([["a", 8, 2, 1], ["b", 8, 2, 1], ["c", 3, 1, 1]]);
  });

  it("laat alleen aanwezige spelers stemmen op gespeelde matchen, niet op zichzelf", () => {
    const aanwezigheden = [aanw("m1", "ik", "aanwezig"), aanw("m1", "a", "aanwezig"), aanw("m1", "b", "afwezig"), aanw("m1", "c", "aanwezig")];
    const spelers = [{ id: "ik" }, { id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    expect(magStemmen(match("m1", "gespeeld"), aanwezigheden, "ik")).toBe(true);
    expect(magStemmen(match("m1", "gepland"), aanwezigheden, "ik")).toBe(false);
    expect(magStemmen(match("m1", "gespeeld"), aanwezigheden, "b")).toBe(false);
    expect(magStemmen(match("m1", "gespeeld"), aanwezigheden, null)).toBe(false);
    expect(kandidaten(match("m1", "gespeeld"), aanwezigheden, spelers, "ik").map((s) => s.id)).toEqual(["a", "c"]);
  });
});
