begin;
insert into auth.users(id,email,raw_user_meta_data) values
('00000000-bbbb-4000-8000-000000000001','qa-omzet-admin@example.invalid','{"voornaam":"QA","achternaam":"Beheerder"}'),
('00000000-bbbb-4000-8000-000000000002','qa-omzet-supporter@example.invalid','{"account_type":"supporter","naam":"QA Supporter","voornaam":"QA","achternaam":"Supporter"}');
update members set status='actief',is_admin=true where user_id='00000000-bbbb-4000-8000-000000000001';
insert into dream_xi(user_id,formatie) values('00000000-bbbb-4000-8000-000000000002','4-3-3');
select set_config('request.jwt.claim.sub','00000000-bbbb-4000-8000-000000000002',true);
do $$ begin
 begin perform admin_accountfunctie('00000000-bbbb-4000-8000-000000000002','verantwoordelijke');raise exception 'TEST: niet-admin toegelaten';
 exception when others then if SQLERRM not like 'Alleen een beheerder%' then raise; end if;end;
end $$;
select set_config('request.jwt.claim.sub','00000000-bbbb-4000-8000-000000000001',true);
do $$ declare mid uuid; mid2 uuid; sid uuid; h uuid; begin
 perform * from admin_supporters();
 mid:=admin_accountfunctie('00000000-bbbb-4000-8000-000000000002','verantwoordelijke');
 if not exists(select 1 from members where id=mid and functie='verantwoordelijke' and status='actief' and speelt and not is_admin) then raise exception 'Promotie mislukt';end if;
 if exists(select 1 from supporter_profiles where user_id='00000000-bbbb-4000-8000-000000000002') then raise exception 'Dubbel profiel';end if;
 sid:=admin_accountfunctie(mid,'supporter');
 if not exists(select 1 from supporter_profiles where user_id=sid and member_id=mid) then raise exception 'Supporter ontbreekt';end if;
 if exists(select 1 from members where id=mid and (user_id is not null or status='actief' or speelt or is_admin)) then raise exception 'Clubtoegang behouden';end if;
 if (select count(*) from admin_supporters() where id=sid)<>1 then raise exception 'Dubbele lijst';end if;
 mid2:=admin_accountfunctie(sid,'speler');
 if mid2<>mid then raise exception 'Historiek niet hergebruikt';end if;
 if not exists(select 1 from dream_xi where user_id=sid) then raise exception 'Dream gewist';end if;
 select id into h from members where is_hoofdadmin limit 1;
 if h is not null then begin perform admin_accountfunctie(h,'supporter');raise exception 'TEST: hoofdadmin omgezet';exception when others then if SQLERRM not like 'De hoofdadmin kan geen%' then raise;end if;end;end if;
 insert into members(voornaam,achternaam,naam,email,functie,status,bron) values('QA','Zonder account','QA Zonder account','qa-geen@example.invalid','coach','actief','admin') returning id into mid;
 perform admin_accountfunctie(mid,'supporter');
 if not exists(select 1 from admin_supporters() where id=mid and not heeft_account) then raise exception 'Zonder account onvindbaar';end if;
 perform admin_accountfunctie(mid,'coach');
end $$;
rollback;
select 'OK: rechten, beide richtingen, historiek, Dream XI, hoofdadmin en zonder account' as controle;