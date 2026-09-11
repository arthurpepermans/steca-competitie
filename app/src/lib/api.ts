import { supabase } from "./supabase";
import type {
  Aanwezigheid24u, AanwezigheidStatus, Attendance, AuditEntry, Formatie, Lineup, LineupPlayer,
  Fine, LaundryTurn, Match, MatchStat, TickerMessage, MatchVote, Member, MemberBasis, Standing, StandingHistory, SyncStatus, Team, VoteCount, VotePoints,
} from "./types";

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ---------------------------------------------------------------- sync-data

export async function haalMatches(): Promise<Match[]> {
  return check(await supabase.from("matches").select("*").order("datum").order("uur"));
}

export async function haalTeams(): Promise<Team[]> {
  return check(await supabase.from("teams").select("*").order("naam"));
}

export async function haalKlassement(): Promise<Standing[]> {
  return check(await supabase.from("standings_current").select("*").order("reeks").order("positie"));
}

export async function haalSyncStatus(): Promise<SyncStatus | null> {
  return check(await supabase.from("sync_status").select("*").eq("id", "kavvv").maybeSingle());
}

// -------------------------------------------------------------------- leden

export async function haalLeden(): Promise<Member[]> {
  return check(await supabase.from("members").select("*").order("achternaam").order("voornaam"));
}

export async function haalLedenBasis(): Promise<MemberBasis[]> {
  return check(await supabase.from("members_basis").select("*").order("achternaam").order("voornaam"));
}

export async function haalLid(id: string): Promise<Member | null> {
  return check(await supabase.from("members").select("*").eq("id", id).maybeSingle());
}

export async function haalLidBasis(id: string): Promise<MemberBasis | null> {
  return check(await supabase.from("members_basis").select("*").eq("id", id).maybeSingle());
}

export async function wijzigLid(id: string, velden: Partial<Member>): Promise<void> {
  check(await supabase.from("members").update(velden).eq("id", id).select("id"));
}

export async function adminZetWachtwoord(memberId: string, wachtwoord: string): Promise<void> {
  check(await supabase.rpc("admin_set_password", { p_member_id: memberId, p_wachtwoord: wachtwoord }));
}

export async function adminVerwijderLid(memberId: string): Promise<void> {
  check(await supabase.rpc("admin_verwijder_lid", { p_member_id: memberId }));
}

export async function adminOntkoppelAccount(memberId: string): Promise<void> {
  check(await supabase.rpc("admin_ontkoppel_account", { p_member_id: memberId }));
}

export async function mijnLid(): Promise<Member | null> {
  const lid = check<Member | null>(await supabase.rpc("mijn_lid"));
  return lid && lid.id ? lid : null;
}

export async function voegLidToe(velden: Partial<Member>): Promise<Member> {
  return check(await supabase.from("members").insert({ ...velden, bron: "admin", status: "actief" }).select("*").single());
}

// ----------------------------------------------------------- aanwezigheden

export async function haalAanwezigheden(): Promise<Attendance[]> {
  return check(await supabase.from("attendance").select("*"));
}

export async function zetAanwezigheid(matchKey: string, memberId: string, status: AanwezigheidStatus): Promise<void> {
  check(await supabase.from("attendance").upsert({ match_key: matchKey, member_id: memberId, status }, { onConflict: "match_key,member_id" }).select("match_key"));
}

export async function aanwezigheden24u(matchKey: string): Promise<Aanwezigheid24u[]> {
  return check(await supabase.rpc("aanwezigheden_24u_voor", { p_match_key: matchKey }));
}

// ------------------------------------------------------------- opstelling

export async function haalOpstellingen(): Promise<Lineup[]> {
  return check(await supabase.from("lineups").select("*"));
}

export async function haalOpstellingSpelers(lineupId: string): Promise<LineupPlayer[]> {
  return check(await supabase.from("lineup_players").select("*").eq("lineup_id", lineupId));
}

export async function bewaarOpstelling(matchKey: string, formatie: Formatie, keuze: Record<string, string | null>, slotjes: string[] = []): Promise<void> {
  check(await supabase.rpc("bewaar_opstelling_met_slotjes", { p_match_key: matchKey, p_formatie: formatie, p_keuze: keuze, p_slotjes: slotjes }));
}

export async function bewaarOpstellingAutomatisch(matchKey: string, formatie: Formatie, keuze: Record<string, string | null>, slotjes: string[], verwacht: string | null): Promise<Lineup> {
  return check(await supabase.rpc("bewaar_opstelling_auto", { p_match_key: matchKey, p_formatie: formatie, p_keuze: keuze, p_slotjes: slotjes, p_verwacht: verwacht }));
}

