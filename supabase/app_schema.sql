-- Schema voor de webapp (leden, aanwezigheden, opstellingen, statistieken, logboek).
-- Uitvoeren in Supabase > SQL Editor, NA supabase/schema.sql. Mag opnieuw uitgevoerd worden.

-- ------------------------------------------------------------------ leden

create table if not exists members (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid unique references auth.users (id) on delete set null,
  naam           text not null,          -- afgeleid: voornaam + achternaam (trigger members_naam)
  voornaam       text,
  achternaam     text,
  speelt         boolean not null default false,  -- afgeleid: telt mee als speler (speler, spelercoach, verantwoordelijke)
  functie        text not null default 'speler'
                 check (functie in ('speler', 'spelercoach', 'coach', 'verantwoordelijke', 'supporter')),
  email          text not null,
  telefoon       text,
  geboortedatum  date,
  adres          text,
  status         text not null default 'wacht_op_goedkeuring'
                 check (status in ('wacht_op_goedkeuring', 'actief', 'inactief')),
  is_admin       boolean not null default false,
  is_hoofdadmin  boolean not null default false,
  aangemaakt_op  timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists members_een_hoofdadmin on members (is_hoofdadmin) where is_hoofdadmin;
alter table members add column if not exists voornaam text;
alter table members add column if not exists achternaam text;
alter table members add column if not exists speelt boolean not null default false;
alter table members add column if not exists nationaliteit text;
alter table members add column if not exists nr integer;                 -- volgnummer op de spelerslijst
alter table members add column if not exists ingeschreven boolean;       -- ingeschreven bij de federatie
alter table members add column if not exists mail_inschrijving boolean;
alter table members add column if not exists bron text not null default 'registratie';  -- import | registratie | admin
create index if not exists members_email_idx on members (lower(email));
drop table if exists members_gevoelig cascade;  -- rijksregisternummer wordt niet bijgehouden

update members
   set voornaam = split_part(naam, ' ', 1),
       achternaam = nullif(trim(substr(naam, length(split_part(naam, ' ', 1)) + 1)), '')
 where voornaam is null;

-- Afgeleide velden: volledige naam uit voornaam + achternaam, en 'speelt' uit de functie
-- (speler, spelercoach en verantwoordelijke tellen mee als speler; coach en supporter niet).
create or replace function members_naam() returns trigger
language plpgsql as $$
begin
  new.naam := trim(concat_ws(' ', nullif(trim(coalesce(new.voornaam, '')), ''), nullif(trim(coalesce(new.achternaam, '')), '')));
  if new.naam = '' then
    new.naam := split_part(new.email, '@', 1);
  end if;
  new.speelt := new.functie in ('speler', 'spelercoach', 'verantwoordelijke');
  return new;
end $$;
drop trigger if exists members_naam on members;
create trigger members_naam before insert or update on members
  for each row execute function members_naam();

-- Bij registratie (auth.users) het account koppelen aan een bestaand lid, of een nieuw lid aanmaken.
-- 1. Lid zonder account met hetzelfde e-mailadres: koppelen, gegevens blijven, geen goedkeuring nodig.
-- 2. Lid zonder account met dezelfde voor- en achternaam: koppelen, maar een admin moet goedkeuren
--    (tot dan blijven de persoonlijke gegevens onzichtbaar, zie mijn_lid()).
-- 3. Anders: nieuw lid dat wacht op goedkeuring. Het allereerste lid ooit wordt hoofdadmin.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  eerste boolean;
  v_functie text := coalesce(new.raw_user_meta_data->>'functie', 'speler');
  v_voornaam text := nullif(trim(coalesce(new.raw_user_meta_data->>'voornaam', '')), '');
  v_achternaam text := nullif(trim(coalesce(new.raw_user_meta_data->>'achternaam', '')), '');
  v_id uuid;
begin
  if v_functie not in ('speler', 'spelercoach', 'coach', 'verantwoordelijke', 'supporter') then
    v_functie := 'speler';
  end if;
  select id into v_id from members
   where user_id is null and lower(email) = lower(new.email)
   order by aangemaakt_op limit 1;
  if v_id is not null then
    update members
       set user_id = new.id,
           status = case when status = 'inactief' then 'wacht_op_goedkeuring' else status end
     where id = v_id;
    return new;
  end if;
  if v_voornaam is not null and v_achternaam is not null then
    select id into v_id from members
     where user_id is null and lower(voornaam) = lower(v_voornaam) and lower(achternaam) = lower(v_achternaam)
     order by aangemaakt_op limit 1;
    if v_id is not null then
      update members set user_id = new.id, status = 'wacht_op_goedkeuring' where id = v_id;
      return new;
    end if;
  end if;
  select not exists (select 1 from members) into eerste;
  insert into members (user_id, naam, voornaam, achternaam, email, functie, status, is_admin, is_hoofdadmin, bron)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'naam'), ''), split_part(new.email, '@', 1)),
    v_voornaam, v_achternaam, new.email,
    case when eerste then 'verantwoordelijke' else v_functie end,
    case when eerste then 'actief' else 'wacht_op_goedkeuring' end,
    eerste, eerste, 'registratie'
  );
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Hulpfuncties (security definer: omzeilen RLS zodat policies op members niet recursief worden).
create or replace function my_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from members where user_id = auth.uid()
$$;
create or replace function my_functie() returns text
language sql stable security definer set search_path = public as $$
  select functie from members where user_id = auth.uid() and status = 'actief'
