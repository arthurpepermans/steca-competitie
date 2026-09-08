import { BANK, FORMATIES, positieKort, positieLabel } from "../lib/formaties";
import type { Formatie } from "../lib/types";

type Props = {
  formatie: Formatie;
  namen: Record<string, string | undefined>; // positie -> naam
};

export function Veld({ formatie, namen }: Props) {
  return (
    <>
      <div className="pitch">
        {FORMATIES[formatie].map((lijn, i) => (
          <div className="lijn" key={i}>
            {lijn.map((pos) => (
              <div className="speler" key={pos} title={positieLabel(pos)}>
                <div className="shirt">{positieKort(pos)}</div>
                <div className="naam">{namen[pos] ?? "—"}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="kaart">
        <strong>Bank</strong>
        <div className="namen" style={{ marginTop: 6 }}>
          {BANK.map((b) => namen[b]).filter(Boolean).map((n, i) => <span key={i}>{n}</span>)}
          {!BANK.some((b) => namen[b]) && <span className="zacht">geen bankspelers ingevuld</span>}
        </div>
      </div>
    </>
  );
}
