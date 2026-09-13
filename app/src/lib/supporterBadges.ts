export type FanBadge = {id:string;titel:string;uitleg:string;soort:'seizoen'|'alltime'|'verzameling';icoon:'ster'|'kroon'|'bus'|'sjaal'|'shirt'|'beker';aantal?:number;veld?:'matchen'|'uit'|'reeks'|'uitreeks'};
export const FAN_BADGES:FanBadge[]=[
 {id:'ultra_jaar',titel:'Ultra van het jaar',uitleg:'Meeste gespeelde matchen bijgewoond dit seizoen.',soort:'seizoen',icoon:'kroon'},
 {id:'eeuwige_ultra',titel:'Eeuwige Ultra',uitleg:'Meeste gespeelde matchen bijgewoond aller tijden.',soort:'alltime',icoon:'beker'},
 {id:'vaste_klant',titel:'Vaste klant',uitleg:'5 gespeelde Steca-matchen op rij bijgewoond.',soort:'verzameling',icoon:'sjaal',veld:'reeks',aantal:5},
 {id:'prioriteiten',titel:'Prioriteiten in orde',uitleg:'10 gespeelde Steca-matchen op rij bijgewoond.',soort:'verzameling',icoon:'ster',veld:'reeks',aantal:10},
 {id:'perfect_seizoen',titel:'Perfect seizoen',uitleg:'Alle matchen van een volledig afgerond seizoen bijgewoond.',soort:'seizoen',icoon:'beker'},
 ...([['first_away','First away day',1],['away_crew','Away crew',5],['onderweg','Altijd onderweg',10],['zwart_wit','Zwart wit bloed',25],['away_legend','Away legend',50],['away_icon','Away icon',100]] as const).map(([id,titel,aantal])=>({id,titel,aantal,uitleg:`${aantal} uitmatch${aantal===1?'':'en'} bijgewoond.`,soort:'verzameling' as const,icoon:'bus' as const,veld:'uit' as const})),
 ...([['welkom','Welkom langs de lijn',1],['smaak','Smaak te pakken',5],['toog','Toog én tribune',10],['hardcore','Hardcore fan',25],['team','Part of the team',50],['tribune','Tribunelegende',100]] as const).map(([id,titel,aantal])=>({id,titel,aantal,uitleg:`${aantal} gespeelde match${aantal===1?'':'en'} bijgewoond.`,soort:'verzameling' as const,icoon:aantal>=50?'shirt' as const:'sjaal' as const,veld:'matchen' as const})),
 {id:'busje',titel:'Busje komt zo',uitleg:'5 opeenvolgende uitmatchen bijgewoond. Thuismatchen onderbreken deze reeks niet.',soort:'verzameling',icoon:'bus',veld:'uitreeks',aantal:5},
];
export type Fan={id:string;naam:string;user_id:string|null};
export type FanMatch={id:string;seizoen:string;datum:string;uit:boolean;gespeeld:boolean;label:string};
export type FanBezoek={persoon:string;match:string};
export type FanToewijzing={persoon:string;badge:string;seizoen:string|null};
export type FanData={personen:Fan[];matches:FanMatch[];bezoeken:FanBezoek[];afgerond:string[];testbadges:FanToewijzing[]};
export function berekenFans(data:FanData,seizoen:string|null) {
 const alle=[...data.matches].sort((a,b)=>a.datum.localeCompare(b.datum)||a.id.localeCompare(b.id));
 const gespeeld=alle.filter(m=>m.gespeeld);
 const totaalPerSeizoen=new Map<string,number>();
 for(const m of gespeeld)totaalPerSeizoen.set(m.seizoen,(totaalPerSeizoen.get(m.seizoen)??0)+1);
 const rijen=data.personen.map(p=>{
  const bezocht=new Set(data.bezoeken.filter(b=>b.persoon===p.id).map(b=>b.match));
  const eigen=gespeeld.filter(m=>bezocht.has(m.id));
  let reeks=0,uitreeks=0,beste=0,besteUit=0;
  for(const m of gespeeld){reeks=bezocht.has(m.id)?reeks+1:0;beste=Math.max(beste,reeks);if(m.uit){uitreeks=bezocht.has(m.id)?uitreeks+1:0;besteUit=Math.max(besteUit,uitreeks);}}
  const cijfers={matchen:eigen.length,uit:eigen.filter(m=>m.uit).length,reeks:beste,uitreeks:besteUit};
  const badges:FanToewijzing[]=FAN_BADGES.filter(b=>b.veld && cijfers[b.veld]>=b.aantal!).map(b=>({persoon:p.id,badge:b.id,seizoen:null}));
  for(const s of data.afgerond){const gepland=alle.filter(m=>m.seizoen===s);if(gepland.length && gepland.every(m=>m.gespeeld&&bezocht.has(m.id)))badges.push({persoon:p.id,badge:'perfect_seizoen',seizoen:s});}
  return {...p,...cijfers,aantal:seizoen?eigen.filter(m=>m.seizoen===seizoen).length:eigen.length,badges,perSeizoen:Object.fromEntries([...totaalPerSeizoen.keys()].map(s=>[s,eigen.filter(m=>m.seizoen===s).length]))};
 });
 const max=Math.max(0,...rijen.map(r=>r.matchen));
 for(const r of rijen){
  if(max>0&&r.matchen===max)r.badges.push({persoon:r.id,badge:'eeuwige_ultra',seizoen:null});
  for(const s of totaalPerSeizoen.keys()){const leider=Math.max(0,...rijen.map(x=>x.perSeizoen[s]??0));if(leider>0&&r.perSeizoen[s]===leider)r.badges.push({persoon:r.id,badge:'ultra_jaar',seizoen:s});}
  for(const b of data.testbadges.filter(b=>b.persoon===r.id))if(!r.badges.some(a=>a.badge===b.badge&&a.seizoen===b.seizoen))r.badges.push(b);
 }
 return rijen.sort((a,b)=>b.aantal-a.aantal||a.naam.localeCompare(b.naam,'nl'));
}
