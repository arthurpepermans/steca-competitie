import { BANK, FORMATIES, positieKort, positieLabel } from "../lib/formaties";
import type { Formatie } from "../lib/types";

type Props = {
  formatie: Formatie;
  namen: Record<string, string | undefined>; // positie -> naam
  compact?: boolean;
};

const B = 300; // breedte
const H = 440; // hoogte
const RIJ_Y = [392, 300, 200, 100]; // doelman, verdediging, middenveld, aanval (Steca valt naar boven aan)

function splitsNaam(naam: string): [string, string] {
  const [voor, ...rest] = naam.split(" ");
  return [voor, rest.join(" ")];
}

/** Voetbalveld in SVG met de spelers op hun positie. */
export function Veld({ formatie, namen, compact = false }: Props) {
  const rijen = FORMATIES[formatie];
  return (
    <>
      <svg viewBox={`0 0 ${B} ${H}`} className="veld-svg" role="img" aria-label={`Opstelling ${formatie}`}>
        <defs>
          <linearGradient id="gras" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3f9a4a" />
            <stop offset="1" stopColor="#2f7d3a" />
          </linearGradient>
        </defs>
        <rect width={B} height={H} rx="8" fill="url(#gras)" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <rect key={i} x="0" y={i * (H / 8)} width={B} height={H / 16} fill="#ffffff" opacity="0.045" />
        ))}
        <g fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.9">
          <rect x="12" y="12" width={B - 24} height={H - 24} />
          <line x1="12" y1={H / 2} x2={B - 12} y2={H / 2} />
          <circle cx={B / 2} cy={H / 2} r="36" />
          <rect x={B / 2 - 80} y="12" width="160" height="66" />
          <rect x={B / 2 - 34} y="12" width="68" height="24" />
          <rect x={B / 2 - 80} y={H - 78} width="160" height="66" />
          <rect x={B / 2 - 34} y={H - 36} width="68" height="24" />
          <path d={`M ${B / 2 - 30} 78 A 36 36 0 0 0 ${B / 2 + 30} 78`} />
          <path d={`M ${B / 2 - 30} ${H - 78} A 36 36 0 0 1 ${B / 2 + 30} ${H - 78}`} />
        </g>
        <g fill="#ffffff" opacity="0.9">
          <circle cx={B / 2} cy={H / 2} r="2.5" />
          <circle cx={B / 2} cy="58" r="2.5" />
          <circle cx={B / 2} cy={H - 58} r="2.5" />
        </g>
        {rijen.map((rij, r) =>
          rij.map((pos, i) => {
            const x = (B * (i + 1)) / (rij.length + 1);
            const y = RIJ_Y[r];
            const naam = namen[pos];
            const [voor, achter] = naam ? splitsNaam(naam) : ["", ""];
            return (
              <g key={pos} transform={`translate(${x} ${y})`}>
                <title>{positieLabel(pos)}{naam ? `: ${naam}` : ""}</title>
                <circle r="15" fill={naam ? "#7a1f2b" : "rgba(255,255,255,0.15)"} stroke="#ffffff" strokeWidth="2" strokeDasharray={naam ? undefined : "3 3"} />
                <text y="4" textAnchor="middle" fontSize="9" fontWeight="700" fill="#ffffff">{positieKort(pos)}</text>
                {naam ? (
                  <>
                    <rect x="-34" y="19" width="68" height={achter ? 24 : 14} rx="4" fill="#ffffff" opacity="0.92" />
                    <text y="29" textAnchor="middle" fontSize="9" fontWeight="600" fill="#1f1f1f">{voor}</text>
                    {achter && <text y="39" textAnchor="middle" fontSize="8" fill="#444">{achter}</text>}
                  </>
                ) : (
                  <text y="31" textAnchor="middle" fontSize="8" fill="#ffffff" opacity="0.8">nog niet ingevuld</text>
                )}
              </g>
            );
          }),
        )}
      </svg>
      {!compact && (
        <div className="kaart">
          <strong>Bank</strong>
          <div className="namen" style={{ marginTop: 6 }}>
            {BANK.map((b) => namen[b]).filter(Boolean).map((n, i) => <span key={i}>{n}</span>)}
            {!BANK.some((b) => namen[b]) && <span className="zacht">geen bankspelers ingevuld</span>}
          </div>
        </div>
      )}
    </>
  );
}
