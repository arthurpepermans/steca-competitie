import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { bericht, verschuldigd, CLUB_ORIGIN, CLUB_PROJECT, type Soort, type Uitslag } from '../_shared/meldingen.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const cors = { 'Access-Control-Allow-Origin': CLUB_ORIGIN, 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Cache-Control': 'no-store' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
class Fout extends Error { constructor(message: string, public status = 400) { super(message); } }
function check<T>(r: { data: T; error: unknown }): T { if (r.error) throw new Fout('Databasebewerking mislukt. Probeer opnieuw.',503); return r.data; }
function abonnement(s: any) {
  const u = new URL(s?.endpoint ?? '');
  const toegestaan = ['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com','wns.windows.com'];
  if (u.protocol !== 'https:' || u.port || u.username || u.password || !toegestaan.some(h => u.hostname === h || u.hostname.endsWith('.' + h)) || s.endpoint.length > 4096 || !/^[\w-]{80,100}$/.test(s?.keys?.p256dh ?? '') || !/^[\w-]{20,30}$/.test(s?.keys?.auth ?? '')) throw new Fout('Ongeldig pushabonnement.');
  return { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth } };
}
type Planning = Uitslag & { match_key: string; member_id: string; tegenstander: string; aftrap: string | null; score_at: string | null; deadline: string; antwoord: boolean; aanwezig: boolean; gestemd: boolean; eerste_verzonden: string | null; wasmand?: boolean };
function soorten(p: Planning) { return verschuldigd({ aftrap: p.aftrap ? Date.parse(p.aftrap) : NaN, scoreAt: p.score_at ? Date.parse(p.score_at) : null, deadline: Date.parse(p.deadline), antwoord:p.antwoord, aanwezig:p.aanwezig, gestemd:p.gestemd, wasmand:Boolean(p.wasmand), eersteVerzonden:p.eerste_verzonden ? Date.parse(p.eerste_verzonden) : null }, Date.now()); }
async function planning(): Promise<Planning[]> { return check(await db.rpc('push_planning')); }
async function verzendRij(config: any) {
  if (!config.enabled || !config.vapid_private) return { verzonden:0 };
  for (const p of await planning()) for (const soort of soorten(p)) check(await db.from('push_jobs').upsert({ match_key:p.match_key, member_id:p.member_id, soort }, { onConflict:'match_key,member_id,soort', ignoreDuplicates:true }));
  const jobs = check(await db.from('push_jobs').select('*').or(`and(status.eq.pending,next_attempt.lte.${new Date().toISOString()}),and(status.eq.sending,lease_until.lt.${new Date().toISOString()})`).order('next_attempt').limit(20)) ?? [];
  let verzonden = 0;
  for (const j of jobs) {
    if (!check(await db.rpc('claim_push_job',{p_id:j.id}))) continue;
    // Controleer antwoorden en stemmen opnieuw vlak voor verzending, niet alleen bij het plannen.
    const p = (await planning()).find(p => p.match_key===j.match_key && p.member_id===j.member_id);
    if (!p || !soorten(p).includes(j.soort as Soort)) { check(await db.from('push_jobs').update({status:'skipped',fout:null}).eq('id',j.id)); continue; }
    const subs = check(await db.from('push_subscriptions').select('subscription,endpoint').eq('member_id',j.member_id)) ?? [];
    let gelukt = false;
    for (const sub of subs) {
      try {
        const inhoud = bericht(j.soort,p.tegenstander,p);
        const route = j.soort === 'wasmand' ? '/opstelling' : j.soort.startsWith('aanwezig') ? `/kalender?match=${encodeURIComponent(j.match_key)}` : `/match/${encodeURIComponent(j.match_key)}`;
        await webpush.sendNotification(abonnement(sub.subscription),JSON.stringify({...inhoud,url:`${CLUB_ORIGIN}/#${route}`,tag:j.id}),{vapidDetails:{subject:CLUB_ORIGIN,publicKey:config.vapid_public,privateKey:config.vapid_private},TTL:3600,timeout:10000,topic:j.id.replaceAll('-','')});
        gelukt = true;
      } catch(e) {
        if ([404,410].includes((e as any)?.statusCode)) check(await db.from('push_subscriptions').delete().eq('endpoint',sub.endpoint));
      }
    }
    if (gelukt) { check(await db.from('push_jobs').update({status:'sent',sent_at:new Date().toISOString(),fout:null,lease_until:null}).eq('id',j.id)); verzonden++; }
    else check(await db.from('push_jobs').update({status:'pending',lease_until:null,next_attempt:new Date(Date.now()+Math.min(30,2**Math.min(j.attempts,5))*60000).toISOString(),fout:subs.length ? 'Pushdienst niet bereikbaar. Automatisch opnieuw proberen.' : 'Nog geen actief toestel gekoppeld.'}).eq('id',j.id));
  }
  return {verzonden};
}
Deno.serve(async req => {
  if (Deno.env.get('SUPABASE_URL') !== CLUB_PROJECT) return json({error:'Verkeerde database voor de clubmeldingen.'},403);
  if (req.method==='OPTIONS') return new Response('ok',{headers:cors});
  if (req.method!=='POST') return json({error:'POST vereist.'},405);
  try {
    let config = check(await db.from('push_config').select('*').eq('id',1).single());
    const token = req.headers.get('authorization')?.replace(/^Bearer /i,'') ?? '';
    if (token && token===config.cron_secret) return json(await verzendRij(config));
    const {data:{user}} = await db.auth.getUser(token);
    if (!user) throw new Fout('Log in op de clubapp.',401);
    const lid = check(await db.from('members').select('id,is_admin,status').eq('user_id',user.id).maybeSingle());
    if (!lid || lid.status!=='actief') throw new Fout('Alleen actieve clubleden kunnen meldingen aanzetten.',403);
    const inhoud = await req.text();
    if (inhoud.length>12000) throw new Fout('Aanvraag te groot.');
    const body = JSON.parse(inhoud || '{}');
    if (body.action==='status') {
      if (!config.vapid_public) {
        const keys = webpush.generateVAPIDKeys();
        check(await db.from('push_config').update({vapid_public:keys.publicKey,vapid_private:keys.privateKey}).eq('id',1).is('vapid_public',null));
        config = check(await db.from('push_config').select('*').eq('id',1).single());
      }
      const jobs = check(await db.from('push_jobs').select('match_key,soort,status,sent_at,fout').eq('member_id',lid.id).order('created_at',{ascending:false}).limit(20));
      return json({publicKey:config.vapid_public,enabled:config.enabled,jobs});
    }
    if (body.action==='subscribe') {
      const sub = abonnement(body.subscription);
      check(await db.from('push_subscriptions').upsert({endpoint:sub.endpoint,member_id:lid.id,subscription:sub}));
      return json({ok:true});
    }
    if (body.action==='unsubscribe') { check(await db.from('push_subscriptions').delete().eq('member_id',lid.id).eq('endpoint',String(body.endpoint))); return json({ok:true}); }
    throw new Fout('Onbekende actie.');
  } catch(e) { return json({error:e instanceof Fout ? e.message : 'Meldingen verwerken mislukt. Probeer opnieuw.'},e instanceof Fout ? e.status : 500); }
});
