import { useEffect, useRef, useState } from "react";
import { aftrapTijd } from "../lib/aftrap";
import type { Match } from "../lib/types";

const MINUUT = 60000;
const MATCHDUUR = 110 * MINUUT;

function delen(ms: number) {
  const totaal = Math.max(0, Math.floor(ms / MINUUT));
  return { dagen: Math.floor(totaal / 1440), uren: Math.floor((totaal % 1440) / 60), minuten: totaal % 60 };
}

/** Eén cijfervak van het klapbord; klapt om wanneer de waarde verandert. */
function Vak({ waarde, label }: { waarde: number; label: string }) {
  const [klap, setKlap] = useState(false);
  const vorige = useRef(waarde);
  useEffect(() => {
    if (vorige.current === waarde) return;
    vorige.current = waarde;
    setKlap(true);
    const t = window.setTimeout(() => setKlap(false), 450);
    return () => window.clearTimeout(t);
  }, [waarde]);
  return (
    <div className="aftel-vak">
      <b className={klap ? "klap" : ""}>{String(waarde).padStart(2, "0")}</b>
      <small>{label}</small>
    </div>
  );
}

/** Aftelling naar de aftrap als klapbord: dagen, uren, minuten. Tijdens de match 'Nu bezig', daarna niets. */
export function Aftelling({ match }: { match: Match }) {
  const aftrap = aftrapTijd(match);
  const [nu, setNu] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNu(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);
  if (aftrap === null) return null;
  const rest = aftrap - nu;
  if (rest <= 0 && rest > -MATCHDUUR) {
    return <div className="aftel bezig" aria-live="polite"><div className="aftel-vak"><b>NU</b><small>bezig</small></div></div>;
  }
  if (rest <= 0) return null;
  const d = delen(rest);
  return (
    <div className="aftel" aria-label={`Nog ${d.dagen} dagen, ${d.uren} uur en ${d.minuten} minuten tot de aftrap`}>
      <Vak waarde={d.dagen} label={d.dagen === 1 ? "dag" : "dagen"} />
      <span className="aftel-sep" aria-hidden="true">:</span>
      <Vak waarde={d.uren} label="uren" />
      <span className="aftel-sep" aria-hidden="true">:</span>
      <Vak waarde={d.minuten} label="min" />
    </div>
  );
}
