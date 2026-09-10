import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { haalVerslagen, metVerslag } from "../lib/matchverslag";
import { haalAanwezigheden, haalLedenBasis, haalMatches, haalMijnStemmen, haalStats, haalStemPunten, haalStemmers, haalTeams } from "../lib/api";
import { isSpelerLid, rechten, useAuth } from "../lib/auth";
import { EIGEN_PLOEGID } from "../lib/config";
import { fmtDatum, isEigen, sorteerOpDatum } from "../lib/datum";
import { useAsync } from "../lib/useAsync";
import { Aanwezigheid } from "../components/Aanwezigheid";
import { Fout, Laden } from "../components/Layout";
import { LaatstBijgewerkt } from "../components/LaatstBijgewerkt";
import { MatchKaart } from "../components/MatchKaart";
import { MatchverslagUitklap } from "../components/MatchverslagUitklap";
import { Sfeerbeelden } from "../components/Sfeerbeelden";
import { JuniorStemming } from "../components/Junior";

import { Ploegen } from "./Ploegen";

export function Kalender() {
  const [params, setParams] = useSearchParams();
  const gekozenMatch = params.get('match');
  const { lid } = useAuth();
  const r = rechten(lid);
  const [tab, setTab] = useState<"eigen" | "reeks" | "ploegen">("eigen");
  const [toonGespeeld, setToonGespeeld] = useState(true);
  const matches = useAsync(haalMatches);
  const verslagen = useAsync(haalVerslagen);
  const teams = useAsync(haalTeams);
  const leden = useAsync(haalLedenBasis);
  const aanw = useAsync(haalAanwezigheden);
  const stats = useAsync(haalStats);
  const stemPunten = useAsync(haalStemPunten);
  const stemmers = useAsync(haalStemmers);
  const mijnStemmen = useAsync(haalMijnStemmen);
  const herlaadStemmen = async () => { await Promise.all([stemPunten.herlaad(), stemmers.herlaad(), mijnStemmen.herlaad()]); };

  if (matches.laden || teams.laden || leden.laden) return <Laden />;
  const reeks = teams.data?.find((t) => t.ploegid === EIGEN_PLOEGID)?.reeks ?? "";
  const spelers = (leden.data ?? []).filter(isSpelerLid).map((m) => ({ id: m.id, naam: m.naam }));
  const alle = sorteerOpDatum((matches.data ?? []).map(m => metVerslag(m, verslagen.data?.find(v => v.match_key === m.match_key))));
  const lijst = alle.filter((m) => (tab === "eigen" ? isEigen(m) : m.reeks === reeks)).filter((m) => gekozenMatch ? m.match_key === gekozenMatch : toonGespeeld || m.status === "gepland");

  const perDatum = new Map<string, typeof lijst>();
  for (const m of lijst) {
    const k = m.datum ?? "onbekend";
    perDatum.set(k, [...(perDatum.get(k) ?? []), m]);
  }

  return (
    <>
      <Fout tekst={matches.fout ?? teams.fout ?? leden.fout ?? verslagen.fout} />
      {gekozenMatch && <p><button className="knop licht klein" onClick={() => setParams({})}>Alle matchen tonen</button></p>}
      <div className="tabs">
        <button className={tab === "eigen" ? "actief" : ""} onClick={() => setTab("eigen")}>Steca Juniors</button>
        <button className={tab === "reeks" ? "actief" : ""} onClick={() => setTab("reeks")}>Hele reeks</button>
      <button className={tab === "ploegen" ? "actief" : ""} onClick={() => setTab("ploegen")}>Ploegen</button>
      </div>
      {tab === "ploegen" ? <Ploegen /> : <>
      <label className="klein zacht" style={{ display: "block", marginBottom: 10 }}>
        <input type="checkbox" checked={toonGespeeld} onChange={(e) => setToonGespeeld(e.target.checked)} /> gespeelde matchen tonen
      </label>
      {[...perDatum.entries()].map(([datum, ms]) => (
        <section key={datum}>
          {tab === "reeks" && <h3 style={{ marginTop: 12 }}>{fmtDatum(datum === "onbekend" ? null : datum)}</h3>}
          {ms.map((m) => (
            <MatchKaart key={m.match_key} match={m} toonDatum={tab === "eigen"} verslagKnop={isEigen(m) && lid ? (
              <MatchverslagUitklap match={m} verslag={verslagen.data?.find((v) => v.match_key === m.match_key)} stats={stats.data ?? []} spelers={spelers} isStaf={r.isStaf} onGewijzigd={async () => { await Promise.all([verslagen.herlaad(), matches.herlaad(), stats.herlaad()]); }} />
            ) : undefined}>
              {isEigen(m) && (
                <Aanwezigheid
                  match={m}
                  spelers={spelers}
                  aanwezigheden={aanw.data ?? []}
                  eigenLidId={lid?.id ?? null}
                  isSpeler={r.isSpeler}
                  isStaf={r.isStaf}
                  isAdmin={r.isAdmin}
                  onGewijzigd={aanw.herlaad}
                />
              )}
              {isEigen(m) && m.status === "gespeeld" && (
                <JuniorStemming
                  match={m}
                  spelers={spelers}
                  aanwezigheden={aanw.data ?? []}
                  punten={stemPunten.data ?? []}
                  stemmers={stemmers.data ?? []}
                  mijnStem={(mijnStemmen.data ?? []).find((v) => v.match_key === m.match_key) ?? null}
                  eigenLidId={lid?.id ?? null}
                  onGewijzigd={herlaadStemmen}
                />
              )}
              {isEigen(m) && <Sfeerbeelden matchKey={m.match_key} />}
            </MatchKaart>
          ))}
        </section>
      ))}
      {lijst.length === 0 && <div className="kaart zacht">Geen matchen gevonden.</div>}
      <LaatstBijgewerkt /></>}
    </>
  );
}
