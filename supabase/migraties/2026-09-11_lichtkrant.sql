-- Migratie 2026-09-11: eigen boodschappen in de lichtkrant.
-- Lezen: alle actieve leden. Toevoegen, aan- of uitzetten en verwijderen: alleen admins.
-- Elke wijziging komt in audit_log. Plakken in de Supabase SQL Editor en op Run klikken; veilig om te herhalen.

create table if not exists ticker_messages (
  id             uuid primary key default gen_random_uuid(),
  tekst          text not null check (char_length(tekst) between 1 and 140),
  actief         boolean not null default true,
  ingevoerd_door uuid references members (id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create or replace function ticker_messages_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    new.ingevoerd_door := coalesce(my_member_id(), new.ingevoerd_door);
    new.created_at := now();
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists ticker_messages_stamp on ticker_messages;
create trigger ticker_messages_stamp before insert or update on ticker_messages
  for each row execute function ticker_messages_stamp();
drop trigger if exists ticker_messages_log on ticker_messages;
create trigger ticker_messages_log after insert or update or delete on ticker_messages
  for each row execute function log_wijziging();

alter table ticker_messages enable row level security;
drop policy if exists "lichtkrant lezen" on ticker_messages;
create policy "lichtkrant lezen" on ticker_messages for select to authenticated using (is_actief());
drop policy if exists "lichtkrant beheren" on ticker_messages;
create policy "lichtkrant beheren" on ticker_messages for all to authenticated using (is_admin()) with check (is_admin());

-- Controle: moet 1 rij met true tonen.
select to_regclass('public.ticker_messages') is not null as lichtkrant_aanwezig;
