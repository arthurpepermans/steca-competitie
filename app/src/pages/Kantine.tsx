import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useAsync, foutTekst } from '../lib/useAsync';
import { haalSupportersData } from '../lib/supporters';
import { allePosities, FORMATIE_KEUZES, positieLabel, radOpstelling, veranderFormatie } from '../lib/formaties';
import { bewaarDream, bewaarPronostiek, haalDream, haalPronostieken, haalPronostiekKlassement, kantineSpelers, type Dream, type Pronostiek } from '../lib/kantine';
import { maakOpslaanRij, type OpslagStatus } from '../lib/opslaanRij';
import { aftrapTijd } from '../lib/aftrap';
import { fmtDatum, isEigen, sorteerOpDatum } from '../lib/datum';
import { huidigSeizoen } from '../lib/seizoen';
import type { Match } from '../lib/types';
import { Veld } from '../components/Veld';
import { Fout, Laden } from '../components/Layout';

export function Kantine({ openbaar=false }: { openbaar?: boolean }) {
 const {lid,supporter}=useAuth();
 const eigenaar=supporter?.user_id??(!openbaar?lid?.id:null)??"gast";
 const [params,setParams]=useSearchParams();
 const gevraagd=params.get('spel') ?? 'home';
 const tab=['dream','prono','stand'].includes(gevraagd)?gevraagd:'home';
 const open=(spel:string)=>setParams(p=>{if(spel==='home')p.delete('spel');else p.set('spel',spel);return p;});
 return <><h1>De Kantine</h1>
 {tab==='home'?<><p className="zacht">Een plek waar iedereen het beter weet dan de coach. Stel je Dream XI samen, voorspel de uitslag en bewijs dat je er ook iets van kent.</p><div className="kantine-start">
 <button className="kaart kantine-spel" onClick={()=>open('dream')}><span className="kantine-spel-nr" aria-hidden="true">XI</span><strong>Dream XI</strong><span>Stel jouw ideale Steca-ploeg samen.</span><span className="knop">Maak jouw Dream XI →</span></button>
 <button className="kaart kantine-spel" onClick={()=>open('prono')}><span className="kantine-spel-nr" aria-hidden="true">1–0</span><strong>Junior-Pronostieken</strong><span>Voorspel de Steca-matchen en klim in het klassement.</span><span className="knop">Naar Junior-Pronostieken →</span></button>
 </div></>:<><p><button className="knop licht klein" onClick={()=>open('home')}>← Terug naar De Kantine</button></p>
 {tab==='dream'?<DreamXI key={eigenaar} openbaar={openbaar}/>:<><h2>Junior-Pronostieken</h2><p>Voor de gokkers onder ons…</p>
 <div className="tabs">{[['prono','Voorspellen'],['stand','Klassement']].map(([k,n])=><button key={k} className={tab===k?'actief':''} onClick={()=>open(k)}>{n}</button>)}</div>
 <Pronostieken key={tab} openbaar={openbaar} klassement={tab==='stand'}/></>}</>}
 </>;
}

