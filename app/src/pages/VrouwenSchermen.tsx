import {VrouwenProfielBadges} from '../components/VrouwenProfielBadges';
import {seizoenRanglijst} from '../lib/stemmen';
import {useState,type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {CalendarBlank} from '@phosphor-icons/react/dist/csr/CalendarBlank';
import {MapPin} from '@phosphor-icons/react/dist/csr/MapPin';
import {ArrowUpRight} from '@phosphor-icons/react/dist/csr/ArrowUpRight';
import {Aftelling} from '../components/Aftelling';
import {KalenderTicket,MapsKnop} from '../components/MatchKaart';
import {clubRpc,clubStatistieken,type ClubData,type ClubMatch} from '../lib/club';

export const vrouwenDatum=(iso:string)=>new Date(iso).toLocaleDateString('nl-BE',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Brussels'});
const vrouwenUur=(iso:string)=>new Date(iso).toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Brussels'});
export const vrouwenSeizoen=(_data:ClubData)=>{
 const nu=new Date(),jaar=nu.getMonth()<6?nu.getFullYear()-1:nu.getFullYear();
 return `${jaar}-${jaar+1}`;
};
const labels:Record<string,string>={speler:'Speelster',spelercoach:'Speelster-coach',coach:'Coach',verantwoordelijke:'Verantwoordelijke',supporter:'Supporter'};
const stats:Record<string,string>={goals:'Goals',assists:'Assists',geel:'Geel',rood:'Rood',cleansheets:'Clean sheets',gespeeld:'Gespeeld'};
export function VrouwenTicket({match,children}:{match:ClubMatch;children?:ReactNode}){
 const terrein=match.locaties?.map(l=>[l.zaal,l.adres].filter(Boolean).join(' · ')).join(' / ')||null;
 return <section className="match-blok"><div className="sectie-kop"><h2>01 / Volgende match</h2><Link to="/vrouwen/kalender" aria-label="Bekijk de kalender"><ArrowUpRight size={23}/></Link></div>
 <div className="match-affiche"><div className="affiche-meta"><span>WEDSTRIJDTICKET · {match.reeks??'Dames Zele'}</span><span className="locatie-label">{match.thuis==='STECA VROUWEN'?'Thuismatch':'Uitmatch'}</span></div>
 <div className="affiche-ploegen"><div className="team-naam"><span className="team-boven">{match.thuis}</span><span className="versus">tegen</span><span className="team-onder">{match.uit}</span></div><img className="affiche-logo" src={import.meta.env.BASE_URL+'logo-vrouwen-transparant.png'} alt="Clublogo Steca Vrouwen" width="150" height="150"/></div>
 <div className="match-moment"><CalendarBlank size={22}/><span>{vrouwenDatum(match.aftrap)}</span><strong>{vrouwenUur(match.aftrap)}</strong></div><Aftelling aftrapIso={match.aftrap}/>
 <div className="match-terrein"><MapPin size={20}/><span>{terrein??'Terrein nog niet bekend'}</span><MapsKnop terrein={match.locaties?.[0]?.adres??null}/></div></div>
 {children&&<div className="match-aanwezigheid">{children}</div>}</section>;
}
export type VrouwenKalenderBron={seizoen:string;wedstrijden?:{id:number;thuis:string;uit:string;aftrap:string;score:[number,number]|null;locaties:{zaal:string;adres:string}[];reeks:string}[];reekswedstrijden?:{id:number;thuis:string;uit:string;aftrap:string;score:[number,number]|null;locaties:{zaal:string;adres:string}[];reeks:string}[];klassementen:{naam:string;rijen:{naam:string}[]}[]};
export function VrouwenKalender({data,bron,inhoud,verslag}:{data:ClubData;bron?:VrouwenKalenderBron|null;inhoud?:(m:ClubMatch)=>ReactNode;verslag?:(m:ClubMatch)=>ReactNode}){
 const [tab,setTab]=useState('eigen'),[toonGespeeld,setToonGespeeld]=useState(true),[ploeg,setPloeg]=useState<string|null>(null);
 const eigen=(m:ClubMatch)=>m.thuis==='STECA VROUWEN'||m.uit==='STECA VROUWEN';
 const reeks=(bron?.reekswedstrijden??[]).map(m=>data.matches.find(c=>c.thuis===m.thuis&&c.uit===m.uit&&Date.parse(c.aftrap)===Date.parse(m.aftrap))??({match_key:'twizzit-'+m.id,seizoen:bron!.seizoen,aftrap:m.aftrap,thuis:m.thuis,uit:m.uit,thuis_score:m.score?.[0]??null,uit_score:m.score?.[1]??null,is_test:false,reeks:m.reeks,locaties:m.locaties}));
 const eigenMatches=[...data.matches];
 for(const m of bron?.wedstrijden??[]){const index=eigenMatches.findIndex(c=>c.thuis===m.thuis&&c.uit===m.uit&&Date.parse(c.aftrap)===Date.parse(m.aftrap));if(index<0)eigenMatches.push({match_key:'twizzit-'+m.id,seizoen:bron!.seizoen,aftrap:m.aftrap,thuis:m.thuis,uit:m.uit,thuis_score:m.score?.[0]??null,uit_score:m.score?.[1]??null,is_test:false,reeks:m.reeks,locaties:m.locaties});else if(m.score&&eigenMatches[index].thuis_score===null)eigenMatches[index]={...eigenMatches[index],thuis_score:m.score[0],uit_score:m.score[1]};}
 const wedstrijden=(tab==='eigen'?eigenMatches:reeks).filter(m=>(!ploeg||m.thuis===ploeg||m.uit===ploeg)&&(toonGespeeld||m.thuis_score===null)).sort((a,b)=>a.aftrap.localeCompare(b.aftrap));
 const perDatum=new Map<string,ClubMatch[]>();for(const m of wedstrijden){const d=new Date(m.aftrap).toLocaleDateString('sv-SE',{timeZone:'Europe/Brussels'});perDatum.set(d,[...(perDatum.get(d)??[]),m]);}
 const ploegen=bron?.klassementen[0]?.rijen.map(r=>r.naam).sort((a,b)=>a.localeCompare(b))??[...new Set(data.matches.flatMap(m=>[m.thuis,m.uit]))].sort();
 return <><div className="tabs">{[['eigen','Steca Vrouwen'],['reeks','Hele reeks'],['ploegen','Ploegen']].map(([k,l])=><button key={k} className={tab===k?'actief':''} onClick={()=>{setTab(k);setPloeg(null);}}>{l}</button>)}</div>
 {tab==='ploegen'&&!ploeg?<><div className="veld"><select aria-label="Reeks"><option>{bron?.klassementen[0]?.naam??'Dames Zele'}</option></select></div><ul className="lijst omrand">{ploegen.map(naam=>{const thuis=reeks.find(m=>m.thuis===naam&&m.locaties?.length);return <li key={naam}><button className="rij v-ploegenrij" onClick={()=>setPloeg(naam)}><span><strong>{naam}</strong><br/><span className="zacht klein">{thuis?.locaties?.[0]?.zaal??'Terrein onbekend'}</span></span><span>›</span></button></li>;})}</ul></>:<>
 {ploeg&&<><button className="knop licht klein" onClick={()=>setPloeg(null)}>‹ Alle ploegen</button><h2>{ploeg}</h2></>}
 <label className="klein zacht" style={{display:'block',marginBottom:10}}><input type="checkbox" checked={toonGespeeld} onChange={e=>setToonGespeeld(e.target.checked)}/> gespeelde matchen tonen</label>
 {[...perDatum.entries()].map(([datum,ms])=><section key={datum}>{tab!=='eigen'&&<h3 style={{marginTop:12}}>{vrouwenDatum(ms[0].aftrap)}</h3>}{ms.map(m=><VrouwenKalenderKaart key={m.match_key} match={m} toonDatum={tab==='eigen'} verslagKnop={data.matches.some(x=>x.match_key===m.match_key)?verslag?.(m):null}>{eigen(m)&&data.matches.some(x=>x.match_key===m.match_key)?inhoud?.(m):null}</VrouwenKalenderKaart>)}</section>)}
 {!wedstrijden.length&&<div className="kaart zacht">Geen matchen gevonden.</div>}</>}</>;
}
function VrouwenKalenderKaart({match:m,toonDatum,children,verslagKnop}:{match:ClubMatch;toonDatum:boolean;children?:ReactNode;verslagKnop?:ReactNode}){
 const thuis=m.thuis==='STECA VROUWEN',uit=m.uit==='STECA VROUWEN',gespeeld=m.thuis_score!==null&&m.uit_score!==null;
 const verschil=gespeeld?(m.thuis_score!-m.uit_score!)*(thuis?1:-1):0,res=gespeeld&&(thuis||uit)?verschil>0?'winst':verschil<0?'verlies':'gelijk':null;
 return <KalenderTicket ticketScheur={thuis||uit} toonDatum={toonDatum} datum={vrouwenDatum(m.aftrap)} uur={vrouwenUur(m.aftrap)} reeks={m.reeks??'Dames Zele'} thuis={m.thuis} uit={m.uit} eigenThuis={thuis} eigenUit={uit} status={gespeeld?'gespeeld':'gepland'} scoreTekst={gespeeld?`${m.thuis_score} - ${m.uit_score}`:vrouwenUur(m.aftrap)} terrein={m.locaties?.map(l=>[l.zaal,l.adres].filter(Boolean).join(' · ')).join(' / ')||null} res={res} verslagKnop={verslagKnop}>{children}</KalenderTicket>;
}
export function VrouwenHome({data,children,stand}:{data:ClubData;children?:ReactNode;stand?:{positie:number;punten:number;gespeeld:number;voor:number}}){
 const komend=data.matches.filter(m=>Date.parse(m.aftrap)>Date.now()&&m.thuis_score===null).sort((a,b)=>a.aftrap.localeCompare(b.aftrap));
 const laatste=data.matches.filter(m=>m.thuis_score!==null&&Date.parse(m.aftrap)<=Date.now()).sort((a,b)=>b.aftrap.localeCompare(a.aftrap))[0];
 return <div className="home-pagina"><div className="matchdag-kop"><h1>Matchdag</h1><span>Seizoen {vrouwenSeizoen(data)}</span></div><div className="home-grid">
 {komend[0]?<VrouwenTicket match={komend[0]}>{children}</VrouwenTicket>:<section className="match-blok"><h2>Even geen match gepland</h2><Link to="/vrouwen/kalender">Bekijk de kalender</Link></section>}
 <aside className="home-zijde"><div className="club-embleem"><span>SAMEN UIT. SAMEN THUIS.</span><img src={import.meta.env.BASE_URL+'logo-vrouwen-transparant.png'} alt="Steca Vrouwen"/><span>DE DERDE HELFT</span><strong>WIJNTJES!!</strong></div>
 <section className="stand-blok"><div className="sectie-kop"><h2>02 / De rangschikking</h2></div><p className="zacht">DAMES ZELE</p>{stand?<><div className="stand-cijfer"><strong>{stand.positie}</strong><span>e plaats</span></div><div className="stand-statistieken">{[[stand.punten,'punten'],[stand.gespeeld,'gespeeld'],[stand.voor,'goals']].map(([n,l])=><div key={l}><strong>{n}</strong><span>{l}</span></div>)}</div></>:<p>Klassement laden…</p>}<Link className="tekst-link" to="/vrouwen/klassement">Volledig klassement <ArrowUpRight size={19} aria-hidden="true"/></Link></section>
 <section className="resultaat-blok"><div className="sectie-kop"><h2>Laatste uitslag</h2></div>{laatste?<><p className="zacht">{vrouwenDatum(laatste.aftrap)}</p><div className="laatste-score"><strong>{laatste.thuis_score} : {laatste.uit_score}</strong></div><p>{laatste.thuis} - {laatste.uit}</p><Link to={'/vrouwen/match/'+encodeURIComponent(laatste.match_key)}>Matchverslag bekijken</Link></>:<p>Nog geen uitslag.</p>}</section></aside>
 {komend.length>1&&<section className="binnenkort"><div className="sectie-kop"><h2>Daarna op de kalender</h2></div><div className="komende-lijst">{komend.slice(1,3).map(m=><Link className="komende-match" to="/vrouwen/kalender" key={m.match_key}><time><strong>{new Date(m.aftrap).getDate()}</strong><span>{new Date(m.aftrap).toLocaleDateString('nl-BE',{month:'short'})}</span></time><div><h3>{m.thuis==='STECA VROUWEN'?m.uit:m.thuis}</h3><p>{m.thuis==='STECA VROUWEN'?'Thuis':'Uit'} / {vrouwenUur(m.aftrap)}</p></div><ArrowUpRight size={22}/></Link>)}</div></section>}
 </div></div>;
}

export function VrouwenLeden({data,beheer}:{data:ClubData;beheer?:ReactNode}){
 const [zoek,setZoek]=useState(''),[functie,setFunctie]=useState(''),[supporters,setSupporters]=useState(false);
 const leden=data.leden.filter(l=>l.functie!=='supporter'&&(l.status==='actief'||data.admin));
 const ultras=vrouwenSupporters(data);
 return <><h1>Leden</h1><div className="tabs"><button className={!supporters?'actief':''} onClick={()=>setSupporters(false)}>Clubleden</button>{data.admin&&<button className={supporters?'actief':''} onClick={()=>setSupporters(true)}>Supporters beheren</button>}</div>
 <div className="rij v-leden-filters"><input aria-label="Zoek een lid" placeholder="Zoeken…" value={zoek} onChange={e=>setZoek(e.target.value)}/>{!supporters&&<select aria-label="Filter op functie" value={functie} onChange={e=>setFunctie(e.target.value)}><option value="">Alle functies</option>{Object.entries(labels).filter(([k])=>k!=='supporter').map(([k,l])=><option value={k} key={k}>{l}</option>)}</select>}</div>
 <ul className="lijst omrand">{(supporters?ultras.map(s=>({id:s.user_id,naam:s.naam,functie:'supporter',user_id:s.user_id,status:'actief',is_admin:false})):leden).filter(l=>(!functie||supporters||l.functie===functie)&&l.naam.toLocaleLowerCase().includes(zoek.toLocaleLowerCase())).sort((a,b)=>a.naam.localeCompare(b.naam)).map(l=><li key={l.id}><Link className="rij" to={'/vrouwen/'+(supporters?'supporters/':'leden/')+l.id}><span><strong>{l.naam}</strong>{l.is_admin?' ☆':''}<br/><span className="zacht klein">{labels[l.functie]}{l.status!=='actief'?' · '+l.status.replaceAll('_',' '):''}{!l.user_id?' · geen account':''}</span></span><span>›</span></Link></li>)}</ul>
 <p className="klein zacht">{supporters?`${ultras.length} supporters`:`${leden.length} clubleden`}</p>{!supporters&&beheer}</>;
}
export function VrouwenSpelerProfiel({data,id,beheer,herlaad}:{data:ClubData;id:string;beheer?:ReactNode;herlaad?:()=>Promise<void>}){
 const [alles,setAlles]=useState(false);const lid=data.leden.find(l=>l.id===id);if(!lid)return <p>Lid niet gevonden.</p>;
 const seizoen=vrouwenSeizoen(data),cijfers=clubStatistieken(data,id,alles?undefined:seizoen);
 const wedstrijden=data.matches.filter(m=>m.thuis_score!==null&&Date.parse(m.aftrap)<=Date.now()&&(alles||m.seizoen===seizoen)&&(data.opstellingen.some(o=>o.match_key===m.match_key&&Object.values(o.keuze).includes(id))||data.verslagen.some(v=>v.match_key===m.match_key&&v.statistieken.some(s=>s.id===id&&s.gespeeld===true)))).sort((a,b)=>b.aftrap.localeCompare(a.aftrap));
 return <><p><Link to="/vrouwen/leden">‹ Alle leden</Link></p><h1>{lid.naam}</h1><p className="zacht">{labels[lid.functie]}</p><div className="kaart"><div className="rij"><h3>Statistieken {alles?'alle seizoenen':'seizoen '+seizoen}</h3><select aria-label="Periode statistieken" value={alles?'alles':'seizoen'} onChange={e=>setAlles(e.target.value==='alles')}><option value="seizoen">Dit seizoen</option><option value="alles">All time</option></select></div><div className="stand-statistieken speler-cijfers">{Object.entries(stats).map(([key,label])=><div key={key}><strong>{cijfers[key as keyof typeof cijfers]}</strong><span>{label}</span></div>)}</div>
 <ul className="lijst">{wedstrijden.map(m=><li key={m.match_key}><Link className="rij" to={'/vrouwen/match/'+encodeURIComponent(m.match_key)}><span>{vrouwenDatum(m.aftrap)}<br/>{m.thuis} - {m.uit}</span><strong>{m.thuis_score}-{m.uit_score} ›</strong></Link></li>)}</ul>{!wedstrijden.length&&<p className="zacht">Nog geen gespeelde matchen.</p>}</div><VrouwenProfielBadges data={data} id={lid.id}/>{data.admin&&herlaad&&<VrouwenFunctie key={lid.id} lidId={lid.id} naam={lid.naam} functie={lid.functie} speelt={lid.speelt} herlaad={herlaad}/>} {beheer}</>;
}
export function vrouwenSupporters(data:ClubData){return data.pronoleden.filter(p=>!data.leden.some(l=>l.user_id===p.user_id&&l.functie!=='supporter'));}
export function supporterCijfers(data:ClubData,user:string,seizoen?:string){
 const keys=new Set(data.aanwezigheden.filter(a=>a.user_id===user&&!a.speler&&a.status==='aanwezig').map(a=>a.match_key));
 const matches=data.matches.filter(m=>keys.has(m.match_key)&&m.thuis_score!==null&&Date.parse(m.aftrap)+80*60000<=Date.now()&&(!seizoen||m.seizoen===seizoen));
 return {matches,uit:matches.filter(m=>m.thuis!=='STECA VROUWEN').length};
}
export function VrouwenSupporterProfiel({data,user,beheer,herlaad}:{data:ClubData;user:string;beheer?:ReactNode;herlaad?:()=>Promise<void>}){
 const persoon=vrouwenSupporters(data).find(p=>p.user_id===user);if(!persoon)return <p>Supporter niet gevonden.</p>;
 const jaar=supporterCijfers(data,user,vrouwenSeizoen(data)),alles=supporterCijfers(data,user);
 return <><Link to="/vrouwen/leden">‹ Alle leden</Link><h1>{persoon.naam}</h1><p className="zacht">Supporter</p><section className="kaart"><h2>Supportersstatistieken</h2><div className="stand-statistieken speler-cijfers">{[[jaar.matches.length,'Matchen dit seizoen'],[alles.matches.length,'Matchen all time'],[jaar.uit,'Uitmatchen dit seizoen'],[alles.uit,'Uitmatchen all time']].map(([n,l])=><div key={l}><strong>{n}</strong><span>{l}</span></div>)}</div><ul className="lijst">{alles.matches.map(m=><li key={m.match_key}><Link to={'/vrouwen/match/'+encodeURIComponent(m.match_key)}>{vrouwenDatum(m.aftrap)} · {m.thuis} - {m.uit}</Link></li>)}</ul></section><VrouwenProfielBadges data={data} user={user}/>{data.admin&&herlaad&&<VrouwenFunctie userId={user} naam={persoon.naam} functie="supporter" speelt={false} herlaad={herlaad}/>} {beheer}</>;
}
function VrouwenFunctie({lidId,userId,naam,functie,speelt,herlaad}:{lidId?:string;userId?:string;naam:string;functie:string;speelt:boolean;herlaad:()=>Promise<void>}){
 const [fout,setFout]=useState(''),[bezig,setBezig]=useState(false),[klaar,setKlaar]=useState(false);
 return <details className="kaart"><summary>Functie aanpassen</summary><form onSubmit={async e=>{e.preventDefault();const velden=new FormData(e.currentTarget);setBezig(true);setFout('');setKlaar(false);try{if(lidId)await clubRpc('club_wijzig_lid',{p_lid:lidId,p_functie:velden.get('functie'),p_speelt:velden.get('speelt')==='on'});else await clubRpc('club_zet_lid',{p_user:userId,p_functie:velden.get('functie'),p_speelt:velden.get('speelt')==='on'});await herlaad();setKlaar(true);}catch(e){setFout((e as Error).message);}finally{setBezig(false);}}}><p>{naam}</p><label>Functie<select name="functie" defaultValue={functie}>{Object.entries(labels).map(([k,l])=><option value={k} key={k}>{l}</option>)}</select></label><label><input type="checkbox" name="speelt" defaultChecked={speelt}/>Speelt mee</label><button className="knop" disabled={bezig}>Opslaan</button>{fout&&<p role="alert">{fout}</p>}{klaar&&<p role="status">Functie opgeslagen.</p>}</form></details>;
}
export function VrouwenStatistieken({data}:{data:ClubData}){
 const [stat,setStat]=useState('goals'),[alles,setAlles]=useState(false),[supporters,setSupporters]=useState(false);
 const seizoen=alles?undefined:vrouwenSeizoen(data),kolommen=[stat,...Object.keys(stats).filter(k=>k!==stat)];
 const jaarRijen=seizoenRanglijst((data.stempunten??[]).filter(p=>data.matches.some(m=>m.match_key===p.match_key&&(!seizoen||m.seizoen===seizoen))));
 const rijen=data.leden.filter(l=>l.speelt).map(l=>({...l,cijfers:clubStatistieken(data,l.id,seizoen)})).sort((a,b)=>b.cijfers[stat as keyof typeof b.cijfers]-a.cijfers[stat as keyof typeof a.cijfers]||a.naam.localeCompare(b.naam));
 return <section><div className="tabs"><button className={!supporters?'actief':''} onClick={()=>setSupporters(false)}>Speelsters</button><button className={supporters?'actief':''} onClick={()=>setSupporters(true)}>Supporters</button></div><div className="rij"><h2>{supporters?'Supportersklassement':'Statistieken'}</h2><select aria-label="Periode statistieken" value={alles?'alles':'seizoen'} onChange={e=>setAlles(e.target.value==='alles')}><option value="seizoen">Dit seizoen</option><option value="alles">All time</option></select></div><p className="zacht">{alles?'Alle seizoenen':'Seizoen '+seizoen}</p>
 {supporters?<ul className="lijst omrand">{vrouwenSupporters(data).map(p=>({...p,aantal:supporterCijfers(data,p.user_id,seizoen).matches.length})).sort((a,b)=>b.aantal-a.aantal||a.naam.localeCompare(b.naam)).map((p,i)=><li key={p.user_id}><Link className="rij" to={'/vrouwen/supporters/'+p.user_id}><span>{i+1}. {p.naam}</span><strong>{p.aantal}</strong></Link></li>)}</ul>:<><div className="tabs v-stat-tabs">{Object.entries({...stats,goals:"Topschutter",geel:"Gele kaarten",rood:"Rode kaarten",jaar:"Steca Vrouw van het Jaar"}).map(([k,l])=><button key={k} className={stat===k?"actief":""} onClick={()=>setStat(k)}>{l}</button>)}</div>{stat==="jaar"?<div className="tabel-wrap"><table className="tabel"><thead><tr><th>#</th><th>Speelster</th><th className="num">Punten</th><th className="num">Vrouw van de match</th><th className="num">Matchen</th></tr></thead><tbody>{jaarRijen.map((r,i)=><tr key={r.member_id}><td>{i+1}</td><td><Link to={"/vrouwen/leden/"+r.member_id}>{data.leden.find(l=>l.id===r.member_id)?.naam??"Speelster"}</Link></td><td className="num">{r.punten}</td><td className="num">{r.gewonnen}</td><td className="num">{r.matchen}</td></tr>)}{!jaarRijen.length&&<tr><td colSpan={5}>Nog geen stemmen uitgebracht.</td></tr>}</tbody></table></div>:<div className="tabel-wrap"><table className="tabel"><thead><tr><th>#</th><th>Speelster</th>{kolommen.map(k=><th className="num" key={k}>{stats[k]}</th>)}</tr></thead><tbody>{rijen.map((l,i)=><tr key={l.id}><td>{i+1}</td><td><Link to={'/vrouwen/leden/'+l.id}>{l.naam}</Link></td>{kolommen.map(k=><td className="num" key={k}>{l.cijfers[k as keyof typeof l.cijfers]}</td>)}</tr>)}</tbody></table></div>}</>}
 </section>;
}
