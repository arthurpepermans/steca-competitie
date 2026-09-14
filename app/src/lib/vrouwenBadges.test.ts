import {it,expect} from 'vitest';
import {vrouwenBadges,VROUWEN_CATALOGUS} from './vrouwenBadges';
import {seizoenNu} from './badgeCatalogus';
import type {ClubData,ClubMatch} from './club';
const jaar=seizoenNu();
const lid=(id:string)=>({id,user_id:id,naam:id,speelt:true,functie:'speler',status:'actief',is_admin:false});
const match=(n:number):ClubMatch=>({match_key:String(n),seizoen:jaar,aftrap:new Date(Date.now()-(20-n)*86400000).toISOString(),thuis:'STECA VROUWEN',uit:'Andere',thuis_score:0,uit_score:1,is_test:false});
const basis=():ClubData=>({rol:'speler',admin:false,staf:false,user_id:'b',leden:[lid('a'),lid('b')],aanvragen:[],matches:[],aanwezigheden:[],opstellingen:[],verslagen:[],pronos:[],dream:null,stemmen:[],wasmand:[],pronoleden:[],stempunten:[]});
it('gebruikt de afgesproken titels en biedt geen uitmatchbadges aan',()=>{
 const titles=VROUWEN_CATALOGUS.map(b=>b.titel);
 for(const n of ['KDB in het roze','Official Steca Vrouw','Steca Vrouwen Legende','Supporters icoon','Op een presenteerblaadje','Aangeefster','Nog eentje dan'])expect(titles).toContain(n);
 expect(titles).not.toContain('Wingman');expect(VROUWEN_CATALOGUS.some(b=>b.id==='fan:first_away')).toBe(false);
});
it('geeft geen leidersbadge bij nul en deelt een positieve eerste plaats',()=>{
 const d=basis();expect(vrouwenBadges(d,'a')).toEqual([]);d.matches=[match(1)];d.verslagen=[{match_key:'1',verslag:'',statistieken:['a','b'].map(id=>({id,goals:1,assists:0,geel:0,rood:0,gespeeld:true}))}];
 for(const id of ['a','b'])expect(vrouwenBadges(d,id)).toContainEqual(expect.objectContaining({id:'gouden_stier',seizoen:jaar}));
});
it('rekent aanwezigheidsreeksen voor de profielhouder, niet de ingelogde kijker',()=>{
 const d=basis();d.matches=Array.from({length:10},(_,n)=>match(n));d.aanwezigheden=d.matches.map(m=>({match_key:m.match_key,user_id:'b',status:'aanwezig',naam:'b',speler:true}));
 expect(vrouwenBadges(d,'a').some(b=>b.id==='rots_in_de_branding')).toBe(false);
 d.aanwezigheden=d.aanwezigheden.map(a=>({...a,user_id:'a'}));
 expect(vrouwenBadges(d,'a').map(b=>b.id)).toEqual(expect.arrayContaining(['vijf_op_een_rij','rots_in_de_branding']));
});
it('telt kaarten in opeenvolgende gespeelde importmatchen en bewaart herhaalbare matchlinks',()=>{
 const d=basis();d.matches=Array.from({length:7},(_,n)=>match(n));d.verslagen=[0,6].map(n=>({match_key:String(n),verslag:'',statistieken:[{id:'a',goals:3,assists:0,geel:n===0?1:0,rood:n===6?1:0,gespeeld:true}]}));
 const b=vrouwenBadges(d,'a');expect(b.some(x=>x.id==='getikte_zot')).toBe(true);expect(b.filter(x=>x.id==='hattrick').map(x=>x.match)).toEqual(['0','6']);
});
it('toont supporterbadges van de bekeken supporter en behoudt seizoensvermelding',()=>{
 const d=basis();d.pronoleden=[{user_id:'fan1',naam:'Een'},{user_id:'fan2',naam:'Twee'}];d.matches=[match(0)];d.aanwezigheden=[{match_key:'0',user_id:'fan1',status:'aanwezig',naam:'Een',speler:false}];
 expect(vrouwenBadges(d,undefined,'fan1').map(b=>b.titel)).toContain('Welkom langs de lijn');expect(vrouwenBadges(d,undefined,'fan2')).toEqual([]);
 expect(vrouwenBadges(d,undefined,'fan1')).toContainEqual(expect.objectContaining({id:'fan:ultra_jaar',seizoen:jaar}));
});
