import type {Moment} from './matchverslag';
import type {ClubLid,ClubStat} from './club';
export type VrouwenVerslagInhoud={type:'steca-momenten-v1';momenten:Moment[];tekst:string;oudeStatistieken:ClubStat[]};
export function leesVrouwenVerslag(tekst:string,stats:ClubStat[]):VrouwenVerslagInhoud{
 try{const d=JSON.parse(tekst);if(d.type==='steca-momenten-v1'&&Array.isArray(d.momenten)&&Array.isArray(d.oudeStatistieken))return d;}catch{/* Bestaand tekstverslag behouden. */}
 return {type:'steca-momenten-v1',momenten:[],tekst,oudeStatistieken:stats};
}
export function vrouwenMomentStats(momenten:Moment[],leden:ClubLid[],kant:'thuis'|'uit',oude:ClubStat[]=[]):ClubStat[]{
 const out=new Map(oude.map(s=>[s.id,{...s}]));
 const vind=(naam:string)=>{const lijst=leden.filter(l=>l.speelt&&l.status==='actief'&&l.naam.trim().toLocaleLowerCase()===naam.trim().toLocaleLowerCase());if(lijst.length!==1)throw Error('Kies een unieke speelstersnaam uit de lijst: '+naam);const l=lijst[0];if(!out.has(l.id))out.set(l.id,{id:l.id,goals:0,assists:0,geel:0,rood:0});return out.get(l.id)!;};
 for(const m of momenten.filter(m=>m.kant===kant)){if(m.speler.trim()){const r=vind(m.speler);if(m.soort==='goal')r.goals++;else if(m.soort==='geel')r.geel++;else r.rood++;}if(m.soort==='goal'&&m.assist.trim())vind(m.assist).assists++;}
 for(const r of out.values()){if(r.geel>2||r.rood>1)throw Error('Controleer de kaarten: maximaal twee gele en een rode kaart per speelster.');if(r.geel===2)r.rood=1;}
 return [...out.values()];
}
