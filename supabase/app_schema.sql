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

-- Supporters staan apart van members en krijgen geen clubrol.
create table if not exists public.supporter_profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 naam text not null check(length(naam) between 1 and 100),
 actief boolean not null default true, created_at timestamptz not null default now()
);
alter table public.supporter_profiles enable row level security;
revoke all on public.supporter_profiles from anon,authenticated;
grant select on public.supporter_profiles to authenticated;
grant all on public.supporter_profiles to service_role;
drop policy if exists eigen_supporter on public.supporter_profiles;
create policy eigen_supporter on public.supporter_profiles for select to authenticated using(user_id=auth.uid());

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
  if new.raw_user_meta_data->>'account_type'='supporter' then
    insert into supporter_profiles(user_id,naam) values(new.id,left(coalesce(nullif(trim(new.raw_user_meta_data->>'naam'),''),'Supporter'),100));
    return new;
  end if;
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
  perform 1 from attendance a join lineups l on l.match_key = a.match_key
    where l.id = new.lineup_id and a.member_id = new.member_id and a.status = 'aanwezig'
    for share of a;
  if not found then
    raise exception 'Alleen spelers die voor deze match op aanwezig staan kunnen opgesteld worden. Vernieuw de aanwezigheden.';
  end if;
  return new;
end $$;
drop trigger if exists lineup_players_check on lineup_players;
create trigger lineup_players_check before insert or update on lineup_players
  for each row execute function lineup_players_check();

-- Eén transactie: een gewijzigde aanwezigheid mag de vorige opstelling niet wissen.
create or replace function bewaar_opstelling(p_match_key text, p_formatie text, p_keuze jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_lineup uuid;
begin
  if not is_actief() or not is_staf() then
    raise exception 'Alleen bevoegde staf mag een opstelling maken.';
  end if;
  if p_keuze is null or jsonb_typeof(p_keuze) <> 'object' then
    raise exception 'Ongeldige opstelling.';
  end if;
  insert into lineups (match_key, formatie) values (p_match_key, p_formatie)
    on conflict (match_key) do update set formatie = excluded.formatie
    returning id into v_lineup;
  delete from lineup_players where lineup_id = v_lineup;
  insert into lineup_players (lineup_id, positie, member_id)
    select v_lineup, key, value::uuid from jsonb_each_text(p_keuze)
    where value is not null and value <> '';
end $$;
revoke all on function bewaar_opstelling(text, text, jsonb) from public, anon;
grant execute on function bewaar_opstelling(text, text, jsonb) to authenticated;
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
alter table public.match_stats add column if not exists clean_sheet boolean;

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

-- ------------------------------------------------------ sfeerbeelden
-- Privébestanden per wedstrijd; geen openbare bucket of overschrijven.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('match-sfeerbeelden', 'match-sfeerbeelden', false, 52428800,
  array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif','video/mp4','video/quicktime','video/webm'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.is_match_mediamap(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_actief() and exists (
    select 1 from matches where (thuis_id = 152 or uit_id = 152)
      and encode(convert_to(match_key, 'UTF8'), 'hex') = split_part(p_name, '/', 1)
  ) and array_length(string_to_array(p_name, '/'), 1) = 2
$$;
revoke all on function public.is_match_mediamap(text) from public, anon;
grant execute on function public.is_match_mediamap(text) to authenticated;

drop policy if exists "sfeerbeelden lezen" on storage.objects;
create policy "sfeerbeelden lezen" on storage.objects for select to authenticated
  using (bucket_id = 'match-sfeerbeelden' and public.is_actief());
drop policy if exists "sfeerbeelden toevoegen" on storage.objects;
create policy "sfeerbeelden toevoegen" on storage.objects for insert to authenticated
  with check (bucket_id = 'match-sfeerbeelden' and public.is_match_mediamap(name)
    and split_part(split_part(name, '/', 2), '_', 1) = auth.uid()::text);
drop policy if exists "sfeerbeelden verwijderen" on storage.objects;
create policy "sfeerbeelden verwijderen" on storage.objects for delete to authenticated
  using (bucket_id = 'match-sfeerbeelden' and public.is_actief()
    and (owner_id = auth.uid()::text or public.is_admin()));

-- --------------------------------------------------------------- boetepot

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

-- --------------------------------------------------------------- junior van de match

-- Migratie 2026-09-09: Junior van de match (stemming per match) en Junior d'or (seizoen).
-- Wie op een gespeelde match als aanwezig stond, kiest de beste drie spelers van die match:
-- 3, 2 en 1 punt. Je kunt niet op jezelf stemmen en alleen op spelers die aanwezig waren.
-- Eigen stem is alleen zichtbaar voor de stemmer (en admins); iedereen ziet de opgetelde punten.
-- Plakken in de Supabase SQL Editor en op Run klikken; veilig om te herhalen.

create table if not exists match_votes (
  match_key  text not null references matches (match_key) on delete cascade,
  voter_id   uuid not null references members (id) on delete cascade,
  eerste     uuid not null references members (id) on delete cascade,
  tweede     uuid not null references members (id) on delete cascade,
  derde      uuid not null references members (id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (match_key, voter_id),
  check (eerste <> tweede and eerste <> derde and tweede <> derde),
  check (voter_id <> eerste and voter_id <> tweede and voter_id <> derde)
);

-- Geldigheid van een stembrief: match gespeeld en hoogstens 7 dagen geleden, stemmer aanwezig,
-- alle drie de gekozen spelers aanwezig, niet op jezelf.
create or replace function stem_geldig(p_match_key text, p_eerste uuid, p_tweede uuid, p_derde uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_actief()
    and exists (select 1 from matches m where m.match_key = p_match_key and m.status = 'gespeeld'
                  and m.datum is not null and current_date <= m.datum + 7)
    and exists (select 1 from attendance a where a.match_key = p_match_key and a.member_id = my_member_id() and a.status = 'aanwezig')
    and (select count(*) from attendance a where a.match_key = p_match_key and a.status = 'aanwezig'
           and a.member_id in (p_eerste, p_tweede, p_derde)) = 3
    and my_member_id() not in (p_eerste, p_tweede, p_derde)
    and p_eerste <> p_tweede and p_eerste <> p_derde and p_tweede <> p_derde;
$$;
revoke all on function stem_geldig(text, uuid, uuid, uuid) from public, anon;
grant execute on function stem_geldig(text, uuid, uuid, uuid) to authenticated;

create or replace function match_votes_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists match_votes_stamp on match_votes;
create trigger match_votes_stamp before insert or update on match_votes
  for each row execute function match_votes_stamp();
drop trigger if exists match_votes_log on match_votes;
create trigger match_votes_log after insert or update or delete on match_votes
  for each row execute function log_wijziging();

alter table match_votes enable row level security;
drop policy if exists "eigen stem lezen" on match_votes;
create policy "eigen stem lezen" on match_votes for select to authenticated
  using (voter_id = my_member_id() or is_admin());
drop policy if exists "stem uitbrengen" on match_votes;
create policy "stem uitbrengen" on match_votes for insert to authenticated
  with check (voter_id = my_member_id() and stem_geldig(match_key, eerste, tweede, derde));
drop policy if exists "stem wijzigen" on match_votes;
create policy "stem wijzigen" on match_votes for update to authenticated
  using (voter_id = my_member_id())
  with check (voter_id = my_member_id() and stem_geldig(match_key, eerste, tweede, derde));
drop policy if exists "stem intrekken" on match_votes;
create policy "stem intrekken" on match_votes for delete to authenticated
  using (voter_id = my_member_id());

-- Opgetelde punten per match en speler, zonder te tonen wie op wie stemde.
-- 'stemmen' = aantal stembrieven waarop de speler voorkomt.
create or replace view match_vote_points as
  select s.match_key, s.member_id, sum(s.punten)::int as punten, count(*)::int as stemmen
  from (
    select match_key, eerste as member_id, 3 as punten from match_votes
    union all select match_key, tweede, 2 from match_votes
    union all select match_key, derde, 1 from match_votes
  ) s
  where is_actief()
  group by s.match_key, s.member_id;
revoke all on match_vote_points from anon;
grant select on match_vote_points to authenticated;

-- Aantal stemmers per match.
create or replace view match_vote_counts as
  select match_key, count(*)::int as stemmers
  from match_votes
  where is_actief()
  group by match_key;
revoke all on match_vote_counts from anon;
grant select on match_vote_counts to authenticated;

-- Openbare supporterstoegang: alleen onderstaande velden, nooit contactgegevens of clubadministratie.
create or replace function public.openbare_clubinfo() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'matches', coalesce((select jsonb_agg(to_jsonb(m) order by datum, uur) from (
      select match_key, seizoen, reeks, datum, uur, thuis_id, uit_id, thuis, uit,
             thuis_score, uit_score, status, terrein, null::text as opmerking
      from public.matches where thuis_id = 152 or uit_id = 152
    ) m), '[]'::jsonb),
    'klassement', coalesce((select jsonb_agg(to_jsonb(s) order by reeks, positie) from (
      select seizoen, reeks, ploegid, bron, positie, ploeg, gespeeld, gewonnen, gelijk, verloren,
             doelpunten_voor, doelpunten_tegen, saldo, punten, label, vergelijking_status
      from public.standings_current
    ) s), '[]'::jsonb),
    'ploegen', coalesce((select jsonb_agg(to_jsonb(t) order by naam) from (
      select ploegid, naam, reeks, terrein, kleuren from public.teams
    ) t), '[]'::jsonb)
  );
$$;
revoke all on function public.openbare_clubinfo() from public;
grant execute on function public.openbare_clubinfo() to anon, authenticated;

-- Bezoekers lezen uitsluitend via openbare_clubinfo, niet via de onderliggende tabellen/views.
revoke all on public.teams, public.matches, public.standings, public.standings_state,
 public.standings_current, public.sync_status, public.members, public.members_basis,
 public.attendance, public.lineups, public.lineup_players, public.match_stats,
 public.audit_log, public.fines, public.match_votes, public.match_vote_points, public.match_vote_counts from anon;

-- Bestaande supporteraccounts blijven bestaan. Nieuwe supporters hebben geen account nodig.
create or replace function public.geen_nieuwe_supporterregistratie() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.raw_user_meta_data->>'functie' = 'supporter' and coalesce(new.raw_user_meta_data->>'account_type','') <> 'supporter' then
    raise exception 'Supporters hebben geen account nodig. Kies Verder als supporter.';
  end if;
  return new;
end;
$$;
revoke all on function public.geen_nieuwe_supporterregistratie() from public, anon, authenticated;
drop trigger if exists geen_nieuwe_supporterregistratie on auth.users;
create trigger geen_nieuwe_supporterregistratie before insert on auth.users
 for each row execute function public.geen_nieuwe_supporterregistratie();


-- Openbare spelersnamen, wedstrijdcijfers en boetes. Contactgegevens en vrije opmerkingen blijven intern.
create or replace function public.openbare_spelerscijfers() returns jsonb
language sql stable security definer set search_path = public as $$
 select jsonb_build_object(
 'spelers', coalesce((select jsonb_agg(to_jsonb(p) order by naam) from (
 select id, naam from members where speelt or exists (select 1 from match_stats where member_id = members.id) or exists (select 1 from fines where member_id = members.id)
 ) p), '[]'::jsonb),
 'stats', coalesce((select jsonb_agg(to_jsonb(s)) from (
 select s.match_key, s.member_id, s.gespeeld, s.goals, s.assists, s.geel, s.rood, s.clean_sheet from match_stats s
 join matches m on m.match_key = s.match_key where m.thuis_id = 152 or m.uit_id = 152
 ) s), '[]'::jsonb),
 'boetes', coalesce((select jsonb_agg(to_jsonb(f) order by datum desc) from (
 select id, member_id, match_key, datum, soort, aantal, bedrag_cent, bak_bier,
 null::text as opmerking, null::uuid as ingevoerd_door from fines
 ) f), '[]'::jsonb)
 );
$$;
revoke all on function public.openbare_spelerscijfers() from public;
grant execute on function public.openbare_spelerscijfers() to anon, authenticated;
-- Google Drive: alleen de backend kan de verbinding en eenmalige OAuth-pogingen lezen.
create table if not exists public.drive_connection (
  id integer primary key check (id = 1),
  email text not null,
  folder_id text not null,
  refresh_token_cipher text not null,
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz not null default now()
);
create table if not exists public.drive_oauth_states (
  state_hash text primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  verifier text not null,
  expires_at timestamptz not null
);
alter table public.drive_connection enable row level security;
alter table public.drive_oauth_states enable row level security;
revoke all on public.drive_connection, public.drive_oauth_states from public, anon, authenticated;
grant all on public.drive_connection, public.drive_oauth_states to service_role;

-- Metadata voor privébeelden in de gedeelde Google Drive. Alleen de Edge Function beheert deze tabel.
create table if not exists public.drive_media (
  id uuid primary key,
  match_key text not null references public.matches(match_key),
  owner_id uuid references auth.users(id) on delete set null,
  drive_id text unique,
  name text not null,
  mime_type text not null,
  bytes bigint not null check(bytes > 0 and bytes <= 52428800),
  status text not null check(status in ('pending', 'ready', 'deleted')),
  created_at timestamptz not null default now(),
  check(status <> 'ready' or drive_id is not null)
);
create index if not exists drive_media_album on public.drive_media(match_key, status, created_at desc, id);
alter table public.drive_media enable row level security;
revoke all on public.drive_media from public, anon, authenticated;
grant all on public.drive_media to service_role;

-- Posities vastzetten voor het rad; voorkeuren worden met de opstelling opgeslagen.
alter table public.lineup_players add column if not exists vergrendeld boolean not null default false;
create or replace function public.bewaar_opstelling_met_slotjes(p_match_key text, p_formatie text, p_keuze jsonb, p_slotjes text[])
returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_slotjes is null or cardinality(p_slotjes) > 15 or exists (
    select 1 from unnest(p_slotjes) p where p is null or nullif(p_keuze->>p, '') is null
  ) then
    raise exception 'Vergrendel alleen posities met een gekozen speler.';
  end if;
  perform bewaar_opstelling(p_match_key, p_formatie, p_keuze);
  update lineup_players set vergrendeld = true
    where lineup_id = (select id from lineups where match_key = p_match_key)
      and positie = any(p_slotjes);
end $$;
revoke all on function public.bewaar_opstelling_met_slotjes(text, text, jsonb, text[]) from public, anon;
grant execute on function public.bewaar_opstelling_met_slotjes(text, text, jsonb, text[]) to authenticated;

-- Supporters mogen de opgeslagen veld- en bankindeling bekijken, zonder bewerkrechten.
create or replace function public.openbare_opstellingen() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'match_key', l.match_key, 'formatie', l.formatie,
    'spelers', coalesce((select jsonb_agg(jsonb_build_object('positie', p.positie, 'naam', m.naam, 'member_id', m.id) order by p.positie)
      from public.lineup_players p join public.members m on m.id=p.member_id
      where p.lineup_id=l.id), '[]'::jsonb)
  ) order by l.match_key), '[]'::jsonb)
  from public.lineups l join public.matches w on w.match_key=l.match_key
  where w.thuis_id=152 or w.uit_id=152;
