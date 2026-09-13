import {describe,it,expect} from 'vitest';
import {berekenFans,type FanData} from './supporterBadges';
function fixture(n=0):FanData{return {personen:[{id:'a',naam:'A',user_id:null},{id:'b',naam:'B',user_id:null}],matches:Array.from({length:n},(_,i)=>({id:String(i),seizoen:'2026-2027',datum:`2026-01-${String(i+1).padStart(2,'0')}`,uit:true,gespeeld:true,label:'Test'})),bezoeken:[],afgerond:[],testbadges:[]};}
const ids=(d:FanData,id='a')=>berekenFans(d,null).find(p=>p.id===id)!.badges.map(b=>b.badge);
describe('Supportersbadgeberekening',()=>{
 it('geeft op nul geen leidersbadge',()=>expect(ids(fixture())).toEqual([]));
 it('telt bezoeken uniek en alleen gespeelde matches, deelt leiderschap',()=>{const d=fixture(2);d.matches[1].gespeeld=false;d.bezoeken=[{persoon:'a',match:'0'},{persoon:'a',match:'0'},{persoon:'a',match:'1'},{persoon:'b',match:'0'}];expect(berekenFans(d,null).map(p=>p.aantal)).toEqual([1,1]);for(const p of ['a','b'])expect(ids(d,p)).toContain('ultra_jaar');});
 it('sorteert de leider bovenaan en filtert seizoen',()=>{const d=fixture(2);d.matches[0].seizoen='2025-2026';d.bezoeken=[{persoon:'b',match:'0'},{persoon:'b',match:'1'}];expect(berekenFans(d,'2026-2027')[0]).toMatchObject({id:'b',aantal:1,matchen:2});});
 it('bewaart de verdiende reeks nadat een match wordt gemist',()=>{const d=fixture(6);d.bezoeken=d.matches.slice(0,5).map(m=>({persoon:'a',match:m.id}));expect(ids(d)).toContain('vaste_klant');expect(ids(d)).not.toContain('prioriteiten');});
 it('een gemiste thuismatch onderbreekt alleen de gewone reeks',()=>{const d=fixture(6);d.matches[2].uit=false;d.bezoeken=d.matches.filter(m=>m.uit).map(m=>({persoon:'a',match:m.id}));expect(ids(d)).toContain('busje');expect(ids(d)).not.toContain('vaste_klant');});
 it('wacht voor Perfect seizoen op afronding en alle gespeelde matches',()=>{const d=fixture(2);d.bezoeken=d.matches.map(m=>({persoon:'a',match:m.id}));expect(ids(d)).not.toContain('perfect_seizoen');d.afgerond=['2026-2027'];d.matches[1].gespeeld=false;expect(ids(d)).not.toContain('perfect_seizoen');d.matches[1].gespeeld=true;expect(ids(d)).toContain('perfect_seizoen');});
 it('verdient alle 100-matchmijlpalen zonder dubbele testbadge',()=>{const d=fixture(100);d.bezoeken=d.matches.map(m=>({persoon:'a',match:m.id}));d.testbadges=[{persoon:'a',badge:'tribune',seizoen:null}];expect(ids(d)).toEqual(expect.arrayContaining(['away_icon','tribune','prioriteiten','busje']));expect(ids(d).filter(x=>x==='tribune')).toHaveLength(1);});
});
