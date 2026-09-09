import { useState, type FormEvent } from "react";
import { verwijderBoete, voegBoeteToe } from "../lib/api";
import { BOETE_SOORTEN, bedragVoor, boeteItems, boeteTotalen, fmtBakBier, fmtEuro, potTotaal } from "../lib/boetes";
import { fmtDatum, tegenstander, vandaagIso } from "../lib/datum";
import { foutTekst } from "../lib/useAsync";
import type { Fine, Match, MatchStat } from "../lib/types";

type Speler = { id: string; naam: string };

type Props = {
  fines: Fine[];
  stats: MatchStat[];
  /** eigen matchen (gespeeld en gepland) */
  matches: Match[];
  spelers: Speler[];
  ledenNamen: Map<string, string>;
  eigenLidId: string | null;
  isStaf: boolean;
  onGewijzigd: () => Promise<void> | void;
};

export function Boetepot({ fines, stats, matches, spelers, ledenNamen, eigenLidId, isStaf, onGewijzigd }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [toonTarieven, setToonTarieven] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const gespeeld = matches.filter((m) => m.status === "gespeeld");
  const laatste = gespeeld[gespeeld.length - 1];
  const [speler, setSpeler] = useState("");
  const [soort, setSoort] = useState(BOETE_SOORTEN[0].code);
  const [aantal, setAantal] = useState(1);
  const [vrijEuro, setVrijEuro] = useState("");
  const [matchKey, setMatchKey] = useState(laatste?.match_key ?? "");
  const [opmerking, setOpmerking] = useState("");

  const items = boeteItems(fines, stats, matches);
  const totalen = boeteTotalen(items);
  const pot = potTotaal(totalen);
  const perMatch = new Map(matches.map((m) => [m.match_key, m]));
  const gekozenSoort = BOETE_SOORTEN.find((s) => s.code === soort)!;
  const bedrag = bedragVoor(soort, aantal, Math.round(Number(vrijEuro.replace(",", ".")) * 100) || 0);

  async function doe(actie: () => Promise<void>) {
    setBezig(true);
    setFout(null);
    try {
      await actie();
      await onGewijzigd();
    } catch (e) {
      setFout(foutTekst(e));
    } finally {
      setBezig(false);
    }
  }

  async function toevoegen(e: FormEvent) {
    e.preventDefault();
    if (!speler) return setFout("Kies een speler.");
    if (gekozenSoort.vrijBedrag && bedrag <= 0) return setFout("Vul een bedrag in.");
    const m = perMatch.get(matchKey);
    await doe(async () => {
      await voegBoeteToe({
        member_id: speler,
        match_key: m?.match_key ?? null,
        datum: m?.datum ?? vandaagIso(),
        soort,
        aantal: gekozenSoort.perWeek ? aantal : 1,
        bedrag_cent: bedrag,
        bak_bier: gekozenSoort.bakBier ?? 0,
        opmerking: opmerking.trim() || null,
      });
      setOpmerking("");
      setAantal(1);
      setVrijEuro("");
    });
  }

  function matchTekst(key: string | null): string {
    const m = key ? perMatch.get(key) : undefined;
    return m ? `${fmtDatum(m.datum)} tegen ${tegenstander(m)}` : "";
  }

  return (
    <>
      <div className="kaart">
        <div className="rij boven">
          <div>
            <div className="zacht">In de pot</div>
            <div className="groot">{fmtEuro(pot.cent)}</div>
            <div className="zacht">
              {pot.aantal} {pot.aantal === 1 ? "boete" : "boetes"}
              {pot.bakBier > 0 ? `, plus ${fmtBakBier(pot.bakBier)}` : ""}
            </div>
          </div>
          <button type="button" className="knop licht klein" onClick={() => setToonTarieven(!toonTarieven)}>
            {toonTarieven ? "Tarieven sluiten" : "Tarieven"}
          </button>
        </div>
        {toonTarieven && (
          <ul className="lijst" style={{ marginTop: 10 }}>
            {BOETE_SOORTEN.filter((s) => !s.vrijBedrag).map((s) => (
              <li key={s.code} className="rij klein">
                <span>{s.label}{s.automatisch ? <span className="zacht"> (uit de statistieken)</span> : null}</span>
                <span>{s.bakBier ? fmtBakBier(s.bakBier) : fmtEuro(s.cent)}</span>
              </li>
            ))}
            <li className="klein zacht">Verwittigen kan tot een uur voor de match. Rode kaart: een bak bier. Met dit geld doen we samen iets.</li>
          </ul>
        )}
      </div>

      <div className="tabel-wrap">
        <table className="tabel">
          <thead><tr><th>#</th><th>Speler</th><th className="num">Boetes</th><th className="num">Bedrag</th><th className="num">Bak bier</th></tr></thead>
          <tbody>
            {totalen.map((t, i) => (
              <tr key={t.member_id} className={t.member_id === eigenLidId ? "eigen" : ""} onClick={() => setOpen(open === t.member_id ? null : t.member_id)} style={{ cursor: "pointer" }}>
                <td>{i + 1}</td>
                <td style={{ whiteSpace: "normal" }}>{ledenNamen.get(t.member_id) ?? "?"}</td>
                <td className="num">{t.aantal}</td>
                <td className="num">{fmtEuro(t.cent)}</td>
                <td className="num">{t.bakBier || ""}</td>
              </tr>
            ))}
            {totalen.length === 0 && <tr><td colSpan={5} className="zacht">Nog geen boetes. Zo houden.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="klein zacht">Tik op een speler voor de details. Gele en rode kaarten komen automatisch uit de wedstrijdstatistieken.</p>

      {open && (
        <div className="kaart">
          <h3>{ledenNamen.get(open) ?? "?"}</h3>
          <ul className="lijst">
            {(totalen.find((t) => t.member_id === open)?.items ?? []).map((it, i) => (
              <li key={it.id ?? `${it.match_key}-${it.soort}-${i}`} className="rij boven">
                <span>
                  {it.label}{it.aantal > 1 ? ` (${it.aantal}x)` : ""}
                  <br />
                  <span className="klein zacht">{it.datum ? fmtDatum(it.datum) : ""}{it.match_key && matchTekst(it.match_key) ? `, ${matchTekst(it.match_key).replace(/^.*? tegen /, "tegen ")}` : ""}{it.opmerking ? `, ${it.opmerking}` : ""}</span>
                </span>
                <span className="rij" style={{ gap: 6 }}>
                  <span>{it.bakBier ? fmtBakBier(it.bakBier) : fmtEuro(it.cent)}</span>
                  {isStaf && it.id && (
                    <button type="button" className="knop licht klein" disabled={bezig} onClick={() => { if (confirm("Deze boete verwijderen?")) void doe(() => verwijderBoete(it.id!)); }}>
                      Verwijder
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isStaf && (
        <form className="kaart" onSubmit={toevoegen}>
          <h3>Boete toevoegen</h3>
          {fout && <div className="melding fout">{fout}</div>}
          <div className="veld">
            <label>Speler</label>
            <select value={speler} onChange={(e) => setSpeler(e.target.value)} required>
              <option value="">Kies een speler…</option>
              {spelers.map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
            </select>
          </div>
          <div className="veld">
            <label>Overtreding</label>
            <select value={soort} onChange={(e) => setSoort(e.target.value)}>
              {BOETE_SOORTEN.filter((s) => !s.automatisch).map((s) => (
                <option key={s.code} value={s.code}>{s.label}{s.cent ? ` (${fmtEuro(s.cent)})` : ""}</option>
              ))}
            </select>
          </div>
          {gekozenSoort.perWeek && (
            <div className="veld">
              <label>Aantal weken</label>
              <input type="number" min={1} max={52} value={aantal} onChange={(e) => setAantal(Math.max(1, Number(e.target.value) || 1))} />
            </div>
          )}
          {gekozenSoort.vrijBedrag && (
            <div className="veld">
              <label>Bedrag in euro</label>
              <input type="text" inputMode="decimal" placeholder="bv. 7,50" value={vrijEuro} onChange={(e) => setVrijEuro(e.target.value)} />
            </div>
          )}
          <div className="veld">
            <label>Match (optioneel)</label>
            <select value={matchKey} onChange={(e) => setMatchKey(e.target.value)}>
              <option value="">Geen match, datum van vandaag</option>
              {[...gespeeld].reverse().map((m) => <option key={m.match_key} value={m.match_key}>{matchTekst(m.match_key)}</option>)}
            </select>
          </div>
          <div className="veld">
            <label>Opmerking (optioneel)</label>
            <input value={opmerking} onChange={(e) => setOpmerking(e.target.value)} maxLength={120} />
          </div>
          <div className="rij">
            <span className="zacht">Bedrag: <strong>{gekozenSoort.bakBier ? fmtBakBier(gekozenSoort.bakBier) : fmtEuro(bedrag)}</strong></span>
            <button className="knop" disabled={bezig}>Toevoegen</button>
          </div>
        </form>
      )}
    </>
  );
}
