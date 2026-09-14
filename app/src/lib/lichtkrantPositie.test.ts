import {it,expect} from 'vitest';
import {lichtkrantPositie} from './lichtkrantPositie';
it('slaat tijdelijk onmeetbare balken over zonder eindeloze lus',()=>{
 for(const x of [-10,0,100])expect(lichtkrantPositie(x,0,0)).toBeNull();
 expect(lichtkrantPositie(10,100,0)).toBeNull();
 expect(lichtkrantPositie(Infinity,100,600)).toBeNull();
});
it('plaatst kopieën doorlopend binnen de band, ook na lang bewegen',()=>{
 for(const x of [-1000000000000,-601,-101,-100,0,499,501,1000000000000]){
 const uit=lichtkrantPositie(x,100,600)!;
 expect(uit).toBeGreaterThanOrEqual(-100);expect(uit).toBeLessThan(500);
 expect(Math.abs((x-uit)%600)).toBe(0);
 }
 expect(lichtkrantPositie(-101,100,600)).toBe(499);
 expect(lichtkrantPositie(501,100,600)).toBe(-99);
});
