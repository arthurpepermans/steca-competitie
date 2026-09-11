import type { ReactNode } from 'react';
import { WasmandTekening } from './Wasmand';
import { Shirt } from './Shirt';
import { badgeVoor } from '../lib/badgeCatalogus';

const G = '#e2b63c', R = '#f5eedb', Z = '#292929', H = '#606060', RO = '#ba5144';
function Bal({x=50,y=50,r=18,kleur=R}:{x?:number;y?:number;r?:number;kleur?:string}) {
  return <g transform={`translate(${x} ${y}) scale(${r/18})`}>
    <circle r="18" fill={kleur} stroke={Z} strokeWidth="1.3"/>
    <path d="m0-7.5 7.13 5.18-2.72 8.39h-8.82l-2.72-8.39Z" fill={Z}/>
    {[0,72,144,216,288].map(hoek=><g key={hoek} transform={`rotate(${hoek})`}>
      <path d="M-5-17a18 18 0 0 1 10 0l-.5 5L0-10l-4.5-2Z" fill={Z}/>
      <path d="M0-7.5V-10M4.5-12l7.5-1.4" fill="none" stroke={Z} strokeWidth="1.1" strokeLinejoin="round"/>
    </g>)}
    <circle r="17.3" fill="none" stroke={kleur} strokeWidth="1.4"/>
  </g>;
}
function Getal({n,x=50,y=77}:{n:string;x?:number;y?:number}) {return <text x={x} y={y} textAnchor="middle" fill={G} stroke={Z} strokeWidth="3" paintOrder="stroke" fontFamily="Arial, sans-serif" fontWeight="900" fontSize={n.length>2?23:27}>{n}</text>;}
function Ster({kleur=G}:{kleur?:string}) {return <path d="m50 19 9 20 23 2-17 16 5 23-20-12-20 12 5-23-17-16 23-2Z" fill={kleur}/>;}
function Handschoen() {return <path d="M36 77 28 55l-8-14q-2-7 4-8l11 13-2-25q0-8 6-7l4 24V16q1-8 7-5l3 27 3-21q2-7 7-3l-1 26 5-16q3-5 7-1l-4 32-8 22Z" fill={R} stroke={Z} strokeWidth="2"/>;}

