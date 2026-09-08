import { describe, expect, it } from "vitest";
import { allePosities, basisPosities, controleerOpstelling, FORMATIES, positieKort, positieLabel } from "./formaties";

describe("formaties", () => {
  it("elke formatie heeft 11 basisposities en 4 bankplaatsen", () => {
    for (const f of ["4-3-3", "4-4-2", "3-4-3"] as const) {
      expect(basisPosities(f)).toHaveLength(11);
      expect(allePosities(f)).toHaveLength(15);
      expect(new Set(allePosities(f)).size).toBe(15);
      expect(FORMATIES[f][0]).toEqual(["GK"]);
    }
  });

  it("rijen komen overeen met de formatienaam", () => {
    expect(FORMATIES["4-3-3"].slice(1).map((r) => r.length)).toEqual([4, 3, 3]);
    expect(FORMATIES["4-4-2"].slice(1).map((r) => r.length)).toEqual([4, 4, 2]);
    expect(FORMATIES["3-4-3"].slice(1).map((r) => r.length)).toEqual([3, 4, 3]);
  });

  it("controle: lege basispositie en dubbele speler worden gemeld, lege bank niet", () => {
    const vol = Object.fromEntries(basisPosities("4-3-3").map((p, i) => [p, `speler${i}`]));
    expect(controleerOpstelling("4-3-3", vol)).toEqual([]);
    expect(controleerOpstelling("4-3-3", { ...vol, GK: null })[0]).toMatch(/Doelman/);
    expect(controleerOpstelling("4-3-3", { ...vol, BANK1: "speler0" })[0]).toMatch(/meer dan één keer/);
  });

  it("labels en korte codes", () => {
    expect(positieLabel("CB2")).toBe("Centrale verdediger");
    expect(positieKort("CM3")).toBe("CM");
    expect(positieLabel("BANK4")).toBe("Bank 4");
  });
});
