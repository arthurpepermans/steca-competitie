import { expect,it } from 'vitest';
import { aftrapTijd } from './aftrap';
it('rekent Belgische winter- en zomertijd om onafhankelijk van de toestelzone',()=>{
 expect(aftrapTijd({datum:'2026-09-12',uur:'15:00'})).toBe(Date.parse('2026-09-12T13:00:00Z'));
 expect(aftrapTijd({datum:'2026-10-25',uur:'15:00'})).toBe(Date.parse('2026-10-25T14:00:00Z'));
 expect(aftrapTijd({datum:'2026-03-29',uur:'15:00'})).toBe(Date.parse('2026-03-29T13:00:00Z'));
 expect(aftrapTijd({datum:'2026-09-12',uur:null})).toBe(null);
});
