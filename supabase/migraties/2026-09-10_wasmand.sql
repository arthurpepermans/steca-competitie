-- Migratie 2026-09-10: wasmand.
-- Per match één speler die de wasmand mee naar huis neemt. Lezen: alle actieve leden.
-- Aanduiden en wijzigen: coach, spelercoach, verantwoordelijke of admin. Elke wijziging komt in audit_log.
-- Plakken in de Supabase SQL Editor en op Run klikken; veilig om te herhalen.

create table if not exists laundry_turns (
  match_key      text primary key references matches (match_key) on delete cascade,
  member_id      uuid not null references members (id) on delete cascade,
  opmerking      text,
  ingevoerd_door uuid references members (id),
  updated_at     timestamptz not null default now()
);
create index if not exists laundry_turns_member_idx on laundry_turns (member_id);

create or replace function laundry_turns_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.ingevoerd_door := coalesce(my_member_id(), new.ingevoerd_door);
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists laundry_turns_stamp on laundry_turns;
create trigger laundry_turns_stamp before insert or update on laundry_turns
  for each row execute function laundry_turns_stamp();
drop trigger if exists laundry_turns_log on laundry_turns;
create trigger laundry_turns_log after insert or update or delete on laundry_turns
  for each row execute function log_wijziging();

alter table laundry_turns enable row level security;
drop policy if exists "wasmand lezen" on laundry_turns;
create policy "wasmand lezen" on laundry_turns for select to authenticated using (is_actief());
drop policy if exists "wasmand beheren" on laundry_turns;
create policy "wasmand beheren" on laundry_turns for all to authenticated using (is_staf()) with check (is_staf());

drop policy if exists "logboek lezen" on audit_log;
create policy "logboek lezen" on audit_log for select to authenticated
  using (is_admin() or (is_staf() and tabel in ('match_stats', 'lineups', 'lineup_players', 'attendance', 'fines', 'laundry_turns')));

-- Controle: moet 1 rij met true tonen.
select to_regclass('public.laundry_turns') is not null as wasmand_aanwezig;
