import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ArrowUpRight } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { fmtDatum, isEigen, mapsUrl, resultaat, score } from "../lib/datum";
import { EIGEN_PLOEGID } from "../lib/config";
import type { Match } from "../lib/types";

export function MapsKnop({ terrein }: { terrein: string | null }) {
  if (!terrein) return null;
  return (
    <a className="knop licht klein" href={mapsUrl(terrein)} target="_blank" rel="noreferrer">
      Route <ArrowUpRight size={17} aria-hidden="true" />
    </a>
  );
}

export function MatchKaart({ match, children, toonDatum = true, verslagKnop }: { match: Match; children?: ReactNode; toonDatum?: boolean; verslagKnop?: ReactNode }) {
  const { lid } = useAuth();
  const res = isEigen(match) ? resultaat(match) : null;
  const eigenThuis = match.thuis_id === EIGEN_PLOEGID;
  const eigenUit = match.uit_id === EIGEN_PLOEGID;
  return (
    <div className={`kaart ${isEigen(match) ? "accent" : ""}`}>
      {toonDatum && (
        <div className="rij zacht" style={{ marginBottom: 6 }}>
          <span>{fmtDatum(match.datum)}{match.uur ? ` · ${match.uur}` : ""}</span>
          <span>{match.reeks}</span>
        </div>
      )}
      <div className="uitslag">
        <div className="thuis" style={{ fontWeight: eigenThuis ? 700 : 400 }}>{match.thuis}</div>
        <div className={`score ${match.status}`}>{score(match) || "uur volgt"}</div>
        <div style={{ fontWeight: eigenUit ? 700 : 400 }}>{match.uit}</div>
      </div>
      <div className="rij" style={{ marginTop: 8 }}>
        <span className="zacht">{match.terrein ?? "terrein onbekend"}</span>
        <span className="rij" style={{ gap: 6 }}>
          {res && <span className={`res ${res}`}>{res}</span>}
          <MapsKnop terrein={match.terrein} />
        </span>
      </div>
      {match.opmerking && <div className="klein zacht" style={{ marginTop: 4 }}>{match.opmerking}</div>}
      {verslagKnop ?? (lid && isEigen(match) && <p><Link className="knop licht klein" to={`/match/${encodeURIComponent(match.match_key)}`}>Matchverslag bekijken</Link></p>)}
      {children}
    </div>
  );
}