$$;
revoke all on function public.openbare_opstellingen() from public;
grant execute on function public.openbare_opstellingen() to anon, authenticated;

-- Automatisch opslaan controleert de laatst gelezen versie binnen dezelfde transactie.
create or replace function public.bewaar_opstelling_auto(p_match_key text, p_formatie text, p_keuze jsonb, p_slotjes text[], p_verwacht timestamptz)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare v_huidig timestamptz; v_resultaat jsonb;
begin
  if not is_actief() or not is_staf() then raise exception 'Alleen bevoegde staf mag een opstelling maken.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_match_key, 0));
  select updated_at into v_huidig from lineups where match_key=p_match_key for update;
  if v_huidig is distinct from p_verwacht then
    raise exception 'Deze opstelling is ondertussen gewijzigd. Herlaad de nieuwste opstelling voordat je verder bewerkt.';
  end if;
  perform bewaar_opstelling_met_slotjes(p_match_key, p_formatie, p_keuze, p_slotjes);
  select to_jsonb(l) into v_resultaat from lineups l where match_key=p_match_key;
  return v_resultaat;
end $$;
revoke all on function public.bewaar_opstelling_auto(text, text, jsonb, text[], timestamptz) from public, anon;
grant execute on function public.bewaar_opstelling_auto(text, text, jsonb, text[], timestamptz) to authenticated;

