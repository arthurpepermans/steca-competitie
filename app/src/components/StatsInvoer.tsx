import { useEffect, useState } from "react";
import { bewaarStats, haalLogboek, verwijderStat } from "../lib/api";
import { fmtTijdstip } from "../lib/datum";
import { goalsControle } from "../lib/stats";
import { foutTekst } from "../lib/useAsync";
import type { AuditEntry, Match, MatchStat } from "../lib/types";

type Speler = { id: string; naam: string };

type Props = {
  match: Match;
  spelers: Speler[];
  stats: MatchStat[];
  ledenNamen: Map<string, string>;
  onOpgeslagen: () => Promise<void> | void;
};

function leeg(matchKey: string, memberId: string): MatchStat {
  return { match_key: matchKey, member_id: memberId, gespeeld: false, goals: 0, assists: 0, geel: 0, rood: 0 };
}

export function StatsInvoer({ match, spelers, stats, ledenNamen, onOpgeslagen }: Props) {
  const bestaand = new Map(stats.filter((s) => s.match_key === match.match_key).map((s) => [s.member_id, s]));
  const [rijen, setRijen] = useState<MatchStat[]>(() => spelers.map((p) => bestaand.get(p.id) ?? leeg(match.match_key, p.id)));
  const [fout, setFout] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [log, setLog] = useState<AuditEntry[] | null>(null);

  useEffect(() => {
    setRijen(spelers.map((p) => bestaand.get(p.id) ?? leeg(match.match_key, p.id)));
    setLog(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.match_key, stats]);

  function wijzig(memberId: string, veld: keyof MatchStat, waarde: number | boolean) {
    setRijen((r) => r.map((x) => (x.member_id === memberId ? { ...x, [veld]: waarde } : x)));
    setOk(false);
  }

  const controle = goalsControle(rijen, match);

  async function opslaan() {
    setFout(null);
    try {
      const teBewaren = rijen.filter((r) => r.gespeeld || r.goals || r.assists || r.geel || r.rood);
      await bewaarStats(match.match_key, teBewaren);
      // rijen die leeg werden en al bestonden: verwijderen
      for (const r of rijen) {
        if (!teBewaren.includes(r) && bestaand.has(r.member_id)) await verwijderStat(match.match_key, r.member_id);
      }
      setOk(true);
      await onOpgeslagen();
    } catch (e) {
      setFout(foutTekst(e));
    }
  }

  async function toonLog() {
    try {
      setLog(await haalLogboek("match_stats", `${match.match_key}|`));
    } catch (e) {
      setFout(foutTekst(e));
    }
  }

  async function herstel(entry: AuditEntry) {
    if (!confirm("Deze versie terugzetten?")) return;
    setFout(null);
    try {
      const oud = entry.oud as MatchStat | null;
      const memberId = (entry.nieuw?.member_id ?? entry.oud?.member_id) as string;
      if (oud) await bewaarStats(match.match_key, [{ ...oud, match_key: match.match_key, member_id: memberId }]);
      else await verwijderStat(match.match_key, memberId);
      await onOpgeslagen();
      await toonLog();
    } catch (e) {
      setFout(foutTekst(e));
    }
  }

  return (
    <div className="kaart stats-invoer">
      {fout && <div className="melding fout">{fout}</div>}
      {ok && <div className="melding ok">Opgeslagen.</div>}
      {controle && controle.ingevoerd !== controle.officieel && (
        <div className="melding waarschuwing">
          Ingevoerde goals: {controle.ingevoerd}, officiële score van Steca: {controle.officieel}. Opslaan kan, maar controleer de invoer.
        </div>
      )}
      <div className="tabel-wrap">
        <table className="tabel">
          <thead>
            <tr><th>Speler</th><th>Gesp.</th><th>Goals</th><th>Assists</th><th>Geel</th><th>Rood</th></tr>
          </thead>
          <tbody>
            {rijen.map((r) => (
              <tr key={r.member_id}>
                <td style={{ whiteSpace: "normal" }}>{ledenNamen.get(r.member_id) ?? r.member_id}</td>
                <td><input type="checkbox" checked={r.gespeeld} onChange={(e) => wijzig(r.member_id, "gespeeld", e.target.checked)} /></td>
                <td><input type="number" min={0} value={r.goals} onChange={(e) => wijzig(r.member_id, "goals", Number(e.target.value))} /></td>
                <td><input type="number" min={0} value={r.assists} onChange={(e) => wijzig(r.member_id, "assists", Number(e.target.value))} /></td>
                <td><input type="number" min={0} max={2} value={r.geel} onChange={(e) => wijzig(r.member_id, "geel", Number(e.target.value))} /></td>
                <td><input type="number" min={0} max={1} value={r.rood} onChange={(e) => wijzig(r.member_id, "rood", Number(e.target.value))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="knoppen">
        <button type="button" className="knop" onClick={opslaan}>Opslaan</button>
        <button type="button" className="knop licht" onClick={toonLog}>Geschiedenis</button>
      </div>
      {log && (
        <ul className="lijst omrand log" style={{ marginTop: 10 }}>
          {log.length === 0 && <li className="zacht">Nog geen wijzigingen voor deze match.</li>}
          {log.map((e) => {
            const n = e.nieuw as MatchStat | null;
            const o = e.oud as MatchStat | null;
            const naam = ledenNamen.get((n?.member_id ?? o?.member_id) as string) ?? "?";
            const fmt = (s: MatchStat | null) => (s ? `${s.gespeeld ? "gespeeld" : "niet gespeeld"}, ${s.goals}G ${s.assists}A ${s.geel}geel ${s.rood}rood` : "geen rij");
            return (
              <li key={e.id} className="rij boven">
                <span>
                  <strong>{naam}</strong> · {e.actie.toLowerCase()} door {ledenNamen.get(e.door ?? "") ?? "onbekend"} op {fmtTijdstip(e.op)}
                  <br />
                  <span className="zacht">{fmt(o)} → {fmt(n)}</span>
                </span>
                <button type="button" className="knop licht klein" onClick={() => herstel(e)}>Terugzetten</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
