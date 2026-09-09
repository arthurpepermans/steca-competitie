import { describe, expect, it } from "vitest";
import { juniorVanDeMatch, kandidaten, magStemmen, matchRanglijst, seizoenRanglijst, stemDeadline, stemmingOpen, stemtOpZichzelf } from "./stemmen";
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

  it("laat alleen aanwezige spelers stemmen op gespeelde matchen", () => {
    const aanwezigheden = [aanw("m1", "ik", "aanwezig"), aanw("m1", "a", "aanwezig"), aanw("m1", "b", "afwezig"), aanw("m1", "c", "aanwezig")];
    const spelers = [{ id: "ik" }, { id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
    const vandaag = "2026-09-06";
    expect(magStemmen(match("m1", "gespeeld"), aanwezigheden, "ik", vandaag)).toBe(true);
    expect(magStemmen(match("m1", "gepland"), aanwezigheden, "ik", vandaag)).toBe(false);
    expect(magStemmen(match("m1", "gespeeld"), aanwezigheden, "b", vandaag)).toBe(false);
    expect(magStemmen(match("m1", "gespeeld"), aanwezigheden, null, vandaag)).toBe(false);
    expect(kandidaten(match("m1", "gespeeld"), aanwezigheden, spelers).map((s) => s.id)).toEqual(["ik", "a", "c"]);
  });

  it("sluit de stemming 7 dagen na de match", () => {
    const m = match("m1", "gespeeld"); // gespeeld op 2026-09-05
    expect(stemDeadline(m)).toBe("2026-09-12");
    expect(stemmingOpen(m, "2026-09-12")).toBe(true);
    expect(stemmingOpen(m, "2026-09-13")).toBe(false);
    expect(stemmingOpen({ ...m, datum: null }, "2026-09-06")).toBe(false);
  });

  it("herkent een egotripper", () => {
    expect(stemtOpZichzelf("ik", ["a", "ik", "c"])).toBe(true);
    expect(stemtOpZichzelf("ik", ["a", "b", "c"])).toBe(false);
    expect(stemtOpZichzelf(null, ["a"])).toBe(false);
  });
});