function DreamXI({ openbaar }: { openbaar: boolean }) {
 const {lid,supporter}=useAuth();const ingelogd=Boolean((!openbaar && lid)||supporter?.actief);
 const spelers=useAsync(kantineSpelers);
 const geladen=useAsync(()=>ingelogd?haalDream():Promise.resolve(null),[ingelogd,lid?.id,supporter?.user_id]);
 const [dream,setDream]=useState<Dream>({formatie:'4-3-3',keuze:{},slotjes:[],updated_at:null});
 const [klaar,setKlaar]=useState(false);const [status,setStatus]=useState<OpslagStatus>('bewaard');const [fout,setFout]=useState<string|null>(null);
 const versie=useRef<string|null>(null);
 useEffect(()=>{if(!geladen.laden&&!geladen.fout){if(geladen.data){setDream(geladen.data);versie.current=geladen.data.updated_at;}
 else if(!ingelogd){try{const bewaard=JSON.parse(localStorage.getItem('steca-gast-dream-xi')??'null');if(bewaard&&FORMATIE_KEUZES.includes(bewaard.formatie)&&typeof bewaard.keuze==='object'&&bewaard.keuze!==null&&Array.isArray(bewaard.slotjes))setDream(bewaard);}catch{/* Een ongeldige lokale kopie wordt overgeslagen. */}}
 setKlaar(true);}},[geladen.laden,geladen.data,geladen.fout]);
 const rij=useMemo(()=>maakOpslaanRij<Dream>(async d=>{versie.current=await bewaarDream(d,versie.current);},(s,e)=>{setStatus(s);setFout(e?foutTekst(e):null);}),[lid?.id,supporter?.user_id]);
 function wijzig(d:Dream){setDream(d);if(ingelogd)rij.wijzig(d);else{try{localStorage.setItem("steca-gast-dream-xi",JSON.stringify(d));setFout(null);}catch{setFout("Opslaan op dit toestel is niet beschikbaar. Je ploeg blijft alleen tijdens dit bezoek bestaan.");}}}
 const namen=Object.fromEntries(Object.entries(dream.keuze).map(([p,id])=>[p,spelers.data?.find(s=>s.id===id)?.naam]));
 if(spelers.laden||geladen.laden)return <Laden/>;
 return <><div className="melding kantine-prive"><strong>MIJN DREAM XI</strong><br />{ingelogd?<span role="status">{status==='opslaan'?'Opslaan…':status==='fout'?'Niet opgeslagen.':'Wordt automatisch privé bewaard bij je account.'}</span>:<span>Zonder account blijft je ploeg alleen op dit toestel bewaard. Met een account neem je ze mee naar je andere toestellen.</span>}</div>
 <Fout tekst={spelers.fout??geladen.fout??fout}/>{status==='fout'&&<button className="knop" onClick={()=>rij.opnieuw()}>Opnieuw opslaan</button>}
 {klaar&&!spelers.fout&&<><div className="kantine-acties"><label>Formatie <select value={dream.formatie} onChange={e=>{const f=e.target.value as Dream['formatie'];wijzig({...dream,formatie:f,keuze:veranderFormatie(dream.formatie,f,dream.keuze),slotjes:[]});}}>{FORMATIE_KEUZES.map(f=><option key={f}>{f}</option>)}</select></label>
 <button className="knop" disabled={(spelers.data?.length??0)<11} onClick={()=>{try{const keuze=radOpstelling(dream.formatie,(spelers.data??[]).map(s=>s.id),Math.random,Object.fromEntries(dream.slotjes.map(p=>[p,dream.keuze[p]])));if(!Object.keys(keuze).length)throw new Error('Te weinig spelers voor deze vergrendelingen.');wijzig({...dream,keuze});}catch(e){setFout(foutTekst(e));}}}>Draai het rad</button>
 <button className="knop licht" onClick={()=>{if(window.confirm('Je persoonlijke Dream XI leegmaken?'))wijzig({...dream,keuze:{},slotjes:[]});}}>Leegmaken</button></div>
 <Veld formatie={dream.formatie} namen={namen} slotjes={dream.slotjes}/>
 <h2>Kies jouw spelers</h2><p className="zacht">Alle actieve spelers zijn beschikbaar, ongeacht hun aanwezigheid. Gebruik het slotje om iemand vast te zetten voor het rad.</p>
 <div className="dream-keuzes">{allePosities(dream.formatie).map(p=><div className="veld" key={p}><label htmlFor={'dream-'+p}>{positieLabel(p)}</label><div className="rij"><select id={'dream-'+p} value={dream.keuze[p]??''} onChange={e=>{const keuze={...dream.keuze};for(const q of Object.keys(keuze))if(e.target.value&&keuze[q]===e.target.value)keuze[q]=null;keuze[p]=e.target.value||null;wijzig({...dream,keuze,slotjes:dream.slotjes.filter(q=>keuze[q])});}}><option value="">Kies een speler</option>{spelers.data?.map(s=><option key={s.id} value={s.id}>{s.naam}{Object.entries(dream.keuze).some(([q,id])=>q!==p&&id===s.id)?' (verplaatsen)':''}</option>)}</select><button className="knop licht klein" disabled={!dream.keuze[p]} aria-label={`${positieLabel(p)} ${dream.slotjes.includes(p)?'ontgrendelen':'vergrendelen'}`} aria-pressed={dream.slotjes.includes(p)} onClick={()=>wijzig({...dream,slotjes:dream.slotjes.includes(p)?dream.slotjes.filter(q=>q!==p):[...dream.slotjes,p]})}>{dream.slotjes.includes(p)?'🔒':'🔓'}</button></div></div>)}</div></>}
 <p><Link to={openbaar?'/supporters?tab=Opstelling':'/opstelling'} className="knop licht">Naar de officiële opstelling</Link></p></>;
}
function Pronostieken({ openbaar,klassement }: {openbaar:boolean;klassement:boolean}) {
 const info=useAsync(haalSupportersData);const {lid,supporter,session}=useAuth();const kanSpelen=Boolean((!openbaar&&lid)||supporter?.actief);
 const eigen=useAsync(()=>kanSpelen?haalPronostieken():Promise.resolve([]),[kanSpelen,lid?.id,supporter?.user_id]);
 const [seizoen,setSeizoen]=useState<string|null>(null);
 const alle=sorteerOpDatum((info.data?.matches??[]).filter(isEigen));const gekozen=seizoen??huidigSeizoen(alle,new Date().toISOString().slice(0,10));
 const rang=useAsync(()=>haalPronostiekKlassement(gekozen),[gekozen]);
 const [nu,setNu]=useState(Date.now());useEffect(()=>{const id=setInterval(()=>setNu(Date.now()),1000);return()=>clearInterval(id);},[]);
 const seizoenen=[...new Set(alle.map(m=>m.seizoen))].sort().reverse();
 return <><div className="kaart"><h2>{klassement?'Prono-klassement':'Zo scoor je punten'}</h2><p><strong>10</strong> exacte score · <strong>5</strong> juist doelpuntenverschil (ook gelijkspel) · <strong>3</strong> juiste winnaar · <strong>0</strong> verkeerd.</p><p className="zacht klein">Alleen de hoogste score telt. 2–0 voorspeld en 4–2 gespeeld = 5 punten. 1–1 voorspeld en 2–2 gespeeld = 5. Invoer sluit bij de aftrap. Punten vanaf 80 minuten na aftrap zodra er een uitslag is; correcties worden herberekend. Bij gelijke punten deel je dezelfde plaats.</p></div>
 {!kanSpelen&&!klassement&&<div className="melding">Om punten te verzamelen heb je een actief clubaccount nodig. Als supporter kun je het klassement bekijken en Dream XI proberen. <Link to="/supporter-account">Maak een supporteraccount</Link> of <Link to="/login">log in</Link>.</div>}
 <label>Seizoen <select value={gekozen} onChange={e=>setSeizoen(e.target.value)}>{(seizoenen.length?seizoenen:[gekozen]).map(s=><option key={s}>{s}</option>)}</select></label>
 <Fout tekst={info.fout??eigen.fout??rang.fout}/>{(info.laden||eigen.laden||rang.laden)&&<Laden/>}
 {klassement?<div className="tabel-wrap"><table className="tabel"><thead><tr><th>#</th><th>Naam</th><th className="num">Punten</th><th className="num">Exact</th><th className="num">Verschil</th><th className="num">Winnaar</th><th className="num">Matchen</th></tr></thead><tbody>{rang.data?.map((r,_i,rs)=><tr key={r.user_id} className={r.user_id===session?.user.id ? "eigen" : ""}><td>{rs.findIndex(x=>x.punten===r.punten)+1}</td><td style={{whiteSpace:"normal"}}>{r.naam}{r.user_id===session?.user.id?' (jij)':''}</td><td className="num"><strong>{r.punten}</strong></td><td className="num">{r.exact}</td><td className="num">{r.verschil}</td><td className="num">{r.winnaar}</td><td className="num">{r.gespeeld}</td></tr>)}</tbody></table>{!rang.laden&&!rang.data?.length&&<p>Er zijn nog geen actieve deelnemers.</p>}</div>:
 alle.filter(m=>m.seizoen===gekozen).map(m=><PronoKaart key={m.match_key} match={m} bestaand={eigen.data?.find(p=>p.match_key===m.match_key)} nu={nu} mag={kanSpelen&&!eigen.laden&&!eigen.fout} herlaad={async()=>{await Promise.all([eigen.herlaad(),rang.herlaad()]);}}/>)}
 {!info.laden&&!alle.length&&<p>Er zijn nog geen Steca-matchen beschikbaar.</p>}</>;
}
function PronoKaart({match:m,bestaand,nu,mag,herlaad}:{match:Match;bestaand?:Pronostiek;nu:number;mag:boolean;herlaad:()=>Promise<void>}) {
 const [thuis,setThuis]=useState('');const [uit,setUit]=useState('');const [bezig,setBezig]=useState(false);const [bericht,setBericht]=useState('');const [fout,setFout]=useState<string|null>(null);
 useEffect(()=>{setThuis(bestaand?String(bestaand.thuis):'');setUit(bestaand?String(bestaand.uit):'');},[bestaand?.thuis,bestaand?.uit]);
 const aftrap=aftrapTijd(m);const open=aftrap!==null&&aftrap>nu&&m.status==='gepland'&&m.thuis_score===null&&m.uit_score===null;
 return <section className="kaart"><p className="zacht klein">{fmtDatum(m.datum)} · {m.uur??'Uur onbekend'} · {open?'Open tot de aftrap':'Gesloten'}</p><h3>{m.thuis} – {m.uit}</h3><form onSubmit={async e=>{e.preventDefault();setBezig(true);setFout(null);setBericht('');try{if(!/^\d{1,2}$/.test(thuis)||!/^\d{1,2}$/.test(uit))throw new Error('Vul beide scores in (0 tot 99).');await bewaarPronostiek(m.match_key,Number(thuis),Number(uit));setBericht('Pronostiek opgeslagen.');await herlaad();}catch(err){setFout(foutTekst(err));}finally{setBezig(false);}}}><div className="prono-invoer"><label>{m.thuis}<input aria-label={'Voorspelde score '+m.thuis} inputMode="numeric" type="number" min="0" max="99" step="1" required value={thuis} disabled={!mag||!open||bezig} onChange={e=>setThuis(e.target.value)}/></label><strong>–</strong><label>{m.uit}<input aria-label={'Voorspelde score '+m.uit} inputMode="numeric" type="number" min="0" max="99" step="1" required value={uit} disabled={!mag||!open||bezig} onChange={e=>setUit(e.target.value)}/></label></div>{mag&&open&&<button className="knop" disabled={bezig}>{bezig?'Opslaan…':bestaand?'Pronostiek aanpassen':'Pronostiek vastleggen'}</button>}</form><Fout tekst={fout}/><p role="status">{bericht}</p>{!open&&!bestaand&&<p className="zacht">Geen voorspelling ingevuld.</p>}</section>;
}