-- Matchverslag en clubmeldingen. Geen testgegevens of testacties in productie.
create table if not exists public.match_reports (
 match_key text primary key references public.matches(match_key) on delete cascade,
 thuis_score integer not null check(thuis_score between 0 and 99),
 uit_score integer not null check(uit_score between 0 and 99),
 momenten jsonb not null default '[]' check(jsonb_typeof(momenten)='array'),
 score_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 ingevoerd_door uuid references public.members(id)
);
alter table public.match_reports enable row level security;
revoke all on public.match_reports from anon, authenticated;
grant select on public.match_reports to authenticated;
grant all on public.match_reports to service_role;
drop policy if exists "actieve leden lezen verslagen" on public.match_reports;
create policy "actieve leden lezen verslagen" on public.match_reports for select to authenticated using (is_actief());

create or replace function public.bewaar_matchverslag(p_match_key text, p_thuis integer, p_uit integer, p_momenten jsonb, p_versie timestamptz)
returns void language plpgsql security definer set search_path=public as $$
declare v_versie timestamptz; m jsonb;
begin
 if not is_actief() or not is_staf() then raise exception 'Alleen bevoegde staf mag het matchverslag invullen.'; end if;
 if not exists(select 1 from matches where match_key=p_match_key and (thuis_id=152 or uit_id=152)) then raise exception 'Geen eigen wedstrijd.'; end if;
 if p_momenten is null or jsonb_typeof(p_momenten)<>'array' or jsonb_array_length(p_momenten)>150 then raise exception 'Ongeldige tijdlijn.'; end if;
 for m in select value from jsonb_array_elements(p_momenten) loop
  if coalesce(m->>'soort','') not in ('goal','geel','rood') or coalesce(m->>'kant','') not in ('thuis','uit')
    or length(coalesce(m->>'speler',''))>100 or length(coalesce(m->>'assist',''))>100
    or (m->>'minuut' is not null and ((m->>'minuut') !~ '^[0-9]{1,3}$' or (m->>'minuut')::integer>130)) then raise exception 'Ongeldig wedstrijdmoment.'; end if;
 end loop;
 perform pg_advisory_xact_lock(hashtextextended('verslag:'||p_match_key,0));
 select updated_at into v_versie from match_reports where match_key=p_match_key for update;
 if v_versie is distinct from p_versie then raise exception 'Iemand heeft dit verslag aangepast. Herlaad het verslag voordat je verdergaat.'; end if;
 insert into match_reports(match_key,thuis_score,uit_score,momenten,ingevoerd_door)
 values(p_match_key,p_thuis,p_uit,p_momenten,my_member_id())
 on conflict(match_key) do update set thuis_score=excluded.thuis_score,uit_score=excluded.uit_score,momenten=excluded.momenten,ingevoerd_door=excluded.ingevoerd_door,updated_at=clock_timestamp();
end $$;
revoke all on function public.bewaar_matchverslag(text,integer,integer,jsonb,timestamptz) from public,anon;
grant execute on function public.bewaar_matchverslag(text,integer,integer,jsonb,timestamptz) to authenticated;

create or replace function public.match_aftrap(p_datum date,p_uur text) returns timestamptz
language sql stable set search_path=public as $$
 select case when p_datum is not null and p_uur ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then (p_datum + p_uur::time) at time zone 'Europe/Brussels' else null end;
$$;
create or replace function stem_geldig(p_match_key text,p_eerste uuid,p_tweede uuid,p_derde uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select is_actief()
 and exists(select 1 from matches m where m.match_key=p_match_key and (m.status='gespeeld' or exists(select 1 from match_reports r where r.match_key=m.match_key))
   and match_aftrap(m.datum,m.uur)+interval '80 minutes'<=now() and (now() at time zone 'Europe/Brussels')::date<=m.datum+7)
 and exists(select 1 from attendance where match_key=p_match_key and member_id=my_member_id() and status='aanwezig')
 and (select count(*) from attendance where match_key=p_match_key and status='aanwezig' and member_id in(p_eerste,p_tweede,p_derde))=3
 and my_member_id() not in(p_eerste,p_tweede,p_derde) and p_eerste<>p_tweede and p_eerste<>p_derde and p_tweede<>p_derde;
$$;
revoke all on function stem_geldig(text,uuid,uuid,uuid) from public,anon;
grant execute on function stem_geldig(text,uuid,uuid,uuid) to authenticated;

create table if not exists public.push_config (
 id integer primary key check(id=1), enabled boolean not null default false,
 vapid_public text, vapid_private text,
 cron_secret text not null default encode(gen_random_bytes(32),'hex')
);
insert into public.push_config(id) values(1) on conflict do nothing;
create table if not exists public.push_subscriptions (
 endpoint text primary key, member_id uuid not null references public.members(id) on delete cascade,
 subscription jsonb not null, created_at timestamptz not null default now()
);
create table if not exists public.push_jobs (
 id uuid primary key default gen_random_uuid(), match_key text not null references public.matches(match_key) on delete cascade,
 member_id uuid not null references public.members(id) on delete cascade,
 soort text not null check(soort in('aanwezig72','aanwezig48','stemmen','stemherinnering','wasmand')),
 status text not null default 'pending' check(status in('pending','sending','sent','skipped')),
 sent_at timestamptz, lease_until timestamptz, attempts integer not null default 0,
 next_attempt timestamptz not null default now(), fout text, created_at timestamptz not null default now(),
 unique(match_key,member_id,soort)
);
alter table public.push_config enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.push_jobs enable row level security;
revoke all on public.push_config,public.push_subscriptions,public.push_jobs from public,anon,authenticated;
grant all on public.push_config,public.push_subscriptions,public.push_jobs to service_role;

-- Alleen service_role krijgt planninggegevens; geen contactgegevens of abonnementen in de client.
create or replace function public.push_planning() returns jsonb
language sql stable security definer set search_path=public as $$
 select coalesce(jsonb_agg(jsonb_build_object('match_key',m.match_key,'tegenstander',case when m.thuis_id=152 then m.uit else m.thuis end,
 'aftrap',match_aftrap(m.datum,m.uur),'score_at',r.score_at,'deadline',((m.datum+8)::timestamp at time zone 'Europe/Brussels'),
 'thuis_score',r.thuis_score,'uit_score',r.uit_score,'steca_thuis',m.thuis_id=152,
 'antwoord',a.member_id is not null,'aanwezig',coalesce(a.status='aanwezig',false),'gestemd',v.voter_id is not null,
 'eerste_verzonden',j.sent_at,'member_id',lid.id,'wasmand',w.member_id is not null)), '[]'::jsonb)
 from push_config c join members lid on lid.status='actief' and lid.user_id is not null
 cross join matches m left join match_reports r on r.match_key=m.match_key
 left join attendance a on a.match_key=m.match_key and a.member_id=lid.id
 left join match_votes v on v.match_key=m.match_key and v.voter_id=lid.id
 left join push_jobs j on j.match_key=m.match_key and j.member_id=lid.id and j.soort='stemmen' and j.status='sent'
 left join laundry_turns w on w.match_key=m.match_key and w.member_id=lid.id
 where c.enabled and exists(select 1 from push_subscriptions ps where ps.member_id=lid.id) and (lid.speelt or a.status='aanwezig' or w.member_id is not null) and (m.thuis_id=152 or m.uit_id=152) and m.datum between (now() at time zone 'Europe/Brussels')::date-7 and (now() at time zone 'Europe/Brussels')::date+4;
$$;
revoke all on function public.push_planning() from public,anon,authenticated;
grant execute on function public.push_planning() to service_role;

-- Eén verzender per job, inclusief herstart na een afgebroken Edge Function.
create or replace function public.claim_push_job(p_id uuid) returns boolean
language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 update push_jobs j set status='sending',lease_until=now()+interval '2 minutes',attempts=attempts+1
 where j.id=p_id and ((j.status='pending' and j.next_attempt<=now()) or (j.status='sending' and j.lease_until<now()))
 and exists(select 1 from push_config c join members m on m.id=j.member_id where c.enabled and m.status='actief' and m.user_id is not null)
 returning j.id into v_id;
 return v_id is not null;
end $$;
revoke all on function public.claim_push_job(uuid) from public,anon,authenticated;
grant execute on function public.claim_push_job(uuid) to service_role;

-- Geheime planneraanroep blijft in de database.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('steca-club-push','* * * * *',$cron$
 select net.http_post(
  url := 'https://odgrmhcmkvbdadjhphiz.supabase.co/functions/v1/match-push',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||cron_secret),
  body := '{"action":"run"}'::jsonb, timeout_milliseconds := 55000
 ) from public.push_config where id=1 and enabled and vapid_public is not null;
$cron$);

