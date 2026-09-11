/// <reference types="node" />
import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { BADGES } from './badgeCatalogus';
let db:PGlite;
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002',c='00000000-0000-0000-0000-000000000003',d='00000000-0000-0000-0000-000000000004';
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon; create role authenticated;
 create table members(id uuid primary key,functie text);
 create table matches(match_key text primary key,seizoen text,datum date,uur text,thuis_id int,uit_id int,status text,thuis_score int,uit_score int);
 create table match_stats(match_key text,member_id uuid,gespeeld bool,goals int,assists int,geel int,rood int);
 create table attendance(match_key text,member_id uuid,status text);
 create table match_votes(match_key text,voter_id uuid,eerste uuid,tweede uuid,derde uuid);
 create table laundry_turns(match_key text,member_id uuid);
 create function my_member_id() returns uuid language sql as $$select nullif(current_setting('test.lid',true),'')::uuid$$;
 create function is_actief() returns bool language sql as $$select my_member_id() is not null$$;`);
 const schema=readFileSync(new URL('../../../supabase/app_schema.sql',import.meta.url),'utf8');
 await db.exec(schema.slice(schema.indexOf('-- Automatische badges:')).split('-- Alleen test: handmatige')[0]);
},30000);
afterAll(async()=>{await db?.close();});
beforeEach(async()=>{
 await db.exec(`truncate badge_voorkeuren,members,matches,match_stats,attendance,match_votes,laundry_turns cascade; select set_config('test.lid','',false);`);
 for(const id of [a,b,c,d]) await db.query('insert into members values($1,$2)',[id,'speler']);
});
async function match(key:string,date='2020-09-01',season='2020-2021',tegen=1){await db.query(`insert into matches values($1,$2,$3,'15:00',152,999,'gespeeld',3,$4)`,[key,season,date,tegen]);}
async function stat(key:string,id=a,goals=0,assists=0,geel=0,rood=0,gespeeld=true){await db.query('insert into match_stats values($1,$2,$3,$4,$5,$6,$7)',[key,id,gespeeld,goals,assists,geel,rood]);}
async function badges(id=a){return (await db.query<{badge_id:string;seizoen:string|null;match_key:string|null}>('select * from bereken_badges() where member_id=$1',[id])).rows;}
async function ids(id=a){return (await badges(id)).map(r=>r.badge_id);}
describe('Automatische badges in PostgreSQL',()=>{
 it('geeft niemand een titel bij nul en telt geplande/vroege/vreemde matchen niet',async()=>{
 await match('nul'); await stat('nul',a,0,0,0,0,false);
 expect(await ids()).toEqual([]);
 await match('toekomst','2099-01-01');await stat('toekomst',a,100);
 await match('vreemd');await db.exec("update matches set thuis_id=123 where match_key='vreemd'");await stat('vreemd',a,100);
 await match('gepland');await db.exec("update matches set status='gepland' where match_key='gepland'");await stat('gepland',a,100);
 expect(await ids()).toEqual([]);
 });
 it('wacht echt tot 80 minuten na aftrap ondanks een vroeg ingevulde score',async()=>{
 await match('vroeg');await stat('vroeg',a,3);
 await db.exec("update matches set datum=((now() at time zone 'Europe/Brussels')-interval '79 minutes')::date,uur=to_char((now() at time zone 'Europe/Brussels')-interval '79 minutes','HH24:MI')");
 expect(await ids()).toEqual([]);
 await db.exec("update matches set datum=((now() at time zone 'Europe/Brussels')-interval '81 minutes')::date,uur=to_char((now() at time zone 'Europe/Brussels')-interval '81 minutes','HH24:MI')");
 expect(await ids()).toContain('gouden_stier');
 });
 it('houdt gedeelde leiders, verhuist een titel bij correctie en bewaart het vorige seizoen',async()=>{
 await match('oud','2019-09-01','2019-2020');await stat('oud',a,5);
 await match('nu');await stat('nu',a,2);await stat('nu',b,2);
 expect((await badges(b)).some(x=>x.badge_id==='gouden_stier'&&x.seizoen==='2020-2021')).toBe(true);
 await db.query("update match_stats set goals=3 where member_id=$1 and match_key='nu'",[b]);
 const r=await badges(); expect(r.filter(x=>x.badge_id==='gouden_stier').map(x=>x.seizoen)).toEqual(['2019-2020']);
 expect(await ids()).toContain('het_kanon');
 });
 it('rekent clean sheets alleen voor gespeelde spelers, ook bij uitmatchen',async()=>{
 await match('thuis','2020-09-01','2020-2021',0);await stat('thuis');await stat('thuis',b,0,0,0,0,false);
 await match('uit');await db.exec("update matches set thuis_id=999,uit_id=152,thuis_score=0 where match_key='uit'");await stat('uit');
 expect(await ids()).toContain('muur_van_dendermonde'); expect(await ids(b)).not.toContain('muur_van_dendermonde');
 });
 it('aanwezig zonder selectie telt, toekomstige aanwezigheden en wasbeurten niet',async()=>{
 await match('nu');await db.query("insert into attendance values('nu',$1,'aanwezig');",[a]);
 await match('later','2099-01-01');await db.query("insert into laundry_turns values('later',$1)",[a]);
 expect(await ids()).toContain('fundering');expect(await ids()).not.toContain('official_junior');expect(await ids()).not.toContain('kuisvrouw');
 });
 it('bewaart iedere hattrick en matchwinnaar apart en telt gedeelde stemwinnaars',async()=>{
 for(const key of ['een','twee']) {await match(key);await stat(key,a,3);await db.query('insert into match_votes values($1,$2,$3,$4,$5),($1,$5,$4,$3,$2)',[key,d,a,b,c]);}
 const r=await badges();expect(r.filter(x=>x.badge_id==='hattrick')).toHaveLength(2);expect(r.filter(x=>x.badge_id==='junior_van_de_match')).toHaveLength(2);
 expect(await ids(b)).toContain('star_boy');expect(await ids()).toContain('junior_dor');expect(await ids()).toContain('goat');
 });
 it('negeert eigen stembriefjes en geeft supporters geen badges',async()=>{
 await match('m');await db.query("insert into match_votes values('m',$1,$1,$2,$3)",[a,b,c]);
 expect(await ids()).not.toContain('goat');await stat('m',a,100);await db.query("update members set functie='supporter' where id=$1",[a]);expect(await ids()).toEqual([]);
 });
 it('getikte zot gebruikt alleen gespeelde matchen: afwezigheid breekt de reeks niet, kaartloze match wel',async()=>{
 for(let i=0;i<7;i++)await match('m'+i,`2020-09-0${i+1}`);
 await stat('m0',a,0,0,1);await stat('m6',a,0,0,0,1);
 expect(await ids()).toContain('getikte_zot');await stat('m3');expect(await ids()).not.toContain('getikte_zot');
 });
 it('controleert echte opeenvolgende clubmatchen bij aanwezigheids- en speelreeksen',async()=>{
 for(let i=0;i<10;i++){const key='m'+i;await match(key,`2020-09-${String(i+1).padStart(2,'0')}`);await stat(key);await db.query('insert into attendance values($1,$2,$3)',[key,a,'aanwezig']);}
 expect(await ids()).toEqual(expect.arrayContaining(['vijf_op_een_rij','rots_in_de_branding']));
 await db.exec("delete from attendance where match_key='m5'; delete from match_stats where match_key in('m3','m7')");
 expect(await ids()).not.toContain('rots_in_de_branding');expect(await ids()).not.toContain('vijf_op_een_rij');
 });
 it('kent alle 40 badges toe wanneer alle voorwaarden behaald zijn, zonder duplicaten',async()=>{
 for(let i=0;i<100;i++){const key='m'+i;const date=new Date(Date.UTC(2020,0,i+1)).toISOString().slice(0,10);await match(key,date,'2019-2020',0);await stat(key,a,i===0?3:1,1,1,1);await db.query('insert into attendance values($1,$2,$3)',[key,a,'aanwezig']);}
 await db.query("insert into laundry_turns values('m0',$1)",[a]);await db.query("insert into match_votes values('m0',$1,$2,$3,$4)",[d,a,b,c]);
 const r=await ids();expect(new Set(r)).toEqual(new Set(BADGES.map(x=>x.id)));expect(r.length).toBe(40);
 });
 it('publieke lezers kunnen badges bekijken maar geen toewijzingen of voorkeuren schrijven',async()=>{
 await match('m');await stat('m',a,2);
 await db.exec('set role anon');
 expect((await db.query('select * from badges_met_volgorde')).rows.length).toBeGreaterThan(0);
 await expect(db.query('select * from match_votes')).rejects.toThrow('permission denied');
 await expect(db.query("insert into badge_voorkeuren values($1,'{}')",[a])).rejects.toThrow('permission denied');
 await db.exec('reset role');
 });
 it('laat uitsluitend de eigenaar zijn verdiende badges rangschikken',async()=>{
 await match('m');await stat('m',a,1);
 await expect(db.query("select bewaar_badgevolgorde(array['gouden_stier'])")).rejects.toThrow('Log in');
 await db.query("select set_config('test.lid',$1,false)",[a]);
 await db.query("select bewaar_badgevolgorde(array['gouden_stier','eentje_is_geentje'])");
 await expect(db.query("select bewaar_badgevolgorde(array['goat'])")).rejects.toThrow('eigen badges');
 await expect(db.query("select bewaar_badgevolgorde(array['gouden_stier','gouden_stier'])")).rejects.toThrow('een keer');
 expect((await db.query('select * from badge_voorkeuren')).rows).toHaveLength(1);
 });
});