$$;
create or replace function is_actief() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select status = 'actief' from members where user_id = auth.uid()), false)
$$;
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin and status = 'actief' from members where user_id = auth.uid()), false)
$$;
create or replace function is_hoofdadmin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_hoofdadmin and status = 'actief' from members where user_id = auth.uid()), false)
$$;
-- Staf: coach, spelercoach, verantwoordelijke of admin.
create or replace function is_staf() returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or coalesce(my_functie() in ('coach', 'spelercoach', 'verantwoordelijke'), false)
$$;
create or replace function is_supporter() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(my_functie() = 'supporter', false)
$$;

-- Bewaking van wijzigingen aan leden: wie mag wat veranderen.
create or replace function members_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ik members;
begin
  if auth.uid() is null or current_setting('steca.ontkoppelen', true) = 'ja' then
    -- service-role, SQL Editor, of admin_ontkoppel_account dat een account loskoppelt: alles mag
    new.updated_at := now();
    return new;
  end if;
  select * into ik from members where user_id = auth.uid();
  if ik.id is null or ik.status <> 'actief' then
    if new.user_id is distinct from auth.uid() then
      raise exception 'niet toegestaan';
    end if;
  end if;
  if not coalesce(ik.is_admin, false) then
    if new.user_id is distinct from auth.uid() then
      raise exception 'je mag alleen je eigen gegevens wijzigen';
    end if;
    if new.functie <> old.functie or new.status <> old.status or new.is_admin <> old.is_admin
       or new.is_hoofdadmin <> old.is_hoofdadmin or new.email <> old.email
       or new.user_id is distinct from old.user_id then
      raise exception 'functie, status en rechten kunnen alleen door een admin gewijzigd worden';
    end if;
  else
    if old.is_hoofdadmin and not ik.is_hoofdadmin then
      raise exception 'de gegevens van de hoofdadmin kunnen alleen door de hoofdadmin zelf gewijzigd worden';
    end if;
    if new.is_hoofdadmin <> old.is_hoofdadmin then
      raise exception 'de hoofdadmin-vlag kan niet gewijzigd worden';
    end if;
    if new.user_id is distinct from old.user_id and new.user_id is not null then
      -- een admin mag een koppeling wel verwijderen (account weg), maar nooit zelf leggen of verleggen
      raise exception 'de koppeling met het account kan niet gewijzigd worden';
    end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists members_guard on members;
create trigger members_guard before update on members
  for each row execute function members_guard();

-- Eigen lidgegevens voor de app. Zolang het lid niet actief is, blijven de persoonlijke velden leeg:
-- een registratie die op naam gekoppeld is, mag die gegevens pas zien na goedkeuring.
create or replace function mijn_lid() returns members
language plpgsql stable security definer set search_path = public as $$
declare
  r members;
begin
  select * into r from members where user_id = auth.uid();
  if r.id is not null and r.status <> 'actief' then
    r.telefoon := null; r.geboortedatum := null; r.adres := null; r.nationaliteit := null; r.nr := null;
  end if;
  return r;
end $$;
revoke all on function mijn_lid() from public, anon;
grant execute on function mijn_lid() to authenticated;

-- Beperkte weergave voor supporters: alleen naam en functie.
create or replace view members_basis as
  select id, naam, functie, status, is_admin, is_hoofdadmin, voornaam, achternaam, speelt,
         (user_id is not null) as heeft_account
  from members;
revoke all on members_basis from anon;
grant select on members_basis to authenticated;

