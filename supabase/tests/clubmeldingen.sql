-- Integratietest binnen een teruggedraaide transactie. Geen blijvende gegevens.
begin;
do $test$
declare u uuid:=gen_random_uuid(); lid uuid; key text:='controle-'||gen_random_uuid(); versie timestamptz; eerste timestamptz; job uuid; nieuw text; geweigerd boolean:=false;
begin
 if has_table_privilege('authenticated','public.push_config','select') or has_table_privilege('anon','public.push_subscriptions','select') or has_function_privilege('authenticated','public.push_planning()','execute') then raise exception 'Pushgegevens niet afgeschermd'; end if;
 if match_aftrap('2026-10-25','15:00')<>'2026-10-25 14:00:00+00'::timestamptz or match_aftrap('2026-09-12','15:00')<>'2026-09-12 13:00:00+00'::timestamptz then raise exception 'Tijdzone onjuist'; end if;
 insert into auth.users(id,email,raw_user_meta_data) values(u,'controle-'||u||'@example.invalid','{"voornaam":"Tijdelijke","achternaam":"Controle","functie":"speler"}');
 select id into lid from members where user_id=u;
 update members set status='actief' where id=lid;
 insert into matches(match_key,seizoen,reeks,datum,uur,thuis_id,uit_id,thuis,uit,status,fetched_at,bron) values(key,'2026-2027','TEST',current_date,'15:00',152,9901,'Steca Juniors','Controleploeg','gepland',now(),'test');
 perform set_config('request.jwt.claim.sub',u::text,true);
 begin perform bewaar_matchverslag(key,2,1,'[]',null); exception when others then geweigerd:=true; end;
 if not geweigerd then raise exception 'Speler kon verslag schrijven'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 update members set is_admin=true where id=lid;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform bewaar_matchverslag(key,2,1,'[{"minuut":18,"soort":"goal","kant":"thuis","speler":"Testspeler","assist":"Andere speler"}]',null);
 select updated_at,score_at into versie,eerste from match_reports where match_key=key;
 geweigerd:=false;
 begin perform bewaar_matchverslag(key,3,1,'[]',null); exception when others then geweigerd:=true; end;
 if not geweigerd then raise exception 'Verouderde versie kon overschrijven'; end if;
 perform bewaar_matchverslag(key,3,1,'[]',versie);
 if (select score_at from match_reports where match_key=key) is distinct from eerste then raise exception 'Scorecorrectie verschuift stemmelding'; end if;
 if (select thuis_score from matches where match_key=key) is not null then raise exception 'Officiële uitslag overschreven'; end if;
 perform set_config('request.jwt.claim.sub','',true);
 update push_config set enabled=true where id=1;
 insert into push_jobs(match_key,member_id,soort) values(key,lid,'stemmen') returning id into job;
 if not claim_push_job(job) or claim_push_job(job) then raise exception 'Job kon tegelijk dubbel geclaimd worden'; end if;
 insert into push_subscriptions(endpoint,member_id,subscription) values('https://controle.invalid/'||u,lid,'{}');
 if not exists(select 1 from jsonb_array_elements(push_planning()) x where x->>'member_id'=lid::text and x->>'match_key'=key and x->>'thuis_score'='3' and x->>'uit_score'='1' and x->>'steca_thuis'='true') then raise exception 'Planning mist uitslag'; end if;
 delete from push_subscriptions where member_id=lid;
 if exists(select 1 from jsonb_array_elements(push_planning()) x where x->>'member_id'=lid::text) then raise exception 'Planning voor lid zonder abonnement'; end if;
end $test$;
rollback;
select 'GESLAAGD: rechten, Belgische tijdzone, opslaan, conflictcontrole en ongewijzigd eerste scoremoment' as resultaat;
