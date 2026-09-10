import { useState } from "react";
import { zetWasbeurt } from "../lib/api";
import { fmtDatum, isThuis, sorteerOpDatum, tegenstander } from "../lib/datum";
import { foutTekst } from "../lib/useAsync";
import type { LaundryTurn, Match } from "../lib/types";

type Speler = { id: string; naam: string };

/** Wasmand vol verfrommelde truitjes, in de kleuren van de shirts op het veld. */
export function WasmandTekening() {
  const Z = "#292929", Z2 = "#1c1c1c", Z3 = "#3a3a3a", R = "#f8f5e9", L = "#171717", V = "#4d4d4d";
  return (
    <svg className="wasmand-tekening" viewBox="0 0 150 140" role="img" aria-label="Wasmand vol truitjes">
      {/* hoop verfrommelde truitjes achter de rand */}
      <path d="M18 70c4-14 14-22 24-24 6-12 22-18 34-12 8-10 26-8 32 4 12-2 22 8 22 20 6 2 8 8 6 12Z" fill={Z} stroke={L} strokeWidth="2.5" strokeLinejoin="round" />
      <g fill="none" stroke={V} strokeWidth="1.6" strokeLinecap="round">
        <path d="M30 60c6-6 12-8 20-6M46 48c8-4 16-2 20 4M78 38c6 4 8 10 6 16M100 46c6 2 10 8 10 14M56 62c8-2 14 2 18 8M88 60c-6 2-10 6-10 12" />
      </g>
      {/* witte stukken van de shirts */}
      <path d="M52 44l16-8 10 10-14 12-9-4Z" fill={R} stroke={L} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M60 47c3 3 6 5 10 5" fill="none" stroke="#d8d3c2" strokeWidth="1.4" />
      <path d="M92 34c10-2 18 4 20 12l-14 6c-3-6-5-10-6-18Z" fill={R} stroke={L} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M98 40c4 2 7 5 9 9" fill="none" stroke="#d8d3c2" strokeWidth="1.4" />
      {/* kraagje dat uitsteekt */}
      <path d="M66 28c4-6 14-6 18 0" fill="none" stroke={R} strokeWidth="3" strokeLinecap="round" />
      <path d="M69 30c3 4 9 4 12 0" fill="none" stroke={L} strokeWidth="1.5" />
      {/* donkerder verfrommeld stuk vooraan de hoop */}
      <path d="M24 70c8-8 22-10 32-4 8-6 22-4 28 4 6-4 18-2 22 6l4 6H20Z" fill={Z2} stroke={L} strokeWidth="2" strokeLinejoin="round" />
      <path d="M40 70c6-3 12-3 18 0M76 68c6-2 12-1 16 3" fill="none" stroke={V} strokeWidth="1.6" strokeLinecap="round" />
      {/* rieten mand */}
      <path d="M16 70 27 134h96l11-64Z" fill="#c9a24f" stroke="#332e24" strokeWidth="3" strokeLinejoin="round" />
      <g stroke="#8a6a2e" strokeWidth="2" fill="none" opacity=".85">
        <path d="M22 84h106M25 98h100M28 112h94M31 126h88" />
        <path d="M36 71l9 63M56 71l5 63M75 71v63M94 71l-5 63M114 71l-9 63" />
      </g>
      <path d="M10 64h130v10H10Z" fill="#d9b565" stroke="#332e24" strokeWidth="3" strokeLinejoin="round" />
      <path d="M10 69c-8 0-8 12 0 12M140 69c8 0 8 12 0 12" fill="none" stroke="#332e24" strokeWidth="3" strokeLinecap="round" />
      {/* mouw die links over de rand hangt */}
      <path d="M30 62c-4 8-10 18-8 30 4 3 10 3 14-1 2-10 2-20 4-28Z" fill={Z3} stroke={L} strokeWidth="2" strokeLinejoin="round" />
      <path d="M22 88c4 3 10 3 14-1" fill="none" stroke={R} strokeWidth="3" strokeLinecap="round" />
      <path d="M28 70c-1 6-2 12-2 16" fill="none" stroke={V} strokeWidth="1.4" />
      {/* stuk shirt met witte band dat rechts over de rand hangt */}
      <path d="M104 62c8 2 16 6 20 12-2 10-6 18-10 24-6-2-12-6-16-12 4-8 6-16 6-24Z" fill={Z} stroke={L} strokeWidth="2" strokeLinejoin="round" />
      <path d="M102 76c6 2 12 6 16 10l-4 8c-5-3-9-6-14-10Z" fill={R} stroke={L} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M108 68c2 4 2 8 0 12" fill="none" stroke={V} strokeWidth="1.4" />
    </svg>
  );
}

