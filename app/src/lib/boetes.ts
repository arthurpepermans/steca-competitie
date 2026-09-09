import type { Fine, Match, MatchStat } from "./types";

/** Tarieven van de boetepot, seizoen 2026-2027 (mededeling van het bestuur). */
export type BoeteSoort = {
  code: string;
  label: string;
  cent: number;
  /** aantal = weken, bedrag per week */
  perWeek?: boolean;
  /** komt automatisch uit de wedstrijdstatistieken (kaarten), niet handmatig in te voeren */
  automatisch?: boolean;
  bakBier?: number;
  /** bedrag wordt bij het invoeren zelf ingevuld */
  vrijBedrag?: boolean;
};

export const BOETE_SOORTEN: BoeteSoort[] = [
  { code: "bal_over_net", label: "Bal over het net (en bal gaan zoeken)", cent: 200 },
  { code: "bal_kwijt", label: "Bal kwijt", cent: 1000 },
  { code: "kledij_mee", label: "Kledij mee naar huis, per week", cent: 500, perWeek: true },
  { code: "te_laat_voor", label: "Onverwittigd te laat, voor de match", cent: 200 },
  { code: "te_laat_tijdens", label: "Onverwittigd te laat, match al bezig", cent: 500 },
  { code: "afwezig", label: "Onverwittigd afwezig", cent: 1000 },
  { code: "wasmand", label: "Wasmand laten liggen bij je wasbeurt", cent: 1000 },
  { code: "kleedkamer", label: "Kleedkamer niet gekuist als laatste", cent: 1000 },
  { code: "geel", label: "Gele kaart", cent: 500, automatisch: true },
  { code: "rood", label: "Rode kaart", cent: 0, bakBier: 1, automatisch: true },
  { code: "andere", label: "Andere (bedrag zelf invullen)", cent: 0, vrijBedrag: true },
];

export const GEEL_CENT = 500;
export const ROOD_BAK_BIER = 1;

export function soortLabel(code: string): string {
  return BOETE_SOORTEN.find((s) => s.code === code)?.label ?? code;
}

/** Bedrag in cent voor een handmatige boete: tarief x aantal, of het vrij ingevulde bedrag. */
export function bedragVoor(code: string, aantal: number, vrijCent = 0): number {
  const s = BOETE_SOORTEN.find((x) => x.code === code);
  if (!s) return 0;
  if (s.vrijBedrag) return Math.max(0, Math.round(vrijCent));
  return s.cent * Math.max(1, aantal);
}

export type BoeteItem = {
  id: string | null; // null = afgeleid uit de statistieken
  member_id: string;
  datum: string;
  match_key: string | null;
  soort: string;
  label: string;
  aantal: number;
  cent: number;
  bakBier: number;
  opmerking: string | null;
  uitStats: boolean;
};

export type BoeteTotaal = {
  member_id: string;
  aantal: number;
  cent: number;
  bakBier: number;
  items: BoeteItem[];
};

/** Alle boetes: handmatig ingevoerde plus kaarten uit de wedstrijdstatistieken. */
export function boeteItems(fines: Fine[], stats: MatchStat[], matches: Match[]): BoeteItem[] {
  const perMatch = new Map(matches.map((m) => [m.match_key, m]));
  const items: BoeteItem[] = fines.map((f) => ({
    id: f.id,
    member_id: f.member_id,
    datum: f.datum,
    match_key: f.match_key,
    soort: f.soort,
    label: soortLabel(f.soort),
    aantal: f.aantal,
    cent: f.bedrag_cent,
    bakBier: f.bak_bier,
    opmerking: f.opmerking,
    uitStats: false,
  }));
  for (const s of stats) {
    const datum = perMatch.get(s.match_key)?.datum ?? "";
    if (s.geel > 0) {
      items.push({ id: null, member_id: s.member_id, datum, match_key: s.match_key, soort: "geel", label: soortLabel("geel"), aantal: s.geel, cent: GEEL_CENT * s.geel, bakBier: 0, opmerking: null, uitStats: true });
    }
    if (s.rood > 0) {
      items.push({ id: null, member_id: s.member_id, datum, match_key: s.match_key, soort: "rood", label: soortLabel("rood"), aantal: s.rood, cent: 0, bakBier: ROOD_BAK_BIER * s.rood, opmerking: null, uitStats: true });
    }
  }
  return items.sort((a, b) => b.datum.localeCompare(a.datum));
}

/** Ranglijst: hoogste bedrag eerst, dan bakken bier, dan aantal boetes. */
export function boeteTotalen(items: BoeteItem[]): BoeteTotaal[] {
  const out = new Map<string, BoeteTotaal>();
  for (const it of items) {
    const t = out.get(it.member_id) ?? { member_id: it.member_id, aantal: 0, cent: 0, bakBier: 0, items: [] };
    t.aantal += it.aantal;
    t.cent += it.cent;
    t.bakBier += it.bakBier;
    t.items.push(it);
    out.set(it.member_id, t);
  }
  return [...out.values()].sort((a, b) => b.cent - a.cent || b.bakBier - a.bakBier || b.aantal - a.aantal);
}

export function potTotaal(totalen: BoeteTotaal[]): { cent: number; bakBier: number; aantal: number } {
  return totalen.reduce((p, t) => ({ cent: p.cent + t.cent, bakBier: p.bakBier + t.bakBier, aantal: p.aantal + t.aantal }), { cent: 0, bakBier: 0, aantal: 0 });
}

/** 1250 -> '€ 12,50'. */
export function fmtEuro(cent: number): string {
  const euro = Math.floor(cent / 100);
  const rest = Math.abs(cent % 100);
  return `€ ${euro},${String(rest).padStart(2, "0")}`;
}

export function fmtBakBier(n: number): string {
  return n === 1 ? "1 bak bier" : `${n} bakken bier`;
}