-- --------------------------------------------------------------- logboek

create table if not exists audit_log (
  id         bigserial primary key,
  tabel      text not null,
  rij_id     text not null,
  actie      text not null,
  oud        jsonb,
  nieuw      jsonb,
  door       uuid,          -- members.id
  door_user  uuid,          -- auth.users.id
  op         timestamptz not null default now()
);
create index if not exists audit_log_tabel_rij_idx on audit_log (tabel, rij_id, op desc);

create or replace function log_wijziging() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  j jsonb := coalesce(to_jsonb(new), to_jsonb(old));
  rij text := coalesce(j->>'id', concat_ws('|', j->>'match_key', j->>'lineup_id', j->>'member_id', j->>'positie'));
begin
  insert into audit_log (tabel, rij_id, actie, oud, nieuw, door, door_user)
  values (TG_TABLE_NAME, rij, TG_OP, to_jsonb(old), to_jsonb(new), my_member_id(), auth.uid());
  return coalesce(new, old);
end $$;
drop trigger if exists members_log on members;
create trigger members_log after insert or update or delete on members
  for each row execute function log_wijziging();

-- ---------------------------------------------------------- aanwezigheden

create table if not exists attendance (
  match_key  text not null references matches (match_key) on delete cascade,
  member_id  uuid not null references members (id) on delete cascade,
  status     text not null check (status in ('aanwezig', 'afwezig', 'onzeker')),
  gezet_door uuid references members (id),
  updated_at timestamptz not null default now(),
  primary key (match_key, member_id)
);
create or replace function attendance_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.gezet_door := my_member_id();
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists attendance_stamp on attendance;
create trigger attendance_stamp before insert or update on attendance
  for each row execute function attendance_stamp();
drop trigger if exists attendance_log on attendance;
create trigger attendance_log after insert or update or delete on attendance
  for each row execute function log_wijziging();

-- Lijst zoals ze 24 uur voor de aftrap was (alleen admins), afgeleid uit het logboek.
create or replace function aanwezigheden_24u_voor(p_match_key text)
returns table (member_id uuid, naam text, functie text, status text, gezet_op timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  grens timestamptz;
begin
  if not is_admin() then
    raise exception 'alleen admins';
  end if;
  select ((m.datum + coalesce(nullif(m.uur, '')::time, '15:00'::time)) at time zone 'Europe/Brussels') - interval '24 hours'
    into grens from matches m where m.match_key = p_match_key;
  if grens is null then
    raise exception 'wedstrijd zonder datum';
  end if;
  return query
    with laatste as (
      select distinct on (l.nieuw->>'member_id')
             (l.nieuw->>'member_id')::uuid as mid, l.nieuw->>'status' as st, l.op
      from audit_log l
      where l.tabel = 'attendance' and l.actie in ('INSERT', 'UPDATE')
        and l.nieuw->>'match_key' = p_match_key and l.op <= grens
      order by l.nieuw->>'member_id', l.op desc)
    select mm.id, mm.naam, mm.functie, la.st, la.op
    from laatste la join members mm on mm.id = la.mid
    order by la.st, mm.naam;
end $$;

-- ------------------------------------------------------------ opstelling

create table if not exists lineups (
  id           uuid primary key default gen_random_uuid(),
  match_key    text not null unique references matches (match_key) on delete cascade,
  formatie     text not null default '4-3-3' check (formatie in ('4-3-3', '4-4-2', '3-4-3')),
  gemaakt_door uuid references members (id),
  updated_at   timestamptz not null default now()
);
create table if not exists lineup_players (
  lineup_id  uuid not null references lineups (id) on delete cascade,
  member_id  uuid not null references members (id) on delete cascade,
  positie    text not null,   -- positiecode van de formatie (GK, RB, ...) of BANK1..BANK4
  primary key (lineup_id, positie),
  unique (lineup_id, member_id)
);
create or replace function lineups_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.gemaakt_door := coalesce(my_member_id(), new.gemaakt_door);
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists lineups_stamp on lineups;
create trigger lineups_stamp before insert or update on lineups
  for each row execute function lineups_stamp();
create or replace function lineup_players_check() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from members where id = new.member_id and status = 'actief' and speelt) then
    raise exception 'alleen actieve leden die meespelen kunnen opgesteld worden';
  end if;
  return new;
end $$;
drop trigger if exists lineup_players_check on lineup_players;
create trigger lineup_players_check before insert or update on lineup_players
  for each row execute function lineup_players_check();
