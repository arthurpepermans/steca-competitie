import { useState } from 'react';
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
  const index = maanden.indexOf(maand);
  if (!maanden.length) return null;
  return <nav className="maand-navigatie" aria-label="Kalendermaand">
    <button type="button" className="knop licht" aria-label="Vorige maand" disabled={index <= 0} onClick={() => setMaand(maanden[index - 1])}>‹</button>
    <label><span className="klein zacht">Maand</span><select aria-label="Kalendermaand kiezen" value={maand} onChange={e => setMaand(e.target.value)}>
      {maanden.map(m => <option key={m} value={m}>{m === 'onbekend' ? 'Datum onbekend' : new Date(`${m}-01T12:00:00`).toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' })}</option>)}
    </select></label>
    <button type="button" className="knop licht" aria-label="Volgende maand" disabled={index < 0 || index >= maanden.length - 1} onClick={() => setMaand(maanden[index + 1])}>›</button>
  </nav>;
}