-- De Kantine: persoonlijke ploegen zijn strikt gescheiden van officiële lineups.
create table if not exists public.dream_xi (
 user_id uuid primary key references auth.users(id) on delete cascade,
 formatie text not null check (formatie in ('4-3-3','4-4-2','3-4-3')),
 keuze jsonb not null default '{}', slotjes text[] not null default '{}',
 updated_at timestamptz not null default now()
);
alter table public.dream_xi enable row level security;
revoke all on public.dream_xi from anon, authenticated;
grant select on public.dream_xi to authenticated;
grant all on public.dream_xi to service_role;
drop policy if exists dream_prive on public.dream_xi;
create policy dream_prive on public.dream_xi for select to authenticated using ((is_actief() or exists(select 1 from supporter_profiles where user_id=auth.uid() and actief)) and user_id=auth.uid());

create or replace function public.kantine_spelers() returns table(id uuid,naam text)
language sql stable security definer set search_path=public as $$
 select id,naam from members where status='actief' and speelt order by naam;
$$;
revoke all on function public.kantine_spelers() from public;
grant execute on function public.kantine_spelers() to anon,authenticated;

create or replace function public.bewaar_dream_xi(p_formatie text,p_keuze jsonb,p_slotjes text[],p_versie timestamptz)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare pos text[]; v timestamptz; nieuw timestamptz; k record;
begin
 if not (coalesce(is_actief(),false) or exists(select 1 from supporter_profiles where user_id=auth.uid() and actief)) then raise exception 'Log in met een actief clubaccount.'; end if;
 pos:=case p_formatie when '4-3-3' then array['GK','LB','CB1','CB2','RB','CM1','CM2','CM3','LW','ST','RW']
 when '4-4-2' then array['GK','LB','CB1','CB2','RB','LM','CM1','CM2','RM','ST1','ST2']
 when '3-4-3' then array['GK','CB1','CB2','CB3','LM','CM1','CM2','RM','LW','ST','RW'] end;
 if pos is null or p_keuze is null or jsonb_typeof(p_keuze)<>'object' then raise exception 'Ongeldige persoonlijke opstelling.'; end if;
 pos:=pos||array['BANK1','BANK2','BANK3','BANK4'];
 for k in select * from jsonb_each_text(p_keuze) loop
  if not(k.key=any(pos)) or (k.value is not null and not exists(select 1 from members where id::text=k.value and status='actief' and speelt)) then raise exception 'Ongeldige speler of positie.'; end if;
 end loop;
 if (select count(*)<>count(distinct value) from jsonb_each_text(p_keuze) where value is not null) then raise exception 'Een speler mag maar eenmaal voorkomen.'; end if;
 if p_slotjes is null or not(p_slotjes<@pos) or exists(select 1 from unnest(p_slotjes) p where p_keuze->>p is null) then raise exception 'Ongeldig slotje.'; end if;
 perform pg_advisory_xact_lock(hashtextextended('dream:'||auth.uid()::text,0));
 select updated_at into v from dream_xi where user_id=auth.uid();
 if v is distinct from p_versie then raise exception 'Je Dream XI is elders gewijzigd. Herlaad eerst.'; end if;
 nieuw:=clock_timestamp();
 insert into dream_xi values(auth.uid(),p_formatie,p_keuze,p_slotjes,nieuw)
 on conflict(user_id) do update set formatie=excluded.formatie,keuze=excluded.keuze,slotjes=excluded.slotjes,updated_at=excluded.updated_at;
 return nieuw;
end $$;
revoke all on function public.bewaar_dream_xi(text,jsonb,text[],timestamptz) from public,anon;
grant execute on function public.bewaar_dream_xi(text,jsonb,text[],timestamptz) to authenticated;

create table if not exists public.pronostieken (
 match_key text references public.matches(match_key) on delete cascade,
 user_id uuid references auth.users(id) on delete cascade,
 thuis integer not null check(thuis between 0 and 99), uit integer not null check(uit between 0 and 99),
 updated_at timestamptz not null default now(), primary key(match_key,user_id)
);
alter table public.pronostieken enable row level security;
revoke all on public.pronostieken from anon,authenticated;
grant select on public.pronostieken to authenticated;
grant all on public.pronostieken to service_role;
drop policy if exists eigen_pronostiek on public.pronostieken;
create policy eigen_pronostiek on public.pronostieken for select to authenticated using((is_actief() or exists(select 1 from supporter_profiles where user_id=auth.uid() and actief)) and user_id=auth.uid());

create or replace function public.bewaar_pronostiek(p_match text,p_thuis integer,p_uit integer)
returns void language plpgsql security definer set search_path=public as $$
declare m matches%rowtype;
begin
 if not (coalesce(is_actief(),false) or exists(select 1 from supporter_profiles where user_id=auth.uid() and actief)) then raise exception 'Log in met een actief clubaccount.'; end if;
 select * into m from matches where match_key=p_match for share;
 if m.match_key is null or not coalesce(m.thuis_id=152 or m.uit_id=152,false) then raise exception 'Alleen matchen van Steca Juniors.'; end if;
 if match_aftrap(m.datum,m.uur) is null or match_aftrap(m.datum,m.uur)<=clock_timestamp() or m.status<>'gepland'
 or m.thuis_score is not null or m.uit_score is not null or exists(select 1 from match_reports where match_key=p_match) then raise exception 'Pronostieken zijn gesloten voor deze match.'; end if;
 if p_thuis is null or p_uit is null or p_thuis not between 0 and 99 or p_uit not between 0 and 99 then raise exception 'Vul twee volledige scores van 0 tot 99 in.'; end if;
 insert into pronostieken values(p_match,auth.uid(),p_thuis,p_uit,clock_timestamp())
 on conflict(match_key,user_id) do update set thuis=excluded.thuis,uit=excluded.uit,updated_at=excluded.updated_at;
end $$;
revoke all on function public.bewaar_pronostiek(text,integer,integer) from public,anon;
grant execute on function public.bewaar_pronostiek(text,integer,integer) to authenticated;

create or replace function public.pronostiek_punten(p_thuis integer,p_uit integer,r_thuis integer,r_uit integer)
returns integer language sql immutable as $$
 select case when r_thuis is null or r_uit is null or p_thuis is null or p_uit is null then 0
 when p_thuis=r_thuis and p_uit=r_uit then 10
 when p_thuis-p_uit=r_thuis-r_uit then 5
 when sign(p_thuis-p_uit)=sign(r_thuis-r_uit) then 3 else 0 end;
$$;

-- Alleen totalen en namen zijn openbaar; persoonlijke voorspellingen blijven privé.
-- Herberekent bij correcties. Een tijdens de match ingevulde score telt pas vanaf aftrap +80 min.
create or replace function public.kantine_klassement(p_seizoen text)
returns table(user_id uuid,naam text,punten bigint,exact bigint,verschil bigint,winnaar bigint,gespeeld bigint)
language sql stable security definer set search_path=public as $$
 with scores as (
 select p.user_id,pronostiek_punten(p.thuis,p.uit,coalesce(r.thuis_score,m.thuis_score),coalesce(r.uit_score,m.uit_score)) pt
 from pronostieken p join matches m using(match_key) left join match_reports r using(match_key)
 where m.seizoen=p_seizoen and (m.thuis_id=152 or m.uit_id=152)
 and match_aftrap(m.datum,m.uur)+interval '80 minutes'<=now()
 and (r.match_key is not null or m.status='gespeeld')
 and coalesce(r.thuis_score,m.thuis_score) is not null and coalesce(r.uit_score,m.uit_score) is not null
 ), deelnemers as (
 select coalesce(m.user_id,m.id) as user_id,m.naam from members m where m.status='actief' and m.functie<>'supporter'
 union all select sp.user_id,sp.naam from supporter_profiles sp where sp.actief
 )
 select d.user_id,d.naam,coalesce(sum(s.pt),0)::bigint,count(*) filter(where pt=10),count(*) filter(where pt=5),count(*) filter(where pt=3),count(s.pt)
 from deelnemers d left join scores s on s.user_id=d.user_id
 group by d.user_id,d.naam order by 3 desc,d.naam;
$$;
revoke all on function public.kantine_klassement(text) from public;
grant execute on function public.kantine_klassement(text) to anon,authenticated;

-- --------------------------------------------------------------- wasmand
-- Per match één speler die de wasmand mee naar huis neemt. Lezen: alle actieve leden.
-- Aanduiden en wijzigen: coach, spelercoach, verantwoordelijke of admin. Elke wijziging komt in audit_log.

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