drop trigger if exists lineups_log on lineups;
create trigger lineups_log after insert or update or delete on lineups
  for each row execute function log_wijziging();
drop trigger if exists lineup_players_log on lineup_players;
create trigger lineup_players_log after insert or update or delete on lineup_players
  for each row execute function log_wijziging();

-- ---------------------------------------------------------- statistieken

create table if not exists match_stats (
  match_key      text not null references matches (match_key) on delete cascade,
  member_id      uuid not null references members (id) on delete cascade,
  gespeeld       boolean not null default true,
  goals          integer not null default 0 check (goals >= 0),
  assists        integer not null default 0 check (assists >= 0),
  geel           integer not null default 0 check (geel between 0 and 2),
  rood           integer not null default 0 check (rood between 0 and 1),
  ingevoerd_door uuid references members (id),
  updated_at     timestamptz not null default now(),
  primary key (match_key, member_id)
);
create or replace function match_stats_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.ingevoerd_door := coalesce(my_member_id(), new.ingevoerd_door);
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists match_stats_stamp on match_stats;
create trigger match_stats_stamp before insert or update on match_stats
  for each row execute function match_stats_stamp();
drop trigger if exists match_stats_log on match_stats;
create trigger match_stats_log after insert or update or delete on match_stats
  for each row execute function log_wijziging();

-- --------------------------------------------------------- adminfuncties

