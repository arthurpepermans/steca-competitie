import { useEffect, useRef, useState } from "react";
import { Camera } from "@phosphor-icons/react/dist/csr/Camera";
import { rechten, useAuth } from "../lib/auth";
import { controleerMedia, haalSfeerbeelden, MEDIA_TYPES, uploadSfeerbeeld, verwijderSfeerbeeld, type Sfeerbeeld } from "../lib/media";

export function Sfeerbeelden({ matchKey }: { matchKey: string }) {
  const [open, setOpen] = useState(false);
  return <section className="sfeerbeelden">
    <button type="button" className="knop licht sfeer-open" aria-expanded={open} onClick={() => setOpen(!open)}><Camera size={21} aria-hidden="true" /> Sfeerbeelden <span>{open ? "Sluiten" : "Bekijken / toevoegen"}</span></button>
    {open && <Album key={matchKey} matchKey={matchKey} />}
  </section>;
}

function Album({ matchKey }: { matchKey: string }) {
  const { lid, session } = useAuth();
  const [beelden, setBeelden] = useState<Sfeerbeeld[]>([]);
  const [meer, setMeer] = useState(false);
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState("");
  const [fout, setFout] = useState("");
  const [verwijderen, setVerwijderen] = useState<string | null>(null);
  const invoer = useRef<HTMLInputElement>(null);
  const actief = useRef(true);
  const aanvraag = useRef(0);
  const isAdmin = rechten(lid).isAdmin;

  async function laad(offset = 0) {
    const nr = ++aanvraag.current;
    setLaden(true);
    try {
      const resultaat = await haalSfeerbeelden(matchKey, offset);
      if (!actief.current || nr !== aanvraag.current) return;
      setBeelden((oud) => offset ? [...oud, ...resultaat.beelden.filter((b) => !oud.some((o) => o.path === b.path))] : resultaat.beelden);
      setMeer(resultaat.meer);
    } catch {
      if (actief.current && nr === aanvraag.current) setFout("De sfeerbeelden konden niet geladen worden. Probeer opnieuw.");
    } finally { if (actief.current && nr === aanvraag.current) setLaden(false); }
  }
  useEffect(() => {
    actief.current = true;
    void laad();
    return () => { actief.current = false; aanvraag.current++; };
  }, [matchKey]);

  async function upload(files: File[]) {
    if (!files.length || bezig) return;
    setBezig(true); setFout(""); setMelding("");
    let gelukt = 0;
    const fouten: string[] = [];
    for (let i = 0; i < files.length; i++) {
      if (!actief.current) break;
      setMelding(`Uploaden: ${i + 1} van ${files.length}. Houd dit album open.`);
      const ongeldig = controleerMedia(files[i]);
      if (ongeldig) { fouten.push(`${files[i].name}: ${ongeldig}`); continue; }
      try { await uploadSfeerbeeld(matchKey, files[i]); gelukt++; }
      catch { fouten.push(`${files[i].name}: upload mislukt. Controleer je verbinding en probeer dit bestand opnieuw.`); }
    }
    if (!actief.current) return;
    setMelding(`${gelukt} ${gelukt === 1 ? "bestand toegevoegd" : "bestanden toegevoegd"}.`);
    setFout(fouten.join("\n"));
    await laad();
    setBezig(false);
    if (invoer.current) invoer.current.value = "";
  }
  async function wis(path: string) {
    setBezig(true); setFout("");
    try { await verwijderSfeerbeeld(path); setVerwijderen(null); setMelding("Beeld verwijderd."); await laad(); }
    catch { setFout("Verwijderen is mislukt. Probeer opnieuw."); }
    finally { setBezig(false); }
  }
  return <div className="sfeer-album" aria-busy={bezig || laden}>
    <p>Foto’s en video’s van deze match. Alleen zichtbaar voor leden.</p>
    <div className="knoppen">
      <button type="button" className="knop" disabled={bezig || lid?.status !== "actief"} onClick={() => invoer.current?.click()}>Foto’s / video’s toevoegen</button>
      <button type="button" className="knop licht klein" disabled={bezig || laden} onClick={() => { setFout(""); void laad(); }}>Vernieuwen</button>
    </div>
    <input ref={invoer} type="file" multiple accept={Object.keys(MEDIA_TYPES).join(",")} hidden onChange={(e) => void upload(Array.from(e.target.files ?? []))} />
    <p className="klein zacht">Maximaal 50 MB per bestand. Video’s spelen pas af wanneer je ze start.</p>
    {melding && <p className="melding ok" role="status">{melding}</p>}
    {fout && <p className="melding fout" role="alert" style={{ whiteSpace: "pre-line" }}>{fout}</p>}
    {!laden && !fout && beelden.length === 0 && <p className="sfeer-leeg">Nog geen sfeerbeelden. Voeg de eerste foto of video toe.</p>}
    <div className="sfeer-grid">{beelden.map((beeld) => <article key={beeld.path} className="sfeer-item">
      {beeld.video ? <video src={beeld.url} controls playsInline preload="none" onError={(e) => { e.currentTarget.title = "Kan deze video niet afspelen? Gebruik Openen."; }} /> : <Foto beeld={beeld} />}
      <div className="sfeer-meta"><span>{beeld.createdAt ? new Date(beeld.createdAt).toLocaleDateString("nl-BE") : ""}</span><a href={beeld.url} target="_blank" rel="noreferrer">Openen</a></div>
      {(isAdmin || beeld.eigenaar === session?.user.id) && (verwijderen === beeld.path ? <div className="sfeer-wissen"><p>Dit beeld verwijderen?</p><button className="knop klein" disabled={bezig} onClick={() => void wis(beeld.path)}>Verwijderen</button> <button className="knop licht klein" disabled={bezig} onClick={() => setVerwijderen(null)}>Annuleren</button></div> : <button className="knop licht klein" disabled={bezig} onClick={() => setVerwijderen(beeld.path)}>Verwijderen</button>)}
    </article>)}</div>
    {laden && <p role="status">Sfeerbeelden laden…</p>}
    {meer && <button className="knop licht" disabled={laden || bezig} onClick={() => void laad(beelden.length)}>Meer beelden laden</button>}
  </div>;
}
function Foto({ beeld }: { beeld: Sfeerbeeld }) {
  const [fout, setFout] = useState(false);
  useEffect(() => setFout(false), [beeld.url]);
  return fout ? <p className="sfeer-fallback">Voorbeeld niet beschikbaar. Tik op ‘Openen’ om de foto te bekijken of te downloaden.</p> : <a href={beeld.url} target="_blank" rel="noreferrer"><img src={beeld.url} alt="Sfeerbeeld van de wedstrijd" loading="lazy" onError={() => setFout(true)} /></a>;
}
