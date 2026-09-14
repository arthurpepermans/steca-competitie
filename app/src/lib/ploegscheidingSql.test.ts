/// <reference types="node" />
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {beforeAll,afterAll,beforeEach,it,expect} from 'vitest';
let db:PGlite;
const man='00000000-0000-0000-0000-000000000001',vrouw='00000000-0000-0000-0000-000000000002',beheer='00000000-0000-0000-0000-000000000003';
const lid='10000000-0000-0000-0000-000000000002';
beforeAll(async()=>{db=new PGlite();await db.exec(`
create role anon;create role authenticated;create role service_role;
create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}',email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create function public.mag_testbadges_beheren() returns boolean language sql as $$select auth.uid()='${beheer}'::uuid$$;
create table members(id uuid,user_id uuid,naam text,status text,is_admin boolean);
create function public.is_admin() returns boolean language sql security definer as $$select exists(select 1 from members where user_id=auth.uid() and status='actief' and is_admin)$$;
create table supporter_profiles(user_id uuid,naam text,actief boolean);
insert into auth.users(id) values('${man}'),('${vrouw}'),('${beheer}');
insert into members values('${man}','${man}','Mannenadmin','actief',true),('${beheer}','${beheer}','Gedeelde beheerder','actief',true);
insert into supporter_profiles values('${vrouw}','Speelster',true),('${beheer}','Vrouwenbeheer',true);
`);
const sql=readFileSync(new URL('../../../supabase/app_schema.sql',import.meta.url),'utf8').split('-- Ploegscheiding:')[1].split('-- Einde ploegscheiding.')[0];
await db.exec('-- Ploegscheiding:'+sql);
const registratie=readFileSync(new URL('../../../supabase/app_schema.sql',import.meta.url),'utf8').split('-- Ploegregistratie:')[1].split('-- Einde ploegregistratie.')[0];
await db.exec('-- Ploegregistratie:'+registratie);
const profiel=readFileSync(new URL('../../../supabase/app_schema.sql',import.meta.url),'utf8').split('-- Vrouwenprofielbeheer,')[1].split('-- Einde vrouwenprofielbeheer.')[0];
await db.exec('-- Vrouwenprofielbeheer,'+profiel);
const melding=readFileSync(new URL('../../../supabase/app_schema.sql',import.meta.url),'utf8').split('-- Ploegmeldingen:')[1].split('-- Einde ploegmeldingen.')[0];await db.exec('-- Ploegmeldingen:'+melding);
await db.exec(`insert into club_members(id,club_id,user_id,naam,functie,speelt,is_admin) values('${lid}','vrouwen','${vrouw}','Speelster','speler',true,false),('${beheer}','vrouwen','${beheer}','Beheer','verantwoordelijke',false,true);
insert into club_matches(club_id,match_key,seizoen,aftrap,thuis,uit) values('vrouwen','morgen','2026-2027',now()+interval '1 day','STECA VROUWEN','Andere'),('vrouwen','gisteren','2026-2027',now()-interval '1 day','Andere','STECA VROUWEN');`);
},30000);
afterAll(async()=>await db.close());
beforeEach(async()=>{await db.exec(`reset role;truncate club_attendance,club_lineups,club_dream,club_predictions,club_role_requests,club_push_jobs,club_push_preferences;select set_config('test.uid','${man}',false);set role authenticated;`);});
async function data(){return (await db.query<{d:any}>("select club_data('vrouwen') d")).rows[0].d;}

