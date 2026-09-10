import { describe, expect, it } from 'vitest';
import { pronostiekPunten } from './kantine';
describe('pronostiekpunten zonder optellen',()=>{
 it.each([[2,0,2,0,10],[0,3,0,3,10],[0,0,0,0,10],[2,0,4,2,5],[0,2,2,4,5],[1,1,2,2,5],[0,0,3,3,5],[2,0,2,4,0],[0,2,4,2,0],[2,0,3,2,3],[0,2,2,3,3],[1,1,2,1,0],[1,0,1,1,0],[1,0,null,null,0]])('%s-%s bij %s-%s geeft %s',(a,b,c,d,p)=>expect(pronostiekPunten(a,b,c,d)).toBe(p));
 it('is symmetrisch voor thuis en uit en houdt prioriteit bij alle kleine scores',()=>{
  for(let a=0;a<6;a++)for(let b=0;b<6;b++)for(let c=0;c<6;c++)for(let d=0;d<6;d++){
   const p=pronostiekPunten(a,b,c,d);expect(p).toBe(pronostiekPunten(b,a,d,c));
   if(Math.sign(a-b)!==Math.sign(c-d))expect(p).toBe(0);
   expect([0,3,5,10]).toContain(p);
  }
 });
});
