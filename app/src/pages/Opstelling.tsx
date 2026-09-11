import { useEffect, useRef, useState } from "react";
import { LockSimple } from "@phosphor-icons/react/dist/csr/LockSimple";
import { LockSimpleOpen } from "@phosphor-icons/react/dist/csr/LockSimpleOpen";
import { bewaarOpstellingAutomatisch, haalAanwezigheden, haalLedenBasis, haalMatches, haalOpstellingSpelers, haalOpstellingen, haalWasbeurten } from "../lib/api";
import { aanwezigeSpelerIds, nietAanwezigeKeuzes } from "../lib/opstellingAanwezigheid";
import { Aanwezigheid } from "../components/Aanwezigheid";
import { isSpelerLid, rechten, useAuth } from "../lib/auth";
import { fmtDatum, isEigen, sorteerOpDatum, tegenstander, vandaagIso, volgendeMatch } from "../lib/datum";
import { BANK, FORMATIE_KEUZES, STANDAARD_FORMATIE, allePosities, basisPosities, controleerOpstelling, positieLabel, radOpstelling, veranderFormatie, type OpstellingKeuze } from "../lib/formaties";
import { foutTekst, useAsync } from "../lib/useAsync";
import { Fout, Laden } from "../components/Layout";
import { Veld } from "../components/Veld";
import { WasmandKeuze } from "../components/Wasmand";
import { maakOpslaanRij } from "../lib/opslaanRij";
import type { Formatie, LineupPlayer } from "../lib/types";

type Concept = { formatie: Formatie; keuze: OpstellingKeuze; slotjes: string[] };

