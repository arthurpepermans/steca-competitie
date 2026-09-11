-- Migratie 2026-09-11: geschiedenis van de stand, voor de pijltjes (gestegen, gezakt, gelijk) in het klassement.
-- Telkens de synchronisatie een rij van de stand wijzigt (ander aantal gespeelde matchen, andere plaats of andere
-- punten), wordt de VORIGE toestand van die rij hier bewaard. Lezen mag iedereen, net als de stand zelf.
-- Plakken in de Supabase SQL Editor en op Run klikken; veilig om te herhalen.

create table if not exists standings_history (
  seizoen        text not null,
  reeks          text not null,
  ploegid        integer not null,
  bron           text not null,
  positie        integer not null,
  punten         integer not null,
  gespeeld       integer not null,
  vastgelegd_op  timestamptz not null default now(),
  primary key (seizoen, reeks, ploegid, bron, vastgelegd_op)
);

create or replace function standings_history_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into standings_history (seizoen, reeks, ploegid, bron, positie, punten, gespeeld, vastgelegd_op)
  values (old.seizoen, old.reeks, old.ploegid, old.bron, old.positie, old.punten, old.gespeeld, now())
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists standings_history_log on standings;
create trigger standings_history_log after update on standings
  for each row when (old.gespeeld is distinct from new.gespeeld or old.positie is distinct from new.positie or old.punten is distinct from new.punten)
  execute function standings_history_log();

alter table standings_history enable row level security;
drop policy if exists "publiek lezen" on standings_history;
create policy "publiek lezen" on standings_history for select using (true);

-- Controle: moet 1 rij met true tonen.
select to_regclass('public.standings_history') is not null as standgeschiedenis_aanwezig;
