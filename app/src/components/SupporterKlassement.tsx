import {Shirt} from './Shirt';
import {useEffect,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {supabase} from '../lib/supabase';
import {rechten,useAuth} from '../lib/auth';
import {useAsync} from '../lib/useAsync';
import {seizoenNu} from '../lib/badgeCatalogus';
import {FAN_BADGES,berekenFans,type FanBadge,type FanData} from '../lib/supporterBadges';
import {Fout,Laden} from './Layout';

function useFans(){const [v,setV]=useState(0);useEffect(()=>{const f=()=>setV(x=>x+1);window.addEventListener('supporter-badges',f);return()=>window.removeEventListener('supporter-badges',f);},[]);return useAsync(async()=>{const {data,error}=await supabase.rpc('supporter_klassement_data');if(error)throw error;return data as FanData;},[v]);}
export function SupporterBadgeIcoon({badge:b}:{badge:FanBadge}){
 const G='#e2b63c',R='#f5eedb',Z='#292929';
 return <svg className="badge-icoon" viewBox="0 0 100 100" role="img" aria-label={b.titel}><circle cx="50" cy="50" r="48" fill={Z} stroke={R} strokeWidth="2"/>
 {b.id==='busje'?<g stroke={Z} strokeWidth="2" strokeLinejoin="round">
   <path d="M18 33q0-5 5-5h48q7 0 10 8l5 15v13H18Z" fill={G}/>
   <path d="M24 34h13v16H24zm18 0h13v16H42zm18 0h12l6 16H60Z" fill={R}/>
   <path d="M19 56h66" fill="none"/>
   <circle cx="31" cy="65" r="8" fill={Z} stroke={R}/><circle cx="72" cy="65" r="8" fill={Z} stroke={R}/>
   <circle cx="31" cy="65" r="3" fill={G}/><circle cx="72" cy="65" r="3" fill={G}/>
   <path d="M35 42q-9 4-17-3L9 32v13q9 12 26 6Z" fill="#fff"/>
   <path d="m14 36 5 4v13l-5-3Zm11 6 5 1v9l-5 1Z" fill="#171717" stroke="none"/>
   <path d="M9 33H5m4 5H5m4 5H5" stroke="#fff"/>
  </g>:b.icoon==='bus'?<g stroke={Z} strokeWidth="2"><rect x="20" y="24" width="60" height="46" rx="8" fill={G}/><rect x="27" y="31" width="46" height="21" rx="2" fill={R}/><path d="M50 31v21"/><circle cx="30" cy="61" r="4" fill={R}/><circle cx="70" cy="61" r="4" fill={R}/><path d="M27 71v5m46-5v5" stroke={R} strokeWidth="6"/></g>:
 b.icoon==='sjaal'?<g stroke={Z} strokeWidth="2" strokeLinejoin="round"><path d="M24 38h16v30H24zM60 38h16v30H60z" fill="#fff"/><path d="M24 49h16v7H24zM60 49h16v7H60z" fill="#171717"/><path d="M18 24q32 9 64 0v19q-32 9-64 0Z" fill="#fff"/><path d="M22 29q28 7 56 0v9q-28 7-56 0Z" fill="#171717"/><path d="M26 68v6m6-6v6m6-6v6m24-6v6m6-6v6m6-6v6" stroke="#fff"/></g>:
 b.icoon==='shirt'?<svg x="19" y="12" width="62" height="66"><Shirt label=""/></svg>:
 b.icoon==='kroon'?<path d="m21 32 15 10 14-22 14 22 15-10-7 36H28Z" fill={G} stroke={R} strokeWidth="2"/>:
 b.icoon==='beker'?<g fill="none" stroke={G} strokeWidth="5"><path d="M32 24h36v22q-2 17-18 17T32 46Z" fill={G}/><path d="M31 31H20v11q0 13 16 13m33-24h11v11q0 13-16 13M50 63v15m-15 2h30"/></g>:
 <path d="m50 19 9 20 23 2-17 16 5 23-20-12-20 12 5-23-17-16 23-2Z" fill={G}/>}
 {b.aantal&&<text x="50" y="87" textAnchor="middle" fontSize="23" fontWeight="900" fontFamily="Arial" fill={G} stroke={Z} strokeWidth="3" paintOrder="stroke">{b.aantal}</text>}
 </svg>;
}
function FanProfiel({rij}:{rij:ReturnType<typeof berekenFans>[number]}){return <section className="kaart"><h2>{rij.naam}</h2><div className="supporter-profiel-tellingen"><p><strong>{rij.perSeizoen[seizoenNu()] ?? 0}</strong><span>Dit seizoen ({seizoenNu().replace('-','/')})</span></p><p><strong>{rij.matchen}</strong><span>Aller tijden</span></p></div><p className="klein zacht">Waarvan {rij.uit} uitmatchen aller tijden.</p><h3>Supportersbadges</h3>{!rij.badges.length&&<p>Nog geen badges verdiend.</p>}<div className="badge-test-grid">{rij.badges.map(b=>{const badge=FAN_BADGES.find(x=>x.id===b.badge);return badge?<article className="badge-test-kaart" key={b.badge+(b.seizoen??'')}><SupporterBadgeIcoon badge={badge}/><strong>{badge.titel}</strong>{b.seizoen&&<small>{b.seizoen.replace('-','/')}</small>}<span>{badge.uitleg}</span></article>:null;})}</div></section>;}
export function SupporterProfielBadges({userId}:{userId?:string}={}){const {supporter}=useAuth();const info=useFans();const rij=info.data&&berekenFans(info.data,null).find(p=>p.user_id===(userId ?? supporter?.user_id));return <><Fout tekst={info.fout}/>{info.laden?<Laden/>:rij?<FanProfiel rij={rij}/>:<p>Nog geen supportersprofiel gevonden.</p>}<p><Link className="knop" to="/supporter-klassement">Supportersklassement</Link></p></>;}
export function SupporterKlassement(){const info=useFans();const [seizoen,setSeizoen]=useState(seizoenNu());const [persoon,setPersoon]=useState('');if(info.laden)return <Laden/>;if(!info.data)return <><Fout tekst={info.fout}/><button onClick={info.herlaad}>Opnieuw laden</button></>;const data=info.data;const rijen=berekenFans(data,seizoen||null);const seizoenen=[...new Set([seizoenNu(),...data.matches.map(m=>m.seizoen)])].sort().reverse();let rang=0;return <><h2>Supportersklassement</h2><p>Op deze ultras kunnen we rekenen. Alleen bijgewoonde, gespeelde matchen tellen mee.</p><label>Periode<select value={seizoen} onChange={e=>setSeizoen(e.target.value)}><option value="">Aller tijden</option>{seizoenen.map(s=><option key={s} value={s}>{s.replace('-','/')}</option>)}</select></label><div className="tabel-wrap"><table className="tabel"><thead><tr><th>#</th><th>Supporter</th><th>Matchen</th></tr></thead><tbody>{rijen.map((r,i)=>{if(i===0||rijen[i-1].aantal!==r.aantal)rang=i+1;return <tr key={r.id}><td>{rang}</td><td><button className="tekst-knop" onClick={()=>setPersoon(persoon===r.id?'':r.id)}>{r.naam}</button></td><td><strong>{r.aantal}</strong></td></tr>;})}</tbody></table></div>{!rijen.length&&<p>Nog geen supporters.</p>}{persoon&&rijen.find(r=>r.id===persoon)&&<FanProfiel rij={rijen.find(r=>r.id===persoon)!}/>}</>;}

export function SupporterDetail(){
 const {id}=useParams();const {lid}=useAuth();const info=useFans();
 const rij=info.data&&berekenFans(info.data,null).find(p=>p.user_id===id);
 return <><p><Link to={rechten(lid).isAdmin?'/leden?tab=supporters':'/supporter-klassement'}>← Terug naar {rechten(lid).isAdmin?'supporters beheren':'supportersklassement'}</Link></p><h1>Supportersprofiel</h1><Fout tekst={info.fout}/>{info.laden?<Laden/>:rij?<FanProfiel rij={rij}/>:!info.fout&&<p>Supporter niet gevonden of geen toegang.</p>}</>;
}
