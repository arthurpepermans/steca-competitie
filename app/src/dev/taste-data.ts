import { allePosities } from "../lib/formaties";
import type { Attendance, Lineup, LineupPlayer, Match, Member, Standing, Team } from "../lib/types";
import { EIGEN_PLOEGID } from "../lib/config";

// Alle gegevens hieronder zijn voorbeeldgegevens, geen officiële clubgegevens.
const reeks = "DERDE AFDELING B";
const seizoen = "2026-2027";
const namen = ["Arthur Pepermans", "Seppe De Wilde", "Lars Vermeulen", "Mathis Claes", "Niels Maes", "Tuur De Smet", "Wout Jacobs", "Jelle Peeters", "Arne Van Damme", "Mats Willems", "Victor De Vos", "Bram Hendrickx", "Florian Goossens", "Lennert De Clercq", "Senne Michiels", "Robbe Wouters", "Daan Coppens", "Kobe Van Acker"];
export const leden: Member[] = namen.map((naam, i) => ({
  id: "voorbeeld-" + i, user_id: null, naam, voornaam: naam.split(" ")[0], achternaam: naam.split(" ").slice(1).join(" "),
  speelt: true, functie: "speler", nationaliteit: null, nr: null, ingeschreven: true, bron: "registratie",
  email: "speler" + i + "@example.com", telefoon: "Voorbeeld", geboortedatum: "2000-01-01", adres: "Voorbeeldadres",
  status: "actief", is_admin: false, is_hoofdadmin: false,
}));
export const voorbeeldLid = { ...leden[0], functie: "spelercoach" as const };
function datum(weken: number) {
  const d = new Date();
  const verschil = (6 - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + verschil + weken * 7);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
}
const clubs = ["Steca Juniors", "FC Patron", "VK Eeksken", "VK De Sjoeters 81", "FC Stroppen"];
const ids = [EIGEN_PLOEGID, 63, 90, 81, 35];
export const matches: Match[] = clubs.slice(1).map((tegen, i) => ({
  match_key: "voorbeeld-match-" + i, seizoen, reeks, datum: datum(i), uur: i === 2 ? "15:30" : "15:00",
  thuis_id: i === 3 ? EIGEN_PLOEGID : ids[i + 1], uit_id: i === 3 ? ids[i + 1] : EIGEN_PLOEGID,
  thuis: i === 3 ? "Steca Juniors" : tegen, uit: i === 3 ? tegen : "Steca Juniors",
  thuis_score: null, uit_score: null, status: "gepland",
  terrein: i === 0 ? "Putstraat 116, 9310 Meldert" : i === 3 ? "Oud Kerkhofstraat 124, 9200 Dendermonde" : null,
  opmerking: null,
}));
const stand: Standing[] = clubs.map((ploeg, i) => ({ seizoen, reeks, ploegid: ids[i], bron: "kavvv", positie: i + 1, ploeg, gespeeld: 0, gewonnen: 0, gelijk: 0, verloren: 0, doelpunten_voor: 0, doelpunten_tegen: 0, saldo: 0, punten: 0, label: null, vergelijking_status: "gelijk" }));
const teams: Team[] = clubs.map((naam, i) => ({ ploegid: ids[i], seizoen, naam, reeks, clubnummer: null, afdeling: reeks, terrein: i === 0 ? "Oud Kerkhofstraat 124, 9200 Dendermonde" : matches[i - 1].terrein, kleuren: i === 0 ? "Zwart en wit" : null, secretaris: null, secretaris_adres: null, tel: null, gsm: null, email: null, verantwoordelijke: null, verantwoordelijke_tel: null, wegwijzer: null }));
let aanwezigheden: Attendance[] = leden.slice(1, 16).map((lid, i) => ({ match_key: matches[0].match_key, member_id: lid.id, status: i < 12 ? "aanwezig" : i < 14 ? "onzeker" : "afwezig", gezet_door: null, updated_at: "" }));

let voorbeeldLineups: Lineup[] = [{id:"voorbeeld-lineup",match_key:matches[0].match_key,formatie:"4-3-3",gemaakt_door:null,updated_at:"2026-09-09T12:00:00Z"}];
let voorbeeldOpstelling: LineupPlayer[] = allePosities("4-3-3").map((positie,i)=>({lineup_id:"voorbeeld-lineup",positie,member_id:leden[i].id}));

