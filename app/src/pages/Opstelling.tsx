import { useEffect, useState } from "react";
import { bewaarOpstelling, haalLedenBasis, haalMatches, haalOpstellingSpelers, haalOpstellingen } from "../lib/api";
import { isSpelerLid, rechten, useAuth } from "../lib/auth";
import { fmtDatum, isEigen, sorteerOpDatum, tegenstander, vandaagIso, volgendeMatch } from "../lib/datum";
import { BANK, FORMATIE_KEUZES, STANDAARD_FORMATIE, allePosities, basisPosities, controleerOpstelling, positieLabel, type OpstellingKeuze } from "../lib/formaties";
import { foutTekst, useAsync } from "../lib/useAsync";
import { Fout, Laden } from "../components/Layout";
import { Veld } from "../components/Veld";
import type { Formatie, LineupPlayer } from "../lib/types";

export function Opstelling() {
  const { lid } = useAuth();
  const r = rechten(lid);
  const matches = useAsync(haalMatches);
  const lineups = useAsync(haalOpstellingen);
  const leden = useAsync(haalLedenBasis);
  const [matchKey, setMatchKey] = useState<string | null>(null);
  const [spelersVanLineup, setSpelersVanLineup] = useState<LineupPlayer[]>([]);
  const [bewerken, setBewerken] = useState(false);
  const [formatie, setFormatie] = useState<Formatie>(STANDAARD_FORMATIE);
  const [keuze, setKeuze] = useState<OpstellingKeuze>({});
  const [fout, setFout] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const eigenMatches = sorteerOpDatum((matches.data ?? []).filter(isEigen));
  const volgende = volgendeMatch(matches.data ?? []);
  const gekozenKey = matchKey ?? volgende?.match_key ?? null;
  const match = eigenMatches.find((m) => m.match_key === gekozenKey);
  const lineup = (lineups.data ?? []).find((l) => l.match_key === gekozenKey);
  const spelers = (leden.data ?? []).filter(isSpelerLid).map((m) => ({ id: m.id, naam: m.naam }));
  const namen = new Map(spelers.map((p) => [p.id, p.naam]));

  useEffect(() => {
    setBewerken(false);
    setOk(null);
    if (!lineup) {
      setSpelersVanLineup([]);
      setFormatie(STANDAARD_FORMATIE);
      setKeuze({});
      return;
    }
    haalOpstellingSpelers(lineup.id).then((rows) => {
      setSpelersVanLineup(rows);
      setFormatie(lineup.formatie);
      setKeuze(Object.fromEntries(rows.map((x) => [x.positie, x.member_id])));
    }).catch((e) => setFout(foutTekst(e)));
  }, [lineup?.id, lineup?.updated_at, lineup?.formatie, lineup?.match_key]);

  if (matches.laden || lineups.laden || leden.laden) return <Laden />;

  const veldNamen: Record<string, string | undefined> = Object.fromEntries(spelersVanLineup.map((x) => [x.positie, namen.get(x.member_id)]));
  const fouten = controleerOpstelling(formatie, keuze);

  async function opslaan() {
    if (!match) return;
    if (fouten.length) return setFout(fouten.join(" "));
    setFout(null);
    try {
      const geldige = Object.fromEntries(allePosities(formatie).map((p) => [p, keuze[p] ?? null]));
      await bewaarOpstelling(match.match_key, formatie, geldige);
      await lineups.herlaad();
      setBewerken(false);
      setOk("Opstelling opgeslagen.");
    } catch (e) {
      setFout(foutTekst(e));
    }
  }

  function wisselFormatie(f: Formatie) {
    // spelers die op een positie stonden die in de nieuwe formatie niet bestaat, vallen weg
    const toegestaan = new Set(allePosities(f));
    setFormatie(f);
    setKeuze(Object.fromEntries(Object.entries(keuze).filter(([p]) => toegestaan.has(p))));
  }

  const vandaag = vandaagIso();

  return (
    <>
      <Fout tekst={matches.fout ?? lineups.fout ?? leden.fout ?? fout} />
      {ok && <div className="melding ok">{ok}</div>}
      <div className="veld">
        <label>Match</label>
        <select value={gekozenKey ?? ""} onChange={(e) => setMatchKey(e.target.value)}>
          {eigenMatches.map((m) => (
            <option key={m.match_key} value={m.match_key}>
              {fmtDatum(m.datum)} · {tegenstander(m)}{(lineups.data ?? []).some((l) => l.match_key === m.match_key) ? " ✓" : ""}{m.match_key === volgende?.match_key ? " (volgende)" : ""}
            </option>
          ))}
        </select>
      </div>

      {!match && <div className="kaart zacht">Geen match gekozen.</div>}

      {match && !bewerken && (
        lineup ? (
          <>
            <div className="rij" style={{ marginBottom: 8 }}>
              <span className="zacht">Formatie {lineup.formatie}{lineup.gemaakt_door ? ` · door ${namen.get(lineup.gemaakt_door) ?? (leden.data ?? []).find((m) => m.id === lineup.gemaakt_door)?.naam ?? "staf"}` : ""}</span>
              {r.isStaf && <button type="button" className="knop klein" onClick={() => setBewerken(true)}>Bewerken</button>}
            </div>
            <Veld formatie={lineup.formatie} namen={veldNamen} />
          </>
        ) : (
          <div className="kaart midden">
            <p>Opstelling voor {(match.datum ?? "") >= vandaag && match.match_key === volgende?.match_key ? "de volgende match" : "deze match"} nog niet gemaakt.</p>
            {r.isStaf && <button type="button" className="knop" onClick={() => setBewerken(true)}>Opstelling maken</button>}
          </div>
        )
      )}

      {match && bewerken && r.isStaf && (
        <div className="kaart">
          <div className="veld">
            <label>Formatie</label>
            <select value={formatie} onChange={(e) => wisselFormatie(e.target.value as Formatie)}>
              {FORMATIE_KEUZES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          {[...basisPosities(formatie), ...BANK].map((pos) => {
            const gekozenElders = new Set(Object.entries(keuze).filter(([p, id]) => p !== pos && id).map(([, id]) => id));
            return (
              <div className="veld" key={pos}>
                <label className={BANK.includes(pos) ? "" : "verplicht"}>{positieLabel(pos)}</label>
                <select value={keuze[pos] ?? ""} onChange={(e) => setKeuze({ ...keuze, [pos]: e.target.value || null })}>
                  <option value="">—</option>
                  {spelers.filter((p) => !gekozenElders.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
                </select>
              </div>
            );
          })}
          {fouten.length > 0 && <div className="melding waarschuwing">{fouten.join(" ")}</div>}
          <div className="knoppen">
            <button type="button" className="knop" onClick={opslaan} disabled={fouten.length > 0}>Opslaan</button>
            <button type="button" className="knop licht" onClick={() => setBewerken(false)}>Annuleren</button>
          </div>
        </div>
      )}
    </>
  );
}
