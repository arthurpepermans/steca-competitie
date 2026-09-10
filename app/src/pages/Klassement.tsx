import { useState } from "react";
import { haalBoetes, haalKlassement, haalLedenBasis, haalMatches, haalStats, haalStemPunten, haalStemmers, haalWasbeurten } from "../lib/api";
import { isSpelerLid, rechten, useAuth } from "../lib/auth";
import { EIGEN_PLOEGID } from "../lib/config";
import { fmtDatum, isEigen, sorteerOpDatum, tegenstander } from "../lib/datum";
import { sorteerOp, totalen, type Totalen } from "../lib/stats";
import { useAsync } from "../lib/useAsync";
import { Klassementstabel } from "../components/Klassementstabel";
import { Fout, Laden } from "../components/Layout";
import { LaatstBijgewerkt } from "../components/LaatstBijgewerkt";
import { StatsInvoer } from "../components/StatsInvoer";
import { Boetepot } from "../components/Boetepot";
import { JuniorDor } from "../components/Junior";
import { WasmandTabel } from "../components/Wasmand";

const KOLOMMEN: { veld: keyof Totalen; label: string }[] = [
  { veld: "goals", label: "Topschutter" },
  { veld: "assists", label: "Assists" },
  { veld: "geel", label: "Geel" },
  { veld: "rood", label: "Rood" },
  { veld: "cleanSheets", label: "Clean sheets" },
  { veld: "gespeeld", label: "Gespeeld" },
];

export function Klassement() {
  const { lid } = useAuth();
  const r = rechten(lid);
  const [tab, setTab] = useState<"klassement" | "stats" | "boetes" | "junior" | "wasmand">("klassement");
  const [reeks, setReeks] = useState<string | null>(null);
  const [sorteer, setSorteer] = useState<keyof Totalen>("goals");
  const [invoerMatch, setInvoerMatch] = useState<string>("");
  const klassement = useAsync(haalKlassement);
  const matches = useAsync(haalMatches);
  const leden = useAsync(haalLedenBasis);
  const stats = useAsync(haalStats);
  const boetes = useAsync(haalBoetes);
  const stemPunten = useAsync(haalStemPunten);
  const stemmers = useAsync(haalStemmers);
  const wasbeurten = useAsync(haalWasbeurten);

  if (klassement.laden || matches.laden || leden.laden || stats.laden || boetes.laden || stemPunten.laden) return <Laden />;
  const rijen = klassement.data ?? [];
  const eigenReeks = rijen.find((s) => s.ploegid === EIGEN_PLOEGID)?.reeks ?? rijen[0]?.reeks ?? "";
  const reeksen = [...new Set(rijen.map((s) => s.reeks))].sort();
  const gekozen = reeks ?? eigenReeks;
  const ledenNamen = new Map((leden.data ?? []).map((m) => [m.id, m.naam]));
  const spelers = (leden.data ?? []).filter(isSpelerLid).map((m) => ({ id: m.id, naam: m.naam }));
  const eigenMatches = sorteerOpDatum((matches.data ?? []).filter(isEigen));
  const gespeeld = eigenMatches.filter((m) => m.status === "gespeeld");
  const tot = sorteerOp(totalen(stats.data ?? [], eigenMatches), sorteer);
  const invoer = gespeeld.find((m) => m.match_key === invoerMatch);

  return (
    <>
      <Fout tekst={klassement.fout ?? matches.fout ?? stats.fout ?? boetes.fout ?? stemPunten.fout} />
      <div className="tabs">
        <button className={tab === "klassement" ? "actief" : ""} onClick={() => setTab("klassement")}>Klassement</button>
        <button className={tab === "stats" ? "actief" : ""} onClick={() => setTab("stats")}>Statistieken</button>
        <button className={tab === "boetes" ? "actief" : ""} onClick={() => setTab("boetes")}>Boetepot</button>
        <button className={tab === "junior" ? "actief" : ""} onClick={() => setTab("junior")}>Junior d'or</button>
        <button className={tab === "wasmand" ? "actief" : ""} onClick={() => setTab("wasmand")}>Wasmand</button>
      </div>

      {tab === "klassement" && (
        <>
          <div className="veld">
            <select value={gekozen} onChange={(e) => setReeks(e.target.value)}>
              {reeksen.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <Klassementstabel rijen={rijen.filter((s) => s.reeks === gekozen)} />
          <p className="klein zacht">Rangschikking volgens reglement: punten, gewonnen wedstrijden, doelsaldo.</p>
          <LaatstBijgewerkt />
        </>
      )}

      {tab === "stats" && (
        <>
          <div className="tabs">
            {KOLOMMEN.map((k) => (
              <button key={k.veld} className={sorteer === k.veld ? "actief" : ""} onClick={() => setSorteer(k.veld)}>{k.label}</button>
            ))}
          </div>
          <div className="tabel-wrap">
            <table className="tabel">
              <thead><tr><th>#</th><th>Speler</th><th className="num">Gesp</th><th className="num">Goals</th><th className="num">Ass.</th><th className="num">Geel</th><th className="num">Rood</th><th className="num">CS</th></tr></thead>
              <tbody>
                {tot.map((t, i) => (
                  <tr key={t.member_id} className={t.member_id === lid?.id ? "eigen" : ""}>
                    <td>{i + 1}</td>
                    <td style={{ whiteSpace: "normal" }}>{ledenNamen.get(t.member_id) ?? "?"}</td>
                    <td className="num">{t.gespeeld}</td><td className="num">{t.goals}</td><td className="num">{t.assists}</td>
                    <td className="num">{t.geel}</td><td className="num">{t.rood}</td><td className="num">{t.cleanSheets}</td>
                  </tr>
                ))}
                {tot.length === 0 && <tr><td colSpan={8} className="zacht">Nog geen statistieken ingevoerd.</td></tr>}
              </tbody>
            </table>
          </div>
          {r.isStaf && (
            <div className="kaart">
              <h3>Invoeren per match</h3>
              <div className="veld">
                <select value={invoerMatch} onChange={(e) => setInvoerMatch(e.target.value)}>
                  <option value="">Kies een gespeelde match…</option>
                  {gespeeld.map((m) => (
                    <option key={m.match_key} value={m.match_key}>{fmtDatum(m.datum)} · {tegenstander(m)} ({m.thuis_score}-{m.uit_score})</option>
                  ))}
                </select>
              </div>
              {invoer && <StatsInvoer match={invoer} spelers={spelers} stats={stats.data ?? []} ledenNamen={ledenNamen} onOpgeslagen={stats.herlaad} />}
            </div>
          )}
        </>
      )}

      {tab === "boetes" && (
        <Boetepot fines={boetes.data ?? []} stats={stats.data ?? []} matches={eigenMatches} spelers={spelers} ledenNamen={ledenNamen} eigenLidId={lid?.id ?? null} isStaf={r.isStaf} onGewijzigd={boetes.herlaad} />
      )}

      {tab === "wasmand" && (
        <>
          <Fout tekst={wasbeurten.fout} />
          <WasmandTabel matches={eigenMatches} beurten={wasbeurten.data ?? []} ledenNamen={ledenNamen} eigenLidId={lid?.id ?? null} />
        </>
      )}

      {tab === "junior" && (
        <JuniorDor matches={eigenMatches} punten={stemPunten.data ?? []} stemmers={stemmers.data ?? []} ledenNamen={ledenNamen} eigenLidId={lid?.id ?? null} />
      )}
    </>
  );
}
