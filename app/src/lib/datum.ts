import { EIGEN_PLOEGID } from "./config";
import type { Match } from "./types";

const DAGEN = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const MAANDEN = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** 'JJJJ-MM-DD' -> Date op middernacht lokale tijd. */
export function naarDate(iso: string): Date {
  const [j, m, d] = iso.split("-").map(Number);
  return new Date(j, m - 1, d);
}

export function vandaagIso(nu: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${nu.getFullYear()}-${p(nu.getMonth() + 1)}-${p(nu.getDate())}`;
}

/** 'JJJJ-MM-DD' -> 'za 12 sep 2026'. */
export function fmtDatum(iso: string | null): string {
  if (!iso) return "datum onbekend";
  const d = naarDate(iso);
  return `${DAGEN[d.getDay()]} ${d.getDate()} ${MAANDEN[d.getMonth()]} ${d.getFullYear()}`;
}

/** ISO-tijdstip -> 'di 8 sep 2026, 20:01'. */
export function fmtTijdstip(iso: string | null): string {
  if (!iso) return "nooit";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${DAGEN[d.getDay()]} ${d.getDate()} ${MAANDEN[d.getMonth()]} ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function isEigen(m: Match): boolean {
  return m.thuis_id === EIGEN_PLOEGID || m.uit_id === EIGEN_PLOEGID;
}

export function isThuis(m: Match): boolean {
  return m.thuis_id === EIGEN_PLOEGID;
}

export function tegenstander(m: Match): string {
  return isThuis(m) ? m.uit : m.thuis;
}

export function sorteerOpDatum<T extends { datum: string | null; uur: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => `${a.datum ?? "9999"} ${a.uur ?? ""}`.localeCompare(`${b.datum ?? "9999"} ${b.uur ?? ""}`));
}

/** Eerstvolgende geplande eigen match (vandaag of later). */
export function volgendeMatch(matches: Match[], vandaag: string = vandaagIso()): Match | undefined {
  return sorteerOpDatum(matches.filter((m) => isEigen(m) && m.status === "gepland" && (m.datum ?? "") >= vandaag))[0];
}

/** Laatst gespeelde eigen match met score. */
export function laatsteUitslag(matches: Match[]): Match | undefined {
  const gespeeld = sorteerOpDatum(matches.filter((m) => isEigen(m) && m.status === "gespeeld"));
  return gespeeld[gespeeld.length - 1];
}

export function score(m: Match): string {
  return m.status === "gespeeld" ? `${m.thuis_score} - ${m.uit_score}` : (m.uur ?? "");
}

/** Winst/gelijk/verlies vanuit Steca gezien. */
export function resultaat(m: Match): "W" | "G" | "V" | null {
  if (m.status !== "gespeeld" || m.thuis_score === null || m.uit_score === null) return null;
  const voor = isThuis(m) ? m.thuis_score : m.uit_score;
  const tegen = isThuis(m) ? m.uit_score : m.thuis_score;
  return voor > tegen ? "W" : voor === tegen ? "G" : "V";
}

export function mapsUrl(terrein: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(terrein)}`;
}

/** Aanwezigheid mag aangepast worden tot en met de dag van de match. */
export function magAanwezigheidWijzigen(m: Match, vandaag: string = vandaagIso()): boolean {
  return m.status === "gepland" && (m.datum ?? "") >= vandaag;
}
