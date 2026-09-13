import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { foutTekst, useAsync, type AsyncState } from "../lib/useAsync";
import { magAanwezigheidWijzigen } from "../lib/datum";
import type { AanwezigheidStatus, Match } from "../lib/types";

type Antwoord = { match_key: string; user_id: string; naam: string; status: AanwezigheidStatus };
export const SupporterAanwezigheidContext = createContext<AsyncState<Antwoord[]> | null>(null);
const statussen: AanwezigheidStatus[] = ["aanwezig", "afwezig", "onzeker"];

export function SupporterAanwezigheidProvider({children}: {children: ReactNode}) {
  const {session} = useAuth();
  const {pathname} = useLocation();
  const info = useAsync(async () => {
    const {data,error} = await supabase.rpc("supporter_aanwezigheden");
    if (error) throw error;
    return data as Antwoord[];
  }, [session?.user.id, pathname]);
  useEffect(() => {
    const vernieuw = () => { if (!document.hidden) void info.herlaad(); };
    window.addEventListener("focus", vernieuw);
    document.addEventListener("visibilitychange", vernieuw);
    return () => {window.removeEventListener("focus", vernieuw); document.removeEventListener("visibilitychange", vernieuw);};
  }, [info.herlaad]);
  return <SupporterAanwezigheidContext.Provider value={info}>{children}</SupporterAanwezigheidContext.Provider>;
}

export function SupporterAanwezigheid({match}: {match: Match}) {
  const info = useContext(SupporterAanwezigheidContext);
  const {supporter} = useAuth();
  const [open, setOpen] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  if (!info) return null;
  const antwoorden = (info.data ?? []).filter(a => a.match_key === match.match_key);
  const aanwezigen = antwoorden.filter(a => a.status === "aanwezig");
  const eigen = antwoorden.find(a => a.user_id === supporter?.user_id)?.status;
  async function zet(status: AanwezigheidStatus) {
    setBezig(true); setFout(null);
    try {
      const {error} = await supabase.rpc("zet_supporter_aanwezigheid", {p_match: match.match_key, p_status: status});
      if (error) throw error;
      await info!.herlaad();
    } catch (e) {setFout(foutTekst(e));} finally {setBezig(false);}
  }
  return <section className="supporter-aanwezigheid" aria-label="Aanwezigheid supporters">
    <div className="rij"><strong>Supporters</strong><button type="button" className="tekst-knop" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Supporters verbergen" : "Supporters tonen"}</button></div>
    <p className="klein zacht">Op deze ultras kunnen we rekenen.</p>
    {supporter?.actief && <>
      {magAanwezigheidWijzigen(match) && <div className="status-knoppen">
        {statussen.map(status => <button type="button" key={status} disabled={bezig || info.laden} aria-pressed={eigen === status} className={`${status} ${eigen === status ? "actief" : ""}`} onClick={() => zet(status)}>{status === "aanwezig" ? "Aanwezig" : status === "afwezig" ? "Afwezig" : "Onzeker"}</button>)}
      </div>}
      <p className="aanwezig-bevestiging" role="status">{bezig ? "Bezig met opslaan…" : eigen ? `Je staat als supporter op ${eigen}.` : "Je hebt als supporter nog niet geantwoord."}</p>
    </>}
    {(fout || info.fout) && <p role="alert" className="melding fout">{fout ?? info.fout}<button type="button" className="tekst-knop" onClick={info.herlaad}>Opnieuw laden</button></p>}
    {info.laden ? <p className="klein zacht">Supporters laden…</p> : <p className="klein zacht">Aanwezig: {aanwezigen.length}</p>}
    {open && <div>
      {!aanwezigen.length && <p className="klein zacht">Nog geen supporters op aanwezig.</p>}
      <div className="namen">{aanwezigen.map(a => <span key={a.user_id} className="aanwezig">{a.naam}</span>)}</div>
    </div>}
  </section>;
}
