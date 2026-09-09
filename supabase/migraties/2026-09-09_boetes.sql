-- Migratie 2026-09-09: boetepot.
-- Handmatig ingevoerde boetes per speler (kaarten komen uit match_stats en staan hier niet in).
-- Lezen: alle actieve leden. Invoeren, wijzigen en verwijderen: coach, spelercoach, verantwoordelijke of admin.
-- Elke wijziging komt in audit_log. Plakken in de Supabase SQL Editor en op Run klikken; veilig om te herhalen.

create table if not exists fines (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid not null references members (id) on delete cascade,
  match_key      text references matches (match_key) on delete set null,
  datum          date not null default current_date,
  soort          text not null,
  aantal         integer not null default 1 check (aantal > 0),
  bedrag_cent    integer not null default 0 check (bedrag_cent >= 0),
  bak_bier       integer not null default 0 check (bak_bier >= 0),
  opmerking      text,
  ingevoerd_door uuid references members (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists fines_member_idx on fines (member_id, datum desc);

create or replace function fines_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    new.ingevoerd_door := coalesce(new.ingevoerd_door, my_member_id());
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists fines_stamp on fines;
create trigger fines_stamp before insert or update on fines
  for each row execute function fines_stamp();
drop trigger if exists fines_log on fines;
create trigger fines_log after insert or update or delete on fines
  for each row execute function log_wijziging();

alter table fines enable row level security;
drop policy if exists "boetes lezen" on fines;
create policy "boetes lezen" on fines for select to authenticated using (is_actief());
drop policy if exists "boetes beheren" on fines;
create policy "boetes beheren" on fines for all to authenticated using (is_staf()) with check (is_staf());

drop policy if exists "logboek lezen" on audit_log;
create policy "logboek lezen" on audit_log for select to authenticated
  using (is_admin() or (is_staf() and tabel in ('match_stats', 'lineups', 'lineup_players', 'attendance', 'fines')));

-- Controle: moet 1 rij met true tonen.
select to_regclass('public.fines') is not null as boetes_aanwezig;
