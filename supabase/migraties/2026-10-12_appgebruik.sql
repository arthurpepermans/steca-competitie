-- Appgebruik voor Steca Juniors. Na app_schema.sql uitvoeren. Herhaalbaar.
begin;
create table if not exists public.app_usage_meta (
  id boolean primary key default true check (id), gestart timestamptz not null default now()
);
insert into public.app_usage_meta(id) values(true) on conflict do nothing;
create table if not exists public.app_usage_visits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bezoek uuid not null,
  sessie uuid not null,
  pagina text not null,
  gestart timestamptz not null default now(),
  laatst timestamptz not null default now(),
  seconden integer not null default 0 check (seconden between 0 and 86400),
  primary key(user_id, bezoek)
);
create index if not exists app_usage_visits_gestart on public.app_usage_visits(gestart);
create table if not exists public.app_usage_actions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  actie text not null, op timestamptz not null default now()
);
create index if not exists app_usage_actions_op on public.app_usage_actions(op);
alter table public.app_usage_actions enable row level security;
alter table public.app_usage_visits enable row level security;
alter table public.app_usage_meta enable row level security;
-- Geen directe tabeltoegang, ook niet voor gewone beheerders. Alleen gecontroleerde RPC's.
revoke all on public.app_usage_visits, public.app_usage_meta from public, anon, authenticated;
revoke all on public.app_usage_actions from public, anon, authenticated;

-- Meet alleen geslaagde wijzigingen; geen inhoud, match-ID of gekozen spelers opslaan.
create or replace function public.appgebruik_actie_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and (tg_op='INSERT' or to_jsonb(new) is distinct from to_jsonb(old))
    and exists(select 1 from public.members where user_id=auth.uid() and status='actief') then
    insert into public.app_usage_actions(user_id,actie) values(auth.uid(),tg_argv[0]);
  end if;
  return new;
end $$;
revoke all on function public.appgebruik_actie_trigger() from public,anon,authenticated;
drop trigger if exists appgebruik_aanwezigheid on public.attendance;
create trigger appgebruik_aanwezigheid after insert or update on public.attendance
for each row execute function public.appgebruik_actie_trigger('aanwezigheid');
drop trigger if exists appgebruik_stem on public.match_votes;
create trigger appgebruik_stem after insert or update on public.match_votes
for each row execute function public.appgebruik_actie_trigger('stem');
drop trigger if exists appgebruik_opstelling on public.lineups;
create trigger appgebruik_opstelling after insert or update on public.lineups
for each row execute function public.appgebruik_actie_trigger('opstelling');

create or replace function public.registreer_appgebruik(p_bezoek uuid, p_sessie uuid, p_pagina text, p_seconden integer)
returns void language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_rij public.app_usage_visits;
begin
  if v_user is null or not (
    exists(select 1 from public.members where user_id=v_user and status='actief') or
    exists(select 1 from public.supporter_profiles where user_id=v_user and actief)
  ) then raise exception 'Een actief clubaccount is vereist.' using errcode='42501'; end if;
  if p_bezoek is null or p_sessie is null or p_seconden is null or p_seconden not between 0 and 86400
    or p_pagina is null or p_pagina not in (
      '/', '/kalender','/klassement','/opstelling','/kantine','/leden','/leden/:id',
      '/profiel','/ploegen','/ploegen/:id','/match/:key','/meldingen','/drive',
      '/supporter-klassement','/supporter-profiel/:id'
    ) then raise exception 'Ongeldige gebruiksmeting.'; end if;
  -- Serialiseer per gebruiker: ook gelijktijdige verzoeken respecteren de bovengrens.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text, 712));
  select * into v_rij from public.app_usage_visits where user_id=v_user and bezoek=p_bezoek;
  if found then
    if v_rij.pagina <> p_pagina or v_rij.sessie <> p_sessie then raise exception 'Bezoek is al geregistreerd.'; end if;
    if v_rij.gestart < now()-interval '90 days' then return; end if;
    update public.app_usage_visits set
      seconden=greatest(seconden, least(p_seconden, floor(extract(epoch from (now()-gestart)))::integer+15)),
      laatst=greatest(laatst, case when p_seconden>seconden then now() else laatst end)
      where user_id=v_user and bezoek=p_bezoek;
  else
    if (select count(*) from public.app_usage_visits where user_id=v_user and gestart>now()-interval '1 hour') >= 600
      then raise exception 'Te veel gebruiksmetingen.'; end if;
    insert into public.app_usage_visits(user_id,bezoek,sessie,pagina,seconden)
      values(v_user,p_bezoek,p_sessie,p_pagina,least(p_seconden,15));
  end if;
