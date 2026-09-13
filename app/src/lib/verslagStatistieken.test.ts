/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, beforeEach, it, expect } from 'vitest';
let db:PGlite;
const a='00000000-0000-0000-0000-000000000001',b='00000000-0000-0000-0000-000000000002';
const l='00000000-0000-0000-0000-000000000010';
beforeAll(async()=>{
 db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role;
 create table members(id uuid primary key,naam text,functie text);
 create table matches(match_key text primary key,thuis_id int,uit_id int,status text,thuis_score int,uit_score int);
 create table match_reports(match_key text primary key references matches on delete cascade,thuis_score int,uit_score int,momenten jsonb);
 create table lineups(id uuid primary key,match_key text unique references matches on delete cascade);
 create table lineup_players(lineup_id uuid references lineups on delete cascade,member_id uuid,positie text);
 create table match_stats(match_key text references matches on delete cascade,member_id uuid,gespeeld bool,goals int,assists int,geel int,rood int,primary key(match_key,member_id));`);
 const schema=readFileSync(new URL('../../../supabase/app_schema.sql',import.meta.url),'utf8');
 await db.exec('-- Statistieken uit verslag'+schema.split('-- Statistieken uit verslag')[1]);
},30000);
afterAll(async()=>await db.close());
beforeEach(async()=>{
 await db.exec(`truncate matches,members cascade;
 insert into members values('${a}','Speler A','speler'),('${b}','Speler B','speler');
 insert into matches values('m',152,99,'gepland',null,null);
 insert into lineups values('${l}','m');
 insert into lineup_players values('${l}','${a}','GK'),('${l}','${b}','BANK1');`);
});
async function report(events:unknown[],home=2,away=0){await db.query(`insert into match_reports values('m',$1,$2,$3) on conflict(match_key) do update set thuis_score=excluded.thuis_score,uit_score=excluded.uit_score,momenten=excluded.momenten`,[home,away,JSON.stringify(events)]);}
async function stats(){return (await db.query('select * from match_stats order by member_id')).rows as {member_id:string;gespeeld:boolean;goals:number;assists:number;geel:number;rood:number;clean_sheet:boolean}[];}
const goal={soort:'goal',kant:'thuis',speler:'Speler A',assist:'Speler B'};
it('telt een toekomstige opstelling niet en telt basis plus bank na de uitslag',async()=>{
 expect(await stats()).toEqual([]);await db.exec("update matches set status='gespeeld',thuis_score=1,uit_score=0 where match_key='m'");
 expect((await stats()).map(s=>[s.gespeeld,s.clean_sheet])).toEqual([[true,true],[true,true]]);
});
it('haalt goals, assists en kaarten uit het verslag en sluit tegenstanders uit',async()=>{
 await report([goal,goal,{soort:'geel',kant:'thuis',speler:'Speler B'}, {...goal,kant:'uit'}]);
 expect(await stats()).toMatchObject([{goals:2,assists:0,gespeeld:true},{goals:0,assists:2,geel:1,gespeeld:true}]);
});
it('vervangt de totalen bij een correctie en verwijdert de laatste gebeurtenis',async()=>{
 await report([goal,goal]);await report([goal],1,1);
 expect(await stats()).toMatchObject([{goals:1,clean_sheet:false},{assists:1,clean_sheet:false}]);
 await report([],0,0);expect(await stats()).toMatchObject([{goals:0},{assists:0}]);
});
it('blijft stabiel bij een andere spelersnaam dankzij de id',async()=>{
 await report([goal]);const moments=(await db.query<{momenten:unknown[]}>('select momenten from match_reports')).rows[0].momenten;
 await db.exec("update members set naam='Nieuwe naam' where naam='Speler A'");await report(moments);
 expect((await stats())[0].goals).toBe(1);
});
it('weigert onbekende spelers en rolt de wijziging volledig terug',async()=>{
 await report([goal]);await expect(report([{...goal,speler:'Bestaat niet'}])).rejects.toThrow(/Kies voor/);
 expect((await stats())[0].goals).toBe(1);
});
it('verwerkt opstellingswijzigingen en een verwijderde opstelling zonder stale gespeeld',async()=>{
 await report([goal]);await db.exec(`delete from lineup_players where member_id='${b}'`);
 expect((await stats())[1].gespeeld).toBe(false);
 await db.exec('delete from lineups');expect((await stats()).every(s=>!s.gespeeld)).toBe(true);
});
it('neemt voor uitwedstrijden alleen Steca-momenten en de juiste tegengoals',async()=>{
 await db.exec("update matches set thuis_id=99,uit_id=152");await report([{...goal,kant:'uit'},goal],0,1);
 expect((await stats())[0]).toMatchObject({goals:1,clean_sheet:true});
});
it('laat oude handmatige cijfers staan wanneer er geen verslag is',async()=>{
 await db.exec(`insert into match_stats(match_key,member_id,gespeeld,goals,assists,geel,rood) values('m','${a}',true,3,1,0,0);
 update matches set status='gespeeld',thuis_score=3,uit_score=1;`);
 expect((await stats())[0]).toMatchObject({goals:3,assists:1});
});
it('laat gewone accounts de serverberekening niet rechtstreeks oproepen',async()=>{
 await db.exec('set role authenticated');
 await expect(db.query("select synchroniseer_matchstatistieken('m')")).rejects.toThrow(/permission denied/);
 await db.exec('reset role');
});

it('twee geel wordt één rood, zonder dubbel rood, en een correctie trekt dat terug',async()=>{
 const geel={soort:'geel',kant:'thuis',speler:'Speler A'};
 await report([geel,geel]);expect((await stats())[0]).toMatchObject({geel:2,rood:1});
 await report([geel,geel,{...geel,soort:'rood'}]);expect((await stats())[0]).toMatchObject({geel:2,rood:1});
 await report([geel]);expect((await stats())[0]).toMatchObject({geel:1,rood:0});
});
