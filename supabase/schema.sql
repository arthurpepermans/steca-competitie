-- Schema voor de competitiemodule. Eén keer uitvoeren in Supabase > SQL Editor.
-- Sleutelkolommen moeten overeenkomen met SLEUTELS in competition/sync.py.

create table if not exists teams (
  ploegid              integer primary key,
  seizoen              text not null,
  naam                 text not null,
  reeks                text,
  clubnummer           text,
  afdeling             text,
  terrein              text,          -- 'Vollezele - Waterstraat 48 B - 1570 Vollezele'
  kleuren              text,
  secretaris           text,
  secretaris_adres     text,
  tel                  text,
  gsm                  text,
  email                text,
  verantwoordelijke    text,
  verantwoordelijke_tel text,
  wegwijzer            text,
  bron                 text not null default 'kavvv',
  fetched_at           timestamptz not null,
  manual_override      boolean not null default false,
  updated_at           timestamptz not null default now()
);

create table if not exists matches (
  match_key    text primary key,      -- 'seizoen|thuis_id|uit_id'
  seizoen      text not null,
  reeks        text not null,
  datum        date,
  uur          text,                  -- 'HH:MM', zo tonen in de app
  thuis_id     integer,
  uit_id       integer,
  thuis        text not null,
  uit          text not null,
  thuis_score  integer,
  uit_score    integer,
  status       text not null check (status in ('gepland', 'gespeeld')),
  terrein      text,                  -- terrein van de thuisploeg
  opmerking    text,
  bron         text not null default 'kavvv',
  fetched_at   timestamptz not null,
  manual_override boolean not null default false,
  updated_at   timestamptz not null default now()
);
create index if not exists matches_datum_idx on matches (seizoen, datum);
create index if not exists matches_ploeg_idx on matches (thuis_id, uit_id);

create table if not exists standings (
  seizoen          text not null,
  reeks            text not null,
  ploegid          integer not null,
  bron             text not null check (bron in ('kavvv', 'berekend')),
  positie          integer not null,
  ploeg            text not null,
  gespeeld         integer not null,
  gewonnen         integer not null,
  gelijk           integer not null,
  verloren         integer not null,
  doelpunten_voor  integer not null,
  doelpunten_tegen integer not null,
  saldo            integer not null,
  punten           integer not null,
  fetched_at       timestamptz not null,
  manual_override  boolean not null default false,
  updated_at       timestamptz not null default now(),
  primary key (seizoen, reeks, ploegid, bron)
);

-- Per reeks: welk klassement de app toont en waarom.
create table if not exists standings_state (
  seizoen       text not null,
  reeks         text not null,
  toon_bron     text not null check (toon_bron in ('kavvv', 'berekend')),
  label         text,                 -- 'voorlopig' als het berekende klassement getoond wordt
  status        text not null,        -- gelijk | officieel_loopt_achter | officieel_loopt_voor | afwijking
  verschillen   jsonb not null default '[]'::jsonb,
  vergeleken_at timestamptz not null,
  primary key (seizoen, reeks)
);

-- Eén rij: laatste sync-poging en -succes. De app toont "niet bijgewerkt sinds laatste_succes_at" als status <> 'ok'.
create table if not exists sync_status (
  id                text primary key,
  laatste_poging_at timestamptz,
  laatste_succes_at timestamptz,
  status            text not null default 'ok',
  fout              text,
  pagina            text,
  updated_at        timestamptz not null default now()
);

-- Handmatige correcties (manual_override = true) worden nooit overschreven door de sync.
create or replace function keep_manual_override() returns trigger language plpgsql as $$
begin
  if old.manual_override then
    return old;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists teams_keep_manual_override on teams;
create trigger teams_keep_manual_override before update on teams
  for each row execute function keep_manual_override();
drop trigger if exists matches_keep_manual_override on matches;
create trigger matches_keep_manual_override before update on matches
  for each row execute function keep_manual_override();
drop trigger if exists standings_keep_manual_override on standings;
create trigger standings_keep_manual_override before update on standings
  for each row execute function keep_manual_override();

-- Het klassement dat de app toont: officieel als het actueel is, anders het berekende met label 'voorlopig'.
create or replace view standings_current as
  select s.*, st.label, st.status as vergelijking_status, st.vergeleken_at
  from standings s
  join standings_state st on st.seizoen = s.seizoen and st.reeks = s.reeks and st.toon_bron = s.bron;
-- De view volgt de rijbeveiliging van de onderliggende tabellen (anders toont Supabase "UNRESTRICTED").
alter view standings_current set (security_invoker = on);

-- Lezen met de anon key toestaan (schrijven gebeurt alleen met de service-role key, die RLS omzeilt).
alter table teams enable row level security;
alter table matches enable row level security;
alter table standings enable row level security;
alter table standings_state enable row level security;
alter table sync_status enable row level security;
drop policy if exists "publiek lezen" on teams;
create policy "publiek lezen" on teams for select using (true);
drop policy if exists "publiek lezen" on matches;
create policy "publiek lezen" on matches for select using (true);
drop policy if exists "publiek lezen" on standings;
create policy "publiek lezen" on standings for select using (true);
drop policy if exists "publiek lezen" on standings_state;
create policy "publiek lezen" on standings_state for select using (true);
drop policy if exists "publiek lezen" on sync_status;
create policy "publiek lezen" on sync_status for select using (true);
