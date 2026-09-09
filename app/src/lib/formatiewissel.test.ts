import { describe, expect, it } from "vitest";
import { allePosities, basisPosities, FORMATIE_KEUZES, veranderFormatie, BANK } from "./formaties";
describe("formatiewissel", () => {
  for (const van of FORMATIE_KEUZES) for (const naar of FORMATIE_KEUZES) {
    it(`${van} naar ${naar} behoudt alle spelers en de bank`, () => {
      const keuze = Object.fromEntries(allePosities(van).map((p,i)=>[p,`speler-${i}`]));
      const nieuw = veranderFormatie(van,naar,keuze);
      expect(basisPosities(naar).map(p=>nieuw[p]).sort()).toEqual(basisPosities(van).map(p=>keuze[p]).sort());
      for (const p of BANK) expect(nieuw[p]).toBe(keuze[p]);
      expect(new Set(Object.values(nieuw)).size).toBe(15);
    });
  }
});
