import { useState } from "react";
import { haalBoetes, haalMatches, haalStats, haalStemPunten } from "../lib/api";
import { boeteItems, boeteTotalen, fmtBakBier, fmtEuro } from "../lib/boetes";
import { fmtDatum, isEigen, isThuis, sorteerOpDatum, tegenstander, vandaagIso } from "../lib/datum";
import { huidigSeizoen, matchesInBereik, seizoenVanDatum, type Bereik } from "../lib/seizoen";
import { eigenScore, totalen } from "../lib/stats";
import { seizoenRanglijst } from "../lib/stemmen";
import { useAsync } from "../lib/useAsync";
import { Laden } from "./Layout";

/** Seizoenscijfers van één speler: totalen, Junior d'or, boetepot en de cijfers per match.
 *  Met een knop wissel je tussen dit seizoen en alle seizoenen samen. */
export function SpelerStatistieken({ memberId }: { memberId: string }) {
  const matches = useAsync(haalMatches);
  const stats = useAsync(haalStats);
  const boetes = useAsync(haalBoetes);
  const punten = useAsync(haalStemPunten);
  const [bereik, setBereik] = useState<Bereik>("seizoen");

  if (matches.laden || stats.laden || boetes.laden || punten.laden) {
    return <div className="kaart"><Laden tekst="Statistieken laden…" /></div>;
  }
  if (matches.fout || stats.fout) {
    return <div className="kaart"><h3>Statistieken</h3><p className="zacht">Statistieken konden niet geladen worden.</p></div>;
  }

  const alleEigen = sorteerOpDatum((matches.data ?? []).filter(isEigen));
  const seizoen = huidigSeizoen(alleEigen, vandaagIso());
  const eigenMatches = matchesInBereik(alleEigen, bereik, seizoen);
  const inBereik = new Set(eigenMatches.map((m) => m.match_key));
  const alleStats = (stats.data ?? []).filter((s) => inBereik.has(s.match_key));

  const tot = totalen(alleStats, eigenMatches).find((t) => t.member_id === memberId)
    ?? { member_id: memberId, gespeeld: 0, goals: 0, assists: 0, geel: 0, rood: 0, cleanSheets: 0 };

  const ranglijst = seizoenRanglijst((punten.data ?? []).filter((p) => inBereik.has(p.match_key)));
  const plaats = ranglijst.findIndex((r) => r.member_id === memberId);
  const junior = plaats >= 0 ? ranglijst[plaats] : null;

  // boetes zonder match tellen mee op basis van hun datum
  const boetesInBereik = (boetes.data ?? []).filter((b) => bereik === "alles" || (b.match_key ? inBereik.has(b.match_key) : seizoenVanDatum(b.datum) === seizoen));
  const boete = boetes.fout ? null : boeteTotalen(boeteItems(boetesInBereik, alleStats, eigenMatches)).find((t) => t.member_id === memberId) ?? null;

  const perMatch = new Map(eigenMatches.map((m) => [m.match_key, m]));
  const rijen = alleStats
    .filter((s) => s.member_id === memberId && perMatch.has(s.match_key))
    .map((s) => ({ s, m: perMatch.get(s.match_key)! }))
    .sort((a, b) => `${b.m.datum ?? ""}`.localeCompare(`${a.m.datum ?? ""}`));

  const tegels: [number, string][] = [
    [tot.gespeeld, "gespeeld"], [tot.goals, "goals"], [tot.assists, "assists"],
    [tot.geel, "geel"], [tot.rood, "rood"], [tot.cleanSheets, "clean sheets"],
  ];
  const titel = bereik === "seizoen" ? `Statistieken seizoen ${seizoen}` : "Statistieken alle seizoenen";

  return (
    <div className="kaart">
      <div className="rij" style={{ alignItems: "baseline", gap: 12 }}>
        <h3>{titel}</h3>
        <button type="button" className="knop licht klein" aria-pressed={bereik === "alles"} onClick={() => setBereik(bereik === "seizoen" ? "alles" : "seizoen")}>
          {bereik === "seizoen" ? "All time" : "Dit seizoen"}
        </button>
      </div>
      <div className="stand-statistieken speler-cijfers">
        {tegels.map(([n, label]) => <div key={label}><strong>{n}</strong><span>{label}</span></div>)}
      </div>
      <p>
        <strong>Junior d&apos;or</strong><br />
        {junior
          ? `${junior.punten} ${junior.punten === 1 ? "punt" : "punten"}, ${plaats + 1}e plaats${junior.gewonnen ? `, ${junior.gewonnen} keer Junior van de match` : ""}`
          : <span className="zacht">nog geen punten</span>}
      </p>
      <p>
        <strong>Boetepot</strong><br />
        {boetes.fout
          ? <span className="zacht">niet beschikbaar</span>
          : boete && boete.aantal > 0
            ? `${fmtEuro(boete.cent)}${boete.bakBier ? ` en ${fmtBakBier(boete.bakBier)}` : ""} (${boete.aantal} ${boete.aantal === 1 ? "boete" : "boetes"})`
            : <span className="zacht">nog geen boetes</span>}
      </p>
      {rijen.length > 0 && (
        <div className="tabel-wrap" style={{ marginTop: 12 }}>
          <table className="tabel">
            <thead>
              <tr><th>Match</th><th>Uitslag</th><th className="num">Goals</th><th className="num">Ass.</th><th className="num">Kaarten</th></tr>
            </thead>
            <tbody>
              {rijen.map(({ s, m }) => {
                const sc = eigenScore(m);
                return (
                  <tr key={s.match_key}>
                    <td style={{ whiteSpace: "normal" }}>{fmtDatum(m.datum)}{bereik === "alles" ? ` (${m.seizoen})` : ""}<br /><span className="zacht">{isThuis(m) ? "thuis" : "uit"} tegen {tegenstander(m)}{s.gespeeld ? "" : ", niet gespeeld"}</span></td>
                    <td className="num">{sc ? `${sc.voor}-${sc.tegen}` : "?"}</td>
                    <td className="num">{s.goals}</td>
                    <td className="num">{s.assists}</td>
                    <td className="num">{s.geel ? `${s.geel}× geel` : ""}{s.geel && s.rood ? ", " : ""}{s.rood ? "rood" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {rijen.length === 0 && <p className="klein zacht">Nog geen cijfers per match ingevoerd.</p>}
    </div>
  );
}
