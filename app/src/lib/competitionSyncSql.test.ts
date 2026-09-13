/// <reference types="node" />
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
it('dwingt adminrechten, uitsluitend servertoegang, exclusiviteit en vijf minuten af in PostgreSQL',async()=>{
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
   create table public.members(id uuid primary key,is_admin boolean,status text);
   insert into public.members values ('00000000-0000-0000-0000-000000000001',true,'actief'),
   ('00000000-0000-0000-0000-000000000002',false,'actief');`);
  const sql=readFileSync(new URL('../../../supabase/app_schema.sql',import.meta.url),'utf8').split('-- Handmatige competitie-update:')[1];
  await db.exec('-- Handmatige competitie-update:'+sql);
  await db.exec('-- Handmatige competitie-update:'+sql); // herhaalbare installatie
  await db.exec('set role authenticated');
  await expect(db.query(`select public.claim_competition_sync('00000000-0000-0000-0000-000000000001')`)).rejects.toThrow(/permission denied/);
  await expect(db.query('select * from public.scrape_control')).rejects.toThrow(/permission denied/);
  await db.exec('reset role; set role service_role');
  await expect(db.query(`select public.claim_competition_sync('00000000-0000-0000-0000-000000000002')`)).rejects.toThrow(/actieve admins/);
  await db.query(`select public.claim_competition_sync('00000000-0000-0000-0000-000000000001')`);
  await expect(db.query(`select public.claim_competition_sync('00000000-0000-0000-0000-000000000001')`)).rejects.toThrow(/al een update/);
  await db.exec(`reset role; update public.scrape_control set status='success'; set role service_role;`);
  await expect(db.query(`select public.claim_competition_sync('00000000-0000-0000-0000-000000000001')`)).rejects.toThrow(/vijf minuten/);
  await db.exec(`reset role; update public.scrape_control set requested_at=now()-interval '6 minutes'; set role service_role;`);
  await db.query(`select public.claim_competition_sync('00000000-0000-0000-0000-000000000001')`);
 } finally {await db.close();}
},30000);
