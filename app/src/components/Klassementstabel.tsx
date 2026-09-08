import { EIGEN_PLOEGID } from "../lib/config";
import type { Standing } from "../lib/types";

export function Klassementstabel({ rijen, compact = false }: { rijen: Standing[]; compact?: boolean }) {
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
                <td>{r.positie}</td>
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