export function Opstelling() {
  const { lid } = useAuth();
  const r = rechten(lid);
  const matches = useAsync(haalMatches);
  const lineups = useAsync(haalOpstellingen);
  const leden = useAsync(haalLedenBasis);
  const aanwezigheden = useAsync(haalAanwezigheden);
  const wasbeurten = useAsync(haalWasbeurten);
  const [opslaanBezig, setOpslaanBezig] = useState(false);
  const [spelersLaden, setSpelersLaden] = useState(false);
  const [matchKey, setMatchKey] = useState<string | null>(null);
  const [spelersVanLineup, setSpelersVanLineup] = useState<LineupPlayer[]>([]);
  const [bewerken, setBewerken] = useState(false);
  const [formatie, setFormatie] = useState<Formatie>(STANDAARD_FORMATIE);
  const [keuze, setKeuze] = useState<OpstellingKeuze>({});
  const [slotjes, setSlotjes] = useState<string[]>([]);
  const [fout, setFout] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [radDraait, setRadDraait] = useState(false);
  const radTimer = useRef<number | null>(null);
  const opslag = useRef<ReturnType<typeof maakOpslaanRij<Concept>> | null>(null);
  const [onbewaard, setOnbewaard] = useState(false);
  const [opslagFout, setOpslagFout] = useState(false);
  const [herlaadNr, setHerlaadNr] = useState(0);
  useEffect(() => () => { if (radTimer.current) window.clearInterval(radTimer.current); }, []);

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
    if (!onbewaard) return;
    const waarschuw = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", waarschuw);
    return () => window.removeEventListener("beforeunload", waarschuw);
  }, [onbewaard]);

  useEffect(() => {
    let actief = true;
    opslag.current = null;
    setOnbewaard(false); setOpslagFout(false); setOpslaanBezig(false);
    const sleutel = `steca-concept-${lid?.id}-${gekozenKey}`;
    function startOpslag(rows: LineupPlayer[], f: Formatie) {
      if (!gekozenKey) return;
      let versie = lineup?.updated_at ?? null;
      let laatste: Concept | null = null;
      const eigenaar = crypto.randomUUID();
      let bezitReserve = false;
      const reserve = () => {
        try {
          const bestaand = sessionStorage.getItem(sleutel);
          if (bezitReserve && (!bestaand || JSON.parse(bestaand).eigenaar !== eigenaar)) return;
          if (laatste) { sessionStorage.setItem(sleutel, JSON.stringify({ ...laatste, versie, eigenaar })); bezitReserve = true; }
          else if (bezitReserve) { sessionStorage.removeItem(sleutel); bezitReserve = false; }
        } catch { /* De serveropslag blijft werken als lokale opslag niet beschikbaar is. */ }
      };
      const rij = maakOpslaanRij<Concept>(async concept => {
        const bewaard = await bewaarOpstellingAutomatisch(gekozenKey, concept.formatie, concept.keuze, concept.slotjes, versie);
        versie = bewaard.updated_at;
        reserve();
        if (actief) setSpelersVanLineup(Object.entries(concept.keuze).filter(([, id]) => id).map(([positie, id]) => ({ lineup_id: bewaard.id, positie, member_id: id!, vergrendeld: concept.slotjes.includes(positie) })));
      }, (status, error) => {
        if (status === "bewaard") { laatste = null; reserve(); }
        if (!actief) return;
        setOpslaanBezig(status === "opslaan");
        setOpslagFout(status === "fout");
        setOnbewaard(status !== "bewaard");
        setFout(status === "fout" ? foutTekst(error) : null);
        setOk(status === "bewaard" ? "Automatisch opgeslagen." : null);
      });
      opslag.current = {
        wijzig(concept) { laatste = concept; reserve(); rij.wijzig(concept); },
        opnieuw: rij.opnieuw,
      };
      setFormatie(f);
      setKeuze(Object.fromEntries(rows.map(x => [x.positie, x.member_id])));
      setSlotjes(rows.filter(x => x.vergrendeld).map(x => x.positie));
      // Bewaar een mislukte of onderbroken wijziging per account en wedstrijd in deze tab.
      if (r.isStaf) try {
        const tekst = sessionStorage.getItem(sleutel);
        if (tekst) {
          const concept = JSON.parse(tekst);
          if (FORMATIE_KEUZES.includes(concept.formatie) && concept.keuze && Array.isArray(concept.slotjes)) {
            versie = concept.versie ?? null;
            setFormatie(concept.formatie); setKeuze(concept.keuze); setSlotjes(concept.slotjes);
            setBewerken(true);
            opslag.current.wijzig(concept);
          }
        }
      } catch { /* Een onleesbaar concept blokkeert het laden niet. */ }
    }
    if (radTimer.current) window.clearInterval(radTimer.current);
    radTimer.current = null;
    setRadDraait(false);
    setSlotjes([]);
    setBewerken(false);
    setOk(null);
    setFout(null);
    if (!lineup) {
      setSpelersLaden(false);
      setSpelersVanLineup([]);
      setFormatie(STANDAARD_FORMATIE);
      setKeuze({});
      startOpslag([], STANDAARD_FORMATIE);
      return () => { actief = false; };
    }
    setSpelersLaden(true);
    haalOpstellingSpelers(lineup.id).then((rows) => {
      if (!actief) return;
      setSpelersVanLineup(rows);
      startOpslag(rows, lineup.formatie);
    }).catch((e) => { if (actief) setFout(foutTekst(e)); })
      .finally(() => { if (actief) setSpelersLaden(false); });
    return () => { actief = false; };
  }, [gekozenKey, lineup?.id, lineup?.updated_at, lineup?.formatie, lineup?.match_key, lid?.id, herlaadNr]);

  if (matches.laden || lineups.laden || leden.laden || aanwezigheden.laden) return <Laden />;

  const veldNamen: Record<string, string | undefined> = Object.fromEntries(spelersVanLineup.map((x) => [x.positie, namen.get(x.member_id)]));
  const fouten = controleerOpstelling(formatie, keuze);
  const nietBeschikbaar = nietAanwezigeKeuzes(keuze, new Set(beschikbaar.map((p) => p.id)));
  if (nietBeschikbaar.length) fouten.push(`Niet aanwezig of niet meer speelgerechtigd: ${nietBeschikbaar.map((id) => namen.get(id) ?? "onbekende speler").join(", ")}. Pas de aanwezigheid aan of kies een andere speler.`);

  function wijzigConcept(k: OpstellingKeuze, f = formatie, s = slotjes) {
    setKeuze(k); setFormatie(f); setSlotjes(s);
    setOnbewaard(true); setOk(null);
    opslag.current?.wijzig({ formatie: f, keuze: Object.fromEntries(allePosities(f).map(p => [p, k[p] ?? null])), slotjes: [...s] });
  }
  /** HET RAD: laat de namen een seconde rondtollen en zet dan een willekeurige opstelling uit de aanwezige spelers. */
  function draaiRad(f: Formatie = formatie) {
    if (radDraait || !radKanDraaien) return;
    const ids = beschikbaar.map((p) => p.id);
    const vast = Object.fromEntries(slotjes.map(pos => [pos, keuze[pos]]));
    setOk(null);
    setFout(null);
    setRadDraait(true);
    let stap = 0;
    radTimer.current = window.setInterval(() => {
      stap += 1;
      const resultaat = radOpstelling(f, ids, Math.random, vast);
      setKeuze(resultaat);
      if (stap >= 10) {
        if (radTimer.current) window.clearInterval(radTimer.current);
        radTimer.current = null;
        setRadDraait(false);
        wijzigConcept(resultaat, f);
      }
    }, 90);
  }

  const radNodig = basisPosities(formatie).length + slotjes.filter(pos => BANK.includes(pos)).length;
  const radKanDraaien = beschikbaar.length >= radNodig && slotjes.every(pos => keuze[pos] && beschikbaar.some(p => p.id === keuze[pos]));

  function wisselFormatie(f: Formatie) {
    const verdwenen = slotjes.filter(pos => !allePosities(f).includes(pos));
    if (verdwenen.length) { setFout(`Ontgrendel eerst ${verdwenen.map(positieLabel).join(", ")}. Die positie bestaat niet in ${f}.`); return; }
    setFout(null);
    wijzigConcept(veranderFormatie(formatie, f, keuze), f);
  }

  const vandaag = vandaagIso();

  return (
    <>
      <Fout tekst={matches.fout ?? lineups.fout ?? leden.fout ?? aanwezigheden.fout ?? fout} />
      {ok && <div className="melding ok">{ok}</div>}
      <div className="veld">
        <label htmlFor="opstelling-match">Match</label>
        <select id="opstelling-match" disabled={opslaanBezig || onbewaard || radDraait} value={gekozenKey ?? ""} onChange={(e) => setMatchKey(e.target.value)}>
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
            <Veld memberIds={Object.fromEntries(spelersVanLineup.map(p=>[p.positie,p.member_id]))} formatie={lineup.formatie} namen={veldNamen} slotjes={spelersVanLineup.filter(p => p.vergrendeld).map(p => p.positie)} />
            {r.isStaf && !spelersLaden && spelersVanLineup.some((p) => !aanwezig.has(p.member_id)) && <p className="melding waarschuwing">Deze opstelling bevat spelers die niet op aanwezig staan. Controleer de aanwezigheden en pas de opstelling aan.</p>}
          </>
        ) : (
          <div className="kaart midden">
            <Veld formatie={STANDAARD_FORMATIE} namen={{}} />
            <p>Opstelling voor {(match.datum ?? "") >= vandaag && match.match_key === volgende?.match_key ? "de volgende match" : "deze match"} nog niet gemaakt.</p>
            {r.isStaf && (
              <div className="knoppen" style={{ justifyContent: "center" }}>
                <button type="button" className="knop" onClick={() => setBewerken(true)}>Opstelling maken</button>
                <button type="button" className="knop licht" disabled={!radKanDraaien} onClick={() => { setBewerken(true); draaiRad(); }}>HET RAD</button>
              </div>
            )}
          </div>
        )
      )}

      {match && bewerken && r.isStaf && (
        <div className="kaart">
          <Veld memberIds={keuze} formatie={formatie} namen={Object.fromEntries(Object.entries(keuze).map(([p, id]) => [p, id ? namen.get(id) : undefined]))} slotjes={slotjes} compact />
          <div className="veld">
            <label htmlFor="opstelling-formatie">Formatie</label>
            <select id="opstelling-formatie" disabled={radDraait || opslaanBezig} value={formatie} onChange={(e) => wisselFormatie(e.target.value as Formatie)}>
              {FORMATIE_KEUZES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div className="rij" style={{ marginBottom: 12 }}>
            <button type="button" className="knop" onClick={() => draaiRad()} disabled={radDraait || opslaanBezig || !radKanDraaien} aria-live="polite">
              {radDraait ? "HET RAD DRAAIT…" : "HET RAD"}
            </button>
            <span className="klein zacht">{radKanDraaien ? "Het rad verdeelt aanwezige spelers. Gesloten slotjes blijven staan." : `Minstens ${radNodig} aanwezige spelers nodig, inclusief alle vergrendelde spelers. Nu beschikbaar: ${beschikbaar.length}.`}</span>
          </div>
          <p className="klein zacht">Kies een speler en sluit het slotje om hem op die positie vast te zetten. Iedere wijziging wordt automatisch opgeslagen, ook je slotjes.</p>
          {[...basisPosities(formatie), ...BANK].map((pos) => {
            const gekozenElders = new Set(Object.entries(keuze).filter(([p, id]) => p !== pos && id).map(([, id]) => id));
            return (
              <div className="veld" key={pos}>
                <label htmlFor={"positie-" + pos} className={BANK.includes(pos) ? "" : "verplicht"}>{positieLabel(pos)}</label>
                <div className="positie-keuze">
                <select id={"positie-" + pos} disabled={slotjes.includes(pos) || radDraait || opslaanBezig} value={keuze[pos] ?? ""} onChange={(e) => wijzigConcept({ ...keuze, [pos]: e.target.value || null })}>
                  <option value="">—</option>
                  {keuze[pos] && !beschikbaar.some((p) => p.id === keuze[pos]) && <option value={keuze[pos]!} disabled>{namen.get(keuze[pos]!) ?? "Speler"} (niet beschikbaar)</option>}
                  {beschikbaar.filter((p) => !gekozenElders.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.naam}</option>)}
                </select>
                <button type="button" className="knop licht positie-slot" disabled={!keuze[pos] || radDraait || opslaanBezig} aria-label={`${positieLabel(pos)}: ${slotjes.includes(pos) ? "ontgrendelen" : "vergrendelen"}`} aria-pressed={slotjes.includes(pos)} title={slotjes.includes(pos) ? "Ontgrendelen" : "Vastzetten voor het rad"} onClick={() => wijzigConcept(keuze, formatie, slotjes.includes(pos) ? slotjes.filter(p => p !== pos) : [...slotjes, pos])}>{slotjes.includes(pos) ? <LockSimple size={22} weight="fill" /> : <LockSimpleOpen size={22} />}</button>
                </div>
              </div>
            );
          })}
          {fouten.length > 0 && <div className="melding waarschuwing">{fouten.join(" ")}</div>}
          <div className="knoppen">
            <span role="status">{opslaanBezig ? "Automatisch opslaan…" : opslagFout ? "Nog niet opgeslagen." : onbewaard ? "Wijzigingen bewaren…" : "Alle wijzigingen opgeslagen."}</span>
            {opslagFout && <><button type="button" className="knop" onClick={() => opslag.current?.opnieuw()}>Opnieuw proberen</button><button type="button" className="knop licht" onClick={async () => { try { sessionStorage.removeItem(`steca-concept-${lid?.id}-${gekozenKey}`); } catch { /* Optionele lokale reservekopie. */ } await lineups.herlaad(); setHerlaadNr(n => n + 1); }}>Nieuwste opstelling laden</button></>}
            <button type="button" className="knop licht" disabled={radDraait || opslaanBezig || onbewaard} onClick={async () => { await lineups.herlaad(); setBewerken(false); }}>Sluiten</button>          </div>
        </div>
      )}
      {match && (
        <WasmandKeuze match={match} beurt={(wasbeurten.data ?? []).find((b) => b.match_key === match.match_key)} spelers={spelers} beschikbaar={beschikbaar} isStaf={r.isStaf} fout={wasbeurten.fout} onGewijzigd={wasbeurten.herlaad} />
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
