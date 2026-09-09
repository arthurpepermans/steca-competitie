import { supabase } from "./supabase";
import type {
  Aanwezigheid24u, AanwezigheidStatus, Attendance, AuditEntry, Formatie, Lineup, LineupPlayer,
  Match, MatchStat, Member, MemberBasis, MemberGevoelig, Standing, SyncStatus, Team,
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

export async function haalGevoelig(memberId: string): Promise<MemberGevoelig | null> {
  return check(await supabase.from("members_gevoelig").select("*").eq("member_id", memberId).maybeSingle());
}

export async function bewaarGevoelig(memberId: string, rijksregisternummer: string | null): Promise<void> {
  check(await supabase.from("members_gevoelig").upsert({ member_id: memberId, rijksregisternummer }, { onConflict: "member_id" }).select("member_id"));
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

export async function bewaarOpstelling(matchKey: string, formatie: Formatie, keuze: Record<string, string | null>): Promise<void> {
  const lineup = check<Lineup>(
    await supabase.from("lineups").upsert({ match_key: matchKey, formatie }, { onConflict: "match_key" }).select("*").single(),
  );
  check(await supabase.from("lineup_players").delete().eq("lineup_id", lineup.id));
  const rijen = Object.entries(keuze)
    .filter(([, memberId]) => memberId)
    .map(([positie, memberId]) => ({ lineup_id: lineup.id, member_id: memberId, positie }));
  if (rijen.length) check(await supabase.from("lineup_players").insert(rijen).select("positie"));
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
