import { useId, useState } from 'react';
import './MaandNavigatie.css';

export function matchMaand(datum: string | null): string {
  if (!datum) return 'onbekend';
  return datum.length === 10 ? datum.slice(0, 7) : new Date(datum).toLocaleDateString('sv-SE', { timeZone: 'Europe/Brussels' }).slice(0, 7);
}

export function kalenderMaanden(datums: (string | null)[]): string[] {
  const bekend = datums.filter((d): d is string => !!d).map(matchMaand).sort();
  const maanden: string[] = [];
  if (bekend.length) {
    const [jaar, maand] = bekend[0].split('-').map(Number);
    const datum = new Date(jaar, maand - 1, 1);
    while (true) {
      const sleutel = `${datum.getFullYear()}-${String(datum.getMonth() + 1).padStart(2, '0')}`;
      if (sleutel > bekend[bekend.length - 1]) break;
      maanden.push(sleutel);
      datum.setMonth(datum.getMonth() + 1);
    }
  }
  if (datums.some(d => !d)) maanden.push('onbekend');
  return maanden;
}

export function useKalenderMaand(datums: (string | null)[]) {
  const [keuze, setMaand] = useState<string | null>(null);
  const maanden = kalenderMaanden(datums);
  const nu = matchMaand(new Date().toISOString());
  const bekend = maanden.filter(m => m !== 'onbekend');
  const standaard = bekend.includes(nu) ? nu : bekend.find(m => m > nu) ?? bekend.at(-1) ?? maanden[0] ?? nu;
  const maand = keuze && maanden.includes(keuze) ? keuze : standaard;
  return { maanden, maand, setMaand, bevat: (datum: string | null) => matchMaand(datum) === maand };
}

export function MaandNavigatie({ maanden, maand, setMaand }: ReturnType<typeof useKalenderMaand>) {
  const [open, setOpen] = useState(false);
  const paneel = useId();
  const index = maanden.indexOf(maand);
  const datum = maand === 'onbekend' ? null : new Date(`${maand}-01T12:00:00`);
  const naam = datum?.toLocaleDateString('nl-BE', { month: 'long' }) ?? 'Datum onbekend';
  if (!maanden.length) return null;
  const kies = (waarde: string) => { setMaand(waarde); setOpen(false); };
  return <nav className="maand-navigatie" aria-label="Kalendermaand" onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); document.getElementById(paneel + '-knop')?.focus(); } }}>
    <div className="maand-navigatie-kop">
      <button id={paneel + '-knop'} type="button" className="maand-titel" aria-label={`Kies een maand, nu ${naam} ${datum?.getFullYear() ?? ''}`} aria-expanded={open} aria-controls={paneel} onClick={() => setOpen(!open)}>
        <span className="maand-editie">Wedstrijdkalender <span aria-hidden="true">/</span> {datum?.getFullYear() ?? 'Nog te bepalen'}</span>
        <span className="maand-naam">{naam}<svg className={open ? 'maand-chevron open' : 'maand-chevron'} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></span>
      </button>
      <div className="maand-pijlen">
        <button type="button" aria-label="Vorige maand" disabled={index <= 0} onClick={() => kies(maanden[index - 1])}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M19 12H5m7-7-7 7 7 7"/></svg></button>
        <button type="button" aria-label="Volgende maand" disabled={index < 0 || index >= maanden.length - 1} onClick={() => kies(maanden[index + 1])}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 12h14m-7-7 7 7-7 7"/></svg></button>
      </div>
    </div>
    <div id={paneel} className="maand-keuzes" hidden={!open}>
      {maanden.map(m => { const d = m === 'onbekend' ? null : new Date(`${m}-01T12:00:00`); return <button key={m} type="button" aria-pressed={m === maand} onClick={() => kies(m)}>
        <strong>{d?.toLocaleDateString('nl-BE', { month: 'short' }).replace('.', '') ?? 'Onbekend'}</strong><span>{d?.getFullYear() ?? 'Geen datum'}</span>
      </button>; })}
    </div>
  </nav>;
}