// ----------------------------------------------------------- statistieken

export async function haalStats(): Promise<MatchStat[]> {
  return check(await supabase.from("match_stats").select("*"));
}

export async function bewaarStats(matchKey: string, rijen: MatchStat[]): Promise<void> {
  const data = rijen.map((r) => ({
    match_key: matchKey, member_id: r.member_id, gespeeld: r.gespeeld,
    goals: r.goals, assists: r.assists, geel: r.geel, rood: r.rood,
  }));
  if (data.length) check(await supabase.from("match_stats").upsert(data, { onConflict: "match_key,member_id" }).select("match_key"));
}

export async function verwijderStat(matchKey: string, memberId: string): Promise<void> {
  check(await supabase.from("match_stats").delete().eq("match_key", matchKey).eq("member_id", memberId));
}

// ---------------------------------------------------------------- logboek

export async function haalLogboek(tabel: string, rijPrefix: string): Promise<AuditEntry[]> {
  return check(
    await supabase.from("audit_log").select("*").eq("tabel", tabel).like("rij_id", `${rijPrefix}%`).order("op", { ascending: false }).limit(200),
  );
}

// ---------------------------------------------------------------- boetepot

export async function haalBoetes(): Promise<Fine[]> {
  return check(await supabase.from("fines").select("*").order("datum", { ascending: false }));
}

export async function voegBoeteToe(boete: Omit<Fine, "id" | "ingevoerd_door" | "created_at" | "updated_at">): Promise<void> {
  check(await supabase.from("fines").insert(boete));
}

export async function verwijderBoete(id: string): Promise<void> {
  check(await supabase.from("fines").delete().eq("id", id));
}

// ---------------------------------------------------------------- junior van de match

export async function haalStemPunten(): Promise<VotePoints[]> {
  return check(await supabase.from("match_vote_points").select("*"));
}

export async function haalStemmers(): Promise<VoteCount[]> {
  return check(await supabase.from("match_vote_counts").select("*"));
}

/** Alleen de eigen stembrieven (RLS). */
export async function haalMijnStemmen(): Promise<MatchVote[]> {
  return check(await supabase.from("match_votes").select("*"));
}

export async function stem(matchKey: string, eerste: string, tweede: string, derde: string): Promise<void> {
  const lid = check<Member | null>(await supabase.rpc("mijn_lid"));
  if (!lid) throw new Error("Geen lid gevonden bij dit account.");
  check(await supabase.from("match_votes").upsert({ match_key: matchKey, voter_id: lid.id, eerste, tweede, derde }, { onConflict: "match_key,voter_id" }));
}

export async function trekStemIn(matchKey: string): Promise<void> {
  const lid = check<Member | null>(await supabase.rpc("mijn_lid"));
  if (!lid) throw new Error("Geen lid gevonden bij dit account.");
  check(await supabase.from("match_votes").delete().eq("match_key", matchKey).eq("voter_id", lid.id));
}

// ---------------------------------------------------------------- wasmand

export async function haalWasbeurten(): Promise<LaundryTurn[]> {
  return check(await supabase.from("laundry_turns").select("*"));
}

/** Duidt de speler aan die de wasmand meeneemt; null haalt de aanduiding weg. */
export async function zetWasbeurt(matchKey: string, memberId: string | null): Promise<void> {
  if (memberId === null) {
    check(await supabase.from("laundry_turns").delete().eq("match_key", matchKey));
  } else {
    check(await supabase.from("laundry_turns").upsert({ match_key: matchKey, member_id: memberId }, { onConflict: "match_key" }));
  }
}

// ---------------------------------------------------------------- lichtkrant

export async function haalLichtkrantBerichten(): Promise<TickerMessage[]> {
  return check(await supabase.from("ticker_messages").select("*").order("created_at", { ascending: true }));
}

export async function voegLichtkrantBerichtToe(tekst: string): Promise<void> {
  check(await supabase.from("ticker_messages").insert({ tekst }));
}

export async function wijzigLichtkrantBericht(id: string, velden: Partial<Pick<TickerMessage, "tekst" | "actief">>): Promise<void> {
  check(await supabase.from("ticker_messages").update(velden).eq("id", id));
}

export async function verwijderLichtkrantBericht(id: string): Promise<void> {
  check(await supabase.from("ticker_messages").delete().eq("id", id));
}

// ---------------------------------------------------------------- standgeschiedenis (pijltjes)

export async function haalStandGeschiedenis(): Promise<StandingHistory[]> {
  return check(await supabase.from("standings_history").select("*").order("vastgelegd_op", { ascending: false }).limit(2000));
}
