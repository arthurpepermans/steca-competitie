import { describe,it,expect } from 'vitest';
import { BADGES, seizoenNu, truitjeBadges, type BadgeToewijzing } from './badgeCatalogus';

const award=(badge_id:string,seizoen:string|null=null,member_id='a'):BadgeToewijzing=>({id:badge_id,badge_id,member_id,seizoen,match_key:null,aangemaakt_op:'2026-09-11'});
describe('badges op een truitje',()=>{
  it('toont enkel actuele leiders van die persoon, nooit verzamelbadges of oude seizoenen',()=>{
    const lijst=[award('gouden_stier','2026-2027'),award('assistenkoning','2025-2026'),award('betonblok'),award('hattrick'),award('star_boy','2026-2027','b')];
    expect(truitjeBadges(lijst,'a','2026-2027').map(b=>b.id)).toEqual(['gouden_stier','betonblok']);
    expect(lijst).toHaveLength(5);
  });
  it('laat gedeelde leiders toe zonder dubbele icoontjes',()=>{
    const lijst=[award('goat'),award('goat'),award('goat',null,'b')];
    expect(truitjeBadges(lijst,'a')).toHaveLength(1);
    expect(truitjeBadges(lijst,'b')).toHaveLength(1);
    expect(truitjeBadges(lijst,'c')).toEqual([]);
  });
  it('behoudt alltime bij een nieuw seizoen',()=>{
    expect(truitjeBadges([award('gouden_stier','2026-2027'),award('goat')],'a','2027-2028').map(b=>b.id)).toEqual(['goat']);
  });
  it('wisselt seizoen op 1 juli',()=>{
    expect(seizoenNu(new Date(2027,5,30))).toBe('2026-2027');
    expect(seizoenNu(new Date(2027,6,1))).toBe('2027-2028');
  });
});
describe('afgesproken catalogus',()=>{
  it('bevat 40 unieke badges en alleen twee herhaalbare wedstrijdprijzen',()=>{
    expect(new Set(BADGES.map(b=>b.id)).size).toBe(40);
    expect(BADGES.filter(b=>b.soort!=='verzameling')).toHaveLength(15);
    expect(BADGES.filter(b=>b.herhaalbaar).map(b=>b.id)).toEqual(['hattrick','junior_van_de_match']);
  });
});

it('gebruikt persoonlijke volgorde voor de drie zichtbare titels, met nieuwe badges achteraan',()=>{
  const lijst=[{...award('gouden_stier','2026-2027'),volgorde:3},{...award('goat'),volgorde:1},{...award('betonblok'),volgorde:2},award('maestro')];
  expect(truitjeBadges(lijst,'a','2026-2027').map(b=>b.id)).toEqual(['goat','betonblok','gouden_stier','maestro']);
});
it('neemt nooit de voorkeur van een andere speler over',()=>{
  const lijst=[award('goat'),award('betonblok'),{...award('goat',null,'b'),volgorde:1}];
  expect(truitjeBadges(lijst,'a').map(b=>b.id)).toEqual(['betonblok','goat']);
});