-- Wachtwoord van een lid instellen (niet van de hoofdadmin). Wordt gelogd.
create or replace function admin_set_password(p_member_id uuid, p_wachtwoord text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user uuid;
  v_hoofd boolean;
begin
  if not is_admin() then
    raise exception 'alleen admins';
  end if;
  select user_id, is_hoofdadmin into v_user, v_hoofd from members where id = p_member_id;
  if v_user is null then
    raise exception 'dit lid heeft geen account';
  end if;
  if v_hoofd then
    raise exception 'het wachtwoord van de hoofdadmin kan alleen door de hoofdadmin zelf gewijzigd worden';
  end if;
  if length(p_wachtwoord) < 8 then
    raise exception 'wachtwoord moet minstens 8 tekens hebben';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(p_wachtwoord, extensions.gen_salt('bf')), updated_at = now()
   where id = v_user;
  insert into audit_log (tabel, rij_id, actie, nieuw, door, door_user)
  values ('auth.users', v_user::text, 'WACHTWOORD_GEZET', jsonb_build_object('member_id', p_member_id), my_member_id(), auth.uid());
end $$;
revoke all on function admin_set_password(uuid, text) from public, anon;
grant execute on function admin_set_password(uuid, text) to authenticated;

-- Account loskoppelen: het inlogaccount verdwijnt, de gegevens van het lid blijven staan.
-- Registreert de persoon later opnieuw (zelfde e-mailadres of naam), dan wordt hij weer gekoppeld.
create or replace function admin_ontkoppel_account(p_member_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_hoofd boolean;
  v_naam text;
begin
  if not is_admin() then
    raise exception 'alleen admins';
  end if;
  select user_id, is_hoofdadmin, naam into v_user, v_hoofd, v_naam from members where id = p_member_id;
  if v_hoofd then
    raise exception 'het account van de hoofdadmin kan niet verwijderd worden';
  end if;
  if v_user is null then
    raise exception 'dit lid heeft geen account';
  end if;
  insert into audit_log (tabel, rij_id, actie, oud, door, door_user)
  values ('members', p_member_id::text, 'ACCOUNT_VERWIJDERD', jsonb_build_object('naam', v_naam, 'user_id', v_user), my_member_id(), auth.uid());
  -- het verwijderen zet members.user_id op null (on delete set null); die update mag niet
  -- tegen members_guard aanlopen, dus zetten we een vlag voor de duur van deze transactie
  perform set_config('steca.ontkoppelen', 'ja', true);
  delete from auth.users where id = v_user;  -- members.user_id wordt automatisch null
end $$;
revoke all on function admin_ontkoppel_account(uuid) from public, anon;
grant execute on function admin_ontkoppel_account(uuid) to authenticated;

-- Lid volledig verwijderen: gegevens én account (bv. een foute registratie). Niet voor de hoofdadmin. Wordt gelogd.
create or replace function admin_verwijder_lid(p_member_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_hoofd boolean;
  v_naam text;
begin
  if not is_admin() then
    raise exception 'alleen admins';
  end if;
  select user_id, is_hoofdadmin, naam into v_user, v_hoofd, v_naam from members where id = p_member_id;
  if v_hoofd then
    raise exception 'de hoofdadmin kan niet verwijderd worden';
  end if;
  insert into audit_log (tabel, rij_id, actie, oud, door, door_user)
  values ('members', p_member_id::text, 'VERWIJDERD', jsonb_build_object('naam', v_naam, 'user_id', v_user), my_member_id(), auth.uid());
  delete from members where id = p_member_id;
  if v_user is not null then
    delete from auth.users where id = v_user;
  end if;
end $$;
revoke all on function admin_verwijder_lid(uuid) from public, anon;
grant execute on function admin_verwijder_lid(uuid) to authenticated;

-- ------------------------------------------------------- toegangsregels

alter table members enable row level security;
alter table attendance enable row level security;
alter table lineups enable row level security;
alter table lineup_players enable row level security;
alter table match_stats enable row level security;
alter table audit_log enable row level security;

-- leden
drop policy if exists "leden lezen" on members;
create policy "leden lezen" on members for select to authenticated
  using ((user_id = auth.uid() and status = 'actief') or is_admin() or (is_actief() and not is_supporter()));
drop policy if exists "leden toevoegen" on members;
create policy "leden toevoegen" on members for insert to authenticated with check (is_admin());
drop policy if exists "leden wijzigen" on members;
create policy "leden wijzigen" on members for update to authenticated
  using (user_id = auth.uid() or is_admin())
  with check (user_id = auth.uid() or is_admin());


-- aanwezigheden
drop policy if exists "aanwezigheid lezen" on attendance;
create policy "aanwezigheid lezen" on attendance for select to authenticated using (is_actief());
drop policy if exists "aanwezigheid zetten" on attendance;
create policy "aanwezigheid zetten" on attendance for insert to authenticated
  with check (is_staf() or (is_actief() and not is_supporter() and member_id = my_member_id()));
drop policy if exists "aanwezigheid wijzigen" on attendance;
create policy "aanwezigheid wijzigen" on attendance for update to authenticated
  using (is_staf() or (is_actief() and not is_supporter() and member_id = my_member_id()))
  with check (is_staf() or (is_actief() and not is_supporter() and member_id = my_member_id()));

-- opstellingen
drop policy if exists "opstelling lezen" on lineups;
create policy "opstelling lezen" on lineups for select to authenticated using (is_actief());
drop policy if exists "opstelling beheren" on lineups;
create policy "opstelling beheren" on lineups for all to authenticated using (is_staf()) with check (is_staf());
drop policy if exists "opstellingsspelers lezen" on lineup_players;
create policy "opstellingsspelers lezen" on lineup_players for select to authenticated using (is_actief());
drop policy if exists "opstellingsspelers beheren" on lineup_players;
create policy "opstellingsspelers beheren" on lineup_players for all to authenticated using (is_staf()) with check (is_staf());

-- statistieken
drop policy if exists "statistieken lezen" on match_stats;
create policy "statistieken lezen" on match_stats for select to authenticated using (is_actief());
drop policy if exists "statistieken beheren" on match_stats;
create policy "statistieken beheren" on match_stats for all to authenticated using (is_staf()) with check (is_staf());

-- logboek: admins lezen alles; staf alleen wedstrijdgebonden tabellen (ledengegevens staan er ook in)
drop policy if exists "logboek lezen" on audit_log;
create policy "logboek lezen" on audit_log for select to authenticated
  using (is_admin() or (is_staf() and tabel in ('match_stats', 'lineups', 'lineup_players', 'attendance')));

-- Synctabellen: alleen ingelogde leden lezen (de sync schrijft met de service-role key).
drop policy if exists "publiek lezen" on teams;
drop policy if exists "publiek lezen" on matches;
drop policy if exists "publiek lezen" on standings;
drop policy if exists "publiek lezen" on standings_state;
drop policy if exists "publiek lezen" on sync_status;
drop policy if exists "leden lezen" on teams;
create policy "leden lezen" on teams for select to authenticated using (true);
drop policy if exists "leden lezen" on matches;
create policy "leden lezen" on matches for select to authenticated using (true);
drop policy if exists "leden lezen" on standings;
create policy "leden lezen" on standings for select to authenticated using (true);
drop policy if exists "leden lezen" on standings_state;
create policy "leden lezen" on standings_state for select to authenticated using (true);
drop policy if exists "leden lezen" on sync_status;
create policy "leden lezen" on sync_status for select to authenticated using (true);
