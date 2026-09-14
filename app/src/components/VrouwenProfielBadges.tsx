import {Link} from 'react-router-dom';
import type {ClubData} from '../lib/club';
import {vrouwenBadges} from '../lib/vrouwenBadges';
import {VrouwenBadgeIcoon} from './VrouwenBadgeIcoon';
export function VrouwenProfielBadges({data,id,user}:{data:ClubData;id?:string;user?:string}){
 const items=vrouwenBadges(data,id,user);
 return <section className="kaart"><h2>Badges</h2>{!items.length?<p className="zacht">Nog geen badges behaald.</p>:<div className="badge-profiel-grid">{items.map((b,i)=><details className="badge-profiel" key={b.id+String(i)}><summary><VrouwenBadgeIcoon id={b.id}/><strong>{b.titel}</strong>{b.seizoen&&<small>{b.seizoen.replace('-','/')}</small>}{b.test&&<small>Testbadge</small>}</summary><p>{b.uitleg}</p>{b.match&&<Link to={'/vrouwen/match/'+encodeURIComponent(b.match)}>Bekijk matchverslag</Link>}</details>)}</div>}</section>;
}
