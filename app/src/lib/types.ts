import type { Functie } from "./config";

export type Match = {
  match_key: string;
  seizoen: string;
  reeks: string;
  datum: string | null; // 'JJJJ-MM-DD'
  uur: string | null; // 'HH:MM'
  thuis_id: number | null;
  uit_id: number | null;
  thuis: string;
  uit: string;
  thuis_score: number | null;
  uit_score: number | null;
  status: "gepland" | "gespeeld";
  terrein: string | null;
  opmerking: string | null;
};

export type Team = {
  ploegid: number;
  seizoen: string;
  naam: string;
  reeks: string | null;
  clubnummer: string | null;
  afdeling: string | null;
  terrein: string | null;
  kleuren: string | null;
  secretaris: string | null;
  secretaris_adres: string | null;
  tel: string | null;
  gsm: string | null;
  email: string | null;
  verantwoordelijke: string | null;
  verantwoordelijke_tel: string | null;
  wegwijzer: string | null;
};

export type Standing = {
  seizoen: string;
  reeks: string;
  ploegid: number;
  bron: "kavvv" | "berekend";
  positie: number;
  ploeg: string;
  gespeeld: number;
  gewonnen: number;
  gelijk: number;
  verloren: number;
  doelpunten_voor: number;
  doelpunten_tegen: number;
  saldo: number;
  punten: number;
  label: string | null;
  vergelijking_status: string;
};

export type SyncStatus = {
  id: string;
  laatste_poging_at: string | null;
  laatste_succes_at: string | null;
  status: string;
  fout: string | null;
};

export type LidStatus = "wacht_op_goedkeuring" | "actief" | "inactief";

export type Member = {
  id: string;
  user_id: string | null;
  naam: string; // voornaam + achternaam, afgeleid in de database
  voornaam: string | null;
  achternaam: string | null;
  speelt: boolean; // afgeleid uit de functie: speler, spelercoach en verantwoordelijke tellen mee als speler
  functie: Functie;
  nationaliteit: string | null;
  nr: number | null;
  ingeschreven: boolean | null;
  bron: "import" | "registratie" | "admin";
  email: string;
  telefoon: string | null;
  geboortedatum: string | null;
  adres: string | null;
  status: LidStatus;
  is_admin: boolean;
  is_hoofdadmin: boolean;
  aangemaakt_op?: string;
};

/** Beperkte weergave (view members_basis) voor supporters. */
export type MemberBasis = Pick<Member, "id" | "naam" | "voornaam" | "achternaam" | "speelt" | "functie" | "status" | "is_admin" | "is_hoofdadmin"> & { heeft_account: boolean };

export type AanwezigheidStatus = "aanwezig" | "afwezig" | "onzeker";

export type Attendance = {
  match_key: string;
  member_id: string;
  status: AanwezigheidStatus;
  gezet_door: string | null;
  updated_at: string;
};

export type Formatie = "4-3-3" | "4-4-2" | "3-4-3";

export type Lineup = {
  id: string;
  match_key: string;
  formatie: Formatie;
  gemaakt_door: string | null;
  updated_at: string;
};

export type LineupPlayer = {
  lineup_id: string;
  member_id: string;
  positie: string;
  vergrendeld?: boolean;
};

export type MatchStat = {
  match_key: string;
  member_id: string;
  gespeeld: boolean;
  goals: number;
  assists: number;
  geel: number;
  rood: number;
  ingevoerd_door?: string | null;
  updated_at?: string;
};

export type AuditEntry = {
  id: number;
  tabel: string;
  rij_id: string;
  actie: string;
  oud: Record<string, unknown> | null;
  nieuw: Record<string, unknown> | null;
  door: string | null;
  op: string;
};

export type Aanwezigheid24u = {
  member_id: string;
  naam: string;
  functie: Functie;
  status: AanwezigheidStatus;
  gezet_op: string;
};

export type Fine = {
  id: string;
  member_id: string;
  match_key: string | null;
  datum: string; // 'JJJJ-MM-DD'
  soort: string; // code uit BOETE_SOORTEN
  aantal: number;
  bedrag_cent: number;
  bak_bier: number;
  opmerking: string | null;
  ingevoerd_door: string | null;
  created_at?: string;
  updated_at?: string;
};

/** Stembrief van één lid voor één match: beste drie spelers. */
export type MatchVote = {
  match_key: string;
  voter_id: string;
  eerste: string;
  tweede: string;
  derde: string;
  updated_at?: string;
};

/** Opgetelde punten per match en speler (view match_vote_points). */
export type VotePoints = {
  match_key: string;
  member_id: string;
  punten: number;
  stemmen: number;
};

/** Aantal stemmers per match (view match_vote_counts). */
export type VoteCount = {
  match_key: string;
  stemmers: number;
};

/** Wie de wasmand na een match mee naar huis neemt (tabel laundry_turns). */
export type LaundryTurn = {
  match_key: string;
  member_id: string;
  opmerking: string | null;
  ingevoerd_door: string | null;
  updated_at: string;
};

/** Eigen boodschap van een admin in de lichtkrant (tabel ticker_messages). */
export type TickerMessage = {
  id: string;
  tekst: string;
  actief: boolean;
  ingevoerd_door: string | null;
  created_at: string;
  updated_at: string;
};
