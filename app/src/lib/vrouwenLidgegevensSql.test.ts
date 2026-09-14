/// <reference types="node" />
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
it('toont contactgegevens alleen aan staf en de eigenaar, ook bij nog niet gekoppelde inschrijvingen',async()=>{
 const db=new PGlite();
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create function club_role(text) returns text language sql as $$select 'speler'::text$$;
 create function club_staf(text) returns boolean language sql as $$select current_setting('test.staf',true)='ja'$$;
 create table club_members(id uuid,club_id text,user_id uuid,naam text,status text);
 create table club_registration(club_id text,member_id uuid,email text);
 create table auth.users(id uuid,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb);
 create table members(id uuid,user_id uuid,telefoon text,geboortedatum date,adres text);
 create table supporter_profiles(user_id uuid,member_id uuid);
 insert into club_members values('00000000-0000-0000-0000-000000000001','vrouwen','00000000-0000-0000-0000-000000000002','Speelster','actief');
 insert into club_registration values('vrouwen','00000000-0000-0000-0000-000000000001','inschrijving@example.invalid');
 insert into auth.users values('00000000-0000-0000-0000-000000000002','account@example.invalid',now(),'{"telefoon":"123"}');`);
 const sql=readFileSync(new URL('../../../supabase/app_schema.sql',import.meta.url),'utf8').split('-- Afgeschermde contactgegevens van vrouwenleden.')[1].split('-- Einde afgeschermde contactgegevens.')[0];
 await db.exec(sql);await db.exec(sql);
 const query="select club_lidgegevens('vrouwen','00000000-0000-0000-0000-000000000001') d";
 await expect(db.query(query)).rejects.toThrow(/Geen toegang/);
 await db.exec("select set_config('test.uid','00000000-0000-0000-0000-000000000003',false)");
 await expect(db.query(query)).rejects.toThrow(/Alleen de speelster/);
 await db.exec("select set_config('test.uid','00000000-0000-0000-0000-000000000002',false)");
 expect((await db.query<{d:any}>(query)).rows[0].d).toMatchObject({email:'account@example.invalid',telefoon:'123',account_gekoppeld:true});
 await db.exec("update club_members set user_id=null;select set_config('test.staf','ja',false)");
 expect((await db.query<{d:any}>(query)).rows[0].d).toMatchObject({email:'inschrijving@example.invalid',account_gekoppeld:false});
 }finally{await db.close();}
},30000);