it('koppelt een ingeschreven speelster pas na e-mailbevestiging en houdt haar mail privé',async()=>{
 await expect(db.exec(`select club_import_members('[]')`)).rejects.toThrow(/permission denied/);
 await expect(db.exec(`select * from club_registration`)).rejects.toThrow(/permission denied/);
 await db.exec(`reset role;select club_import_members('[{"naam":"Ingeschreven Speelster","email":"inschrijving@example.invalid","functie":"speler"}]');
 insert into auth.users(id,email,raw_user_meta_data) values('20000000-0000-0000-0000-000000000001','inschrijving@example.invalid','{"club":"vrouwen","club_functie":"speler"}');`);
 expect((await db.query<{user_id:string|null}>(`select user_id from club_members where naam='Ingeschreven Speelster'`)).rows[0].user_id).toBeNull();
 await db.exec(`update auth.users set email_confirmed_at=now() where email='inschrijving@example.invalid';select set_config('test.uid','20000000-0000-0000-0000-000000000001',false);set role authenticated;`);
 expect(await data()).toMatchObject({rol:'speler',admin:false});
 expect(JSON.stringify(await data())).not.toContain('inschrijving@example.invalid');
 await db.exec(`reset role;delete from club_members where naam='Ingeschreven Speelster';delete from auth.users where email='inschrijving@example.invalid';`);
});
it('hergebruikt bestaande accounts en verandert mannenrechten of aangepaste vrouwenrollen niet',async()=>{
 await db.exec(`reset role;update auth.users set email='bestaand@example.invalid',email_confirmed_at=now() where id='${man}';
 select club_import_members('[{"naam":"Bestaande staf","email":"bestaand@example.invalid","functie":"verantwoordelijke"}]');`);
 expect((await db.query(`select functie,is_admin,speelt from club_members where user_id='${man}'`)).rows[0]).toMatchObject({functie:'verantwoordelijke',is_admin:false,speelt:false});
 await db.exec(`update club_members set functie='supporter' where user_id='${man}';select club_import_members('[{"naam":"Bestaande staf","email":"bestaand@example.invalid","functie":"verantwoordelijke"}]');`);
 expect((await db.query<{functie:string}>(`select functie from club_members where user_id='${man}'`)).rows[0].functie).toBe('supporter');
 expect((await db.query<{is_admin:boolean}>(`select is_admin from members where user_id='${man}'`)).rows[0].is_admin).toBe(true);
 await db.exec(`delete from club_members where user_id='${man}';update auth.users set email=null,email_confirmed_at=null where id='${man}';`);
});
it('een centrale admin beheert beide ploegen zonder aparte vrouwenrol',async()=>{
 expect(await data()).toMatchObject({rol:'supporter',admin:true,staf:true});
 await db.exec("reset role");
 expect((await db.query("select club_admin('onbekend') admin")).rows[0]).toEqual({admin:false});
});
it('een lokale adminvlag geeft geen centrale adminrechten',async()=>{
 await db.exec(`reset role;update club_members set is_admin=true where id='${lid}';select set_config('test.uid','${vrouw}',false);set role authenticated;`);
 expect(await data()).toMatchObject({admin:false});
 await db.exec(`reset role;update club_members set is_admin=false where id='${lid}';set role authenticated;`);
});
it('laat alleen vrouwenbeheerders de functie op een vrouwenprofiel aanpassen',async()=>{
 await db.exec(`select set_config('test.uid','${vrouw}',false)`);
 await expect(db.exec(`select club_wijzig_lid('vrouwen','${lid}','coach',false)`)).rejects.toThrow(/beheerder/);
 await db.exec(`select set_config('test.uid','${beheer}',false);select club_wijzig_lid('vrouwen','${lid}','supporter',true);`);
 expect((await data()).leden.find((l:any)=>l.id===lid)).toMatchObject({functie:'supporter',speelt:false});
 await expect(db.exec(`select club_wijzig_lid('vrouwen','${beheer}','supporter',false)`)).rejects.toThrow(/beheerdersrol/);
 await db.exec(`select club_wijzig_lid('vrouwen','${lid}','speler',true);`);
});
it('een supporterantwoord telt niet als speler',async()=>{await db.exec("select club_aanwezig('vrouwen','morgen','aanwezig')");expect((await data()).aanwezigheden[0].speler).toBe(false);await db.exec(`select set_config('test.uid','${vrouw}',false)`);await expect(db.exec(`select club_aanwezig('vrouwen','morgen','aanwezig','${man}')`)).rejects.toThrow(/bevoegdheid/);});
it('kan zichzelf niet via een rolverzoek promoveren',async()=>{await db.exec(`select set_config('test.uid','${vrouw}',false)`);await db.exec("select club_vraag_rol('vrouwen','verantwoordelijke')");expect(await data()).toMatchObject({rol:'speler',admin:false,staf:false});});
it('blokkeert directe tabelschrijfacties en helper-RPCs',async()=>{await expect(db.exec(`update club_members set is_admin=true`)).rejects.toThrow(/permission denied/);await expect(db.exec(`select club_import_matches('{}')`)).rejects.toThrow(/permission denied/);await expect(db.exec(`select club_naam('${vrouw}')`)).rejects.toThrow(/permission denied/);});
it('weigert een andere ploeg en anonieme toegang',async()=>{await expect(db.exec("select club_data('mannen')")).rejects.toThrow(/actief account/);await db.exec('reset role;set role anon');await expect(db.exec("select club_data('vrouwen')")).rejects.toThrow(/permission denied/);});
it('vereist aanwezigheid en speelstersrol bij de opstelling en beschermt tegen overschrijven',async()=>{
 await db.exec(`select set_config('test.uid','${beheer}',false)`);
 await expect(db.exec(`select club_bewaar_opstelling('vrouwen','morgen','{"GK":"${lid}"}','[]',0)`)).rejects.toThrow(/aanwezige/);
 await db.exec(`select club_aanwezig('vrouwen','morgen','aanwezig','${vrouw}');select club_bewaar_opstelling('vrouwen','morgen','{"GK":"${lid}"}','[]',0)`);
 await expect(db.exec(`select club_bewaar_opstelling('vrouwen','morgen','{}','[]',0)`)).rejects.toThrow(/ondertussen/);
 await expect(db.exec(`select club_bewaar_opstelling('vrouwen','morgen','{"GK":"${beheer}"}','[]',1)`)).rejects.toThrow(/aanwezige/);
 await expect(db.exec(`select club_bewaar_opstelling('vrouwen','morgen','{"GK":"${lid}","LB":"${lid}"}','[]',1)`)).rejects.toThrow(/dubbel/);
});
it('laat actieve speelsters de opstelling opslaan zonder stafrechten, maar geen supporters of inactieve leden',async()=>{
 await db.exec(`select set_config('test.uid','${vrouw}',false)`);
 expect(await data()).toMatchObject({staf:false,admin:false});
 await db.exec(`select club_bewaar_opstelling('vrouwen','morgen','{}','[]',0)`);
 await expect(db.exec(`select club_bewaar_opstelling('vrouwen','gisteren','{}','[]',0)`)).rejects.toThrow(/afgesloten/);
 await expect(db.exec(`select club_bewaar_opstelling('mannen','morgen','{}','[]',0)`)).rejects.toThrow(/opstellingsrechten/);
 await db.exec(`reset role;update club_members set functie='supporter',speelt=false where id='${lid}';set role authenticated;`);
 await expect(db.exec(`select club_bewaar_opstelling('vrouwen','morgen','{}','[]',1)`)).rejects.toThrow(/opstellingsrechten/);
 await db.exec(`reset role;update club_members set functie='speler',speelt=true,status='inactief' where id='${lid}';set role authenticated;`);
 await expect(db.exec(`select club_bewaar_opstelling('vrouwen','morgen','{}','[]',1)`)).rejects.toThrow(/opstellingsrechten/);
 await db.exec(`reset role;update club_members set status='actief' where id='${lid}';set role authenticated;`);
});
it('houdt droomploegen privé en laat supporters een droomploeg maken',async()=>{
 await db.exec(`select club_bewaar_dream('vrouwen','{"GK":"${lid}"}',0)`);expect((await data()).dream.keuze.GK).toBe(lid);
 await db.exec(`select set_config('test.uid','${vrouw}',false)`);expect((await data()).dream).toBeNull();
});
it('laat de staf een ingeschreven speelster zonder account aanwezig zetten en op de bank selecteren',async()=>{
 const reserve='30000000-0000-0000-0000-000000000001';
 await db.exec(`reset role;insert into club_members(id,club_id,naam,functie,speelt) values('${reserve}','vrouwen','Reserve zonder login','speler',true);set role authenticated;`);
 await db.exec(`select set_config('test.uid','${vrouw}',false)`);
 await expect(db.exec(`select club_aanwezig_lid('vrouwen','morgen','${reserve}','aanwezig')`)).rejects.toThrow(/staf/);
 await db.exec(`select set_config('test.uid','${beheer}',false);select club_aanwezig_lid('vrouwen','morgen','${reserve}','aanwezig');select club_bewaar_opstelling('vrouwen','morgen','{"BANK5":"${reserve}"}','[]',0);`);
 expect((await data()).aanwezigheden.find((a:any)=>a.member_id===reserve)).toMatchObject({naam:'Reserve zonder login',status:'aanwezig',speler:true});
 await db.exec(`select club_aanwezig_lid('vrouwen','morgen','${reserve}','afwezig');`);
 await expect(db.exec(`select club_bewaar_opstelling('vrouwen','morgen','{"BANK5":"${reserve}"}','[]',1)`)).rejects.toThrow(/aanwezige/);
 await db.exec(`reset role;delete from club_members where id='${reserve}';`);
});
it('verbergt andermans pronos voor de aftrap en sluit gespeelde matches af',async()=>{
 await db.exec("select club_bewaar_prono('vrouwen','morgen',2,1)");expect((await data()).pronos).toHaveLength(1);
 await db.exec(`select set_config('test.uid','${vrouw}',false)`);expect((await data()).pronos).toHaveLength(0);
 await expect(db.exec("select club_bewaar_prono('vrouwen','gisteren',2,1)")).rejects.toThrow(/afgesloten/);
});
it('supporters kunnen niet stemmen ook als zij aanwezig zijn',async()=>{
 await db.exec("select club_aanwezig('vrouwen','morgen','aanwezig')");
 await expect(db.exec(`select club_stem('vrouwen','morgen','${lid}','${beheer}','${man}')`)).rejects.toThrow(/speelsters/);
});
it('deactivering ontneemt de vrouwenrechten',async()=>{await db.exec(`reset role;update club_members set status='inactief' where id='${lid}';select set_config('test.uid','${vrouw}',false);set role authenticated;`);await expect(data()).rejects.toThrow(/actief account/);await db.exec(`reset role;update club_members set status='actief' where id='${lid}'`);});



