export type Control = {
  request_id: string | null; requested_at: string | null; status: string;
  run_id: number | null; fout: string | null;
};
export type Run = { id: number; status: string; conclusion: string | null; display_title: string };
export type SyncDependencies = {
  admin: (jwt: string) => Promise<string | null>;
  control: () => Promise<Control>;
  update: (id: string, patch: Partial<Control>) => Promise<void>;
  claim: (member: string) => Promise<string>;
  runs: () => Promise<Run[]>;
  run: (id: number) => Promise<Run>;
  dispatch: (id: string) => Promise<number | null>;
  lastSuccess: () => Promise<string | null>;
  now: () => number;
};
export class SyncError extends Error {
  constructor(message: string, public status = 500) { super(message); }
}

/** Gedeelde afhandeling, zonder toegang tot browserinvoer voor repo, branch of commando. */
export async function competitionSync(request: Request, d: SyncDependencies): Promise<Response> {
  const headers = {
    'Access-Control-Allow-Origin': 'https://stecajuniors.app',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store', Vary: 'Origin',
    'Content-Type': 'application/json',
  };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers});
  if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers});
  if (request.method !== 'POST') return reply({error: 'Gebruik POST.'}, 405);
  try {
    const jwt = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
    if (!jwt) return reply({error: 'Log eerst in.'}, 401);
    const member = await d.admin(jwt);
    if (!member) return reply({error: 'Alleen actieve admins kunnen dit beheren.'}, 403);
    let action: string;
    try { action = (await request.json()).action; } catch { return reply({error: 'Ongeldige aanvraag.'}, 400); }
    if (action !== 'start' && action !== 'status') return reply({error: 'Onbekende actie.'}, 400);
    let c = await d.control();
    const runs = await d.runs();
    // Een antwoord kan verloren gaan nadat GitHub de aanvraag heeft aangenomen.
    // Zoek dan de unieke aanvraag terug, zonder de workflow opnieuw te starten.
    if (c.request_id && ['queued','in_progress'].includes(c.status)) {
      const run = c.run_id ? await d.run(c.run_id) : runs.find(r => r.display_title === `Scrape ${c.request_id}`);
      let patch: Partial<Control> | null = null;
      if (run) {
        patch = {run_id: run.id, status: run.status === 'completed'
          ? (run.conclusion === 'success' ? 'success' : 'failure')
          : (run.status === 'in_progress' ? 'in_progress' : 'queued'),
          fout: run.status === 'completed' && run.conclusion !== 'success'
            ? 'De update is niet gelukt. De bestaande gegevens blijven beschikbaar.' : null};
      } else if (c.requested_at && d.now() - Date.parse(c.requested_at) > 10 * 60_000) {
        patch = {status: 'failure', fout: 'De aanvraag is niet teruggevonden. Probeer opnieuw.'};
      }
      if (patch) { await d.update(c.request_id, patch); c = {...c, ...patch}; }
    }
    const active = runs.find(r => r.status !== 'completed');
    if (action === 'start') {
      if (active || ['queued','in_progress'].includes(c.status)) {
        return reply({error: 'Er loopt al een update. Wacht tot die klaar is.'}, 409);
      }
      const id = await d.claim(member);
      try {
        const runId = await d.dispatch(id);
        if (runId) await d.update(id, {run_id: runId});
      } catch (e) {
        // Bij een zekere weigering kan een volgende aanvraag na de afkoeltijd opnieuw.
        // Bij een netwerkfout behouden we de reservering om dubbele updates te voorkomen.
        if (e instanceof SyncError && e.status >= 400 && e.status < 500) {
          await d.update(id, {status: 'failure', fout: e.message});
        }
        throw e;
      }
      c = await d.control();
    }
    return reply({
      status: active ? (active.status === 'in_progress' ? 'in_progress' : 'queued') : c.status,
      requestedAt: c.requested_at, retryAt: c.requested_at ? new Date(Date.parse(c.requested_at) + 300_000).toISOString() : null,
      lastSuccess: await d.lastSuccess(), error: active ? null : c.fout,
    });
  } catch (e) {
    return reply({error: e instanceof SyncError ? e.message : 'De status kon niet worden bevestigd. Vernieuw de status voor je opnieuw probeert.'},
      e instanceof SyncError ? e.status : 502);
  }
}