export function installeerTestgegevens() {
  const origineleFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin === location.origin) return origineleFetch(input, init);
    const antwoord = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
    if (url.pathname === "/storage/v1/object/list/match-sfeerbeelden") return antwoord([]);
    if (!url.pathname.startsWith("/rest/v1/")) return antwoord({ message: "Dit ontwerpvoorbeeld gebruikt geen echte accounts." }, 400);
    const tabel = url.pathname.slice("/rest/v1/".length);
    if (request.method !== "GET") {
      if (tabel === "rpc/bewaar_opstelling" && request.method === "POST") {
        const waarde = await request.json();
        const keuzes = Object.entries(waarde.p_keuze as Record<string, string | null>).filter(([, id]) => id);
        if (keuzes.some(([, id]) => !aanwezigheden.some((a) => a.match_key === waarde.p_match_key && a.member_id === id && a.status === "aanwezig"))) return antwoord({ message: "Alleen aanwezige spelers kunnen opgesteld worden." }, 400);
        const rij: Lineup = { id: voorbeeldLineups.find((l) => l.match_key === waarde.p_match_key)?.id ?? "voorbeeld-" + waarde.p_match_key, match_key: waarde.p_match_key, formatie: waarde.p_formatie, gemaakt_door: null, updated_at: new Date().toISOString() };
        voorbeeldLineups = [...voorbeeldLineups.filter((l) => l.id !== rij.id), rij];
        voorbeeldOpstelling = [...voorbeeldOpstelling.filter((p) => p.lineup_id !== rij.id), ...keuzes.map(([positie, id]) => ({ lineup_id: rij.id, positie, member_id: id! }))];
        return antwoord(null);
      }
      if (tabel === "lineups" && request.method === "POST") {
        const waarde = await request.json();
        const rij: Lineup = { ...waarde, id:voorbeeldLineups.find(l=>l.match_key===waarde.match_key)?.id ?? "voorbeeld-"+waarde.match_key, gemaakt_door:null, updated_at:new Date().toISOString() };
        voorbeeldLineups = [...voorbeeldLineups.filter(l=>l.match_key!==rij.match_key),rij];
        return antwoord(rij);
      }
      if (tabel === "lineup_players" && request.method === "DELETE") {
        const id = url.searchParams.get("lineup_id")?.replace(/^eq\./, "");
        voorbeeldOpstelling = voorbeeldOpstelling.filter(p=>p.lineup_id!==id);
        return antwoord([]);
      }
      if (tabel === "lineup_players" && request.method === "POST") {
        const rijen = await request.json() as LineupPlayer[];
        voorbeeldOpstelling.push(...rijen);
        return antwoord(rijen);
      }

      if (tabel === "attendance" && request.method === "POST") {
        const waarde = await request.json() as Attendance;
        aanwezigheden = [...aanwezigheden.filter((a) => !(a.match_key === waarde.match_key && a.member_id === waarde.member_id)), waarde];
        return antwoord([waarde]);
      }
      return antwoord({ message: "Alleen aanwezigheid en opstelling worden tijdelijk in dit voorbeeld bewaard." }, 400);
    }
    const db: Record<string, object[]> = {
      matches, standings_current: stand, members: leden, members_basis: leden.map((m) => ({ ...m, heeft_account: true })),
      teams, attendance: aanwezigheden, lineups: voorbeeldLineups, lineup_players: voorbeeldOpstelling, match_stats: [], audit_log: [],
      sync_status: [], fines: [], match_vote_points: [], match_vote_counts: [], match_votes: [],
    };
    if (!(tabel in db)) return antwoord({ message: "Geen voorbeeldgegevens voor dit onderdeel." }, 400);
    let rijen = db[tabel];
    for (const [veld, filter] of url.searchParams) {
      if (filter.startsWith("eq.")) rijen = rijen.filter((rij) => String((rij as Record<string, unknown>)[veld]) === filter.slice(3));
    }
    return antwoord(rijen);
  };
}
