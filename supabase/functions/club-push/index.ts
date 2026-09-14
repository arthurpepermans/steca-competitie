// Ploegmeldingen: uitsluitend voor ingeschakelde rollen bij Steca Vrouwen.
import {createClient} from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
const PROJECT='https://odgrmhcmkvbdadjhphiz.supabase.co',ORIGIN='https://stecajuniors.app';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const headers={'Access-Control-Allow-Origin':ORIGIN,'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Content-Type':'application/json','Cache-Control':'no-store'};
const json=(v:unknown,status=200)=>new Response(JSON.stringify(v),{status,headers});
function check(r:any){if(r.error)throw Error('Databasebewerking mislukt.');return r.data;}
function abonnement(s:any){const u=new URL(s?.endpoint??'');const hosts=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','wns.windows.com'];if(u.protocol!=='https:'||u.port||u.username||u.password||!hosts.some(h=>u.hostname===h||u.hostname.endsWith('.'+h))||s.endpoint.length>4096||!/^[-\w]{80,100}$/.test(s?.keys?.p256dh??'')||!/^[-\w]{20,30}$/.test(s?.keys?.auth??''))throw Error('Ongeldig pushabonnement.');return{endpoint:s.endpoint,keys:{p256dh:s.keys.p256dh,auth:s.keys.auth}};}
function tekst(p:any){const score=`${p.thuis_score}-${p.uit_score}`;switch(p.soort){case 'aanwezig72':return{title:'Steca Vrouwen · Speel je mee?',body:`Nog 72 uur tot de match tegen ${p.tegenstander}. Vul je aanwezigheid in.`};case 'aanwezig48':return{title:'Steca Vrouwen · Ben jij erbij?',body:`Nog 2 dagen tot de match tegen ${p.tegenstander}. Je aanwezigheid ontbreekt nog.`};case 'wasmand':return{title:'Steca Vrouwen · Wasmand',body:'De was is voor jou. Vergeet de mand niet mee te nemen!'};case 'stemherinnering':return{title:'Steca Vrouwen · Jouw stem telt',body:`Je hebt nog niet gestemd op de speelster van de match tegen ${p.tegenstander}.`};default:return{title:'Steca Vrouwen · Speelster van de match',body:`${score} tegen ${p.tegenstander}. Stem nu op jouw speelster van de match!`};}}
Deno.serve(async req=>{
 if(Deno.env.get('SUPABASE_URL')!==PROJECT)return json({error:'Verkeerd project.'},403);
 if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return json({error:'POST vereist.'},405);
 try{
 const text=await req.text();if(text.length>12000)return json({error:'Aanvraag te groot.'},400);const body=JSON.parse(text||'{}');
 const vapid=check(await db.from('push_config').select('vapid_public,vapid_private,cron_secret').eq('id',1).single());
 if(body.action==='twizzit'&&req.headers.get('x-club-cron')===vapid.cron_secret){const token=Deno.env.get('COMPETITION_GITHUB_TOKEN');if(!token)return json({error:'Updatekoppeling ontbreekt.'},503);const r=await fetch('https://api.github.com/repos/arthurpepermans/steca-competitie/actions/workflows/sync-vrouwen.yml/dispatches',{method:'POST',headers:{Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','Content-Type':'application/json'},body:JSON.stringify({ref:'main'})});if(!r.ok){await db.from('vrouwen_sync').update({fout:'Update starten mislukt.',afgerond:new Date().toISOString()}).eq('id',true);return json({error:'Update starten mislukt.'},502);}return json({ok:true});}
 const cron=body.action==='process'&&req.headers.get('x-club-cron')===vapid.cron_secret;
 if(!cron){
 const token=req.headers.get('authorization')?.replace(/^Bearer /i,'')??'';
 const {data:{user}}=await db.auth.getUser(token);if(!user)return json({error:'Log eerst in.'},401);
 const member=check(await db.from('club_members').select('id,functie,status,speelt,is_admin').eq('club_id','vrouwen').eq('user_id',user.id).maybeSingle());
 if(!member||member.status!=='actief'||member.functie==='supporter')return json({error:'Als supporter ontvang je geen spelersmeldingen van deze ploeg.'},403);

 if(body.action==='status'){const pref=check(await db.from('club_push_preferences').select('enabled').eq('club_id','vrouwen').eq('user_id',user.id).maybeSingle());return json({publicKey:vapid.vapid_public,enabled:pref?.enabled??false,testAllowed:true});}
 if(body.action==='subscribe'){
 const sub=abonnement(body.subscription);const existing=check(await db.from('club_push_subscriptions').select('user_id').eq('endpoint',sub.endpoint).maybeSingle());if(existing&&existing.user_id!==user.id)return json({error:'Dit toestel is aan een ander account gekoppeld.'},409);
 check(await db.from('club_push_subscriptions').upsert({user_id:user.id,endpoint:sub.endpoint,subscription:sub}));check(await db.from('club_push_preferences').upsert({club_id:'vrouwen',user_id:user.id,enabled:true}));return json({ok:true});}
 if(body.action==='unsubscribe'){check(await db.from('club_push_preferences').upsert({club_id:'vrouwen',user_id:user.id,enabled:false}));return json({ok:true});}
 return json({error:'Niet toegestaan.'},403);
 }
 const config=check(await db.from('club_push_config').select('*').eq('id',1).single());
 if(!config.enabled||!vapid.vapid_private)return json({error:'Vrouwenmeldingen staan nog uit.'},409);
 let verzonden=0;
 const rows=check(await db.rpc('club_push_planning'))??[];
 for(const p of rows){
 check(await db.from('club_push_jobs').upsert({club_id:p.club_id,match_key:p.match_key,user_id:p.user_id,soort:p.soort},{onConflict:'club_id,match_key,user_id,soort',ignoreDuplicates:true}));
 const job=check(await db.from('club_push_jobs').select('*').eq('club_id',p.club_id).eq('match_key',p.match_key).eq('user_id',p.user_id).eq('soort',p.soort).single());
 if(job.sent_at)continue;
 const claim=check(await db.rpc('club_claim_push',{p_id:job.id}));if(!claim)continue;
 const opnieuw=(check(await db.rpc('club_push_planning'))??[]).find((r:any)=>r.club_id===p.club_id&&r.match_key===p.match_key&&r.user_id===p.user_id&&r.soort===p.soort);if(!opnieuw)continue;
 const subs=check(await db.from('club_push_subscriptions').select('*').eq('user_id',p.user_id))??[];let gelukt=false;
 for(const sub of subs){try{const route=p.soort==='wasmand'?'/vrouwen/opstelling':p.soort.startsWith('aanwezig')?'/vrouwen':'/vrouwen/match/'+encodeURIComponent(p.match_key);await webpush.sendNotification(abonnement(sub.subscription),JSON.stringify({...tekst(opnieuw),club:'vrouwen',url:ORIGIN+'/#'+route,tag:job.id}),{vapidDetails:{subject:ORIGIN,publicKey:vapid.vapid_public,privateKey:vapid.vapid_private},TTL:3600,timeout:10000,topic:job.id.replaceAll('-','')});gelukt=true;}catch(e){if([404,410].includes((e as any)?.statusCode))check(await db.from('club_push_subscriptions').delete().eq('endpoint',sub.endpoint));}}
 if(gelukt){check(await db.from('club_push_jobs').update({sent_at:new Date().toISOString()}).eq('id',job.id));verzonden++;}
 }
 return json({verzonden});
 }catch(e){return json({error:(e as Error).message||'Meldingen verwerken mislukt.'},400);}
});
