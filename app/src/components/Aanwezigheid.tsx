import { useState } from "react";
import { Check } from "@phosphor-icons/react/dist/csr/Check";
import { X } from "@phosphor-icons/react/dist/csr/X";
import { Question } from "@phosphor-icons/react/dist/csr/Question";
import { aanwezigheden24u, zetAanwezigheid } from "../lib/api";
import { fmtTijdstip, magAanwezigheidWijzigen } from "../lib/datum";
import { foutTekst } from "../lib/useAsync";
import type { Aanwezigheid24u, AanwezigheidStatus, Attendance, Match } from "../lib/types";

const STATUSSEN: { code: AanwezigheidStatus; label: string }[] = [
  { code: "aanwezig", label: "Aanwezig" },
  { code: "afwezig", label: "Afwezig" },
  { code: "onzeker", label: "Onzeker" },
];

type Speler = { id: string; naam: string };

type Props = {
  match: Match;
  spelers: Speler[];
  aanwezigheden: Attendance[];
  eigenLidId: string | null;
  isSpeler: boolean;
  isStaf: boolean;
  isAdmin: boolean;
  onGewijzigd: () => Promise<void> | void;
};

export function Aanwezigheid({ match, spelers, aanwezigheden, eigenLidId, isSpeler, isStaf, isAdmin, onGewijzigd }: Props) {
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [anderen, setAnderen] = useState(false);
  const [lijst24, setLijst24] = useState<Aanwezigheid24u[] | null>(null);
  const magWijzigen = magAanwezigheidWijzigen(match);
  const perLid = new Map(aanwezigheden.filter((a) => a.match_key === match.match_key).map((a) => [a.member_id, a.status]));
  const eigenStatus = eigenLidId ? perLid.get(eigenLidId) : undefined;

  async function zet(memberId: string, status: AanwezigheidStatus) {
    setBezig(true);
    setFout(null);
    try {
      await zetAanwezigheid(match.match_key, memberId, status);
      await onGewijzigd();
    } catch (e) {
      setFout(foutTekst(e));
    } finally {
      setBezig(false);
    }
  }

  async function haal24() {
    try {
      setLijst24(await aanwezigheden24u(match.match_key));
    } catch (e) {
      setFout(foutTekst(e));
    }
  }

  const groepen = STATUSSEN.map((s) => ({
    ...s,
    namen: spelers.filter((p) => perLid.get(p.id) === s.code),
  }));
  const zonder = spelers.filter((p) => !perLid.has(p.id));

  return (
    <div className="aanwezigheid">
      {fout && <div className="melding fout">{fout}</div>}
      {isSpeler && eigenLidId && magWijzigen && (
        <div className="status-knoppen" style={{ marginBottom: 8 }}>
          {STATUSSEN.map((s) => (
            <button key={s.code} type="button" disabled={bezig} aria-pressed={eigenStatus === s.code} className={`${s.code} ${eigenStatus === s.code ? "actief" : ""}`} onClick={() => zet(eigenLidId, s.code)}>
              {s.code === "aanwezig" ? <Check size={20} /> : s.code === "afwezig" ? <X size={20} /> : <Question size={20} />} {s.label}
            </button>
          ))}
        </div>
      )}
      <p className="aanwezig-bevestiging" role="status">{bezig ? "Bezig met opslaan…" : eigenStatus ? `Je staat als ${eigenStatus}.` : isSpeler ? "Je hebt nog niet geantwoord." : "Bekijk de aanwezigheid van de ploeg."}</p>
      <details className="ploeg-aanwezig">
        <summary><span><strong>{groepen[0].namen.length}</strong> aanwezig <span className="zacht">van {spelers.length} spelers</span></span><span className="details-label">Bekijk ploeg</span></summary>
        <div className="aanwezig-groepen">{groepen.map((g) => <div key={g.code}><h4>{g.label} <span>{g.namen.length}</span></h4><div className="namen">{g.namen.length ? g.namen.map((p) => <span key={p.id} className={g.code}>{p.naam}</span>) : <span>Nog niemand</span>}</div></div>)}<div><h4>Nog niet geantwoord <span>{zonder.length}</span></h4><div className="namen">{zonder.map((p) => <span key={p.id}>{p.naam}</span>)}</div></div></div>
      </details>
      {isStaf && magWijzigen && (
        <div style={{ marginTop: 8 }}>
          <button type="button" className="knop licht klein" onClick={() => setAnderen(!anderen)}>
            {anderen ? "Sluiten" : "Aanwezigheid van anderen zetten"}
          </button>
          {anderen && (
            <ul className="lijst omrand" style={{ marginTop: 8 }}>
              {spelers.map((p) => (
                <li key={p.id} className="rij">
                  <span>{p.naam}</span>
                  <span className="status-knoppen" style={{ width: 200 }}>
                    {STATUSSEN.map((s) => (
                      <button key={s.code} type="button" disabled={bezig} className={`${s.code} ${perLid.get(p.id) === s.code ? "actief" : ""}`} onClick={() => zet(p.id, s.code)}>
                        {s.label.slice(0, 3)}
                      </button>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {isAdmin && (
        <div style={{ marginTop: 8 }}>
          <button type="button" className="knop licht klein" onClick={haal24}>Lijst 24 u voor aftrap</button>
          {lijst24 && (
            <ul className="lijst omrand log" style={{ marginTop: 8 }}>
              {lijst24.length === 0 && <li className="zacht">Niemand had toen al iets aangegeven.</li>}
              {lijst24.map((r) => (
                <li key={r.member_id} className="rij">
                  <span>{r.naam} <span className={`badge ${r.status === "aanwezig" ? "ok" : r.status === "afwezig" ? "fout" : "waarschuwing"}`}>{r.status}</span></span>
                  <span className="zacht">{fmtTijdstip(r.gezet_op)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
