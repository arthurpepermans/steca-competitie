import { describe, expect, it, vi } from 'vitest';
vi.mock('./supabase',()=>({supabase:{}}));
import { samenvatting, sorteerMomenten, type Moment } from './matchverslag';
describe('matchverslag',()=>{
  it('sorteert bekende minuten aflopend en laat ontbrekende minuten onbekend',()=>{
    const goal=(minuut:number|null):Moment=>({minuut,soort:'goal',kant:'thuis',speler:'Test',assist:''});
    const bron=[goal(20),goal(null),goal(75)];
    expect(sorteerMomenten(bron).map(m=>m.minuut)).toEqual([75,20,null]);
    expect(bron.map(m=>m.minuut)).toEqual([20,null,75]);
  });
  it('gebruikt alleen statistieken van deze match zonder minuten of assists te verzinnen',()=>{
    const stat=(match_key:string)=>({match_key,member_id:'a',gespeeld:true,goals:2,assists:1,geel:0,rood:0});
    expect(samenvatting([stat('a'),stat('b')],'a',new Map([['a','Testspeler']]))).toEqual([{...stat('a'),naam:'Testspeler'}]);
  });
});
