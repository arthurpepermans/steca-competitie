import {useState} from 'react';
import {CaretDown} from '@phosphor-icons/react/dist/csr/CaretDown';
import {CaretUp} from '@phosphor-icons/react/dist/csr/CaretUp';
import {clubRpc,type ClubData,type ClubMatch} from '../lib/club';
import type {Match} from '../lib/types';
import {leesVrouwenVerslag,vrouwenMomentStats} from '../lib/vrouwenVerslag';
import {VerslagInvoer,VerslagTijdlijn} from './MatchVerslag';
import {MapsKnop} from '../components/MatchKaart';
export function VrouwenVerslag({data,match:m,herlaad,compact=false}:{data:ClubData;match:ClubMatch;herlaad:()=>Promise<void>;compact?:boolean}){
 const [open,setOpen]=useState(!compact),[bewerk,setBewerk]=useState(false);
 const r=data.verslagen.find(r=>r.match_key===m.match_key),inhoud=leesVrouwenVerslag(r?.verslag??'',r?.statistieken??[]);
 const match:Match={...m,reeks:m.reeks??'Dames Zele',datum:new Date(m.aftrap).toLocaleDateString('sv-SE',{timeZone:'Europe/Brussels'}),uur:new Date(m.aftrap).toLocaleTimeString('nl-BE',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Brussels'}),thuis_id:m.thuis==='STECA VROUWEN'?152:null,uit_id:m.uit==='STECA VROUWEN'?152:null,status:m.thuis_score===null?'gepland':'gespeeld',terrein:m.locaties?.map(l=>[l.zaal,l.adres].filter(Boolean).join(' · ')).join(' / ')||null,opmerking:null};
 const verslag={match_key:m.match_key,thuis_score:m.thuis_score??0,uit_score:m.uit_score??0,momenten:inhoud.momenten,updated_at:r?.verslag??'',score_at:m.aftrap};
 const totalen=(r?.statistieken??[]).map(s=>({...s,member_id:s.id,match_key:m.match_key,gespeeld:true,naam:data.leden.find(l=>l.id===s.id)?.naam??'Speelster'}));
 return <div className={compact?'verslag-uitklap':''}>{compact&&<div className="verslag-uitklap-kop"><button className="knop-rond" aria-label={open?'Matchverslag dichtklappen':'Matchverslag openklappen'} aria-expanded={open} onClick={()=>setOpen(!open)}>{open?<CaretUp size={20} weight="bold"/>:<CaretDown size={20} weight="bold"/>}</button></div>}{open&&<div className={compact?'verslag-uitklap-inhoud':''}>
 <article className={compact?'':'matchverslag'}>{!compact&&<><header className="verslag-kop"><span>HET MATCHVERSLAG</span><span>{match.datum} · {match.uur}</span></header><div className="verslag-scorebord"><div>{match.thuis_id===152?<img src={import.meta.env.BASE_URL+'logo-vrouwen-transparant.png'} alt=""/>:<span className="verslag-schild">{m.thuis.slice(0,2)}</span>}<strong>{m.thuis}</strong></div><div className="verslag-uitslag"><b>{m.thuis_score??'-'} : {m.uit_score??'-'}</b><small>{match.status==='gespeeld'?'UITSLAG':'NOG TE SPELEN'}</small></div><div>{match.uit_id===152?<img src={import.meta.env.BASE_URL+'logo-vrouwen-transparant.png'} alt=""/>:<span className="verslag-schild">{m.uit.slice(0,2)}</span>}<strong>{m.uit}</strong></div></div><div className="verslag-terrein"><span>{match.terrein??'Terrein volgt'}</span><MapsKnop terrein={match.terrein}/></div></>}
 <VerslagTijdlijn match={match} verslag={verslag} totalen={totalen}/>{inhoud.tekst&&<p>{inhoud.tekst}</p>}
 </article>{data.staf&&<><button className="knop licht klein" aria-expanded={bewerk} onClick={()=>setBewerk(!bewerk)}>{bewerk?'Invoer sluiten':'Uitslag en matchverslag invullen'}</button>{bewerk&&<>{inhoud.oudeStatistieken.length>0&&<p className="klein zacht">Eerder ingevoerde totalen blijven behouden. Nieuwe momenten worden erbij geteld.</p>}<VerslagInvoer key={r?.verslag??m.match_key} match={match} verslag={verslag} spelers={data.leden.filter(l=>l.speelt&&l.status==='actief').map(l=>({id:l.id,naam:l.naam}))} bewaar={async(thuis,uit,momenten)=>{const stats=vrouwenMomentStats(momenten,data.leden,match.thuis_id===152?'thuis':'uit',inhoud.oudeStatistieken);await clubRpc('club_bewaar_verslag',{p_match:m.match_key,p_thuis:thuis,p_uit:uit,p_stats:stats,p_verslag:JSON.stringify({...inhoud,momenten})});}} klaar={async()=>{await herlaad();setBewerk(false);}}/></>}</>}
 </div>}</div>;
}
