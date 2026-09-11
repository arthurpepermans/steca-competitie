import { useState } from "react";
import { haalOpenbareOpstellingen } from "../lib/supporters";
import { useAsync } from "../lib/useAsync";
import { fmtDatum, isEigen, sorteerOpDatum, tegenstander, volgendeMatch } from "../lib/datum";
import { Fout, Laden } from "./Layout";
import { Veld } from "./Veld";
import type { Match } from "../lib/types";

export function OpenbareOpstelling({ matches }: { matches: Match[] }) {
  const info = useAsync(haalOpenbareOpstellingen);
  const [keuze, setKeuze] = useState<string | null>(null);
  const eigen = sorteerOpDatum(matches.filter(isEigen));
  const key = keuze ?? volgendeMatch(matches)?.match_key ?? eigen.at(-1)?.match_key;
  const opstelling = info.data?.find(o => o.match_key === key);
  return <>
    <h2>Opstelling</h2>
    <div className="veld"><label htmlFor="publieke-opstelling-match">Wedstrijd</label>
      <select id="publieke-opstelling-match" value={key ?? ""} onChange={e => setKeuze(e.target.value)}>
        {eigen.map(m => <option key={m.match_key} value={m.match_key}>{fmtDatum(m.datum)} · {tegenstander(m)}</option>)}
      </select>
    </div>
    {info.laden && <Laden />}
    <Fout tekst={info.fout} />
    {info.fout && <button className="knop licht" onClick={() => void info.herlaad()}>Opnieuw proberen</button>}
    {!info.laden && !info.fout && (opstelling
      ? <Veld memberIds={Object.fromEntries(opstelling.spelers.map(p=>[p.positie,p.member_id]))} formatie={opstelling.formatie} namen={Object.fromEntries(opstelling.spelers.map(p => [p.positie, p.naam]))} />
      : <p>Er is nog geen opstelling voor deze wedstrijd opgeslagen.</p>)}
  </>;
}
