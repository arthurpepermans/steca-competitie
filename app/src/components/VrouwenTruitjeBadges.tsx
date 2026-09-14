import {useState} from 'react';
import {Link} from 'react-router-dom';
import {seizoenNu} from '../lib/badgeCatalogus';
import {vrouwenBadges} from '../lib/vrouwenBadges';
import type {ClubData} from '../lib/club';
import {VrouwenBadgeIcoon} from './VrouwenBadgeIcoon';
export function VrouwenTruitjeBadges({data,id}:{data:ClubData;id:string}){
 const [open,setOpen]=useState(false),badges=vrouwenBadges(data,id).filter(b=>b.soort==='alltime'||b.soort==='seizoen'&&b.seizoen===seizoenNu());
 if(!badges.length)return null;
 return <div className="truitje-badges"><button type="button" className="truitje-badges-knop" aria-label={'Badges: '+badges.map(b=>b.titel).join(', ')} aria-expanded={open} onClick={()=>setOpen(!open)}>{badges.slice(0,3).map(b=><VrouwenBadgeIcoon key={b.id} id={b.id}/>)}{badges.length>3&&<b>{badges.length-3}+</b>}</button>{open&&<div className="truitje-badge-detail"><button className="knop licht klein" onClick={()=>setOpen(false)}>Sluiten</button>{badges.map(b=><div key={b.id}><VrouwenBadgeIcoon id={b.id}/>{b.titel}</div>)}<Link to={'/vrouwen/leden/'+id}>Speelstersprofiel</Link></div>}</div>;
}
