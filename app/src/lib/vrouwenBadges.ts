import {BADGES,type Badge} from './badgeCatalogus';
import {FAN_BADGES,berekenFans} from './supporterBadges';
import {clubStatistieken,type ClubData} from './club';
const namen:Record<string,string>={gouden_stier:'Gouden panter',assistenkoning:'Assistenkoningin',maestro:'Maestra',beenhouwer:'Beenhouwster',star_boy:'Star girl',junior_dor:'Steca Vrouw van het Jaar',kuisvrouw:'Wasvrouw',wingman:'Op een presenteerblaadje',facteur:'Aangeefster',kdb_der_juniors:'KDB in het roze',opgewarmd_door_georgie:'De deur is dicht',official_junior:'Official Steca Vrouw',toogplekker:'Nog eentje dan',sterkhouder:'Sterkhoudster',georgies_favoriet:'Vaste prik',steca_legend:'Steca Vrouwen Legende',junior_van_de_match:'Vrouw van de Match'};
export const VROUWEN_BADGES:Badge[]=BADGES.map(b=>({...b,titel:namen[b.id]??b.titel,uitleg:b.id==='vijf_op_een_rij'?'5 opeenvolgende ploegmatchen op aanwezig.':b.id==='junior_dor'?'Meeste stempunten voor Vrouw van de Match dit seizoen.':b.uitleg.replaceAll('Junior van de Match','Vrouw van de Match')}));
const fannamen:Record<string,string>={ultra_jaar:'Superfan',eeuwige_ultra:'Supporters icoon',vaste_klant:'Op post',toog:'Vaste klant',perfect_seizoen:'Geen match gemist',tribune:'Tribune legend'};
export const VROUWEN_FAN_BADGES=FAN_BADGES.filter(b=>b.veld!=='uit'&&b.veld!=='uitreeks').map(b=>({...b,titel:fannamen[b.id]??b.titel}));
export const VROUWEN_CATALOGUS:Badge[]=[...VROUWEN_BADGES,...VROUWEN_FAN_BADGES.map(b=>({...b,id:'fan:'+b.id}))];
export type VrouwenBadgeItem=Badge&{seizoen?:string;match?:string;test?:boolean};
export function vrouwenBadges(data:ClubData,id?:string,user?:string):VrouwenBadgeItem[]{
 const items:VrouwenBadgeItem[]=[];const gebruiker=user??(id?(data.leden.find(l=>l.id===id)?.user_id??id):data.user_id);
 const gespeeld=data.matches.filter(m=>m.thuis_score!==null&&m.uit_score!==null&&Date.parse(m.aftrap)+80*60000<=Date.now());
 const voeg=(key:string,seizoen?:string,match?:string)=>{const b=VROUWEN_BADGES.find(b=>b.id===key);if(b)items.push({...b,seizoen,match});};
 if(id&&data.leden.find(l=>l.id===id)?.speelt){
 const total=clubStatistieken(data,id);
 const drempels:Record<string,[number,string][]>= {goals:[[1,'eentje_is_geentje'],[10,'dubbele_cijfers'],[25,'goalgetter'],[50,'sluipschutter'],[67,'67'],[100,'triple_digits']],assists:[[1,'wingman'],[10,'facteur'],[25,'de_architect'],[50,'kdb_der_juniors']],cleansheets:[[1,'muur_van_dendermonde'],[5,'veilige_handen'],[10,'opgewarmd_door_georgie'],[25,'golden_glove']],gespeeld:[[1,'official_junior'],[10,'toogplekker'],[25,'sterkhouder'],[50,'georgies_favoriet'],[100,'steca_legend']],rood:[[1,'laat_je_ploeg']]};
 for(const [stat,rijen] of Object.entries(drempels))for(const [n,b] of rijen)if(total[stat as keyof typeof total]>=n)voeg(b);
 const chronological=[...gespeeld].sort((a,b)=>a.aftrap.localeCompare(b.aftrap));let aanwezigRij=0,besteAanwezig=0,kaartVorige=false;
 for(const m of chronological){const speelt=(data.opstellingen.some(o=>o.match_key===m.match_key&&Object.values(o.keuze).includes(id))||data.verslagen.some(v=>v.match_key===m.match_key&&v.statistieken.some(s=>s.id===id&&s.gespeeld)));const present=data.aanwezigheden.some(a=>a.match_key===m.match_key&&(a.member_id===id||a.user_id===gebruiker)&&a.status==='aanwezig');aanwezigRij=present?aanwezigRij+1:0;besteAanwezig=Math.max(besteAanwezig,aanwezigRij);const st=data.verslagen.find(v=>v.match_key===m.match_key)?.statistieken.find(v=>v.id===id);if((st?.goals??0)>=3)voeg('hattrick',undefined,m.match_key);if(speelt){const kaart=(st?.geel??0)+(st?.rood??0)>0;if(kaart&&kaartVorige&&!items.some(b=>b.id==='getikte_zot'))voeg('getikte_zot');kaartVorige=kaart;}}
 if(besteAanwezig>=5)voeg('vijf_op_een_rij');if(besteAanwezig>=10)voeg('rots_in_de_branding');
 const win=(lid:string,key:string)=>{const punten=(data.stempunten??[]).filter(p=>p.match_key===key);const n=punten.find(p=>p.member_id===lid)?.punten??0;return n>0&&n===Math.max(...punten.map(p=>p.punten));};
 for(const m of gespeeld)if(win(id,m.match_key))voeg('junior_van_de_match',undefined,m.match_key);
 const personen=data.leden.filter(l=>l.speelt);
 const punt=(lid:string,s?:string)=>(data.stempunten??[]).filter(p=>p.member_id===lid&&gespeeld.some(m=>m.match_key===p.match_key&&(!s||m.seizoen===s))).reduce((n,p)=>n+p.punten,0);
 for(const seizoen of [undefined,...new Set(gespeeld.map(m=>m.seizoen))]){
 const ms=gespeeld.filter(m=>!seizoen||m.seizoen===seizoen);
 const score=(lid:string,key:string)=>{const c=clubStatistieken(data,lid,seizoen);if(key==='winnaar')return ms.filter(m=>win(lid,m.match_key)).length;if(key==='punten')return punt(lid,seizoen);if(key==='kaarten')return c.geel+c.rood;if(key==='aanwezig')return ms.filter(m=>data.aanwezigheden.some(a=>a.match_key===m.match_key&&(a.member_id===lid||(!!personen.find(l=>l.id===lid)?.user_id&&a.user_id===personen.find(l=>l.id===lid)?.user_id))&&a.status==='aanwezig')).length;if(key==='was')return ms.filter(m=>data.wasmand.some(w=>w.match_key===m.match_key&&w.member_id===lid)).length;return c[key as keyof typeof c]??0;};
 const titels=seizoen?[['goals','gouden_stier'],['assists','assistenkoning'],['cleansheets','de_muur'],['gespeeld','vaste_waarde'],['kaarten','beenhouwer'],['rood','rosse_furie'],['aanwezig','fundering'],['was','kuisvrouw'],['punten','junior_dor'],['winnaar','star_boy']]:[['goals','het_kanon'],['assists','maestro'],['cleansheets','betonblok'],['gespeeld','clubmeubilair'],['punten','goat']];
 for(const [key,b] of titels){const n=score(id,key);if(n>0&&n===Math.max(...personen.map(l=>score(l.id,key))))voeg(b,seizoen);}
 }
 }else{
 const fans=berekenFans({personen:data.pronoleden.filter(p=>!data.leden.some(l=>l.user_id===p.user_id&&l.functie!=='supporter')).map(p=>({id:p.user_id,user_id:p.user_id,naam:p.naam})),matches:data.matches.map(m=>({id:m.match_key,seizoen:m.seizoen,datum:m.aftrap,uit:false,gespeeld:gespeeld.includes(m),label:m.thuis+' - '+m.uit})),bezoeken:data.aanwezigheden.filter(a=>a.status==='aanwezig').map(a=>({persoon:a.user_id,match:a.match_key})),afgerond:[...new Set(data.matches.map(m=>m.seizoen))].filter(s=>Number(s.split('-')[1])<=new Date().getFullYear()&&new Date(Number(s.split('-')[1]),6,1).getTime()<Date.now()),testbadges:[]},null);
 for(const b of fans.find(f=>f.id===gebruiker)?.badges??[]){const def=VROUWEN_FAN_BADGES.find(f=>f.id===b.badge);if(def&&def.veld!=='uit'&&def.veld!=='uitreeks')items.push({...def,id:'fan:'+def.id,seizoen:b.seizoen??undefined});}
 }

 return items;
}
