import { describe, expect, it } from "vitest";
import { BANK, FORMATIES, basisPosities, controleerOpstelling, radOpstelling } from "./formaties";

/** Vaste, herhaalbare 'toevalsgenerator' voor de test. */
function vasteReeks(): () => number {
  let x = 12345;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

const spelers = Array.from({ length: 17 }, (_, i) => `s${i + 1}`);

describe("het rad", () => {
  it("houdt basis- en bankspelers op hun vergrendelde positie bij elke draai", () => {
    const random = vasteReeks();
    for (let i = 0; i < 100; i++) {
      const keuze = radOpstelling("4-3-3", spelers, random, { GK: "s1", LW: "s2", BANK4: "s3" });
      expect(keuze).toMatchObject({ GK: "s1", LW: "s2", BANK4: "s3" });
      expect(controleerOpstelling("4-3-3", keuze)).toEqual([]);
    }
  });
  it("loot een vaste bankspeler niet mee om een ontbrekende basisspeler op te vullen", () => {
    expect(radOpstelling("4-3-3", spelers.slice(0, 11), vasteReeks(), { BANK1: "s1" })).toEqual({});
    const keuze = radOpstelling("4-3-3", spelers.slice(0, 12), vasteReeks(), { BANK4: "s1" });
    expect(controleerOpstelling("4-3-3", keuze)).toEqual([]);
    expect(keuze.BANK4).toBe("s1");
    expect(keuze.BANK1).toBeNull();
  });
  it("weigert afwezige, dubbele of ongeldige vergrendelingen", () => {
    const ongeldig: Record<string, string | null>[] = [{ GK: "afwezig" }, { GK: "s1", ST: "s1" }, { LM: "s1" }];
    for (const vast of ongeldig) {
      expect(() => radOpstelling("4-3-3", spelers, vasteReeks(), vast)).toThrow(/vergrendelde/);
    }
  });
  it("tekent linkerposities links en rechterposities rechts", () => {
    for (const rijen of Object.values(FORMATIES)) {
      for (const [links, rechts] of [["LB", "RB"], ["LW", "RW"], ["LM", "RM"]]) {
        const rij = rijen.find(r => r.includes(links));
        if (rij) expect(rij.indexOf(links)).toBeLessThan(rij.indexOf(rechts));
      }
    }
  });
  it("vult de elf basisposities en de bank met aanwezige spelers, niemand dubbel", () => {
    const keuze = radOpstelling("4-3-3", spelers, vasteReeks());
    expect(controleerOpstelling("4-3-3", keuze)).toEqual([]);
    const gekozen = Object.values(keuze).filter(Boolean);
    expect(new Set(gekozen).size).toBe(15);
    expect(basisPosities("4-3-3").every((p) => keuze[p])).toBe(true);
    expect(BANK.every((p) => keuze[p])).toBe(true);
  });

  it("laat bankplaatsen leeg als er minder dan vijftien spelers zijn", () => {
    const keuze = radOpstelling("4-4-2", spelers.slice(0, 12), vasteReeks());
    expect(controleerOpstelling("4-4-2", keuze)).toEqual([]);
    expect(BANK.filter((p) => keuze[p]).length).toBe(1);
  });

  it("geeft een lege keuze terug bij minder dan elf spelers", () => {
    expect(radOpstelling("3-4-3", spelers.slice(0, 10), vasteReeks())).toEqual({});
  });

  it("geeft een andere volgorde bij een andere reeks", () => {
    const a = radOpstelling("4-3-3", spelers, vasteReeks());
    let y = 999;
    const andere = () => { y = (y * 48271) % 2147483647; return y / 2147483647; };
    const b = radOpstelling("4-3-3", spelers, andere);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});
