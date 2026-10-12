import { describe, expect, it } from 'vitest';
import { actieveMillis, brusselseDag, paginaCategorie } from './appgebruik';
describe('actieve tijd', () => {
  it('stopt exact na één minuut inactiviteit', () => {
    expect(actieveMillis(58_000, 63_000, 0, true)).toBe(2_000);
    expect(actieveMillis(63_000, 68_000, 0, true)).toBe(0);
  });
  it('telt een verborgen venster en slapend toestel niet mee', () => {
    expect(actieveMillis(0, 5_000, 0, false)).toBe(0);
    expect(actieveMillis(0, 3_600_000, 3_600_000, true)).toBe(0);
  });
  it('hervat na een nieuwe interactie', () => {
    expect(actieveMillis(80_000, 85_000, 80_000, true)).toBe(5_000);
  });
});
it('verwijdert identifiers en meet geen wachtwoordpagina’s of dashboard', () => {
  expect(paginaCategorie('/leden/geheime-id')).toBe('/leden/:id');
  expect(paginaCategorie('/match/2026-10-12')).toBe('/match/:key');
  expect(paginaCategorie('/nieuw-wachtwoord')).toBeNull();
  expect(paginaCategorie('/appgebruik')).toBeNull();
  expect(paginaCategorie('/vrouwen')).toBeNull();
  expect(paginaCategorie('/onbekend')).toBeNull();
});
it('gebruikt Belgische kalenderdagen, ook rond zomer- en wintertijd', () => {
  expect(brusselseDag(new Date('2026-10-12T22:30:00Z'))).toBe('2026-10-13');
  expect(brusselseDag(new Date('2026-12-12T22:30:00Z'))).toBe('2026-12-12');
});
