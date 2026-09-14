import {BadgeIcoon} from './BadgeIcoon';
import {SupporterBadgeIcoon} from './SupporterKlassement';
import {Shirt} from './Shirt';
import {WasmandTekening} from './Wasmand';
import {VROUWEN_CATALOGUS,VROUWEN_FAN_BADGES} from '../lib/vrouwenBadges';
import './VrouwenBadges.css';
export function VrouwenBadgeIcoon({id}:{id:string}){
 const fan=VROUWEN_FAN_BADGES.find(b=>'fan:'+b.id===id),titel=VROUWEN_CATALOGUS.find(b=>b.id===id)?.titel??id;
 const eigen=id==='gouden_stier'||id==='toogplekker'||id==='kuisvrouw'||id==='vaste_waarde'||id==='official_junior'||fan?.icoon==='shirt';
 return <span className="v-badge" role="img" aria-label={titel}><span aria-hidden="true">{eigen?<svg className="badge-icoon" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#f5b5d1" stroke="#171717" strokeWidth="2"/>
 {id==='gouden_stier'?<g fill="#171717"><path d="M25 36 22 18q14-3 20 12h16q6-15 20-12l-3 18q12 18-2 38L50 88 27 74Q13 54 25 36Z"/><path d="m30 45 13 5-7 5Zm40 0-13 5 7 5Z" fill="#fff"/><path d="m43 65 7 7 7-7ZM38 75q12 10 24 0" fill="#f5b5d1" stroke="#f5b5d1" strokeWidth="2"/><path d="m35 28 3-12 12 7 12-7 3 12Z" fill="#fff"/></g>:id==='toogplekker'?<g stroke="#171717" strokeWidth="3" fill="none"><path d="M34 20h32l-2 27q-2 14-14 14T36 47ZM50 61v19m-13 0h26"/><path d="M36 37h28l-1 10q-2 12-13 12T37 47Z" fill="#fff"/><text x="50" y="48" textAnchor="middle" stroke="none" fill="#171717" fontSize="14" fontWeight="bold">10</text></g>:id==='kuisvrouw'?<svg x="15" y="14" width="70" height="70" viewBox="0 0 150 140"><WasmandTekening vrouwen/></svg>:<svg x="18" y="16" width="64" height="68"><Shirt vrouwen label={id==='official_junior'?'1':''}/></svg>}
 </svg>:fan?<SupporterBadgeIcoon badge={fan}/>:<BadgeIcoon id={id}/>}</span></span>;
}
