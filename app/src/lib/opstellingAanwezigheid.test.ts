import { describe, expect, it } from "vitest";
import { aanwezigeSpelerIds, nietAanwezigeKeuzes } from "./opstellingAanwezigheid";
import type { Attendance } from "./types";

const antwoord = (member_id: string, status: Attendance["status"], match_key = "match-a"): Attendance => ({ member_id, status, match_key, gezet_door: null, updated_at: "2026-09-09" });

describe("opstellen op basis van aanwezigheid", () => {
  it("laat alleen expliciet aanwezige spelers van de gekozen wedstrijd toe", () => {
    const rows = [antwoord("a", "aanwezig"), antwoord("b", "afwezig"), antwoord("c", "onzeker"), antwoord("d", "aanwezig", "match-b")];
    expect([...aanwezigeSpelerIds("match-a", rows)]).toEqual(["a"]);
    expect([...aanwezigeSpelerIds(null, rows)]).toEqual([]);
  });
  it("controleert ook bankspelers en spelers zonder antwoord", () => {
    expect(nietAanwezigeKeuzes({ GK: "a", BANK1: "b", BANK2: null, ST: "geen-antwoord" }, new Set(["a"]))).toEqual(["b", "geen-antwoord"]);
  });
  it("markeert een bestaande keuze na een wijziging naar onzeker", () => {
    const keuze = { GK: "a", BANK1: "b" };
    expect(nietAanwezigeKeuzes(keuze, aanwezigeSpelerIds("match-a", [antwoord("a", "aanwezig"), antwoord("b", "aanwezig")]))).toEqual([]);
    expect(nietAanwezigeKeuzes(keuze, aanwezigeSpelerIds("match-a", [antwoord("a", "aanwezig"), antwoord("b", "onzeker")]))).toEqual(["b"]);
  });
});