type KeuzeProps = {
  match: Match;
  beurt: LaundryTurn | undefined;
  spelers: Speler[];
  beschikbaar: Speler[];
  isStaf: boolean;
  fout?: string | null;
  onGewijzigd: () => Promise<void> | void;
};

/** Onder de bank op de opstellingspagina: wie neemt de wasmand mee naar huis. */
export function WasmandKeuze({ match, beurt, spelers, beschikbaar, isStaf, fout: laadFout, onGewijzigd }: KeuzeProps) {
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const naam = beurt ? spelers.find((p) => p.id === beurt.member_id)?.naam ?? "onbekende speler" : null;
  // Iedereen is te kiezen, ook wie niet op aanwezig staat; de aanwezigen staan bovenaan.
  const aanwezigIds = new Set(beschikbaar.map((p) => p.id));
  const keuzelijst = [...spelers].sort((a, b) => Number(aanwezigIds.has(b.id)) - Number(aanwezigIds.has(a.id)) || a.naam.localeCompare(b.naam, "nl"));

  async function zet(memberId: string | null) {
    setBezig(true);
    setFout(null);
    try {
      await zetWasbeurt(match.match_key, memberId);
      await onGewijzigd();
    } catch (e) {
      setFout(foutTekst(e));
    } finally {
      setBezig(false);
    }
  }

  return (
    <section className="kaart wasmand-blok" aria-label="Wasmand">
      <WasmandTekening />
      <div className="wasmand-tekst">
        <h3>De wasmand</h3>
        {laadFout ? (
          <p className="zacht">De wasbeurten konden niet geladen worden.</p>
        ) : (
          <p>{naam ? <>Gaat mee met <strong>{naam}</strong>.</> : <span className="zacht">Nog niemand aangeduid voor deze match.</span>}</p>
        )}
        {fout && <div className="melding fout">{fout}</div>}
        {isStaf && !laadFout && (
          <div className="veld" style={{ marginBottom: 0 }}>
            <label htmlFor={`wasmand-${match.match_key}`}>Wie neemt de mand mee?</label>
            <select id={`wasmand-${match.match_key}`} disabled={bezig} value={beurt?.member_id ?? ""} onChange={(e) => zet(e.target.value || null)}>
              <option value="">Nog niet aangeduid</option>
              {keuzelijst.map((p) => <option key={p.id} value={p.id}>{p.naam}{aanwezigIds.size > 0 && !aanwezigIds.has(p.id) ? " (niet op aanwezig)" : ""}</option>)}
            </select>
          </div>
        )}
      </div>
    </section>
  );
}

type TabelProps = {
  matches: Match[];
  beurten: LaundryTurn[];
  ledenNamen: Map<string, string>;
  eigenLidId: string | null;
};

/** Tabblad Wasmand bij het klassement: per match wie de mand mee naar huis nam. */
export function WasmandTabel({ matches, beurten, ledenNamen, eigenLidId }: TabelProps) {
  const perMatch = new Map(beurten.map((b) => [b.match_key, b]));
  const rijen = sorteerOpDatum(matches).reverse();
  const teller = new Map<string, number>();
  for (const b of beurten) teller.set(b.member_id, (teller.get(b.member_id) ?? 0) + 1);
  return (
    <>
      <div className="tabel-wrap">
        <table className="tabel">
          <thead><tr><th>Match</th><th>Wasmand</th></tr></thead>
          <tbody>
            {rijen.map((m) => {
              const b = perMatch.get(m.match_key);
              return (
                <tr key={m.match_key} className={b && b.member_id === eigenLidId ? "eigen" : ""}>
                  <td style={{ whiteSpace: "normal" }}>{fmtDatum(m.datum)}<br /><span className="zacht">{isThuis(m) ? "thuis" : "uit"} tegen {tegenstander(m)}</span></td>
                  <td style={{ whiteSpace: "normal" }}>{b ? ledenNamen.get(b.member_id) ?? "onbekende speler" : <span className="zacht">{m.status === "gespeeld" ? "niet ingevuld" : "nog niet aangeduid"}</span>}</td>
                </tr>
              );
            })}
            {rijen.length === 0 && <tr><td colSpan={2} className="zacht">Nog geen matchen.</td></tr>}
          </tbody>
        </table>
      </div>
      {teller.size > 0 && (
        <p className="klein zacht">
          Al geweest: {[...teller.entries()].map(([id, n]) => `${ledenNamen.get(id) ?? "?"}${n > 1 ? ` (${n}×)` : ""}`).join(", ")}.
        </p>
      )}
    </>
  );
}
