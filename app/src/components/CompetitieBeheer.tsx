import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fmtTijdstip } from '../lib/datum';
import { foutTekst } from '../lib/useAsync';

type Status = {status: string; requestedAt: string | null; retryAt: string | null; lastSuccess: string | null; error: string | null};
const TEKST: Record<string,string> = {
  idle: 'Klaar om wedstrijdgegevens op te halen.', queued: 'Update aangevraagd. Even wachten tot die start.',
  in_progress: 'Wedstrijdgegevens worden bijgewerkt…', success: 'Wedstrijdgegevens zijn bijgewerkt.',
  failure: 'De vorige update is niet gelukt.',
};
export function CompetitieBeheer() {
  const [status,setStatus] = useState<Status | null>(null);
  const [fout,setFout] = useState<string | null>(null);
  const [bezig,setBezig] = useState(false);
  const [nu,setNu] = useState(Date.now());
  const lock = useRef(false);
  const mounted = useRef(true);
  async function actie(action: 'status' | 'start') {
    if (lock.current) return;
    lock.current = true;
    setBezig(true);
    try {
      const {data,error} = await supabase.functions.invoke('competition-sync',{body:{action}});
      if (error) {
        const detail = await error.context?.json?.().catch(() => null);
        throw new Error(detail?.error ?? error.message);
      }
      if (mounted.current) { setStatus(data); setFout(null); }
    } catch (e) {
      if (mounted.current) setFout(foutTekst(e));
    } finally {
      lock.current = false;
      if (mounted.current) { setBezig(false); setNu(Date.now()); }
    }
  }
  useEffect(() => {
    mounted.current = true;
    void actie('status');
    const timer = window.setInterval(() => {
      if (!document.hidden) void actie('status');
    },15_000);
    return () => { mounted.current = false; window.clearInterval(timer); };
  },[]);
  const loopt = status?.status === 'queued' || status?.status === 'in_progress';
  const wacht = status?.retryAt ? Math.max(0,Math.ceil((Date.parse(status.retryAt)-nu)/60_000)) : 0;
  return <section className="kaart">
    <h3>Wedstrijdgegevens beheren</h3>
    <p className="klein zacht">Haal de nieuwste kalender, uitslagen, klassementen en terreingegevens op. De automatische updates blijven ook lopen.</p>
    <div role="status" aria-live="polite">
      <p>{status ? TEKST[status.status] ?? 'Status wordt opgehaald.' : 'Status ophalen…'}</p>
      {status && <p className="klein zacht">Laatst bijgewerkt: {fmtTijdstip(status.lastSuccess)}</p>}
      {!loopt && wacht > 0 && <p className="klein zacht">Opnieuw aanvragen kan over ongeveer {wacht} {wacht === 1 ? 'minuut' : 'minuten'}.</p>}
    </div>
    {(fout || status?.error) && <p className="melding fout" role="alert">{fout ?? status?.error}</p>}
    <div className="knoppen">
      <button className="knop" type="button" disabled={bezig || !status || !!fout || loopt || wacht > 0} onClick={() => void actie('start')}>Wedstrijdgegevens vernieuwen</button>
      <button className="knop licht" type="button" disabled={bezig} onClick={() => void actie('status')}>Status vernieuwen</button>
    </div>
  </section>;
}
