import { useState } from "react";
import { haalOpenbareCijfers } from "../lib/supporters";
import { useAsync } from "../lib/useAsync";
import { sorteerOp, totalen, type Totalen } from "../lib/stats";
import type { Match } from "../lib/types";
import { Boetepot } from "./Boetepot";
import { Fout, Laden } from "./Layout";

export function OpenbareStatistieken({ matches, boetepot = false }: { matches: Match[]; boetepot?: boolean }) {
  const info = useAsync(haalOpenbareCijfers);
  const [sorteer, setSorteer] = useState<keyof Totalen>("goals");
  if (info.laden) return <Laden />;
  if (info.fout) return <><Fout tekst={info.fout} /><button className="knop" onClick={() => void info.herlaad()}>Opnieuw proberen</button></>;
  const data = info.data!;
  const namen = new Map(data.spelers.map((p) => [p.id, p.naam]));
  if (boetepot) return <Boetepot fines={data.boetes} stats={data.stats} matches={matches} spelers={data.spelers} ledenNamen={namen} eigenLidId={null} isStaf={false} onGewijzigd={info.herlaad} />;
  const rijen = sorteerOp(totalen(data.stats, matches), sorteer);
  return <>
    <div className="veld"><label htmlFor="publiek-sorteren">Rangschikken op</label><select id="publiek-sorteren" value={sorteer} onChange={(e) => setSorteer(e.target.value as keyof Totalen)}>
      <option value="goals">Goals</option><option value="assists">Assists</option><option value="geel">Gele kaarten</option><option value="rood">Rode kaarten</option><option value="cleanSheets">Clean sheets</option><option value="gespeeld">Gespeelde wedstrijden</option>
    </select></div>
    <div className="tabel-wrap"><table className="tabel"><thead><tr><th>#</th><th>Speler</th><th>Gesp.</th><th>Goals</th><th>Assists</th><th>Geel</th><th>Rood</th><th>CS</th></tr></thead><tbody>
      {rijen.map((r, i) => <tr key={r.member_id}><td>{i + 1}</td><td style={{ whiteSpace: "normal" }}>{namen.get(r.member_id) ?? "Speler"}</td><td>{r.gespeeld}</td><td>{r.goals}</td><td>{r.assists}</td><td>{r.geel}</td><td>{r.rood}</td><td>{r.cleanSheets}</td></tr>)}
      {!rijen.length && <tr><td colSpan={8}>Nog geen statistieken ingevoerd.</td></tr>}
    </tbody></table></div>
    <p className="klein zacht">CS = clean sheets: meegespeeld in een wedstrijd zonder tegendoelpunt.</p>
  </>;
}
