import { useEffect, useState } from "react";
import { bewaarOpstelling, haalAanwezigheden, haalLedenBasis, haalMatches, haalOpstellingSpelers, haalOpstellingen } from "../lib/api";
import { aanwezigeSpelerIds, nietAanwezigeKeuzes } from "../lib/opstellingAanwezigheid";
import { Aanwezigheid } from "../components/Aanwezigheid";
import { isSpelerLid, rechten, useAuth } from "../lib/auth";
import { fmtDatum, isEigen, sorteerOpDatum, tegenstander, vandaagIso, volgendeMatch } from "../lib/datum";
import { BANK, FORMATIE_KEUZES, STANDAARD_FORMATIE, allePosities, basisPosities, controleerOpstelling, positieLabel, veranderFormatie, type OpstellingKeuze } from "../lib/formaties";
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
  const aanwezigheden = useAsync(haalAanwezigheden);
  const [opslaanBezig, setOpslaanBezig] = useState(false);
  const [spelersLaden, setSpelersLaden] = useState(false);
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
  const aanwezig = aanwezigeSpelerIds(gekozenKey, aanwezigheden.data ?? []);
  const beschikbaar = spelers.filter((p) => aanwezig.has(p.id));

  useEffect(() => {
    let actief = true;
    setBewerken(false);
    setOk(null);
    setFout(null);
    if (!lineup) {
      setSpelersLaden(false);
      setSpelersVanLineup([]);
      setFormatie(STANDAARD_FORMATIE);
      setKeuze({});
      return;
    }
    setSpelersLaden(true);
    haalOpstellingSpelers(lineup.id).then((rows) => {
      if (!actief) return;
      setSpelersVanLineup(rows);
      setFormatie(lineup.formatie);
      setKeuze(Object.fromEntries(rows.map((x) => [x.positie, x.member_id])));
    }).catch((e) => { if (actief) setFout(foutTekst(e)); })
      .finally(() => { if (actief) setSpelersLaden(false); });
    return () => { actief = false; };
  }, [gekozenKey, lineup?.id, lineup?.updated_at, lineup?.formatie, lineup?.match_key]);

  if (matches.laden || lineups.laden || leden.laden || aanwezigheden.laden) return <Laden />;

  const veldNamen: Record<string, string | undefined> = Object.fromEntries(spelersVanLineup.map((x) => [x.positie, namen.get(x.member_id)]));
  const fouten = controleerOpstelling(formatie, keuze);
  const nietBeschikbaar = nietAanwezigeKeuzes(keuze, new Set(beschikbaar.map((p) => p.id)));
  if (nietBeschikbaar.length) fouten.push(`Niet aanwezig of niet meer speelgerechtigd: ${nietBeschikbaar.map((id) => namen.get(id) ?? "onbekende speler").join(", ")}. Pas de aanwezigheid aan of kies een andere speler.`);

  async function opslaan() {
    if (!match || opslaanBezig || aanwezigheden.fout) return;
    if (fouten.length) return setFout(fouten.join(" "));
    setFout(null);
    setOpslaanBezig(true);
    try {
      const geldige = Object.fromEntries(allePosities(formatie).map((p) => [p, keuze[p] ?? null]));
      await bewaarOpstelling(match.match_key, formatie, geldige);
      await lineups.herlaad();
      setBewerken(false);
      setOk("Opstelling opgeslagen.");
    } catch (e) {
      setFout(foutTekst(e));
      await aanwezigheden.herlaad();
    } finally {
      setOpslaanBezig(false);
    }
  }

  function wisselFormatie(f: Formatie) {
    setKeuze(veranderFormatie(formatie, f, keuze));
    setFormatie(f);
  }

  const vandaag = vandaagIso();

  return (
    <>
      <Fout tekst={matches.fout ?? lineups.fout ?? leden.fout ?? aanwezigheden.fout ?? fout} />
      {ok && <div className="melding ok">{ok}</div>}
      <div className="veld">
        <label htmlFor="opstelling-match">Match</label>
        <select id="opstelling-match" disabled={opslaanBezig} value={gekozenKey ?? ""} onChange={(e) => setMatchKey(e.target.value)}>
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
              {r.isStaf && <button type="button" className="knop klein" disabled={spelersLaden || Boolean(fout)} onClick={() => setBewerken(true)}>Bewerken</button>}
            </div>
            <Veld formatie={lineup.formatie} namen={veldNamen} />
            {r.isStaf && !spelersLaden && spelersVanLineup.some((p) => !aanwezig.has(p.member_id)) && <p className="melding waarschuwing">Deze opstelling bevat spelers die niet op aanwezig staan. Controleer de aanwezigheden en pas de opstelling aan.</p>}
          </>
        ) : (
          <div className="kaart midden">
            <Veld formatie={STANDAARD_FORMATIE} namen={{}} />
            <p>Opstelling voor {(match.datum ?? "") >= vandaag && match.match_key === volgende?.match_key ? "de volgende match" : "deze match"} nog niet gemaakt.</p>
            {r.isStaf && <button type="button" className="knop" onClick={() => setBewerken(true)}>Opstelling maken</button>}
          </div>
        )
      )}

      {match && bewerken && r.isStaf && (
        <div className="kaart">
          <Veld formatie={formatie} namen={Object.fromEntries(Object.entries(keuze).map(([p, id]) => [p, id ? namen.get(id) : undefined]))} compact />
          <div className="veld">
            <label htmlFor="opstelling-formatie">Formatie</label>
            <select id="opstelling-formatie" value={formatie} onChange={(e) => wisselFormatie(e.target.value as Formatie)}>
              {FORMATIE_KEUZES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          {[...basisPosities(formatie), ...BANK].map((pos) => {
            const gekozenElders = new Set(Object.entries(keuze).filter(([p, id]) => p !== pos && id).map(([, id]) => id));
            return (
              <div className="veld" key={pos}>
                <label htmlFor={"positie-" + pos} className={BANK.includes(pos) ? "" : "verplicht"}>{positieLabel(pos)}</label>
                <select id={"positie-" + pos} value={keuze[pos] ?? ""} onChange={(e) => setKeuze({ ...keuze, [pos]: e.target.value || null })}>
                  <option value="">—</option>
                  {keuze[pos] && !beschikbaar.some((p) => p.id === keuze[pos]) && <option value={keuze[pos]!} disabled>{namen.get(keuze[pos]!) ?? "Speler"} (niet beschikbaar)</option>}
                  {beschikbaar.filter((p) => !gekozenElders.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
                </select>
              </div>
            );
          })}
          {fouten.length > 0 && <div className="melding waarschuwing">{fouten.join(" ")}</div>}
          <div className="knoppen">
            <button type="button" className="knop" onClick={opslaan} disabled={opslaanBezig || Boolean(aanwezigheden.fout) || fouten.length > 0}>{opslaanBezig ? "Opslaan…" : "Opslaan"}</button>
            <button type="button" className="knop licht" onClick={() => setBewerken(false)}>Annuleren</button>
          </div>
        </div>
      )}
      {match && r.isStaf && (
        <div className="kaart">
          <h2>Aanwezigheid</h2>
          <p>Alleen aanwezige spelers kunnen in de basis of op de bank staan. Momenteel beschikbaar: {beschikbaar.length}.</p>
          <Aanwezigheid key={match.match_key} match={match} spelers={spelers} aanwezigheden={aanwezigheden.data ?? []} eigenLidId={lid?.id ?? null} isSpeler={r.isSpeler} isStaf={r.isStaf} isAdmin={r.isAdmin} onGewijzigd={aanwezigheden.herlaad} />
        </div>
      )}

    </>
  );
}
