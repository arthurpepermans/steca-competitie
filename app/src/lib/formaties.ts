import type { Formatie } from "./types";

/** Rijen van achter (doelman) naar voor (aanval). */
export const FORMATIES: Record<Formatie, string[][]> = {
  "4-3-3": [["GK"], ["RB", "CB1", "CB2", "LB"], ["CM1", "CM2", "CM3"], ["RW", "ST", "LW"]],
  "4-4-2": [["GK"], ["RB", "CB1", "CB2", "LB"], ["RM", "CM1", "CM2", "LM"], ["ST1", "ST2"]],
  "3-4-3": [["GK"], ["CB1", "CB2", "CB3"], ["RM", "CM1", "CM2", "LM"], ["RW", "ST", "LW"]],
};

export const FORMATIE_KEUZES: Formatie[] = ["4-3-3", "4-4-2", "3-4-3"];
export const STANDAARD_FORMATIE: Formatie = "4-3-3";

export const BANK = ["BANK1", "BANK2", "BANK3", "BANK4"];

const LABELS: Record<string, string> = {
  GK: "Doelman",
  RB: "Rechtsachter",
  LB: "Linksachter",
  CB1: "Centrale verdediger",
  CB2: "Centrale verdediger",
  CB3: "Centrale verdediger",
  CM1: "Middenvelder",
  CM2: "Middenvelder",
  CM3: "Middenvelder",
  RM: "Rechtsmidden",
  LM: "Linksmidden",
  RW: "Rechtsbuiten",
  LW: "Linksbuiten",
  ST: "Spits",
  ST1: "Spits",
  ST2: "Spits",
  BANK1: "Bank 1",
  BANK2: "Bank 2",
  BANK3: "Bank 3",
  BANK4: "Bank 4",
};

export function positieLabel(code: string): string {
  return LABELS[code] ?? code;
}

/** Korte code voor op het veldje (zonder volgnummer). */
export function positieKort(code: string): string {
  return code.replace(/\d+$/, "");
}

export function basisPosities(formatie: Formatie): string[] {
  return FORMATIES[formatie].flat();
}

export function allePosities(formatie: Formatie): string[] {
  return [...basisPosities(formatie), ...BANK];
}

export type OpstellingKeuze = Record<string, string | null>; // positie -> member_id

/** Controleert een opstelling: 11 basisspelers ingevuld, niemand dubbel. Bank mag leeg blijven. */
export function controleerOpstelling(formatie: Formatie, keuze: OpstellingKeuze): string[] {
  const fouten: string[] = [];
  const basis = basisPosities(formatie);
  const leeg = basis.filter((p) => !keuze[p]);
  if (leeg.length) fouten.push(`Nog ${leeg.length} basispositie(s) niet ingevuld: ${leeg.map(positieLabel).join(", ")}.`);
  const gekozen = allePosities(formatie).map((p) => keuze[p]).filter(Boolean) as string[];
  const dubbel = gekozen.filter((id, i) => gekozen.indexOf(id) !== i);
  if (dubbel.length) fouten.push("Een speler staat meer dan één keer in de opstelling.");
  return fouten;
}

/** Behoud bestaande posities waar mogelijk en verdeel overige basisspelers zonder verlies. */
export function veranderFormatie(van: Formatie, naar: Formatie, keuze: OpstellingKeuze): OpstellingKeuze {
  const nieuw: OpstellingKeuze = Object.fromEntries(BANK.map(p => [p, keuze[p] ?? null]));
  const posities = basisPosities(naar);
  const behouden = new Set(posities.filter(p => keuze[p]));
  const over = basisPosities(van).filter(p => !behouden.has(p)).map(p => keuze[p]).filter((id): id is string => Boolean(id));
  for (const p of posities) nieuw[p] = behouden.has(p) ? keuze[p] : over.shift() ?? null;
  return nieuw;
}
