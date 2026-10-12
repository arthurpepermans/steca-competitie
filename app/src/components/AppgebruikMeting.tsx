import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { actieveMillis, brusselseDag, paginaCategorie, SESSIE_MS } from '../lib/appgebruik';

export function AppgebruikMeting() {
  const { session } = useAuth();
  const { pathname } = useLocation();
  const user = session?.user.id;
  const pagina = paginaCategorie(pathname);
  const [gelezen, setGelezen] = useState(false);
  useEffect(() => {
    try { setGelezen(localStorage.getItem(`steca-gebruik-info-v1:${user}`) === 'gelezen'); }
    catch { setGelezen(false); }
  }, [user]);

  useEffect(() => {
    if (!user || !pagina) return;
    let sessie = crypto.randomUUID();
    let laatstActief = Date.now();
    const sleutel = `steca-gebruiksessie:${user}`;
    try {
      const oud = JSON.parse(sessionStorage.getItem(sleutel) ?? 'null');
      if (oud && typeof oud.id === 'string' && Date.now() - oud.tijd < SESSIE_MS) sessie = oud.id;
    } catch { /* Meting werkt ook zonder browseropslag. */ }
    let bezoek = crypto.randomUUID();
    let dag = brusselseDag();
    let millis = 0;
    let vorig = Date.now();
    let laatsteActie = vorig;
    let zichtbaar = document.visibilityState === 'visible' && document.hasFocus();
    let gestart = false;
    let verzonden = -1;

    function bewaarSessie() {
      try { sessionStorage.setItem(sleutel, JSON.stringify({ id: sessie, tijd: laatstActief })); } catch { /* Optioneel. */ }
    }
    function verzend() {
      const seconden = Math.floor(millis / 1000);
      if (!gestart || seconden === verzonden) return;
      const id = bezoek;
      // Cumulatieve teller + bezoek-ID: herhaalde/netwerkverzoeken tellen nooit dubbel.
      void Promise.resolve(supabase.rpc('registreer_appgebruik', {
        p_bezoek: id, p_sessie: sessie, p_pagina: pagina, p_seconden: seconden,
      })).then(({ error }) => {
        if (!error && bezoek === id) verzonden = seconden;
      }).catch(() => { /* Statistieken mogen de clubapp nooit blokkeren. */ });
    }
    function tick() {
      const nu = Date.now();
      millis += actieveMillis(vorig, nu, laatsteActie, zichtbaar);
      vorig = nu;
      if (zichtbaar && nu - laatsteActie < 60_000) {
        const nieuweDag = brusselseDag();
        if (nu - laatstActief >= SESSIE_MS || nieuweDag !== dag) {
          verzend();
          if (nu - laatstActief >= SESSIE_MS) sessie = crypto.randomUUID();
          bezoek = crypto.randomUUID(); millis = 0; verzonden = -1; dag = nieuweDag;
        }
        gestart = true;
        laatstActief = nu;
        bewaarSessie();
      }
    }
    function actie() { tick(); laatsteActie = Date.now(); tick(); }
    function zichtbaarheid() {
      tick(); verzend();
      zichtbaar = document.visibilityState === 'visible' && document.hasFocus();
      if (zichtbaar) { laatsteActie = Date.now(); tick(); verzend(); }
    }
    function afsluiten() { tick(); verzend(); }
    const acties = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
    acties.forEach(e => window.addEventListener(e, actie, { passive: true }));
    document.addEventListener('visibilitychange', zichtbaarheid);
    window.addEventListener('focus', zichtbaarheid);
    window.addEventListener('blur', zichtbaarheid);
    window.addEventListener('pagehide', afsluiten);
    const teller = window.setInterval(tick, 5_000);
    const zender = window.setInterval(verzend, 15_000);
    // Uitgestelde start voorkomt dubbele pageviews door React StrictMode.
    const start = window.setTimeout(() => { tick(); verzend(); }, 0);
    return () => {
      clearTimeout(start); clearInterval(teller); clearInterval(zender);
      acties.forEach(e => window.removeEventListener(e, actie));
      document.removeEventListener('visibilitychange', zichtbaarheid);
      window.removeEventListener('focus', zichtbaarheid);
      window.removeEventListener('blur', zichtbaarheid);
      window.removeEventListener('pagehide', afsluiten);
      if (gestart) afsluiten();
    };
  }, [user, pagina, pathname]);

  if (gelezen || !user) return null;
  return <aside className="melding info" aria-label="Informatie over appgebruik">
    <strong>Zo verbeteren we de clubapp</strong>
    <p>We houden bij welke pagina’s je bezoekt, hoe vaak en hoelang je actief bent, en of je aanwezigheid, stemmen of opstellingen opslaat. Alleen de hoofdadmin kan gebruik aan je naam koppelen. Metingen verdwijnen na 90 dagen uit het overzicht en worden dagelijks verwijderd. We slaan geen ingevulde teksten of schermopnames op.</p>
    <button className="knop licht" type="button" onClick={() => {
      setGelezen(true);
      try { localStorage.setItem(`steca-gebruik-info-v1:${user}`, 'gelezen'); } catch { /* Optioneel. */ }
    }}>Begrepen</button>
  </aside>;
}
