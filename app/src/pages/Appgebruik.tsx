import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { rechten, useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { brusselseDag, duur, PAGINAS, type GebruikRapport } from '../lib/appgebruik';
import { Fout, Laden } from '../components/Layout';
import './Appgebruik.css';

function dagenTerug(aantal: number) {
  const d = new Date(brusselseDag() + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - aantal);
  return d.toISOString().slice(0, 10);
}
const getal = (n: number) => n.toLocaleString('nl-BE');
const datum = (s: string) => new Date(s).toLocaleString('nl-BE', { timeZone: 'Europe/Brussels', dateStyle: 'short', timeStyle: 'short' });

export function Appgebruik() {
  const { lid } = useAuth();
  const toegestaan = rechten(lid).isHoofdadmin;
  const [van, setVan] = useState(() => dagenTerug(6));
  const [tot, setTot] = useState(() => brusselseDag());
  const [eigen, setEigen] = useState(false);
  const [tab, setTab] = useState('Overzicht');
  const [zoek, setZoek] = useState('');
  const [data, setData] = useState<GebruikRapport | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [ververs, setVervers] = useState(0);
  useEffect(() => {
    if (!toegestaan) return;
    let actief = true;
    setData(null); setFout(null);
    if (!van || !tot || van > tot || (Date.parse(tot) - Date.parse(van)) / 86400000 >= 90) {
      setFout('Kies een geldige periode van maximaal 90 dagen.'); setLaden(false); return;
    }
    setLaden(true);
    void Promise.resolve(supabase.rpc('appgebruik_rapport', { p_van: van, p_tot: tot, p_eigen: eigen }))
      .then(({ data: rapport, error }) => {
        if (!actief) return;
        if (error) setFout(error.code === 'PGRST202'
          ? 'Appgebruik is nog niet geactiveerd in de database.'
          : 'De gebruiksstatistieken konden niet geladen worden. Probeer opnieuw.');
        else setData(rapport as GebruikRapport);
      }).catch(() => { if (actief) setFout('Geen verbinding. Probeer opnieuw.'); })
      .finally(() => { if (actief) setLaden(false); });
    return () => { actief = false; };
  }, [van, tot, eigen, toegestaan, ververs]);
  if (!toegestaan) return <div className="melding fout">Alleen de hoofdadmin kan appgebruik bekijken.</div>;
  return <div className="gebruik">
    <Link to="/profiel">← Mijn profiel</Link>
    <div className="gebruik-kop"><div><p className="gebruik-label">STECA JUNIORS · BEHEER</p><h1>Appgebruik</h1><p className="zacht">Wie komt terug, en welke pagina’s worden gebruikt?</p></div>
      <button type="button" className="knop licht" disabled={laden} onClick={() => setVervers(x => x + 1)}>Vernieuwen</button></div>
    <div className="kaart gebruik-filters">
      <div className="gebruik-periodes" aria-label="Snelle periodekeuze">{[[1,'Vandaag'],[7,'7 dagen'],[30,'30 dagen'],[90,'90 dagen']].map(([dagen,label]) =>
        <button type="button" className="knop licht" key={dagen} onClick={() => {setVan(dagenTerug(Number(dagen)-1));setTot(brusselseDag());}}>{label}</button>)}</div>
      <div className="gebruik-datums"><label>Vanaf<input type="date" min={dagenTerug(89)} max={brusselseDag()} value={van} onChange={e => setVan(e.target.value)} /></label>
        <label>Tot en met<input type="date" min={van} max={brusselseDag()} value={tot} onChange={e => setTot(e.target.value)} /></label></div>
      <label className="gebruik-check"><input type="checkbox" checked={eigen} onChange={e => setEigen(e.target.checked)} /> Mijn eigen gebruik meetellen</label>
    </div>
    <div className="gebruik-tabs" aria-label="Statistiekonderdelen">{['Overzicht','Gebruikers','Pagina’s'].map(t =>
      <button type="button" key={t} aria-pressed={tab===t} onClick={() => setTab(t)}>{t}</button>)}</div>
    <Fout tekst={fout} />
    {laden && <Laden tekst="Appgebruik ophalen…" />}
    {!laden && data && <>
      {data.overzicht.paginaweergaven === 0 && <div className="melding info">Nog geen bezoeken gemeten in deze periode{!eigen ? ' zonder jouw eigen gebruik' : ''}. Metingen starten zodra leden de bijgewerkte app openen.</div>}
      {tab === 'Overzicht' && <>
        <div className="gebruik-cijfers">{[
          ['Actieve gebruikers', getal(data.overzicht.gebruikers)], ['Bezoeken', getal(data.overzicht.bezoeken)],
          ['Paginaweergaven', getal(data.overzicht.paginaweergaven)], ['Actieve tijd', duur(data.overzicht.seconden)],
        ].map(([label,waarde]) => <div className="kaart" key={label}><span className="zacht">{label}</span><strong>{waarde}</strong></div>)}</div>
        <section className="kaart"><h2>Gebruikers per dag</h2><p className="zacht">Unieke gebruikers · Belgische tijd</p>
          <div className="gebruik-grafiek" role="img" aria-label="Dagelijkse actieve gebruikers; exacte cijfers in de uitklapbare tabel hieronder.">
            {data.dagen.map(d => <div key={d.dag} className="gebruik-balk" title={`${d.dag}: ${d.gebruikers} gebruikers, ${d.bezoeken} bezoeken`}>
              <span style={{ height: `${d.gebruikers / Math.max(1,...data.dagen.map(x=>x.gebruikers)) * 100}%` }} /></div>)}
          </div><div className="gebruik-as"><span>{van}</span><span>{tot}</span></div>
          <details><summary>Dagcijfers bekijken</summary><div className="gebruik-tabel"><table><thead><tr><th>Dag</th><th>Gebruikers</th><th>Bezoeken</th><th>Actieve tijd</th></tr></thead><tbody>
            {data.dagen.map(d=><tr key={d.dag}><td>{d.dag}</td><td>{d.gebruikers}</td><td>{d.bezoeken}</td><td>{duur(d.seconden)}</td></tr>)}
          </tbody></table></div></details>
        </section>
        <section className="kaart"><h2>Waar gaat de meeste tijd naartoe?</h2>{data.paginas.slice(0,5).map(p => <div className="gebruik-top" key={p.pagina}>
          <div><strong>{PAGINAS[p.pagina] ?? p.pagina}</strong><span>{duur(p.seconden)}</span></div>
          <progress value={p.seconden} max={Math.max(1,...data.paginas.map(x=>x.seconden))} aria-label={`Actieve tijd op ${PAGINAS[p.pagina]}`} />
        </div>)}{!data.paginas.length && <p className="zacht">Nog geen pagina’s gemeten.</p>}</section>
        <section className="kaart"><h2>Gebruik van functies</h2><p className="zacht">Geslaagde opslagacties, inclusief wijzigingen aan een eerdere keuze.</p>
          {['aanwezigheid','stem','opstelling'].map(actie => {
            const a = data.acties.find(x=>x.actie===actie);
            return <div className="gebruik-top" key={actie}><div><strong>{{aanwezigheid:'Aanwezigheid doorgeven',stem:'Stem uitbrengen',opstelling:'Opstelling opslaan'}[actie]}</strong><span>{a?.aantal ?? 0} keer · {a?.gebruikers ?? 0} gebruikers</span></div></div>;
          })}
        </section>
      </>}
      {tab === 'Gebruikers' && <section className="kaart"><h2>Gebruik per persoon</h2>
        <label>Zoek op naam<input type="search" value={zoek} onChange={e=>setZoek(e.target.value)} /></label>
        <p className="zacht">Bezoeken en laatste activiteit binnen de gekozen periode. Accounts zonder metingen staan op nul.</p>
        <div className="gebruik-tabel"><table><thead><tr><th>Naam</th><th>Bezoeken</th><th>Pagina’s</th><th>Actieve tijd</th><th>Laatste activiteit</th></tr></thead><tbody>
          {data.gebruikers.filter(u=>u.naam.toLocaleLowerCase().includes(zoek.toLocaleLowerCase())).map(u=><tr key={u.user_id}>
            <td><strong>{u.naam}</strong><small>{u.functie}</small></td><td>{u.bezoeken}</td><td>{u.paginaweergaven}</td><td>{duur(u.seconden)}</td><td>{u.laatst ? datum(u.laatst) : 'Niet gemeten'}</td>
          </tr>)}
        </tbody></table></div>
        {!data.gebruikers.some(u=>u.naam.toLocaleLowerCase().includes(zoek.toLocaleLowerCase())) && <p>Geen gebruikers gevonden.</p>}
      </section>}
      {tab === 'Pagina’s' && <section className="kaart"><h2>Gebruik per pagina</h2><p className="zacht">Gesorteerd op totale actieve tijd. Gemiddelde = actieve tijd gedeeld door paginaweergaven.</p>
        <div className="gebruik-tabel"><table><thead><tr><th>Pagina</th><th>Weergaven</th><th>Gebruikers</th><th>Actieve tijd</th><th>Gemiddeld</th></tr></thead><tbody>
          {data.paginas.map(p=><tr key={p.pagina}><td><strong>{PAGINAS[p.pagina] ?? p.pagina}</strong></td><td>{p.paginaweergaven}</td><td>{p.gebruikers}</td><td>{duur(p.seconden)}</td><td>{duur(p.seconden/Math.max(1,p.paginaweergaven))}</td></tr>)}
        </tbody></table></div>{!data.paginas.length && <p>Nog geen pagina’s gemeten.</p>}
      </section>}
      <section className="kaart gebruik-uitleg"><h2>Wat meten deze cijfers?</h2>
        <p>Metingen beschikbaar vanaf {datum(data.gestart)}. Een bezoek eindigt na 30 minuten zonder actief gebruik. Een nieuw tabblad of ander toestel telt als een afzonderlijk bezoek.</p>
        <p>Actieve tijd telt alleen bij een zichtbaar venster met focus en stopt na één minuut zonder tikken, scrollen of typen. Dit is een schatting; offline gebruik en abrupt sluiten kunnen ontbreken. De huidige dag is nog onvolledig.</p>
        <p>Alleen ingelogde, actieve Juniors-leden en supporters worden gemeten. Loginpagina’s, de vrouwenapp en dit dashboard tellen niet mee. Detailpagina’s worden gegroepeerd; ingevulde teksten, locatie en schermopnames worden niet opgeslagen.</p>
        <p>Alleen de hoofdadmin ziet deze cijfers. Detailmetingen verdwijnen na 90 dagen uit dit overzicht en worden dagelijks opgeruimd.</p>
      </section>
    </>}
  </div>;
}