-- Accounttype wijzigen zonder wedstrijdhistoriek of persoonlijke pronostieken te wissen.
alter table public.supporter_profiles add column if not exists member_id uuid unique references public.members(id) on delete set null;
create or replace function public.admin_supporters() returns table(id uuid,naam text,actief boolean,heeft_account boolean)
language plpgsql stable security definer set search_path=public as $$
begin
 if not is_admin() then raise exception 'Alleen een beheerder mag supporters beheren.'; end if;
 return query select s.user_id,s.naam,s.actief,true from supporter_profiles s
 union all select m.id,m.naam,m.status='actief',m.user_id is not null from members m
 where m.functie='supporter' and not exists(select 1 from supporter_profiles s where s.member_id=m.id or s.user_id=m.user_id)
 order by 2;
end $$;
revoke all on function public.admin_supporters() from public,anon;
grant execute on function public.admin_supporters() to authenticated;

create or replace function public.admin_accountfunctie(p_id uuid,p_functie text) returns uuid
language plpgsql security definer set search_path=public as $$
declare s supporter_profiles; m members; u auth.users; doel uuid; vorige text; actor uuid; instelling text;
begin
 if not is_admin() then raise exception 'Alleen een beheerder mag functies wijzigen.'; end if;
 if p_functie is null or p_functie not in ('speler','spelercoach','coach','verantwoordelijke','supporter') then raise exception 'Ongeldige functie.'; end if;
 actor:=my_member_id();
 perform pg_advisory_xact_lock(hashtextextended('steca-accountfunctie',0));
 select * into s from supporter_profiles where user_id=p_id for update;
 if s.user_id is not null then
   if p_functie='supporter' then return s.user_id; end if;
   select * into u from auth.users where id=s.user_id;
   if u.id is null then raise exception 'Account niet gevonden.'; end if;
   if exists(select 1 from members where user_id=u.id) then raise exception 'Dit account is al aan een clublid gekoppeld.'; end if;
   if s.member_id is not null then
     select * into m from members where id=s.member_id for update;
     if m.user_id is not null or m.is_hoofdadmin then raise exception 'Historisch profiel is al gekoppeld.'; end if;
   end if;
   instelling:=current_setting('steca.ontkoppelen',true);
   perform set_config('steca.ontkoppelen','ja',true);
   if m.id is not null then
     update members set user_id=u.id,functie=p_functie,status='actief',is_admin=false,email=u.email where id=m.id;
     doel:=m.id;
   else
     insert into members(user_id,naam,voornaam,achternaam,email,functie,status,bron)
     values(u.id,s.naam,coalesce(nullif(u.raw_user_meta_data->>'voornaam',''),split_part(s.naam,' ',1)),
       coalesce(nullif(u.raw_user_meta_data->>'achternaam',''),nullif(trim(substr(s.naam,length(split_part(s.naam,' ',1))+1)),'')),u.email,p_functie,'actief','admin') returning id into doel;
   end if;
   perform set_config('steca.ontkoppelen',coalesce(instelling,''),true);
   delete from supporter_profiles where user_id=u.id;
   vorige:='supporter';
 else
   select * into m from members where id=p_id for update;
   if m.id is null then raise exception 'Account of lid niet gevonden.'; end if;
   if m.is_hoofdadmin and p_functie='supporter' then raise exception 'De hoofdadmin kan geen supporter worden.'; end if;
   if m.is_hoofdadmin and m.id<>actor then raise exception 'Alleen de hoofdadmin mag zijn eigen functie wijzigen.'; end if;
   vorige:=m.functie;doel:=m.id;
   if p_functie='supporter' then
     if m.user_id is not null then
       insert into supporter_profiles(user_id,naam,actief,member_id) values(m.user_id,m.naam,m.status<>'inactief',m.id);
       doel:=m.user_id;
     end if;
     update members set user_id=null,functie='supporter',status='inactief',is_admin=false where id=m.id;
     delete from push_subscriptions where member_id=m.id;
     update push_jobs set status='skipped',fout='Account omgezet naar supporter.',lease_until=null where member_id=m.id and status in ('pending','sending');
   else
     update members set functie=p_functie,status=case when functie='supporter' then 'actief' else status end where id=m.id;
   end if;
 end if;
 insert into audit_log(tabel,rij_id,actie,oud,nieuw,door,door_user) values('accountfunctie',doel::text,'UPDATE',jsonb_build_object('functie',vorige),jsonb_build_object('functie',p_functie),actor,auth.uid());
 return doel;
end $$;
revoke all on function public.admin_accountfunctie(uuid,text) from public,anon;
grant execute on function public.admin_accountfunctie(uuid,text) to authenticated;

-- --------------------------------------------------------------- lichtkrant
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

-- Automatische badges: alleen afgesloten Steca-matchen. Historische seizoenen
-- blijven uit hun bewaarde wedstrijdcijfers beschikbaar, ook na 1 juli.
create or replace function public.bereken_badges()
returns table(id uuid,badge_id text,member_id uuid,seizoen text,match_key text,aangemaakt_op timestamptz)
language sql stable security definer set search_path=public as $$
with m as materialized (
 select x.*, row_number() over(order by datum,coalesce(uur,''),match_key) as nr
 from (select t.match_key,t.seizoen,t.datum,t.uur,t.thuis_id,t.uit_id,
 case when r.match_key is not null then 'gespeeld' else t.status end as status,
 coalesce(r.thuis_score,t.thuis_score) thuis_score,coalesce(r.uit_score,t.uit_score) uit_score
 from matches t left join match_reports r using(match_key)) x
 where (thuis_id=152 or uit_id=152) and status='gespeeld'
 and thuis_score is not null and uit_score is not null and datum is not null
 and ((datum + coalesce(nullif(uur,'')::time,'15:00'::time)) at time zone 'Europe/Brussels') + interval '80 minutes' <= now()
), leden as materialized (
 select id from members where functie<>'supporter'
), cijfers as materialized (
 select s.*,m.seizoen,m.datum,m.nr,
 case when s.gespeeld and (case when m.thuis_id=152 then m.uit_score else m.thuis_score end)=0 then 1 else 0 end as cs
 from match_stats s join m using(match_key) join leden on leden.id=s.member_id
), stemmen as (
 select v.match_key,k.member_id,k.punten
 from match_votes v join m using(match_key)
 cross join lateral (values(v.eerste,3),(v.tweede,2),(v.derde,1)) k(member_id,punten)
 where v.voter_id not in(v.eerste,v.tweede,v.derde)
), punten as materialized (
 select s.match_key,s.member_id,sum(s.punten) as aantal
 from stemmen s join leden on leden.id=s.member_id group by s.match_key,s.member_id
), winnaars as materialized (
 select p.* from punten p where aantal>0 and aantal=(select max(q.aantal) from punten q where q.match_key=p.match_key)
), metingen as (
 select c.member_id,c.seizoen,c.datum,k.soort,k.aantal::bigint
 from cijfers c cross join lateral (values
 ('goals',c.goals),('assists',c.assists),('cs',c.cs),('kaarten',c.geel+c.rood),('rood',c.rood),('gespeeld',c.gespeeld::int)) k(soort,aantal)
 union all select a.member_id,m.seizoen,m.datum,'aanwezig',1 from attendance a join m using(match_key) join leden on leden.id=a.member_id where a.status='aanwezig'
 union all select w.member_id,m.seizoen,m.datum,'winnaar',1 from winnaars w join m using(match_key)
 union all select p.member_id,m.seizoen,m.datum,'punten',p.aantal from punten p join m using(match_key)
 union all select l.member_id,m.seizoen,m.datum,'was',1 from laundry_turns l join m using(match_key) join leden on leden.id=l.member_id
), totalen as materialized (
 select member_id,seizoen,soort,sum(aantal) as aantal,max(datum) as datum from metingen group by member_id,seizoen,soort
 union all select member_id,null,soort,sum(aantal),max(datum) from metingen group by member_id,soort
), titels(badge_id,soort,jaarlijks) as (values
 ('gouden_stier','goals',true),('het_kanon','goals',false),('assistenkoning','assists',true),('maestro','assists',false),
 ('de_muur','cs',true),('betonblok','cs',false),('beenhouwer','kaarten',true),('rosse_furie','rood',true),
 ('fundering','aanwezig',true),('vaste_waarde','gespeeld',true),('clubmeubilair','gespeeld',false),
 ('star_boy','winnaar',true),('goat','punten',false),('kuisvrouw','was',true),('junior_dor','punten',true)
), drempels(badge_id,soort,aantal) as (values
 ('eentje_is_geentje','goals',1),('dubbele_cijfers','goals',10),('goalgetter','goals',25),('sluipschutter','goals',50),('67','goals',67),('triple_digits','goals',100),
 ('wingman','assists',1),('facteur','assists',10),('de_architect','assists',25),('kdb_der_juniors','assists',50),
 ('muur_van_dendermonde','cs',1),('veilige_handen','cs',5),('opgewarmd_door_georgie','cs',10),('golden_glove','cs',25),
 ('official_junior','gespeeld',1),('toogplekker','gespeeld',10),('sterkhouder','gespeeld',25),('georgies_favoriet','gespeeld',50),('steca_legend','gespeeld',100),('laat_je_ploeg','rood',1)
), speelreeks as (
 select member_id,datum,nr-row_number() over(partition by member_id order by nr) as groep from cijfers where gespeeld
), aanwezigreeks as (
 select a.member_id,m.datum,m.nr-row_number() over(partition by a.member_id order by m.nr) as groep
 from attendance a join m using(match_key) join leden on leden.id=a.member_id where a.status='aanwezig'
), kaartenreeks as (
 select member_id,datum,(geel+rood)>0 as kaart,lag((geel+rood)>0) over(partition by member_id order by nr) as vorige
 from cijfers where gespeeld
), resultaat as (
 select b.badge_id,t.member_id,t.seizoen,null::text as match_key,t.datum
 from titels b join totalen t on t.soort=b.soort and (t.seizoen is not null)=b.jaarlijks
 where t.aantal>0 and t.aantal=(select max(q.aantal) from totalen q where q.soort=t.soort and q.seizoen is not distinct from t.seizoen)
 union all select d.badge_id,t.member_id,null,null,t.datum from drempels d join totalen t on t.soort=d.soort and t.seizoen is null and t.aantal>=d.aantal
 union all select 'hattrick',member_id,null,match_key,datum from cijfers where gespeeld and goals>=3
 union all select 'junior_van_de_match',w.member_id,null,w.match_key,m.datum from winnaars w join m using(match_key)
 union all select 'vijf_op_een_rij',member_id,null,null,max(datum) from speelreeks group by member_id,groep having count(*)>=5
 union all select 'rots_in_de_branding',member_id,null,null,max(datum) from aanwezigreeks group by member_id,groep having count(*)>=10
 union all select 'getikte_zot',member_id,null,null,datum from kaartenreeks where kaart and vorige
), uniek as (
 select badge_id,member_id,seizoen,match_key,min(datum) as datum from resultaat group by badge_id,member_id,seizoen,match_key
)
select md5(concat_ws('|',badge_id,member_id,seizoen,match_key))::uuid,badge_id,member_id,seizoen,match_key,
 (datum::timestamp at time zone 'Europe/Brussels') from uniek;
