/// <reference types="node" />
import { describe, it, expect, vi } from 'vitest';
import { competitionSync, SyncError, type Control, type SyncDependencies } from '../../../supabase/functions/_shared/competition-sync';
const nu = Date.parse('2026-09-13T12:00:00Z');
function setup(overrides: Partial<SyncDependencies> = {}) {
  let control: Control = {request_id:null,requested_at:null,status:'idle',run_id:null,fout:null};
  const deps: SyncDependencies = {
    admin: vi.fn(async ()=>'admin'), now:()=>nu, control:async()=>control,
    update:vi.fn(async (_id,patch)=>{control={...control,...patch};}),
    claim:vi.fn(async()=>{control={...control,request_id:'request-1',requested_at:new Date(nu).toISOString(),status:'queued'};return 'request-1';}),
    dispatch:vi.fn(async()=>42), runs:vi.fn(async()=>[]),
    run:vi.fn(async()=>({id:42,status:'completed',conclusion:'success',display_title:'Scrape request-1'})),
    lastSuccess:async()=>null, ...overrides,
  };
  const call = (action='start', token=true)=>competitionSync(new Request('https://example.com',{method:'POST',headers:token?{Authorization:'Bearer valid'}:{},body:JSON.stringify({action})}),deps);
  return {deps,call,setControl:(c:Partial<Control>)=>{control={...control,...c};}};
}
describe('handmatige competitie-update',()=>{
  it('weigert zonder JWT en controleert actieve admin vóór elke actie',async()=>{
    const s=setup({admin:vi.fn(async()=>null)});
    expect((await s.call('start',false)).status).toBe(401);
    expect((await s.call('status')).status).toBe(403);
    expect(s.deps.runs).not.toHaveBeenCalled();
    expect(s.deps.dispatch).not.toHaveBeenCalled();
  });
  it('reserveert de aanvraag voordat de workflow start en bewaart run-id',async()=>{
    const s=setup();const result=await s.call();
    expect(result.status).toBe(200);
    expect(s.deps.dispatch).toHaveBeenCalledWith('request-1');
    expect(await s.deps.control()).toMatchObject({status:'queued',run_id:42});
    expect((await result.json()).retryAt).toBe('2026-09-13T12:05:00.000Z');
  });
  it('start niets wanneer de database de aanvraag weigert',async()=>{
    const s=setup({claim:async()=>{throw new SyncError('Wacht vijf minuten',409);}});
    expect((await s.call()).status).toBe(409);expect(s.deps.dispatch).not.toHaveBeenCalled();
  });
  it('respecteert een al lopende automatische scrape',async()=>{
    const s=setup({runs:async()=>[{id:10,status:'queued',conclusion:null,display_title:'Scrape schedule'}]});
    expect((await s.call()).status).toBe(409);expect(s.deps.claim).not.toHaveBeenCalled();
  });
  it('vindt een dispatch met verloren antwoord terug zonder opnieuw te starten',async()=>{
    const s=setup({runs:async()=>[{id:42,status:'in_progress',conclusion:null,display_title:'Scrape request-1'}]});
    s.setControl({request_id:'request-1',requested_at:new Date(nu-60000).toISOString(),status:'queued'});
    expect((await (await s.call('status')).json()).status).toBe('in_progress');
    expect(await s.deps.control()).toMatchObject({run_id:42});
    expect(s.deps.dispatch).not.toHaveBeenCalled();
  });
  it('behoudt de reservering na een onzekere netwerkfout',async()=>{
    const s=setup({dispatch:async()=>{throw new Error('timeout');}});
    expect((await s.call()).status).toBe(502);
    expect(await s.deps.control()).toMatchObject({status:'queued'});
    expect((await s.call()).status).toBe(409);
  });
  it('toont een zekere weigering als fout',async()=>{
    const s=setup({dispatch:async()=>{throw new SyncError('Geen toegang',403);}});
    expect((await s.call()).status).toBe(403);
    expect(await s.deps.control()).toMatchObject({status:'failure',fout:'Geen toegang'});
  });
  it.each(['success','failure','cancelled'])('verwerkt de werkelijke afloop %s',async conclusion=>{
    const s=setup({run:async()=>({id:42,status:'completed',conclusion,display_title:'Scrape request-1'})});
    s.setControl({request_id:'request-1',status:'queued',run_id:42});
    expect((await (await s.call('status')).json()).status).toBe(conclusion==='success'?'success':'failure');
  });
});
