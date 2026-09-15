/// <reference types="node" />
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
it('handelt de Belgische 22u-update eenmaal af, onafhankelijk van databasezone en zomeruur',async()=>{
 const db=new PGlite();
 try{
 const schema=readFileSync(new URL('../../../supabase/app_schema.sql',import.meta.url),'utf8');
 const expressions=[...schema.matchAll(/due:=due or (exists\(select 1 from generate_series[^;]+);/g)].map(m=>m[1]);
 expect(expressions).toHaveLength(2);
 for(const zone of ['UTC','Europe/Brussels']){
 await db.exec(`set time zone '${zone}'`);
 for(const expression of expressions){
 const check=async(lokaal:string,last:string)=> (await db.query<{due:boolean}>(`select ${expression} as due from (select $1::timestamp lokaal,$2::timestamptz laatste_succes) r`,[lokaal,last])).rows[0].due;
 expect(await check('2026-09-15 21:59','2026-09-14T20:00:00Z')).toBe(false);
 expect(await check('2026-09-15 22:00','2026-09-14T20:00:00Z')).toBe(true);
 expect(await check('2026-09-15 23:11','2026-09-15T21:10:00Z')).toBe(false);
 expect(await check('2026-09-16 21:59','2026-09-15T20:00:00Z')).toBe(false);
 expect(await check('2026-09-16 22:00','2026-09-15T20:00:00Z')).toBe(true);
 expect(await check('2026-12-15 22:01','2026-12-15T21:00:00Z')).toBe(false);
 expect(await check('2026-09-18 10:00','2026-09-16T20:00:00Z')).toBe(true);
 }
 }
 }finally{await db.close();}
},30000);