$$;
revoke all on function public.bereken_badges() from public;
grant execute on function public.bereken_badges() to anon,authenticated;

create table if not exists public.badge_voorkeuren (
 member_id uuid primary key references public.members(id) on delete cascade,
 badges text[] not null default '{}'
);
alter table public.badge_voorkeuren enable row level security;
revoke all on public.badge_voorkeuren from public,anon,authenticated;
grant select on public.badge_voorkeuren to anon,authenticated;
drop policy if exists badgevoorkeur_lezen on public.badge_voorkeuren;
create policy badgevoorkeur_lezen on public.badge_voorkeuren for select using(true);
create or replace view public.badges_met_volgorde with (security_invoker=true) as
 select b.*,array_position(v.badges,b.badge_id) as volgorde,true as automatisch from public.bereken_badges() b left join public.badge_voorkeuren v on v.member_id=b.member_id;
grant select on public.badges_met_volgorde to anon,authenticated;
create or replace function public.bewaar_badgevolgorde(p_badges text[]) returns void
language plpgsql security definer set search_path=public as $$
declare lid uuid:=my_member_id();
begin
 if lid is null or not is_actief() then raise exception 'Log in met je actieve clubaccount.'; end if;
 if p_badges is null or cardinality(p_badges)>40 or array_position(p_badges,null) is not null then raise exception 'Ongeldige badgevolgorde.'; end if;
 if (select count(distinct b) from unnest(p_badges) b)<>cardinality(p_badges) then raise exception 'Een badge mag maar een keer in de volgorde staan.'; end if;
 if exists(select 1 from unnest(p_badges) b where not exists(select 1 from badges_met_volgorde t where t.member_id=lid and t.badge_id=b)) then raise exception 'Je kunt alleen je eigen badges rangschikken.'; end if;
 insert into badge_voorkeuren(member_id,badges) values(lid,p_badges) on conflict(member_id) do update set badges=excluded.badges;
end $$;
revoke all on function public.bewaar_badgevolgorde(text[]) from public,anon;
grant execute on function public.bewaar_badgevolgorde(text[]) to authenticated;

-- Handmatige competitie-update: alleen de server mag aanvragen vastleggen.
create table if not exists public.scrape_control (
  id boolean primary key default true check (id),
  request_id uuid,
  requested_at timestamptz,
  requested_by uuid references public.members(id) on delete set null,
  status text not null default 'idle' check (status in ('idle','queued','in_progress','success','failure')),
  run_id bigint,
  fout text
);
insert into public.scrape_control(id) values (true) on conflict do nothing;
alter table public.scrape_control enable row level security;
revoke all on public.scrape_control from anon, authenticated;
grant all on public.scrape_control to service_role;

