import { createClient } from 'npm:@supabase/supabase-js@2';
import { competitionSync, SyncError, type Control, type Run } from '../_shared/competition-sync.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth:{persistSession:false}});
const repo = 'https://api.github.com/repos/arthurpepermans/steca-competitie';
const workflow = '/actions/workflows/sync-competition.yml';
async function github(path: string, body?: unknown) {
  const token = Deno.env.get('COMPETITION_GITHUB_TOKEN');
  if (!token) throw new SyncError('De updatekoppeling is nog niet ingesteld.', 503);
  const response = await fetch(repo + path, {
    method: body ? 'POST' : 'GET',
    headers: {Authorization:`Bearer ${token}`, Accept:'application/vnd.github+json',
      'X-GitHub-Api-Version':'2026-03-10', 'Content-Type':'application/json'},
    ...(body ? {body:JSON.stringify(body)} : {}), signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new SyncError(
    response.status === 401 || response.status === 403
      ? 'De updatekoppeling heeft geen toegang. Laat de beheerder de koppeling nakijken.'
      : 'De update kon niet worden aangevraagd. Probeer later opnieuw.', response.status);
  return response.status === 204 ? null : response.json();
}
Deno.serve(request => competitionSync(request, {
  now: () => Date.now(),
  async admin(jwt) {
    const {data:{user}, error} = await db.auth.getUser(jwt);
    if (error || !user) return null;
    const {data, error: memberError} = await db.from('members').select('id').eq('user_id',user.id).eq('is_admin',true).eq('status','actief').maybeSingle();
    if (memberError) throw memberError;
    return data?.id ?? null;
  },
  async control() {
    const {data,error} = await db.from('scrape_control').select('*').eq('id',true).single();
    if (error) throw error;
    return data as Control;
  },
  async update(id, patch) {
    const {error} = await db.from('scrape_control').update(patch).eq('id',true).eq('request_id',id);
    if (error) throw error;
  },
  async claim(member) {
    const {data,error} = await db.rpc('claim_competition_sync',{p_member:member});
    if (error) throw new SyncError(error.code === 'P0001' ? error.message : 'De aanvraag kon niet worden opgeslagen.',409);
    return data as string;
  },
  async runs() { return (await github(workflow + '/runs?branch=main&per_page=100')).workflow_runs as Run[]; },
  async run(id) { return await github('/actions/runs/' + id) as Run; },
  async dispatch(id) {
    const result = await github(workflow + '/dispatches',{ref:'main',inputs:{fresh:true,dry_run:false,request_id:id}});
    return result?.workflow_run_id ?? null;
  },
  async lastSuccess() {
    const {data,error} = await db.from('sync_status').select('laatste_succes_at').order('laatste_succes_at',{ascending:false,nullsFirst:false}).limit(1).maybeSingle();
    if (error) throw error;
    return data?.laatste_succes_at ?? null;
  },
}));