end $$;
revoke all on function public.registreer_appgebruik(uuid,uuid,text,integer) from public,anon;
grant execute on function public.registreer_appgebruik(uuid,uuid,text,integer) to authenticated;

create or replace function public.appgebruik_rapport(p_van date, p_tot date, p_eigen boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not exists(select 1 from public.members where user_id=auth.uid() and status='actief' and is_hoofdadmin)
    then raise exception 'Alleen de hoofdadmin kan appgebruik bekijken.' using errcode='42501'; end if;
  if p_van is null or p_tot is null or p_eigen is null or p_tot<p_van or p_tot-p_van>=90
    then raise exception 'Kies een periode van maximaal 90 dagen.'; end if;
  with visits as materialized (
    select * from public.app_usage_visits
    where gestart >= p_van::timestamp at time zone 'Europe/Brussels'
      and gestart < (p_tot+1)::timestamp at time zone 'Europe/Brussels'
      and gestart >= now()-interval '90 days'
      and (p_eigen or user_id<>auth.uid())
  ), actions as (
    select actie,count(*) aantal,count(distinct user_id) gebruikers from public.app_usage_actions
    where op >= p_van::timestamp at time zone 'Europe/Brussels'
      and op < (p_tot+1)::timestamp at time zone 'Europe/Brussels'
      and op >= now()-interval '90 days' and (p_eigen or user_id<>auth.uid()) group by actie
  ), accounts as (
    select user_id, naam, functie from public.members where user_id is not null
    union all
    select s.user_id, s.naam, 'supporter' from public.supporter_profiles s
    where not exists(select 1 from public.members m where m.user_id=s.user_id)
  ), users as (
    select a.user_id,a.naam,a.functie,count(distinct v.sessie) bezoeken,count(v.bezoek) paginaweergaven,
      coalesce(sum(v.seconden),0) seconden,max(v.laatst) laatst
    from accounts a left join visits v using(user_id)
    where p_eigen or a.user_id<>auth.uid()
    group by a.user_id,a.naam,a.functie
  ), pages as (
    select pagina,count(distinct user_id) gebruikers,count(distinct (user_id,sessie)) bezoeken,
      count(*) paginaweergaven,coalesce(sum(seconden),0) seconden
    from visits group by pagina
  ), days as (
    select d::date dag,count(distinct v.user_id) gebruikers,count(distinct (v.user_id,v.sessie)) filter(where v.bezoek is not null) bezoeken,
      count(v.bezoek) paginaweergaven,coalesce(sum(v.seconden),0) seconden
    from generate_series(p_van::timestamp,p_tot::timestamp,interval '1 day') d
    left join visits v on (v.gestart at time zone 'Europe/Brussels')::date=d::date group by d
  ) select jsonb_build_object(
    'gestart',(select gestart from public.app_usage_meta where id),
    'acties',coalesce((select jsonb_agg(to_jsonb(a) order by a.aantal desc) from actions a),'[]'::jsonb),
    'overzicht', (select jsonb_build_object('gebruikers',count(distinct user_id),
      'bezoeken',count(distinct (user_id,sessie)), 'paginaweergaven',count(*),'seconden',coalesce(sum(seconden),0)) from visits),
    'gebruikers',coalesce((select jsonb_agg(to_jsonb(u) order by u.bezoeken desc,u.naam) from users u),'[]'::jsonb),
    'paginas',coalesce((select jsonb_agg(to_jsonb(p) order by p.seconden desc,p.pagina) from pages p),'[]'::jsonb),
    'dagen',coalesce((select jsonb_agg(to_jsonb(d) order by d.dag) from days d),'[]'::jsonb)
  ) into v_result;
  return v_result;
end $$;
revoke all on function public.appgebruik_rapport(date,date,boolean) from public,anon;
grant execute on function public.appgebruik_rapport(date,date,boolean) to authenticated;

-- Dagelijks aangeroepen door Supabase Cron.
create or replace function public.appgebruik_opschonen()
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_aantal bigint; v_acties bigint;
begin
  delete from public.app_usage_visits where gestart < now()-interval '90 days';
  get diagnostics v_aantal = row_count;
  delete from public.app_usage_actions where op < now()-interval '90 days';
  get diagnostics v_acties = row_count;
  return v_aantal+v_acties;
end $$;
revoke all on function public.appgebruik_opschonen() from public,anon,authenticated;
grant execute on function public.appgebruik_opschonen() to service_role;
-- pg_cron is reeds actief op het Steca-project. In lokale tests bestaat het niet.
do $$ begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    perform cron.schedule('steca-appgebruik-retentie','17 3 * * *','select public.appgebruik_opschonen()');
  end if;
end $$;
commit;
