import { useState, type FormEvent } from "react";
import { stem, trekStemIn } from "../lib/api";
import { fmtDatum, tegenstander } from "../lib/datum";
import { PUNTEN, juniorVanDeMatch, kandidaten, magStemmen, matchRanglijst, seizoenRanglijst, stemDeadline, stemmingOpen, stemtOpZichzelf } from "../lib/stemmen";
import { foutTekst } from "../lib/useAsync";
import type { Attendance, Match, MatchVote, VoteCount, VotePoints } from "../lib/types";

type Speler = { id: string; naam: string };

type StemProps = {
  match: Match;
  spelers: Speler[];
  aanwezigheden: Attendance[];
  punten: VotePoints[];
  stemmers: VoteCount[];
  mijnStem: MatchVote | null;
  eigenLidId: string | null;
  onGewijzigd: () => Promise<void> | void;
};

/** Stemming en ranglijst van één gespeelde match. */
export function JuniorStemming({ match, spelers, aanwezigheden, punten, stemmers, mijnStem, eigenLidId, onGewijzigd }: StemProps) {
  const namen = new Map(spelers.map((p) => [p.id, p.naam]));
  const lijst = matchRanglijst(punten, match.match_key);
  const winnaars = juniorVanDeMatch(punten, match.match_key);
  const aantalStemmers = stemmers.find((s) => s.match_key === match.match_key)?.stemmers ?? 0;
  const open = stemmingOpen(match);
  const deadline = stemDeadline(match);
  const mag = magStemmen(match, aanwezigheden, eigenLidId);
  const keuze = kandidaten(match, aanwezigheden, spelers);
  const [bewerk, setBewerk] = useState(false);
  const [eerste, setEerste] = useState(mijnStem?.eerste ?? "");
  const [tweede, setTweede] = useState(mijnStem?.tweede ?? "");
  const [derde, setDerde] = useState(mijnStem?.derde ?? "");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function doe(actie: () => Promise<void>) {
    setBezig(true);
    setFout(null);
    try {
      await actie();
      await onGewijzigd();
      setBewerk(false);
    } catch (e) {
      setFout(foutTekst(e));
    } finally {
      setBezig(false);
    }
  }

  async function opslaan(e: FormEvent) {
    e.preventDefault();
    if (!eerste || !tweede || !derde) return setFout("Kies drie spelers.");
    if (new Set([eerste, tweede, derde]).size < 3) return setFout("Kies drie verschillende spelers.");
    if (stemtOpZichzelf(eigenLidId, [eerste, tweede, derde])) {
      alert("Egotripper! Op jezelf stemmen telt niet. Kies drie andere spelers.");
      return setFout("Stem ongeldig: je stemde op jezelf.");
    }
    await doe(() => stem(match.match_key, eerste, tweede, derde));
  }

  const toonFormulier = mag && (bewerk || !mijnStem);

  return (
    <div style={{ marginTop: 10, borderTop: "1px solid var(--rand)", paddingTop: 10 }}>
      <div className="rij">
        <strong>Junior van de match</strong>
        <span className="klein zacht">
          {aantalStemmers === 0 ? "nog geen stemmen" : `${aantalStemmers} ${aantalStemmers === 1 ? "stem" : "stemmen"}`}
          {deadline ? (open ? `, stemmen tot ${fmtDatum(deadline)}` : ", stemming gesloten") : ""}
        </span>
      </div>
      {lijst.length > 0 && (
        <ol style={{ margin: "6px 0 0", paddingLeft: 22 }}>
          {lijst.slice(0, 5).map((p) => (
            <li key={p.member_id} className="klein">
              {namen.get(p.member_id) ?? "?"}: <strong>{p.punten}</strong> {p.punten === 1 ? "punt" : "punten"}
              {winnaars.some((w) => w.member_id === p.member_id) ? <span className="badge" style={{ marginLeft: 6 }}>Junior van de match</span> : null}
            </li>
          ))}
        </ol>
      )}
      {fout && <div className="melding fout" style={{ marginTop: 8 }}>{fout}</div>}
      {mag && mijnStem && !bewerk && (
        <div className="rij" style={{ marginTop: 8 }}>
          <span className="klein zacht">
            Jouw stem: {namen.get(mijnStem.eerste) ?? "?"}, {namen.get(mijnStem.tweede) ?? "?"}, {namen.get(mijnStem.derde) ?? "?"}
          </span>
          <span className="knoppen">
            <button type="button" className="knop licht klein" onClick={() => setBewerk(true)}>Wijzigen</button>
            <button type="button" className="knop licht klein" disabled={bezig} onClick={() => { if (confirm("Je stem intrekken?")) void doe(() => trekStemIn(match.match_key)); }}>Intrekken</button>
          </span>
        </div>
      )}
      {toonFormulier && (
        <form onSubmit={opslaan} style={{ marginTop: 8 }}>
          <p className="klein zacht" style={{ margin: "0 0 6px" }}>Kies de beste drie spelers van deze match: 3, 2 en 1 punt.</p>
          {[
            { label: `1e (${PUNTEN[0]} punten)`, waarde: eerste, zet: setEerste },
            { label: `2e (${PUNTEN[1]} punten)`, waarde: tweede, zet: setTweede },
            { label: `3e (${PUNTEN[2]} punt)`, waarde: derde, zet: setDerde },
          ].map((v) => (
            <div className="veld" key={v.label}>
              <label>{v.label}</label>
              <select value={v.waarde} onChange={(e) => v.zet(e.target.value)} required>
                <option value="">Kies…</option>
                {keuze.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
              </select>
            </div>
          ))}
          <div className="knoppen">
            <button className="knop" disabled={bezig}>{mijnStem ? "Stem bijwerken" : "Stem uitbrengen"}</button>
            {mijnStem && <button type="button" className="knop licht" onClick={() => setBewerk(false)}>Annuleren</button>}
          </div>
        </form>
      )}
      {!mag && open && eigenLidId && (
        <p className="klein zacht" style={{ margin: "6px 0 0" }}>Alleen wie op deze match als aanwezig stond, kan stemmen.</p>
      )}
    </div>
  );
}

type DorProps = {
  matches: Match[];
  punten: VotePoints[];
  stemmers: VoteCount[];
  ledenNamen: Map<string, string>;
  eigenLidId: string | null;
};

/** Seizoensklassement Junior d'or plus de winnaar per gespeelde match. */
export function JuniorDor({ matches, punten, stemmers, ledenNamen, eigenLidId }: DorProps) {
  const seizoen = seizoenRanglijst(punten);
  const gespeeld = [...matches.filter((m) => m.status === "gespeeld")].reverse();
  return (
    <>
      <div className="tabel-wrap">
        <table className="tabel">
          <thead><tr><th>#</th><th>Speler</th><th className="num">Punten</th><th className="num">Junior v/d match</th><th className="num">Matchen</th></tr></thead>
          <tbody>
            {seizoen.map((r, i) => (
              <tr key={r.member_id} className={r.member_id === eigenLidId ? "eigen" : ""}>
                <td>{i + 1}</td>
                <td style={{ whiteSpace: "normal" }}>{ledenNamen.get(r.member_id) ?? "?"}</td>
                <td className="num">{r.punten}</td>
                <td className="num">{r.gewonnen || ""}</td>
                <td className="num">{r.matchen}</td>
              </tr>
            ))}
            {seizoen.length === 0 && <tr><td colSpan={5} className="zacht">Nog geen stemmen uitgebracht.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="klein zacht">Na elke match kiest wie aanwezig was de beste drie spelers (3, 2 en 1 punt), tot 7 dagen na de match. Stemmen kan bij de match in de kalender.</p>
      <h3 style={{ marginTop: 14 }}>Junior van de match</h3>
      <ul className="lijst omrand">
        {gespeeld.map((m) => {
          const w = juniorVanDeMatch(punten, m.match_key);
          const n = stemmers.find((s) => s.match_key === m.match_key)?.stemmers ?? 0;
          return (
            <li key={m.match_key} className="rij boven">
              <span>
                {fmtDatum(m.datum)} tegen {tegenstander(m)}
                <br />
                <span className="klein zacht">{n === 0 ? "nog geen stemmen" : `${n} ${n === 1 ? "stem" : "stemmen"}`}</span>
              </span>
              <span style={{ textAlign: "right" }}>
                {w.length === 0 ? <span className="zacht">-</span> : w.map((x) => <span key={x.member_id}>{ledenNamen.get(x.member_id) ?? "?"} ({x.punten})<br /></span>)}
              </span>
            </li>
          );
        })}
        {gespeeld.length === 0 && <li className="zacht">Nog geen gespeelde matchen.</li>}
      </ul>
    </>
  );
}
