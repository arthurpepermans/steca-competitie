import {useEffect, useState} from 'react';
import {Link, NavLink, useLocation} from 'react-router-dom';
import {House} from '@phosphor-icons/react/dist/csr/House';
import {CalendarDots} from '@phosphor-icons/react/dist/csr/CalendarDots';
import {Trophy} from '@phosphor-icons/react/dist/csr/Trophy';
import {ArrowSquareOut} from '@phosphor-icons/react/dist/csr/ArrowSquareOut';
import {useNavViewport} from '../lib/useNavViewport';
import './Vrouwen.css';

type Match = {id:number;thuis:string;uit:string;aftrap:string;score:[number,number]|null;locaties:{zaal:string;adres:string}[];reeks:string;bron:string};
type Rij = {positie:number;naam:string;gespeeld:number;winst:number;verlies:number;gelijk:number;voor:number;tegen:number;saldo:number;punten:number};
type Data = {seizoen:string;bijgewerkt:string;wedstrijden:Match[];klassementen:{id:string;naam:string;rijen:Rij[]}[]};
const datum = (iso:string) => new Date(iso).toLocaleDateString('nl-BE',{weekday:'short',day:'numeric',month:'long',timeZone:'Europe/Brussels'});
const uur = (iso:string) => new Date(iso).toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Brussels'});
const logo = import.meta.env.BASE_URL+'logo-vrouwen.png';

