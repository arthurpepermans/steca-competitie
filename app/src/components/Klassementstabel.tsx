import { CaretDown } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CaretUp } from "@phosphor-icons/react/dist/csr/CaretUp";
import { EIGEN_PLOEGID } from "../lib/config";
import type { Beweging } from "../lib/stand";
import type { Standing } from "../lib/types";

/** Pijltje voor gestegen, gezakt of gelijk gebleven sinds de vorige stand. */
export function StandPijl({ beweging }: { beweging: Beweging | undefined }) {
  if (!beweging) return null;
  const label = beweging === "op" ? "gestegen" : beweging === "neer" ? "gezakt" : "gelijk gebleven";
  return (
    <span className={`stand-pijl ${beweging}`} title={label} aria-label={label}>
      {beweging === "op" ? <CaretUp size={14} weight="bold" /> : beweging === "neer" ? <CaretDown size={14} weight="bold" /> : "="}
    </span>
  );
}

export function Klassementstabel({ rijen, compact = false, beweging }: { rijen: Standing[]; compact?: boolean; beweging?: Map<number, Beweging> }) {
  const label = rijen[0]?.label;
  return (
    <>
      {label && (
        <div className="melding waarschuwing">
          Klassement <strong>{label}</strong>: berekend uit de uitslagen, de federatie heeft het officiële klassement nog niet bijgewerkt.
        </div>
      )}
      <div className="tabel-wrap">
        <table className="tabel">
          <thead>
            <tr>
              <th>#</th>
              <th>Ploeg</th>
              <th className="num">G</th>
              {!compact && <th className="num">W</th>}
              {!compact && <th className="num">D</th>}
              {!compact && <th className="num">V</th>}
              {!compact && <th className="num">+/-</th>}
              <th className="num">Pt</th>
            </tr>
          </thead>
          <tbody>
            {rijen.map((r) => (
              <tr key={r.ploegid} className={r.ploegid === EIGEN_PLOEGID ? "eigen" : ""}>
                <td className="stand-positie">{r.positie}<StandPijl beweging={beweging?.get(r.ploegid)} /></td>
                <td style={{ whiteSpace: "normal" }}>{r.ploeg}</td>
                <td className="num">{r.gespeeld}</td>
                {!compact && <td className="num">{r.gewonnen}</td>}
                {!compact && <td className="num">{r.gelijk}</td>}
                {!compact && <td className="num">{r.verloren}</td>}
                {!compact && <td className="num">{r.doelpunten_voor}-{r.doelpunten_tegen}</td>}
                <td className="num"><strong>{r.punten}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
