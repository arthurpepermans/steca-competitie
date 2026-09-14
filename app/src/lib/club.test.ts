import {it,expect} from 'vitest';
import {clubPunten} from './club';
it('kent de afgesproken pronopunten toe in de juiste richting',()=>{expect(clubPunten(2,0,2,0)).toBe(10);expect(clubPunten(2,0,4,2)).toBe(5);expect(clubPunten(1,1,3,3)).toBe(5);expect(clubPunten(2,0,1,0)).toBe(3);expect(clubPunten(2,0,2,4)).toBe(0);});

import {clubStatistieken,type ClubData} from './club';
it('telt een bevestigd wedstrijdblad zonder verzonnen veldposities, zonder dubbeltelling',()=>{
 const d={matches:[{match_key:'eerste',seizoen:'2026-2027',aftrap:'2020-01-01T18:00:00Z',thuis:'Andere',uit:'STECA VROUWEN',thuis_score:21,uit_score:0}],opstellingen:[],verslagen:[{match_key:'eerste',statistieken:[{id:'a',goals:0,assists:0,geel:0,rood:0,gespeeld:true,keeper:true}]}]} as unknown as ClubData;
 expect(clubStatistieken(d,'a')).toMatchObject({gespeeld:1,cleansheets:0});
 d.opstellingen=[{match_key:'eerste',keuze:{GK:'a'},slotjes:[],versie:1}];
 expect(clubStatistieken(d,'a').gespeeld).toBe(1);
 expect(clubStatistieken(d,'b').gespeeld).toBe(0);
});
