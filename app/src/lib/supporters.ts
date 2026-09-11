import { supabase } from "./supabase";
import type { Fine, Match, MatchStat, Standing, Team } from "./types";

export type OpenbareCijfers = { spelers: { id: string; naam: string }[]; stats: MatchStat[]; boetes: Fine[] };
export async function haalOpenbareCijfers(): Promise<OpenbareCijfers> {
  const { data, error } = await supabase.rpc("openbare_spelerscijfers");
  if (error) throw new Error("De statistieken en boetes konden niet geladen worden.");
  return data as OpenbareCijfers;
}

export type SupportersData = {
  matches: Match[];
  klassement: Standing[];
  ploegen: Pick<Team, "ploegid" | "naam" | "reeks" | "terrein" | "kleuren">[];
};

export async function haalSupportersData(): Promise<SupportersData> {
  // De database geeft uitsluitend expliciet toegestane openbare velden terug.
  const { data, error } = await supabase.rpc("openbare_clubinfo");
  if (error) throw new Error("De wedstrijdinformatie kon niet geladen worden. Probeer opnieuw.");
  return data as SupportersData;
}

// Opstellingen voor bezoekers bevatten alleen de formatie, spelersnamen en badgekoppelingen per positie.
export type OpenbareOpstelling = { match_key: string; formatie: import("./types").Formatie; spelers: { positie: string; naam: string; member_id?: string }[] };
export async function haalOpenbareOpstellingen(): Promise<OpenbareOpstelling[]> {
  const { data, error } = await supabase.rpc("openbare_opstellingen");
  if (error) throw new Error("De opstellingen konden niet geladen worden.");
  return data as OpenbareOpstelling[];
}
