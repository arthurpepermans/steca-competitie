import type { Attendance } from "./types";

export function aanwezigeSpelerIds(matchKey: string | null, aanwezigheden: Attendance[]): Set<string> {
  return new Set(aanwezigheden.filter((a) => a.match_key === matchKey && a.status === "aanwezig").map((a) => a.member_id));
}

export function nietAanwezigeKeuzes(keuze: Record<string, string | null>, aanwezig: Set<string>): string[] {
  return [...new Set(Object.values(keuze).filter((id): id is string => Boolean(id) && !aanwezig.has(id!)))];
}
