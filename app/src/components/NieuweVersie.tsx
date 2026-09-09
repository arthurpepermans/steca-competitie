import { useEffect, useState } from "react";

/** Controleert bij het openen en telkens de app weer zichtbaar wordt of er online een nieuwere build staat.
 *  GitHub Pages laat de startpagina tot 10 minuten in de cache staan; een app op het beginscherm houdt de oude
 *  versie nog langer vast. Met een tik wordt de pagina buiten de cache om opnieuw geladen. */
export function NieuweVersie() {
  const [nieuw, setNieuw] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    async function controleer() {
      try {
        const r = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: "no-store" });
        if (!r.ok) return;
        const { versie } = (await r.json()) as { versie?: string };
        if (versie && versie !== __APP_VERSIE__) setNieuw(true);
      } catch {
        // offline of even geen verbinding: niets doen
      }
    }
    void controleer();
    const opZichtbaar = () => {
      if (document.visibilityState === "visible") void controleer();
    };
    document.addEventListener("visibilitychange", opZichtbaar);
    return () => document.removeEventListener("visibilitychange", opZichtbaar);
  }, []);

  if (!nieuw) return null;

  function vernieuw() {
    // een querystring omzeilt de cache van de startpagina; de hash met de huidige pagina blijft behouden
    window.location.href = `${window.location.pathname}?v=${Date.now()}${window.location.hash}`;
  }

  return (
    <button type="button" className="melding info" onClick={vernieuw} style={{ width: "100%", border: "1px solid transparent", cursor: "pointer", textAlign: "left", font: "inherit" }}>
      Er staat een nieuwe versie van de app klaar. Tik hier om te vernieuwen.
    </button>
  );
}
