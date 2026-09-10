import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../lib/auth';
import { pushActie, pushOndersteund, zetMeldingenAan, type PushStatus } from '../lib/push';
import { InstallatieHulp } from './InstallatieHulp';

export function MeldingenPopup() {
  const { lid } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const [publicKey, setPublicKey] = useState('');
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const sleutel = `steca-meldingen-later-${lid?.id}`;
  const ondersteund = pushOndersteund();
  const iphone = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  useEffect(() => {
    let weg = false;
    if (!lid || (!ondersteund && !iphone)) return;
    if ('Notification' in window && Notification.permission === 'denied') return;
    try { if (localStorage.getItem('steca-meldingen-uit') === '1' || Number(localStorage.getItem(sleutel)) > Date.now()) return; } catch { /* Optionele voorkeur. */ }
    async function controleer() {
      // De server bepaalt wie meldingen mag ontvangen.
      const info = await pushActie<PushStatus>('status');
      if (!info.enabled || !info.publicKey) return;
      if (ondersteund && Notification.permission === 'granted') {
        const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
        if (await reg?.pushManager.getSubscription()) return;
      }
      if (!weg) setPublicKey(info.publicKey);
    }
    controleer().catch(() => { /* Bij geen toegang of een verbindingsfout geen pop-up tonen. */ });
    return () => { weg = true; setPublicKey(''); };
  }, [lid?.id, sleutel, ondersteund, iphone]);
  useEffect(() => {
    if (publicKey && !dialog.current?.open) dialog.current?.showModal();
  }, [publicKey]);
  function later() {
    try { localStorage.setItem(sleutel, String(Date.now() + 7 * 86400000)); } catch { /* Optionele voorkeur. */ }
    dialog.current?.close(); setPublicKey('');
  }
  async function aanzetten() {
    setBezig(true); setFout('');
    try {
      await zetMeldingenAan(publicKey);
      dialog.current?.close(); setPublicKey('');
    } catch (e) { setFout(e instanceof Error ? e.message : 'Meldingen aanzetten lukt niet. Probeer opnieuw.'); }
    finally { setBezig(false); }
  }
  if (!publicKey) return null;
  return <dialog ref={dialog} className="meldingen-popup" aria-labelledby="meldingen-titel" onCancel={e => { e.preventDefault(); if (!bezig) later(); }}>
    <img src={import.meta.env.BASE_URL + 'logo-retro.png'} alt="" width="60" height="70" />
    <h2 id="meldingen-titel">Zet je meldingen aan</h2>
    <p>Een seintje om je aanwezigheid in te vullen en te stemmen op de Junior van de match.</p>
    {!ondersteund && <><p>Zet de app eerst op je beginscherm en open ze via het app-icoon. Daarna kun je meldingen aanzetten.</p><InstallatieHulp open /></>}
    {fout && <p role="alert" className="melding fout">{fout}</p>}
    <div className="knoppen">
      {ondersteund && <button className="knop" disabled={bezig} onClick={aanzetten}>{bezig ? 'Even geduld…' : 'Meldingen aanzetten'}</button>}
      <button className="knop licht" disabled={bezig} onClick={later}>Later</button>
    </div>
  </dialog>;
}
