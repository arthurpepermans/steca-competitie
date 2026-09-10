import { describe, expect, it } from 'vitest';
import { bericht, verschuldigd, type Situatie } from '../../../supabase/functions/_shared/meldingen';
const uur = 3600000, minuut = 60000;
const aftrap = Date.parse('2026-10-25T14:00:00Z');
const basis: Situatie = { aftrap, scoreAt:null, antwoord:false, aanwezig:false, gestemd:false, eersteVerzonden:null, deadline:aftrap+7*24*uur };
describe('meldingsteksten per uitslag', () => {
  it.each([
    [3, 0, true, 'Wat een toppers!'], [0, 3, false, 'Wat een toppers!'],
    [0, 3, true, 'Sukkels!'], [3, 0, false, 'Sukkels!'],
    [0, 0, true, '1 punt!'], [2, 2, false, '1 punt!'],
  ])('kiest de juiste tekst bij %i-%i, Steca thuis: %s', (thuis, uit, stecaThuis, tekst) => {
    const b = bericht('stemmen', 'FC Test', { thuis_score: thuis, uit_score: uit, steca_thuis: stecaThuis });
    expect(b.body).toContain(tekst);
    expect(b.body).toContain(`${thuis}-${uit}`);
  });
  it('past ook de herinnering aan het resultaat aan', () => {
    expect(bericht('stemherinnering', 'FC Test', { thuis_score: 0, uit_score: 3, steca_thuis: false }).body).toContain('De derde helft');
    expect(bericht('stemherinnering', 'FC Test', { thuis_score: 0, uit_score: 3, steca_thuis: true }).body).toContain('Verdriet');
    expect(bericht('stemherinnering', 'FC Test', { thuis_score: 1, uit_score: 1, steca_thuis: true }).body).toContain('tegen FC Test');
  });
  it('verzint geen score wanneer de score ontbreekt', () => {
    expect(bericht('stemmen', 'FC Test', { thuis_score: null, uit_score: null, steca_thuis: true }).body).not.toContain('1 punt');
  });
});
describe('meldmomenten',()=>{
  it('stuurt niets vóór 72 uur, wisselt exact bij 48 uur en stopt bij aftrap',()=>{
    expect(verschuldigd(basis,aftrap-72*uur-1)).toEqual([]);
    expect(verschuldigd(basis,aftrap-72*uur)).toEqual(['aanwezig72']);
    expect(verschuldigd(basis,aftrap-48*uur-1)).toEqual(['aanwezig72']);
    expect(verschuldigd(basis,aftrap-48*uur)).toEqual(['aanwezig48']);
    expect(verschuldigd(basis,aftrap)).toEqual([]);
  });
  it('stuurt geen aanwezigheidsherinnering na elk soort ingevuld antwoord',()=>{
    expect(verschuldigd({...basis,antwoord:true},aftrap-72*uur)).toEqual([]);
    expect(verschuldigd({...basis,antwoord:true},aftrap-48*uur)).toEqual([]);
  });
  it('wacht bij een vroeg ingevoerde score tot precies 80 minuten',()=>{
    const s={...basis,antwoord:true,aanwezig:true,scoreAt:aftrap+20*minuut};
    expect(verschuldigd(s,aftrap+80*minuut-1)).toEqual([]);
    expect(verschuldigd(s,aftrap+80*minuut)).toEqual(['stemmen']);
  });
  it('wacht bij een late score tot de score is ingevoerd',()=>{
    const s={...basis,antwoord:true,aanwezig:true,scoreAt:aftrap+2*uur};
    expect(verschuldigd(s,aftrap+90*minuut)).toEqual([]);
    expect(verschuldigd(s,aftrap+2*uur)).toEqual(['stemmen']);
    expect(verschuldigd({...s,scoreAt:null},aftrap+3*uur)).toEqual([]);
  });
  it('herinnert drie uur na werkelijke eerste verzending, niet drie uur na aftrap',()=>{
    const s={...basis,antwoord:true,aanwezig:true,scoreAt:aftrap+90*minuut,eersteVerzonden:aftrap+4*uur};
    expect(verschuldigd(s,aftrap+7*uur-1)).toEqual([]);
    expect(verschuldigd(s,aftrap+7*uur)).toEqual(['stemherinnering']);
    expect(verschuldigd({...s,gestemd:true},aftrap+7*uur)).toEqual([]);
    expect(verschuldigd({...s,aanwezig:false},aftrap+7*uur)).toEqual([]);
  });
  it('stuurt niets zonder geldige aftrap of na de stemdeadline',()=>{
    expect(verschuldigd({...basis,aftrap:NaN},aftrap)).toEqual([]);
    expect(verschuldigd({...basis,antwoord:true,aanwezig:true,scoreAt:aftrap},basis.deadline+1)).toEqual([]);
  });
});
