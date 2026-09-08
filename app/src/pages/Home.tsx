import { Link } from "react-router-dom";
import { haalAanwezigheden, haalKlassement, haalLedenBasis, haalMatches } from "../lib/api";
import { isSpelerLid, rechten, useAuth } from "../lib/auth";
import { EIGEN_PLOEGID } from "../lib/config";
import { fmtDatum, isThuis, laatsteUitslag, resultaat, tegenstander, volgendeMatch } from "../lib/datum";
import { useAsync } from "../lib/useAsync";
import { Aanwezigheid } from "../components/Aanwezigheid";
import { Fout, Laden } from "../components/Layout";
import { LaatstBijgewerkt } from "../components/LaatstBijgewerkt";
import { MapsKnop } from "../components/MatchKaart";

export function Home() {
  const { lid } = useAuth();
  const r = rechten(lid);
  const matches = useAsync(haalMatches);
  const klassement = useAsync(haalKlassement);
  const leden = useAsync(haalLedenBasis);
  const aanw = useAsync(haalAanwezigheden);

  if (matches.laden || klassement.laden || leden.laden) return <Laden />;
  const volgende = volgendeMatch(matches.data ?? []);
  const laatste = laatsteUitslag(matches.data ?? []);
  const stand = (klassement.data ?? []).filter((s) => s.reeks === (klassement.data ?? []).find((x) => x.ploegid === EIGEN_PLOEGID)?.reeks);
  const eigen = stand.find((s) => s.ploegid === EIGEN_PLOEGID);
  const spelers = (leden.data ?? []).filter(isSpelerLid).map((m) => ({ id: m.id, naam: m.naam }));

  return (
    <>
      <Fout tekst={matches.fout ?? klassement.fout ?? leden.fout} />
      <h2>Volgende match</h2>
      {volgende ? (
        <div className="kaart accent">
          <div className="zacht">{fmtDatum(volgende.datum)} · {volgende.uur ?? "uur volgt"} · {isThuis(volgende) ? "thuis" : "uit"}</div>
          <div className="groot">{isThuis(volgende) ? "Steca Juniors - " + volgende.uit : volgende.thuis + " - Steca Juniors"}</div>
          <div className="rij" style={{ marginTop: 6 }}>
            <span className="zacht">{volgende.terrein ?? "terrein onbekend"}</span>
            <MapsKnop terrein={volgende.terrein} />
          </div>
          <Aanwezigheid
            match={volgende}
            spelers={spelers}
            aanwezigheden={aanw.data ?? []}
            eigenLidId={lid?.id ?? null}
            isSpeler={r.isSpeler}
            isStaf={r.isStaf}
            isAdmin={r.isAdmin}
            onGewijzigd={aanw.herlaad}
          />
        </div>
      ) : (
        <div className="kaart zacht">Geen geplande match gevonden.</div>
      )}

      <h2>Laatste uitslag</h2>
      {laatste ? (
        <div className="kaart">
          <div className="zacht">{fmtDatum(laatste.datum)} · {isThuis(laatste) ? "thuis" : "uit"} tegen {tegenstander(laatste)}</div>
          <div className="rij">
            <span className="groot">{laatste.thuis_score} - {laatste.uit_score}</span>
            <span className={`res ${resultaat(laatste)}`}>{resultaat(laatste)}</span>
          </div>
          <div className="zacht">{laatste.thuis} - {laatste.uit}</div>
        </div>
      ) : (
        <div className="kaart zacht">Nog geen uitslag dit seizoen.</div>
      )}

      <h2>Stand</h2>
      {eigen ? (
        <Link to="/klassement" className="kaart" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
          <div className="rij">
            <span className="groot">{eigen.positie}e</span>
            <span>{eigen.reeks}{eigen.label ? <span className="badge waarschuwing" style={{ marginLeft: 6 }}>{eigen.label}</span> : null}</span>
          </div>
          <div className="zacht">
            {eigen.gespeeld} gespeeld · {eigen.gewonnen}W {eigen.gelijk}G {eigen.verloren}V · {eigen.doelpunten_voor}-{eigen.doelpunten_tegen} · <strong>{eigen.punten} pt</strong>
          </div>
        </Link>
      ) : (
        <div className="kaart zacht">Geen klassement gevonden.</div>
      )}
      <LaatstBijgewerkt />
    </>
  );
}
