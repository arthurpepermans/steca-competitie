import { useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { SoccerBall } from '@phosphor-icons/react/dist/csr/SoccerBall';
import { ArrowLeft } from '@phosphor-icons/react/dist/csr/ArrowLeft';
import { bewaarVerslag, haalVerslagen, metVerslag, samenvatting, type Moment, type Verslag } from '../lib/matchverslag';
import { haalAanwezigheden, haalLedenBasis, haalMatches, haalMijnStemmen, haalStats, haalStemmers, haalStemPunten } from '../lib/api';
import { rechten, useAuth, isSpelerLid } from '../lib/auth';
import { fmtDatum, isEigen } from '../lib/datum';
import { foutTekst, useAsync } from '../lib/useAsync';
import { Fout, Laden } from '../components/Layout';
import { MapsKnop } from '../components/MatchKaart';
import { Sfeerbeelden } from '../components/Sfeerbeelden';
import { JuniorStemming } from '../components/Junior';
import type { Match } from '../lib/types';

export function MatchVerslag() {
  const [params]=useSearchParams();
  const { key = '' } = useParams();
  const { lid } = useAuth();
  const info = useAsync(async () => {
    const [matches, verslagen, leden, stats, aanw, punten, stemmers, stemmen] = await Promise.all([haalMatches(), haalVerslagen(), haalLedenBasis(), haalStats(), haalAanwezigheden(), haalStemPunten(), haalStemmers(), haalMijnStemmen()]);
    return { matches, verslagen, leden, stats, aanw, punten, stemmers, stemmen };
  }, [key]);
  const [bewerk, setBewerk] = useState(params.get('invullen')==='1');
  if (info.laden) return <Laden />;
  if (info.fout || !info.data) return <><Fout tekst={info.fout} /><button className="knop" onClick={info.herlaad}>Opnieuw laden</button></>;
  const d = info.data;
  const origineel = d.matches.find(m => m.match_key === key);
  if (!origineel || !isEigen(origineel)) return <p>Deze match is niet gevonden.</p>;
  const verslag = d.verslagen.find(v => v.match_key === key);
  const match = metVerslag(origineel, verslag);
  const spelers = d.leden.filter(isSpelerLid).map(p => ({ id: p.id, naam: p.naam }));
  const totalen = samenvatting(d.stats, key, new Map(spelers.map(p => [p.id, p.naam])));
  return <>
    <Link className="verslag-terug" to="/kalender"><ArrowLeft size={18} /> Kalender</Link>
    <article className="matchverslag">
      <header className="verslag-kop"><span>HET MATCHVERSLAG</span><span>{fmtDatum(match.datum)} · {match.uur ?? 'Uur volgt'}</span></header>
      <div className="verslag-scorebord">
        <div>{match.thuis_id === 152 ? <img src={import.meta.env.BASE_URL + 'logo-retro.png'} alt="" /> : <span className="verslag-schild">{match.thuis.slice(0,2).toUpperCase()}</span>}<strong>{match.thuis}</strong></div>
        <div className="verslag-uitslag"><b>{match.thuis_score ?? '–'} : {match.uit_score ?? '–'}</b><small>{match.status === 'gespeeld' ? 'UITSLAG' : 'NOG TE SPELEN'}</small></div>
        <div>{match.uit_id === 152 ? <img src={import.meta.env.BASE_URL + 'logo-retro.png'} alt="" /> : <span className="verslag-schild">{match.uit.slice(0,2).toUpperCase()}</span>}<strong>{match.uit}</strong></div>
      </div>
      <div className="verslag-terrein"><span>{match.terrein ?? 'Terrein volgt'}</span><MapsKnop terrein={match.terrein} /></div>
      <h2 className="verslag-titel">DE MATCH IN BEELD</h2>
      {verslag?.momenten.length ? <ol className="match-tijdlijn">{verslag.momenten.map((m, i) => <li key={i} className={`moment ${m.kant}`}>
        <div className="moment-speler"><strong>{m.speler || (m.kant === 'thuis' ? match.thuis : match.uit)}</strong>{m.assist && <small>Assist · {m.assist}</small>}<small>{m.soort === 'goal' ? 'Doelpunt' : m.soort === 'geel' ? 'Gele kaart' : 'Rode kaart'}</small></div>
        <span className="moment-minuut">{m.soort === 'goal' ? <SoccerBall size={22} weight="duotone" /> : <i className={`moment-kaart ${m.soort}`} />}</span>
      </li>)}</ol> : <div className="verslag-totalen">{totalen.length ? <><p className="klein zacht">Geregistreerde goals, assists en kaarten.</p>{totalen.map(s => <div className="verslag-totaal" key={s.member_id}><strong>{s.naam}</strong><span>{[s.goals && `${s.goals} goals`, s.assists && `${s.assists} assists`, s.geel && `${s.geel} geel`, s.rood && `${s.rood} rood`].filter(Boolean).join(' · ')}</span></div>)}</> : <p>Nog geen goals, assists of kaarten ingevuld.</p>}</div>}
      <Sfeerbeelden matchKey={key} />
    </article>
    {rechten(lid).isStaf && <div className="kaart"><button className="knop licht" aria-expanded={bewerk} onClick={() => setBewerk(!bewerk)}>{bewerk ? 'Invoer sluiten' : 'Uitslag en matchverslag invullen'}</button>{bewerk && <VerslagInvoer key={verslag?.updated_at ?? key} match={origineel} verslag={verslag} namen={spelers.map(p => p.naam)} klaar={async () => { await info.herlaad(); setBewerk(false); }} />}</div>}
    {match.status === 'gespeeld' && <JuniorStemming match={match} spelers={spelers} aanwezigheden={d.aanw} punten={d.punten} stemmers={d.stemmers} mijnStem={d.stemmen.find(s => s.match_key === key) ?? null} eigenLidId={lid?.id ?? null} onGewijzigd={info.herlaad} />}
  </>;
}

function VerslagInvoer({ match, verslag, namen, klaar }: { match: Match; verslag?: Verslag; namen: string[]; klaar: () => Promise<void> }) {
  const [thuis, setThuis] = useState(verslag?.thuis_score ?? match.thuis_score ?? 0);
  const [uit, setUit] = useState(verslag?.uit_score ?? match.uit_score ?? 0);
  const [momenten, setMomenten] = useState<Moment[]>(verslag?.momenten ?? []);
  const [fout, setFout] = useState('');
  const [bezig, setBezig] = useState(false);
  function wijzig(i: number, v: Partial<Moment>) { setMomenten(ms => ms.map((m, n) => n === i ? { ...m, ...v } : m)); }
  async function opslaan(e: FormEvent) { e.preventDefault(); setBezig(true); setFout(''); try { await bewaarVerslag(match.match_key, thuis, uit, momenten.map(m => ({...m,minuut:null})), verslag?.updated_at ?? null); await klaar(); } catch(e) { setFout(foutTekst(e)); } finally { setBezig(false); } }
  return <form onSubmit={opslaan} className="verslag-invoer"><Fout tekst={fout} /><fieldset disabled={bezig}><legend>Uitslag</legend><div className="verslag-scoreinvoer"><label>{match.thuis}<input aria-label="Thuisscore" type="number" min="0" max="99" required value={thuis} onChange={e => setThuis(Number(e.target.value))} /></label><label>{match.uit}<input aria-label="Uitscore" type="number" min="0" max="99" required value={uit} onChange={e => setUit(Number(e.target.value))} /></label></div>
    <p className="klein zacht">De stemmelding vertrekt pas vanaf 80 minuten na aftrap. Je mag de uitslag eerder invoeren.</p>
    <datalist id="verslag-spelers">{namen.map(n => <option key={n} value={n} />)}</datalist>
    {momenten.map((m, i) => <fieldset className="verslag-momentinvoer" key={i}><legend>Moment {i + 1}</legend>
      <label>Gebeurtenis<select value={m.soort} onChange={e => wijzig(i, { soort: e.target.value as Moment['soort'], ...(e.target.value !== 'goal' ? { assist: '' } : {}) })}><option value="goal">Goal</option><option value="geel">Gele kaart</option><option value="rood">Rode kaart</option></select></label>
      <label>Ploeg<select value={m.kant} onChange={e => wijzig(i, { kant: e.target.value as Moment['kant'] })}><option value="thuis">{match.thuis}</option><option value="uit">{match.uit}</option></select></label>
      <label>Speler<input list="verslag-spelers" maxLength={100} value={m.speler} onChange={e => wijzig(i, { speler: e.target.value })} /></label>
      {m.soort === 'goal' && <label>Assist (optioneel)<input list="verslag-spelers" maxLength={100} value={m.assist} onChange={e => wijzig(i, { assist: e.target.value })} /></label>}
      <button type="button" className="knop licht klein" onClick={() => setMomenten(ms => ms.filter((_, n) => i !== n))}>Moment verwijderen</button>
    </fieldset>)}
    <div className="knoppen"><button type="button" className="knop licht" onClick={() => setMomenten(ms => [...ms, { minuut: null, soort: 'goal', kant: match.thuis_id === 152 ? 'thuis' : 'uit', speler: '', assist: '' }])}>Moment toevoegen</button><button className="knop" disabled={bezig}>{bezig ? 'Opslaan…' : 'Matchverslag opslaan'}</button></div></fieldset></form>;
}