function Tekening({id}:{id:string}):ReactNode {
  const goals:Record<string,string>={eentje_is_geentje:'1',dubbele_cijfers:'10',goalgetter:'25','67':'67',triple_digits:'100'};
  if(goals[id]) return <><Bal y={43} r={24}/><Getal n={goals[id]}/></>;
  switch(id) {
    case 'gouden_stier': return <><path d="M31 42Q9 34 20 18q-1 16 18 12M69 42q22-8 11-24 1 16-18 12" fill={R}/><path d="m31 33 19-7 19 7-4 31-15 15-15-15Z" fill={G}/><path d="m30 41-10-4 8 16 9-4M70 41l10-4-8 16-9-4" fill={G}/><path d="m37 45 8 3m18-3-8 3" stroke={Z} strokeWidth="4"/><ellipse cx="50" cy="65" rx="11" ry="8" fill={H}/><path d="M44 65h3m6 0h3" stroke={Z} strokeWidth="3"/></>;
    case 'het_kanon': return <><path d="M33 54h23l23 19H29Z" fill={H}/><path d="M59 64 79 73H60" fill="none" stroke={G} strokeWidth="4" strokeLinejoin="round"/><g transform="rotate(-14 50 42)"><path d="M28 32h47v20H28a10 10 0 0 1 0-20Z" fill={R}/><rect x="69" y="29" width="8" height="26" rx="2" fill={G}/><path d="M77 32v20" stroke={Z} strokeWidth="3"/></g><circle cx="42" cy="65" r="17" fill={Z}/><circle cx="42" cy="65" r="14" fill={G}/><path d="M42 52v26M29 65h26m-22-9 18 18m0-18-18 18" stroke={Z} strokeWidth="2.5"/><circle cx="42" cy="65" r="4" fill={R}/></>;
    case 'assistenkoning': return <><Bal y={61} r={23}/><path d="m29 23 12 10 9-17 9 17 12-10-4 20H33Z" fill={G}/></>;
    case 'maestro': return <><path d="m26 64 24-36 24 36H26" fill="none" stroke={R} strokeWidth="3" strokeDasharray="5 4"/><path d="m45 32 5-7 5 7m14 25 7 9-10-1" fill="none" stroke={G} strokeWidth="4"/><circle cx="26" cy="64" r="8" fill={G}/><circle cx="50" cy="25" r="7" fill={R}/><Bal x={75} y={66} r={11}/></>;
    case 'de_muur': return <g fill={R} stroke={Z} strokeWidth="2">{[0,1,2,3].map(row=><g key={row}>{[0,1,2].map(col=><rect key={col} x={20+col*20} y={24+row*13} width="20" height="13"/>)}{row%2===1 && <path d={`M30 ${24+row*13}v13m20-13v13m20-13v13`} stroke={H}/>}</g>)}</g>;
    case 'betonblok': return <><rect x="22" y="22" width="56" height="58" rx="7" fill={H}/><rect x="28" y="28" width="44" height="46" rx="4" fill="none" stroke={Z} strokeWidth="3"/><path d="M22 32h9v10h-9Zm0 27h9v10h-9Z" fill="#181818"/><circle cx="53" cy="51" r="13" fill="none" stroke={G} strokeWidth="4"/><path d="M53 51V38m0 13-11 7m11-7 11 7" stroke={G} strokeWidth="4"/><circle cx="53" cy="51" r="4" fill={G}/></>;
    case 'beenhouwer': return <><rect x="25" y="50" width="18" height="28" rx="2" fill={G} transform="rotate(-12 34 64)"/><rect x="44" y="53" width="18" height="28" rx="2" fill={RO}/><path d="M26 20h43v27H26Z" fill={R}/><circle cx="33" cy="26" r="2" fill={Z}/><path d="M69 22h11v8H69Z" fill={G}/><path d="M30 41h35" stroke={H} strokeWidth="2"/></>;
    case 'rosse_furie': return <><path d="M50 17q5 17 18 26l4-14q20 36-7 51H33Q12 61 33 36l1 17q20-13 16-36" fill={G}/><rect x="37" y="40" width="27" height="35" rx="3" fill={RO} stroke={Z} strokeWidth="2"/></>;
    case 'fundering': return <><path d="M21 68h58v13H21zm9-18h40v14H30zm10-18h20v14H40Z" fill={R}/><path d="M18 84h64" stroke={G} strokeWidth="4"/></>;
    case 'vaste_waarde': return <svg x="18" y="16" width="64" height="68"><Shirt label=""/></svg>;
    case 'clubmeubilair': return <><g stroke={R} strokeWidth="4" strokeLinecap="round"><path d="M28 32v46M72 32v46M25 64v16M75 64v16"/></g><rect x="20" y="29" width="60" height="11" rx="2" fill={G}/><rect x="20" y="44" width="60" height="11" rx="2" fill={G}/><path d="m22 59-6 7h68l-6-7Z" fill={R}/><rect x="16" y="66" width="68" height="6" rx="1" fill={G}/><path d="M28 33h44M28 48h44" stroke={Z} strokeWidth="1.5" opacity=".35"/></>;
    case 'star_boy': return <Ster/>;
    case 'goat': return <><path d="M37 38Q14 9 35 15l7 16m21 7Q86 9 65 15l-7 16" fill={G}/><path d="m29 35 21-9 21 9-5 31-16 18-16-18Z" fill={R}/><path d="m30 39-14-5 11 20 9-3m34-12 14-5-11 20-9-3" fill={R}/><path d="m35 46 8 4m22-4-8 4" stroke={Z} strokeWidth="4"/><path d="m44 63 6 5 6-5m-6 5v12" stroke={Z} strokeWidth="3" fill="none"/></>;
    case 'kuisvrouw': return <svg x="15" y="14" width="70" height="70" viewBox="0 0 150 140"><WasmandTekening/></svg>;
    case 'junior_dor': return <><Bal y={40} r={23} kleur={G}/><path d="m42 65-4 10h24l-4-10M30 78h40v7H30Z" fill={G}/></>;
    case 'sluipschutter': return <><circle cx="50" cy="43" r="25" fill="none" stroke={G} strokeWidth="2.5"/><Bal x={50} y={43} r={14}/><path d="M50 12v13m0 36v11M19 43h13m36 0h13" stroke={R} strokeWidth="3" strokeLinecap="round"/><Getal n="50" y={86}/></>;
    case 'wingman': return <><Bal y={34} r={17}/><path d="M20 76h14l16-11h15q7-4 0-7H44l-9 6H20" fill="none" stroke={R} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 53h58l-5 6H26Z" fill={G}/></>;
    case 'facteur': return <><path d="M20 29h60v40H20Z" fill={R}/><path d="m21 31 29 22 29-22" fill="none" stroke={Z} strokeWidth="3"/><Bal x={70} y={60} r={12}/><Getal n="10" y={83}/></>;
    case 'de_architect': return <><path d="M23 69V29h41m-8-8 10 8-10 8" fill="none" stroke={G} strokeWidth="4"/><path d="M35 42h15v13H35Z" fill="none" stroke={R} strokeWidth="2"/><Bal x={69} y={54} r={15}/><Getal n="25" y={83}/></>;
    case 'kdb_der_juniors': return <><path d="m21 27 19 4-2 16 18 9q8 3 4 12H20V52Z" fill={R}/><path d="M25 45h11m-12 8h11M20 65h36m-30 3v6m16-6v6" stroke={Z} strokeWidth="3"/><path d="M53 31h17m-6-6 8 6-8 6" fill="none" stroke={G} strokeWidth="3"/><Bal x={74} y={49} r={12}/><Getal n="50" y={85}/></>;
    case 'muur_van_dendermonde': return <><g transform="translate(9 6) scale(.85)"><Handschoen/></g><Getal n="1"/></>;
    case 'veilige_handen': return <><g transform="translate(6 14) scale(.65)"><Handschoen/></g><g transform="translate(96 14) scale(-.65 .65)"><Handschoen/></g><Getal n="5" y={85}/></>;
    case 'opgewarmd_door_georgie': return <><path d="M27 48q-10-10 0-19t0-15m47 34q-10-10 0-19t0-15" stroke={RO} strokeWidth="3" fill="none"/><g transform="translate(16 13) scale(.7)"><Handschoen/></g><Getal n="10" y={84}/></>;
    case 'golden_glove': return <><g fill="none" stroke={H} strokeWidth="1.3"><path d="M27 32h46v32H27ZM38 32v32m12-32v32m12-32v32M27 43h46M27 54h46M20 24l7 8m46 0 7-8M20 67l7-3m46 0 7 3"/></g><path d="M20 67V24h60v43" fill="none" stroke={R} strokeWidth="4" strokeLinejoin="round"/><g transform="translate(25 24) scale(.5)"><Handschoen/></g><Getal n="25" y={86}/></>;
    case 'official_junior': return <><svg x="18" y="16" width="64" height="68"><Shirt label="1"/></svg></>;
    case 'toogplekker': return <><path d="M27 31h34v40H27Z" fill={G}/><path d="M61 37h12q10 20-12 23M21 77h60" stroke={R} strokeWidth="5" fill="none"/><path d="M27 29q-5-13 7-13 6-7 12 0 16-5 15 13Z" fill={R}/><Getal n="10" y={62}/></>;
    case 'sterkhouder': return <><path d="M31 20h38v9H31zm5 12h28v40H36zm-7 43h42v9H29Z" fill={R}/><path d="M44 35v33m12-33v33" stroke={H} strokeWidth="3"/><Getal n="25" y={64}/></>;
    case 'georgies_favoriet': return <><path d="M50 78 22 48Q7 18 32 20q12-1 18 13 7-14 19-13 24-2 10 28Z" fill={G}/><Getal n="50" y={58}/></>;
    case 'steca_legend': return <><Ster kleur={R}/><Getal n="100" y={60}/></>;
    case 'hattrick': return <><Bal x={50} y={33} r={18}/><Bal x={31} y={66} r={18}/><Bal x={69} y={66} r={18}/></>;
    case 'vijf_op_een_rij': return <><path d="M29 24v31m12-31v31m12-31v31m12-31v31M24 51l47-25" stroke={G} strokeWidth="4"/><path d="M29 62h17v9l21 2v10H29Z" fill={R}/></>;
    case 'rots_in_de_branding': return <><path d="m24 64 10-29 17-12 16 11 10 30Z" fill={H}/><path d="m34 35 17-12-8 29-19 12Z" fill={R}/><path d="m51 23 16 11-4 22-20-4Z" fill="#83837d"/><path d="M17 67q8-6 16 0t16 0t16 0t16 0M22 76q7-5 14 0t14 0t14 0t14 0" fill="none" stroke={R} strokeWidth="3" strokeLinecap="round"/><Getal n="10" y={58}/></>;
    case 'junior_van_de_match': return <><path d="m35 53-7 31 16-7 8 8 6-30m-2 0 8 30 7-9 14 6-12-31" fill={G}/><circle cx="50" cy="41" r="25" fill={G}/><Bal y={41} r={20}/></>;
    case 'laat_je_ploeg': return <><rect x="25" y="20" width="30" height="44" rx="3" fill={RO}/><path d="M34 76h44m-10-10 11 10-11 10" fill="none" stroke={R} strokeWidth="4"/></>;
    case 'getikte_zot': return <><rect x="25" y="26" width="25" height="44" rx="3" fill={G} transform="rotate(-12 37 48)"/><rect x="52" y="30" width="25" height="44" rx="3" fill={G} transform="rotate(12 64 52)"/></>;
    default: return null;
  }
}

export function BadgeIcoon({id}:{id:string}) {
  return <svg className="badge-icoon" viewBox="0 0 100 100" role="img" aria-label={badgeVoor(id)?.titel ?? id}>
    <circle cx="50" cy="50" r="48" fill={Z} stroke={R} strokeWidth="2"/>
    <Tekening id={id}/>
  </svg>;
}
