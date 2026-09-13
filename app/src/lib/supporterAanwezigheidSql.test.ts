/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
let db: PGlite;
const supporter='00000000-0000-0000-0000-000000000001', ander='00000000-0000-0000-0000-000000000002', speler='00000000-0000-0000-0000-000000000003';
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table members(id uuid primary key,user_id uuid,naam text,status text,speelt bool);
 create table supporter_profiles(user_id uuid primary key,naam text,actief bool);
 create table matches(match_key text primary key,thuis_id int,uit_id int,status text,datum date,uur text);
 create function my_member_id() returns uuid language sql security definer as $$select id from members where user_id=auth.uid()$$;
 create function is_actief() returns bool language sql security definer as $$select exists(select 1 from members where user_id=auth.uid() and status='actief')$$;
 create function match_aftrap(date,text) returns timestamptz language sql as $$select ($1+$2::time) at time zone 'Europe/Brussels'$$;
 create table attendance(match_key text,member_id uuid,status text);
 create table lineups(id uuid primary key,match_key text);
 create table lineup_players(lineup_id uuid,member_id uuid);
 create table match_reports(match_key text);
 create table match_votes(match_key text,eerste uuid,tweede uuid,derde uuid);
 create table match_stats(id int);create table fines(id int);create table laundry_turns(id int);create table ticker_messages(id int);
 alter table attendance enable row level security;grant select,insert on attendance to authenticated;
 create policy speler_zetten on attendance for insert to authenticated with check(is_actief() and member_id=my_member_id());
 grant select on supporter_profiles to authenticated;
 alter table supporter_profiles enable row level security;
 create policy eigen on supporter_profiles for select to authenticated using(user_id=auth.uid());
 insert into supporter_profiles values('${supporter}','Supporter A',true),('${ander}','Supporter B',true);
 insert into members values('${speler}','${speler}','Speler','actief',true);
 insert into matches values('komend',152,99,'gepland',current_date+7,'15:00'),('voorbij',152,99,'gespeeld',current_date-1,'15:00'),('ander',98,99,'gepland',current_date+7,'15:00');`);
 const schema=readFileSync(new URL('../../../supabase/app_schema.sql',import.meta.url),'utf8');
 await db.exec('-- Supporteraanwezigheid:'+schema.split('-- Supporteraanwezigheid:')[1]);
 const stem=schema.slice(schema.lastIndexOf('create or replace function stem_geldig(')).split('$$;')[0]+'$$;';
 await db.exec(stem);
 const selectie=schema.split('create or replace function lineup_players_check()')[1].split('end $$;')[0];
 await db.exec('create or replace function lineup_players_check()'+selectie+'end $$;');
 await db.exec('create trigger controle before insert on lineup_players for each row execute function lineup_players_check();');
},30000);
afterAll(async()=>await db.close());
beforeEach(async()=>{await db.exec(`reset role;truncate supporter_attendance;update supporter_profiles set actief=true;select set_config('test.uid','${supporter}',false);set role authenticated;`);});
it('bewaart alleen het eigen supporterantwoord en wijzigt dat zonder spelersrij',async()=>{
 await db.exec("select zet_supporter_aanwezigheid('komend','aanwezig');select zet_supporter_aanwezigheid('komend','onzeker');");
 expect((await db.query('select * from supporter_aanwezigheden()')).rows).toEqual([{match_key:'komend',user_id:supporter,naam:'Supporter A',status:'onzeker'}]);
 expect((await db.query('select * from attendance')).rows).toEqual([]);
});
it('weigert rechtstreeks schrijven en kan geen speler-aanwezigheid zetten',async()=>{
 await expect(db.exec(`insert into supporter_attendance values('komend','${ander}','aanwezig',now())`)).rejects.toThrow(/permission denied/);
 await expect(db.exec(`insert into attendance values('komend','${speler}','aanwezig')`)).rejects.toThrow(/row-level security/);
});
it('weigert gespeelde matches, andere ploegen en ongeldige status',async()=>{
 for(const match of ['voorbij','ander','onbekend']) await expect(db.query('select zet_supporter_aanwezigheid($1,$2)',[match,'aanwezig'])).rejects.toThrow(/komende match/);
 await expect(db.exec("select zet_supporter_aanwezigheid('komend','misschien')")).rejects.toThrow(/Ongeldige/);
});
it('clubleden zien supporters maar kunnen niet als supporter antwoorden',async()=>{
 await db.exec("select zet_supporter_aanwezigheid('komend','aanwezig')");
 await db.exec(`select set_config('test.uid','${speler}',false)`);
 expect((await db.query('select * from supporter_aanwezigheden()')).rows).toHaveLength(1);
 await expect(db.exec("select zet_supporter_aanwezigheid('komend','aanwezig')")).rejects.toThrow(/supporteraccount/);
});
it('deactivering sluit lezen en schrijven af',async()=>{
 await db.exec("select zet_supporter_aanwezigheid('komend','aanwezig');reset role;update supporter_profiles set actief=false;set role authenticated;");
 expect((await db.query('select * from supporter_aanwezigheden()')).rows).toEqual([]);
 await expect(db.exec("select zet_supporter_aanwezigheid('komend','aanwezig')")).rejects.toThrow(/supporteraccount/);
});
it('supporteraanwezigheid geeft geen stemrecht en geen selectie',async()=>{
 await db.exec("select zet_supporter_aanwezigheid('komend','aanwezig')");
 expect((await db.query<{geldig:boolean}>(`select stem_geldig('voorbij','${speler}','${ander}','${supporter}') as geldig`)).rows[0].geldig).toBe(false);
 await db.exec('reset role');
 await expect(db.exec(`insert into lineup_players values(null,'${supporter}')`)).rejects.toThrow(/actieve leden/);
});
it('bezoekers zonder account kunnen geen supporterantwoorden lezen of plaatsen',async()=>{
 await db.exec("reset role;set role anon;");
 await expect(db.exec('select * from supporter_aanwezigheden()')).rejects.toThrow(/permission denied/);
 await expect(db.exec("select zet_supporter_aanwezigheid('komend','aanwezig')")).rejects.toThrow(/permission denied/);
});

it('toont uploadernamen van spelers en supporters zonder contactgegevens',async()=>{
 const result=await db.query('select * from sfeerbeeld_uploaders($1)',[[speler,supporter,ander]]);
 expect(result.rows).toEqual(expect.arrayContaining([{user_id:speler,naam:'Speler'},{user_id:supporter,naam:'Supporter A'},{user_id:ander,naam:'Supporter B'}]));
 expect(result.rows).toHaveLength(3);
 await db.exec("reset role;update supporter_profiles set actief=false;set role authenticated;");
 expect((await db.query('select * from sfeerbeeld_uploaders($1)',[[speler]])).rows).toEqual([]);
 await db.exec('reset role;set role anon');
 await expect(db.query('select * from sfeerbeeld_uploaders($1)',[[speler]])).rejects.toThrow(/permission denied/);
});
