import { describe, expect, it } from "vitest";
import { BANK, basisPosities, controleerOpstelling, radOpstelling } from "./formaties";

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