-- De rijvergrendeling voorkomt twee gelijktijdige aanvragen door verschillende admins.
create or replace function public.claim_competition_sync(p_member uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare c public.scrape_control; aanvraag uuid := gen_random_uuid();
begin
  if not exists (select 1 from public.members where id=p_member and is_admin and status='actief') then
    raise exception 'Alleen actieve admins kunnen wedstrijdgegevens vernieuwen.';
  end if;
  select * into c from public.scrape_control where id=true for update;
  if c.status in ('queued','in_progress') then
    raise exception 'Er loopt al een update. Wacht tot die klaar is.';
  end if;
  if c.requested_at > now() - interval '5 minutes' then
    raise exception 'Wacht vijf minuten tussen twee aanvragen.';
  end if;
  update public.scrape_control set request_id=aanvraag, requested_at=now(), requested_by=p_member,
    status='queued', run_id=null, fout=null where id=true;
  return aanvraag;
end $$;
revoke all on function public.claim_competition_sync(uuid) from public, anon, authenticated;
grant execute on function public.claim_competition_sync(uuid) to service_role;

-- Statistieken uit verslag en officiële opstelling.
alter table public.match_stats add column if not exists uit_verslag boolean not null default false;
alter table public.match_stats add column if not exists uit_opstelling boolean not null default false;
alter table public.match_stats add column if not exists clean_sheet boolean;

-- Bewaar een stabiele spelerskoppeling; oude verslagen kunnen nog enkel namen bevatten.
create or replace function public.verslag_lid(p_id text,p_naam text) returns uuid
language sql stable security definer set search_path=public as $$
 select case when nullif(p_id,'') is not null then
   (select id from members where id::text=p_id and functie<>'supporter')
 else (select (array_agg(id))[1] from members where functie<>'supporter'
   and lower(btrim(naam))=lower(btrim(p_naam)) having count(*)=1) end
$$;
revoke all on function public.verslag_lid(text,text) from public,anon,authenticated;

create or replace function public.koppel_verslag_spelers() returns trigger
language plpgsql security definer set search_path=public as $$
declare moment jsonb; lijst jsonb:='[]'; kant text; speler uuid; assist uuid;
begin
 select case when thuis_id=152 then 'thuis' else 'uit' end into kant from matches where match_key=new.match_key;
 for moment in select value from jsonb_array_elements(new.momenten) loop
  if moment->>'kant'=kant then
   speler:=verslag_lid(moment->>'speler_id',moment->>'speler');
   assist:=case when moment->>'soort'='goal' then verslag_lid(moment->>'assist_id',moment->>'assist') else null end;
   if nullif(btrim(moment->>'speler'),'') is not null and speler is null then
    raise exception 'Kies voor % een speler uit de ledenlijst.',moment->>'speler';
   end if;
   if moment->>'soort'='goal' and nullif(btrim(moment->>'assist'),'') is not null and assist is null then
    raise exception 'Kies voor de assist van % een speler uit de ledenlijst.',moment->>'assist';
   end if;
   moment:=moment || jsonb_build_object('speler_id',speler,'assist_id',assist);
  else
   moment:=moment - 'speler_id' - 'assist_id';
  end if;
  lijst:=lijst || jsonb_build_array(moment);
 end loop;
 new.momenten:=lijst;
 return new;
end $$;
drop trigger if exists koppel_verslag_spelers on public.match_reports;
create trigger koppel_verslag_spelers before insert or update of momenten on public.match_reports
for each row execute function public.koppel_verslag_spelers();
revoke all on function public.koppel_verslag_spelers() from public,anon,authenticated;

create or replace function public.synchroniseer_matchstatistieken(p_match text) returns void
language plpgsql security definer set search_path=public as $$
declare wedstrijd public.matches; verslag public.match_reports; opstelling uuid; klaar boolean; eigenkant text; tegen integer;
begin
 select * into wedstrijd from matches where match_key=p_match for update;
 if not found or (wedstrijd.thuis_id<>152 and wedstrijd.uit_id<>152) then return; end if;
 select * into verslag from match_reports where match_key=p_match;
 select id into opstelling from lineups where match_key=p_match;
 klaar:=verslag.match_key is not null or wedstrijd.status='gespeeld';
 eigenkant:=case when wedstrijd.thuis_id=152 then 'thuis' else 'uit' end;
 tegen:=case when eigenkant='thuis' then coalesce(verslag.uit_score,wedstrijd.uit_score) else coalesce(verslag.thuis_score,wedstrijd.thuis_score) end;
 -- Bestaande onbekende of dubbele namen nooit aan een willekeurige speler toekennen.
 -- Nieuwe invoer wordt reeds door koppel_verslag_spelers gecontroleerd.
 with momenten as (
  select value as m from jsonb_array_elements(coalesce(verslag.momenten,'[]')) where value->>'kant'=eigenkant
 ), punten as (
  select verslag_lid(m->>'speler_id',m->>'speler') as lid,
   (m->>'soort'='goal')::int as goals,0 as assists,(m->>'soort'='geel')::int as geel,(m->>'soort'='rood')::int as rood from momenten
  union all
  select verslag_lid(m->>'assist_id',m->>'assist'),0,1,0,0 from momenten where m->>'soort'='goal'
 ), totalen as (
  select lid,sum(goals)::int goals,sum(assists)::int assists,sum(geel)::int geel,sum(rood)::int rood from punten where lid is not null group by lid
 ), personen as (
  select member_id as lid from match_stats where match_key=p_match
  union select member_id from lineup_players where lineup_id=opstelling and klaar
  union select lid from totalen
 ), berekend as (
  select p.lid,
   case when opstelling is not null then klaar and exists(select 1 from lineup_players l where l.lineup_id=opstelling and l.member_id=p.lid)
     when coalesce(s.uit_opstelling,false) then false else coalesce(s.gespeeld,false) end as gespeeld,
   case when verslag.match_key is not null or coalesce(s.uit_verslag,false) then coalesce(t.goals,0) else coalesce(s.goals,0) end as goals,
   case when verslag.match_key is not null or coalesce(s.uit_verslag,false) then coalesce(t.assists,0) else coalesce(s.assists,0) end as assists,
   case when verslag.match_key is not null or coalesce(s.uit_verslag,false) then least(coalesce(t.geel,0),2) else coalesce(s.geel,0) end as geel,
   case when verslag.match_key is not null or coalesce(s.uit_verslag,false) then case when coalesce(t.geel,0)>=2 then 1 else least(coalesce(t.rood,0),1) end else coalesce(s.rood,0) end as rood
  from personen p left join match_stats s on s.match_key=p_match and s.member_id=p.lid left join totalen t on t.lid=p.lid
 )
 insert into match_stats(match_key,member_id,gespeeld,goals,assists,geel,rood,uit_verslag,uit_opstelling,clean_sheet)
 select p_match,lid,gespeeld,goals,assists,geel,rood,verslag.match_key is not null,opstelling is not null,
   gespeeld and klaar and coalesce(tegen=0,false) from berekend
 on conflict(match_key,member_id) do update set gespeeld=excluded.gespeeld,goals=excluded.goals,assists=excluded.assists,
 geel=excluded.geel,rood=excluded.rood,uit_verslag=excluded.uit_verslag,uit_opstelling=excluded.uit_opstelling,clean_sheet=excluded.clean_sheet
 where (match_stats.gespeeld,match_stats.goals,match_stats.assists,match_stats.geel,match_stats.rood,match_stats.uit_verslag,match_stats.uit_opstelling,match_stats.clean_sheet)
 is distinct from (excluded.gespeeld,excluded.goals,excluded.assists,excluded.geel,excluded.rood,excluded.uit_verslag,excluded.uit_opstelling,excluded.clean_sheet);
end $$;
revoke all on function public.synchroniseer_matchstatistieken(text) from public,anon,authenticated;
grant execute on function public.synchroniseer_matchstatistieken(text) to service_role;

create or replace function public.werk_matchstatistieken_bij() returns trigger
language plpgsql security definer set search_path=public as $$
declare sleutel text;
begin
 if tg_table_name='lineup_players' then
  select match_key into sleutel from lineups where id=case when tg_op='DELETE' then old.lineup_id else new.lineup_id end;
 else
  sleutel:=case when tg_op='DELETE' then old.match_key else new.match_key end;
 end if;
 if sleutel is not null then perform synchroniseer_matchstatistieken(sleutel); end if;
 return null;
end $$;
revoke all on function public.werk_matchstatistieken_bij() from public,anon,authenticated;
drop trigger if exists verslag_statistieken on public.match_reports;
create trigger verslag_statistieken after insert or update or delete on public.match_reports for each row execute function public.werk_matchstatistieken_bij();
drop trigger if exists spelers_statistieken on public.lineup_players;
create trigger spelers_statistieken after insert or update or delete on public.lineup_players for each row execute function public.werk_matchstatistieken_bij();
drop trigger if exists opstelling_statistieken on public.lineups;
create trigger opstelling_statistieken after delete on public.lineups for each row execute function public.werk_matchstatistieken_bij();
drop trigger if exists uitslag_statistieken on public.matches;
create trigger uitslag_statistieken after update of status,thuis_score,uit_score on public.matches for each row execute function public.werk_matchstatistieken_bij();

-- Bestaande eenduidige namen één keer vastleggen als spelers-id, ook vóór een latere naamswijziging.
update public.match_reports r set momenten=r.momenten
where exists (select 1 from matches m cross join lateral jsonb_array_elements(r.momenten) e
 where m.match_key=r.match_key and e->>'kant'=case when m.thuis_id=152 then 'thuis' else 'uit' end
 and ((nullif(e->>'speler','') is not null and e->>'speler_id' is null)
 or (nullif(e->>'assist','') is not null and e->>'assist_id' is null)))
and not exists (select 1 from matches m cross join lateral jsonb_array_elements(r.momenten) e
 cross join lateral (values(e->>'speler_id',e->>'speler'),(case when e->>'soort'='goal' then e->>'assist_id' end,case when e->>'soort'='goal' then e->>'assist' end)) n(id,naam)
 where m.match_key=r.match_key and e->>'kant'=case when m.thuis_id=152 then 'thuis' else 'uit' end
 and nullif(btrim(n.naam),'') is not null and verslag_lid(n.id,n.naam) is null);

-- Ook reeds gespeelde matchen en opgeslagen verslagen verwerken.
do $$ declare k text; begin
 for k in select match_key from matches where (thuis_id=152 or uit_id=152)
 and (status='gespeeld' or exists(select 1 from match_reports r where r.match_key=matches.match_key))
 loop perform synchroniseer_matchstatistieken(k); end loop;
end $$;


-- Supporteraanwezigheid: apart van de spelers en zonder extra schrijfrechten.
create or replace function public.is_supporter_account() returns boolean
language sql stable security definer set search_path=public as $$
 select exists(select 1 from supporter_profiles where user_id=auth.uid() and actief);
$$;
revoke all on function public.is_supporter_account() from public,anon;
grant execute on function public.is_supporter_account() to authenticated;

create table if not exists public.supporter_attendance (
 match_key text not null references public.matches(match_key) on delete cascade,
 user_id uuid not null references public.supporter_profiles(user_id) on delete cascade,
 status text not null check(status in ('aanwezig','afwezig','onzeker')),
 updated_at timestamptz not null default now(),
 primary key(match_key,user_id)
);
alter table public.supporter_attendance enable row level security;
revoke all on public.supporter_attendance from anon,authenticated;
grant all on public.supporter_attendance to service_role;

-- Alleen namen en antwoorden, geen e-mailadressen of andere profielgegevens.
create or replace function public.supporter_aanwezigheden() returns table(match_key text,user_id uuid,naam text,status text)
language sql stable security definer set search_path=public as $$
 select a.match_key,a.user_id,s.naam,a.status
 from supporter_attendance a join supporter_profiles s on s.user_id=a.user_id
 where s.actief and (is_actief() or is_supporter_account())
 order by s.naam;
$$;
revoke all on function public.supporter_aanwezigheden() from public,anon;
grant execute on function public.supporter_aanwezigheden() to authenticated;

-- Geen user-id als invoer: een supporter kan uitsluitend zijn eigen antwoord zetten.
create or replace function public.zet_supporter_aanwezigheid(p_match text,p_status text) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform 1 from supporter_profiles where user_id=auth.uid() and actief for share;
 if not found then raise exception 'Log in met een actief supporteraccount.'; end if;
 if p_status is null or p_status not in ('aanwezig','afwezig','onzeker') then raise exception 'Ongeldige aanwezigheid.'; end if;
 perform 1 from matches where match_key=p_match and (thuis_id=152 or uit_id=152)
  and status='gepland' and datum >= (now() at time zone 'Europe/Brussels')::date for share;
 if not found then raise exception 'Je kunt alleen antwoorden voor een komende match van Steca Juniors.'; end if;
 insert into supporter_attendance(match_key,user_id,status) values(p_match,auth.uid(),p_status)
 on conflict(match_key,user_id) do update set status=excluded.status,updated_at=now();
end;
$$;
revoke all on function public.zet_supporter_aanwezigheid(text,text) from public,anon;
grant execute on function public.zet_supporter_aanwezigheid(text,text) to authenticated;

-- Dezelfde leesweergave in de app, zonder lid te worden of stem-/stafrechten te krijgen.
do $$
declare tabel text;
begin
 foreach tabel in array array['attendance','lineups','lineup_players','match_stats','fines','laundry_turns','match_reports','ticker_messages'] loop
  execute format('drop policy if exists supporter_app_lezen on public.%I',tabel);
  execute format('create policy supporter_app_lezen on public.%I for select to authenticated using (public.is_supporter_account())',tabel);
 end loop;
end;
$$;

create or replace view public.match_vote_points as
 select s.match_key,s.member_id,sum(s.punten)::int as punten,count(*)::int as stemmen
 from (
  select match_key,eerste as member_id,3 as punten from match_votes
  union all select match_key,tweede,2 from match_votes
  union all select match_key,derde,1 from match_votes
 ) s where is_actief() or is_supporter_account() group by s.match_key,s.member_id;
create or replace view public.match_vote_counts as
 select match_key,count(*)::int as stemmers from match_votes
 where is_actief() or is_supporter_account() group by match_key;


-- Uploadernamen voor sfeerbeelden, zonder contactgegevens.
create or replace function public.sfeerbeeld_uploaders(p_ids uuid[]) returns table(user_id uuid,naam text)
language sql stable security definer set search_path=public as $$
 select m.user_id,m.naam from members m
 where m.user_id=any(p_ids) and (is_actief() or is_supporter_account())
 union all
 select s.user_id,s.naam from supporter_profiles s
 where s.user_id=any(p_ids) and (is_actief() or is_supporter_account())
 and not exists(select 1 from members m where m.user_id=s.user_id);
$$;
revoke all on function public.sfeerbeeld_uploaders(uuid[]) from public,anon;
grant execute on function public.sfeerbeeld_uploaders(uuid[]) to authenticated;

-- Supportersklassement: uitsluitend echte supporteraccounts en wedstrijden.
create or replace function public.supporter_klassement_data() returns jsonb
language plpgsql stable security definer set search_path=public as $$
begin
 if not (coalesce(is_actief(),false) or coalesce(is_supporter_account(),false)) then
  raise exception 'Log in met een actief account.';
 end if;
 return jsonb_build_object(
  'personen',coalesce((select jsonb_agg(jsonb_build_object('id',user_id,'user_id',user_id,'naam',naam) order by naam) from supporter_profiles where actief),'[]'::jsonb),
  'matches',coalesce((select jsonb_agg(to_jsonb(m)) from (
   select match_key as id,seizoen,datum,(uit_id=152) as uit,
    (status='gespeeld' and match_aftrap(datum,uur)+interval '80 minutes'<=now()) as gespeeld,
    thuis||' - '||uit as label
   from matches where (thuis_id=152 or uit_id=152) and datum is not null
    and status in ('gepland','gespeeld') and coalesce(bron,'') not in ('push-test','test-invoer')
    and match_key<>'test-matchverslag-voorbeeld'
  ) m),'[]'::jsonb),
  'bezoeken',coalesce((select jsonb_agg(jsonb_build_object('persoon',a.user_id,'match',a.match_key))
   from supporter_attendance a join supporter_profiles s on s.user_id=a.user_id where s.actief and a.status='aanwezig'),'[]'::jsonb),
  -- Seizoenen lopen van juli tot juni. Een lopend seizoen krijgt nooit Perfect seizoen.
  'afgerond',coalesce((select jsonb_agg(seizoen) from (
   select distinct seizoen from matches where (thuis_id=152 or uit_id=152)
    and seizoen ~ '^[0-9]{4}-[0-9]{4}$'
    and seizoen < (case when extract(month from now() at time zone 'Europe/Brussels')>=7
      then extract(year from now() at time zone 'Europe/Brussels')::int
      else extract(year from now() at time zone 'Europe/Brussels')::int-1 end)::text
  ) s),'[]'::jsonb),
  'testbadges','[]'::jsonb
 );
end $$;
revoke all on function public.supporter_klassement_data() from public,anon;
grant execute on function public.supporter_klassement_data() to authenticated;

-- Supporteraccount beheren, met dezelfde admincontrole als bij leden.
create or replace function public.admin_supporter_account(p_id uuid,p_actie text) returns void
language plpgsql security definer set search_path=public as $$
declare s supporter_profiles;
begin
 if not coalesce(is_admin(),false) then raise exception 'Alleen admins mogen supporteraccounts beheren.';end if;
 perform pg_advisory_xact_lock(hashtextextended('steca-accountfunctie',0));
 select * into s from supporter_profiles where user_id=p_id for update;
 if not found then raise exception 'Supporter niet gevonden.';end if;
 if p_id=auth.uid() or exists(select 1 from members where user_id=p_id) then raise exception 'Dit is geen afzonderlijk supporteraccount.';end if;
 if p_actie not in ('deactiveren','activeren','verwijderen') or p_actie is null then raise exception 'Onbekende actie.';end if;
 insert into audit_log(tabel,rij_id,actie,oud,door,door_user) values('supporter_profiles',p_id::text,upper(p_actie),jsonb_build_object('naam',s.naam,'actief',s.actief),my_member_id(),auth.uid());
 if p_actie='verwijderen' then delete from auth.users where id=p_id;
 else update supporter_profiles set actief=(p_actie='activeren') where user_id=p_id;end if;
end $$;
revoke all on function admin_supporter_account(uuid,text) from public,anon;
grant execute on function admin_supporter_account(uuid,text) to authenticated;

create or replace function public.admin_supporter_profiel(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare d jsonb; s supporter_profiles;
begin
 if not coalesce(is_admin(),false) then raise exception 'Alleen admins.';end if;
 select * into s from supporter_profiles where user_id=p_id;
 d:=supporter_klassement_data();
 if not found then return d;end if;
 d:=jsonb_set(d,'{personen}',coalesce((select jsonb_agg(p) from jsonb_array_elements(d->'personen') p where p->>'id'<>p_id::text),'[]')||jsonb_build_array(jsonb_build_object('id',s.user_id,'user_id',s.user_id,'naam',s.naam,'actief',s.actief)));
 return jsonb_set(d,'{bezoeken}',coalesce((select jsonb_agg(jsonb_build_object('persoon',a.user_id,'match',a.match_key)) from supporter_attendance a join supporter_profiles sp on sp.user_id=a.user_id where a.status='aanwezig' and (sp.actief or sp.user_id=p_id)),'[]'));
end $$;
revoke all on function admin_supporter_profiel(uuid) from public,anon;
grant execute on function admin_supporter_profiel(uuid) to authenticated;
