import { useState } from 'react';
import { InstallatieHulp } from '../components/InstallatieHulp';
import { Fout, Laden } from '../components/Layout';
import { pushActie, pushOndersteund, zetMeldingenAan, zetMeldingenUit, type PushStatus } from '../lib/push';
import { foutTekst, useAsync } from '../lib/useAsync';

export function Meldingen() {
  const info = useAsync(() => pushActie<PushStatus>('status'));
  const [bezig,setBezig] = useState(false);
  const [fout,setFout] = useState('');
  const [melding,setMelding] = useState('');
  async function doe(actie: () => Promise<void>, tekst: string) {
    setBezig(true); setFout(''); setMelding('');
    try { await actie(); setMelding(tekst); }
    catch(e) { setFout(foutTekst(e)); }
    finally { setBezig(false); }
  }
  if (info.laden) return <Laden />;
  return <>
    <h1>Meldingen</h1>
    <Fout tekst={info.fout || fout} />
    {melding && <p className="melding ok" role="status">{melding}</p>}
    <section className="kaart">
      <h2>Blijf mee met de ploeg</h2>
      <p>Een herinnering 72 en 48 uur voor de match als je aanwezigheid nog ontbreekt. Na de uitslag een seintje om te stemmen op de Junior van de match, en drie uur later een herinnering als je nog niet gestemd hebt.</p>
      {!pushOndersteund() && <><p>Open de app vanaf je beginscherm om meldingen te kunnen ontvangen.</p><InstallatieHulp open /></>}
      {'Notification' in window && Notification.permission === 'denied' && <p className="melding waarschuwing">Meldingen zijn geblokkeerd. Zet ze opnieuw aan in de meldingsinstellingen van je toestel of browser en probeer daarna opnieuw.</p>}
      <div className="knoppen">
        <button className="knop" disabled={bezig || !pushOndersteund() || !info.data?.enabled} onClick={() => doe(() => zetMeldingenAan(info.data!.publicKey),'Meldingen staan aan op dit toestel.')}>Meldingen aanzetten</button>
        <button className="knop licht" disabled={bezig || !pushOndersteund()} onClick={() => doe(zetMeldingenUit,'Meldingen staan uit op dit toestel.')}>Meldingen uitzetten</button>
      </div>
      {info.data && !info.data.enabled && <p>Meldingen zijn momenteel nog niet beschikbaar.</p>}
      {!info.data && <button className="knop licht" onClick={info.herlaad}>Opnieuw proberen</button>}
    </section>
  </>;
}
