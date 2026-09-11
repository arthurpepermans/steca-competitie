import { useState, type FormEvent } from "react";
import { haalLichtkrantBerichten, verwijderLichtkrantBericht, voegLichtkrantBerichtToe, wijzigLichtkrantBericht } from "../lib/api";
import { fmtTijdstip } from "../lib/datum";
import { foutTekst, useAsync } from "../lib/useAsync";

export const LICHTKRANT_HERLADEN = "lichtkrant-herladen";
const MAX = 140;

/** Beheer van eigen boodschappen in de lichtkrant, alleen voor admins. */
export function LichtkrantBeheer() {
  const berichten = useAsync(haalLichtkrantBerichten);
  const [tekst, setTekst] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function doe(actie: () => Promise<void>) {
    setBezig(true);
    setFout(null);
    try {
      await actie();
      await berichten.herlaad();
      window.dispatchEvent(new Event(LICHTKRANT_HERLADEN));
    } catch (e) {
      setFout(foutTekst(e));
    } finally {
      setBezig(false);
    }
  }

  async function toevoegen(e: FormEvent) {
    e.preventDefault();
    const t = tekst.trim();
    if (!t) return;
    await doe(async () => { await voegLichtkrantBerichtToe(t); setTekst(""); });
  }

  const lijst = berichten.data ?? [];
  return (
    <div className="kaart">
      <h3>Lichtkrant</h3>
      <p className="klein zacht">Eigen boodschappen lopen mee in de gouden band bovenaan, voor de automatische berichten. Zet een boodschap uit om ze tijdelijk te verbergen.</p>
      {(berichten.fout || fout) && <div className="melding fout">{berichten.fout ?? fout}</div>}
      <form onSubmit={toevoegen}>
        <div className="veld">
          <label htmlFor="lichtkrant-tekst">Nieuwe boodschap</label>
          <input id="lichtkrant-tekst" value={tekst} maxLength={MAX} placeholder="Bv. Zaterdag verzamelen om 13:30 aan de Steca" onChange={(e) => setTekst(e.target.value)} disabled={bezig} />
          <span className="klein zacht">{tekst.length}/{MAX}</span>
        </div>
        <button className="knop" disabled={bezig || !tekst.trim()}>Toevoegen</button>
      </form>
      {lijst.length > 0 && (
        <ul className="lijst omrand" style={{ marginTop: 12 }}>
          {lijst.map((b) => (
            <li key={b.id} className="rij boven">
              <span>
                <span style={{ textDecoration: b.actief ? "none" : "line-through", opacity: b.actief ? 1 : .6 }}>{b.tekst}</span>
                <br /><span className="klein zacht">{b.actief ? "loopt mee" : "uit"} · {fmtTijdstip(b.created_at)}</span>
              </span>
              <span className="knoppen" style={{ flexShrink: 0 }}>
                <button type="button" className="knop licht klein" disabled={bezig} onClick={() => doe(() => wijzigLichtkrantBericht(b.id, { actief: !b.actief }))}>{b.actief ? "Uit" : "Aan"}</button>
                <button type="button" className="knop licht klein" disabled={bezig} onClick={() => { if (confirm("Deze boodschap verwijderen?")) void doe(() => verwijderLichtkrantBericht(b.id)); }}>Verwijderen</button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {!berichten.laden && lijst.length === 0 && <p className="klein zacht" style={{ marginTop: 10 }}>Nog geen eigen boodschappen.</p>}
    </div>
  );
}