it('plant geen vrouwenmelding voor een mannenspeler of zonder opt-in',async()=>{
 await db.exec(`reset role;update club_matches set aftrap=now()+interval '70 hours' where match_key='morgen';insert into club_push_preferences values('vrouwen','${man}',true);`);
 expect((await db.query('select * from club_push_planning()')).rows).toHaveLength(0);
 await db.exec(`insert into club_push_preferences values('vrouwen','${vrouw}',true)`);
 expect((await db.query('select * from club_push_planning()')).rows).toMatchObject([{user_id:vrouw,soort:'aanwezig72'}]);
});
it('wacht 80 minuten, verstuurt de eerste melding niet opnieuw bij scorewijziging en herinnert na 3 uur',async()=>{
 await db.exec(`reset role;insert into club_push_preferences values('vrouwen','${vrouw}',true);update club_matches set aftrap=now()-interval '79 minutes',thuis_score=1,uit_score=0,score_at=now()-interval '20 minutes' where match_key='morgen';insert into club_attendance values('vrouwen','morgen','${vrouw}','aanwezig');`);
 expect((await db.query('select * from club_push_planning()')).rows).toHaveLength(0);
 expect((await db.query("select * from club_push_planning(now()+interval '1 minute')")).rows).toMatchObject([{soort:'stemmen'}]);
 await db.exec(`insert into club_push_jobs(club_id,match_key,user_id,soort,sent_at) values('vrouwen','morgen','${vrouw}','stemmen',now());update club_matches set thuis_score=2 where match_key='morgen'`);
 expect((await db.query("select * from club_push_planning(now()+interval '2 hours')")).rows).toHaveLength(0);
 expect((await db.query("select * from club_push_planning(now()+interval '3 hours')")).rows).toMatchObject([{soort:'stemherinnering'}]);
});


it('maakt een ingeschreven speelster ook via mannenregistratie uitsluitend supporter bij de mannen',async()=>{
 const uid='80000000-0000-0000-0000-000000000001';
 await db.exec(`reset role;insert into club_registration values('vrouwen','speelster@example.invalid','${lid}');`);
 const schema=readFileSync(new URL('../../../supabase/app_schema.sql',import.meta.url),'utf8');
 await db.exec(schema.split('-- Ingeschreven speelsters blijven ook bij registratie via het mannenformulier supporter.')[1]);
 await db.exec(`create trigger test_nieuwe_user after insert on auth.users for each row execute function handle_new_user();insert into auth.users(id,email,raw_user_meta_data) values('${uid}','speelster@example.invalid','{"account_type":"club","functie":"speler","naam":"Speelster"}');`);
 expect((await db.query(`select naam from supporter_profiles where user_id='${uid}'`)).rows).toEqual([{naam:'Speelster'}]);
 expect((await db.query(`select * from members where user_id='${uid}'`)).rows).toEqual([]);
 await db.exec(`drop trigger test_nieuwe_user on auth.users;delete from supporter_profiles where user_id='${uid}';delete from auth.users where id='${uid}';delete from club_registration where email='speelster@example.invalid';`);
});