function Wedstrijd({match, groot=false}:{match:Match;groot?:boolean}) {
  return <article className={'v-match'+(groot?' v-match-groot':'')}>
    <div className="v-match-meta"><span>{datum(match.aftrap)} · {uur(match.aftrap)}</span><span>{match.thuis==='STECA VROUWEN'?'Thuis':'Uit'}</span></div>
    <div className="v-scorebord"><strong>{match.thuis}</strong><b>{match.score?match.score.join(' - '):'VS'}</b><strong>{match.uit}</strong></div>
    {match.locaties.map((plek,i)=><div className="v-locatie" key={i}><span><b>{plek.zaal}</b><small>{plek.adres}</small></span><a className="v-route" href={'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(plek.adres)} target="_blank" rel="noreferrer">Route <ArrowSquareOut size={16}/></a></div>)}
    {!match.locaties.length&&<p className="v-zacht">Terrein nog niet beschikbaar.</p>}
    <a className="v-bron-match" href={match.bron} target="_blank" rel="noreferrer">Wedstrijdinfo op Twizzit ↗</a>
  </article>;
}

export function Vrouwen() {
  const {pathname}=useLocation();
  const navRef=useNavViewport(pathname);
  const [data,setData]=useState<Data|null>(null);
  const [fout,setFout]=useState(false);
  const [poging,setPoging]=useState(0);
  const [filter,setFilter]=useState('komend');
  const [reeks,setReeks]=useState(0);
  const [donker,setDonker]=useState(()=>{try{return localStorage.getItem('steca-retro-thema')==='dark';}catch{return false;}});
  useEffect(()=>{
    document.documentElement.dataset.ploeg='vrouwen';
    const oudeTitel=document.title;
    document.title='Steca Vrouwen Clubapp';
    try{localStorage.setItem('steca-ploeg','vrouwen');}catch{/* Voorkeur is optioneel. */}
    return ()=>{delete document.documentElement.dataset.ploeg;document.title=oudeTitel;};
  },[]);
  useEffect(()=>{document.documentElement.dataset.theme=donker?'dark':'light';try{localStorage.setItem('steca-retro-thema',donker?'dark':'light');}catch{/* Optioneel. */}},[donker]);
  useEffect(()=>{window.scrollTo(0,0);},[pathname]);
  useEffect(()=>{
    const controller=new AbortController();setFout(false);
    fetch(import.meta.env.BASE_URL+'vrouwen-data.json',{signal:controller.signal,cache:'no-cache'})
      .then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{if(!Array.isArray(d.wedstrijden)||!Array.isArray(d.klassementen))throw Error();setData(d);})
      .catch(e=>{if(e.name!=='AbortError')setFout(true);});
    return ()=>controller.abort();
  },[poging]);
  const nu=Date.now();
  const komend=data?.wedstrijden.filter(m=>new Date(m.aftrap).getTime()>nu&&!m.score)??[];
  const gespeeld=data?.wedstrijden.filter(m=>m.score!==null).slice().reverse()??[];
  const tab=pathname.split('/')[2]??'';
  return <>
    <header className="kop v-kop"><Link to="/vrouwen" className="clubmerk"><img src={logo} width="48" height="54" alt=""/><span>STECA VROUWEN<small>CLUBAPP</small></span></Link><button className="thema-knop" onClick={()=>setDonker(!donker)} aria-label={donker?'Licht thema':'Donker thema'}>{donker?'☀':'☾'}</button></header>
    <div className="v-ploegwissel"><span>ROZE. WIT. ZWART.</span><Link to="/" onClick={()=>{try{localStorage.setItem('steca-ploeg','juniors');}catch{/* Optioneel. */}}}>Wissel naar Juniors ↗</Link></div>
    <main className="inhoud v-inhoud">
      {fout?<div role="alert" className="melding fout">De wedstrijdgegevens konden niet geladen worden. <button onClick={()=>setPoging(p=>p+1)}>Opnieuw proberen</button></div>:!data?<p role="status">Wedstrijden laden…</p>:<>
      {Date.now()-new Date(data.bijgewerkt).getTime()>36*3600000&&<p className="melding">Deze gegevens zijn meer dan een dag oud. Controleer recente wijzigingen via Twizzit.</p>}
      {tab===''&&<>
        <section className="v-hero"><div><p>HAMSE LIGA · {data.seizoen}</p><h1>Samen op het veld.<br/>Samen Steca.</h1><span>Welkom bij de Steca Vrouwen.</span></div><img src={logo} alt="Schild van Steca Vrouwen"/></section>
        <div className="v-sectie-kop"><h2>Volgende match</h2><Link to="/vrouwen/kalender">Kalender ↗</Link></div>
        {komend[0]?<Wedstrijd match={komend[0]} groot/>:<p>Er staat nog geen volgende match ingepland.</p>}
        {gespeeld[0]&&<><div className="v-sectie-kop"><h2>Laatste uitslag</h2><Link to="/vrouwen/klassement">Klassement ↗</Link></div><Wedstrijd match={gespeeld[0]}/></>}
      </>}
      {tab==='kalender'&&<><h1>Kalender</h1><p className="v-zacht">Alle matchen van de Steca Vrouwen · {data.seizoen}</p><div className="v-tabs">{[['komend','Komend'],['gespeeld','Uitslagen'],['alles','Alles']].map(([id,label])=><button aria-pressed={filter===id} key={id} onClick={()=>setFilter(id)}>{label}</button>)}</div>{(filter==='komend'?komend:filter==='gespeeld'?gespeeld:data.wedstrijden).map(m=><Wedstrijd key={m.id} match={m}/>)}{filter==='gespeeld'&&!gespeeld.length&&<p>Nog geen uitslagen beschikbaar.</p>}</>}
      {tab==='klassement'&&<><h1>Klassement</h1><p className="v-zacht">Hamse Liga · {data.seizoen}</p><label className="v-reeks">Reeks<select value={reeks} onChange={e=>setReeks(Number(e.target.value))}>{data.klassementen.map((r,i)=><option value={i} key={r.id}>{r.naam}</option>)}</select></label><div className="v-tabel-scroll"><table className="v-tabel"><thead><tr><th>#</th><th>Ploeg</th><th title="Gespeeld">G</th><th>W</th><th>V</th><th title="Gelijk">GL</th><th>+/-</th><th>PT</th></tr></thead><tbody>{data.klassementen[reeks]?.rijen.map(r=><tr key={r.naam} className={r.naam==='STECA VROUWEN'?'v-eigen':''}><td>{r.positie}</td><th scope="row">{r.naam}</th><td>{r.gespeeld}</td><td>{r.winst}</td><td>{r.verlies}</td><td>{r.gelijk}</td><td>{r.voor}-{r.tegen}</td><td><b>{r.punten}</b></td></tr>)}</tbody></table></div></>}
      <p className="v-update">Bijgewerkt op {datum(data.bijgewerkt)} om {uur(data.bijgewerkt)} · <a href="https://hamseliga.be/kalender" target="_blank" rel="noreferrer">Hamse Liga / Twizzit</a></p>
      </>}
    </main>
    <nav ref={navRef} className="nav" aria-label="Vrouwen hoofdnavigatie">{[{to:'/vrouwen',label:'Home',Icon:House},{to:'/vrouwen/kalender',label:'Kalender',Icon:CalendarDots},{to:'/vrouwen/klassement',label:'Klassement',Icon:Trophy}].map(({to,label,Icon})=><NavLink key={to} to={to} end className={({isActive})=>isActive?'actief':''}><Icon size={25}/><span>{label}</span></NavLink>)}</nav>
  </>;
}
