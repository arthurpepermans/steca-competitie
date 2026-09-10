-- Migratie 2026-09-10: melding KUISVROUW voor de wasmand (100 minuten na de aftrap).
-- Vereist de migratie 2026-09-10_wasmand.sql (tabel laundry_turns). Veilig om te herhalen.
-- Daarna moet de Edge Function match-push (met _shared/meldingen.ts) opnieuw gepubliceerd worden.

alter table public.push_jobs drop constraint if exists push_jobs_soort_check;
alter table public.push_jobs add constraint push_jobs_soort_check check (soort in ('aanwezig72','aanwezig48','stemmen','stemherinnering','wasmand'));

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

-- Controle: moet true tonen.
select pg_get_functiondef('public.push_planning()'::regprocedure) like '%laundry_turns%' as wasmand_melding_aanwezig;
