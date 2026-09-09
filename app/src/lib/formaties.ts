import type { Formatie } from "./types";

/** Rijen van achter (doelman) naar voor (aanval). */
export const FORMATIES: Record<Formatie, string[][]> = {
  "4-3-3": [["GK"], ["LB", "CB1", "CB2", "RB"], ["CM1", "CM2", "CM3"], ["LW", "ST", "RW"]],
  "4-4-2": [["GK"], ["LB", "CB1", "CB2", "RB"], ["LM", "CM1", "CM2", "RM"], ["ST1", "ST2"]],
  "3-4-3": [["GK"], ["CB1", "CB2", "CB3"], ["LM", "CM1", "CM2", "RM"], ["LW", "ST", "RW"]],
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

/** HET RAD: een willekeurige opstelling uit de aanwezige spelers. Elf in de basis, de rest (max. vier) op de bank.
 *  Met minder dan elf spelers komt er niets uit. `random` is vervangbaar voor tests. */
export function radOpstelling(formatie: Formatie, aanwezig: string[], random: () => number = Math.random, vast: OpstellingKeuze = {}): OpstellingKeuze {
  const basis = basisPosities(formatie);
  const posities = allePosities(formatie);
  const gekozen = Object.entries(vast).filter(([, id]) => Boolean(id));
  const vasteIds = new Set(gekozen.map(([, id]) => id));
  if (gekozen.some(([pos, id]) => !posities.includes(pos) || !aanwezig.includes(id!)) || vasteIds.size !== gekozen.length) {
    throw new Error("Controleer de vergrendelde spelers en hun aanwezigheid voordat je het rad draait.");
  }
  const uniekeAanwezigen = [...new Set(aanwezig)];
  if (uniekeAanwezigen.length < basis.length + gekozen.filter(([pos]) => BANK.includes(pos)).length) return {};
  const pot = uniekeAanwezigen.filter(id => !vasteIds.has(id));
  for (let i = pot.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pot[i], pot[j]] = [pot[j], pot[i]];
  }
  const keuze: OpstellingKeuze = {};
  for (const p of posities) keuze[p] = vast[p] || pot.shift() || null;
  return keuze;
}
