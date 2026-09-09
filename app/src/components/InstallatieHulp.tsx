import { useEffect, useState } from "react";
import { DeviceMobile } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import { Export } from "@phosphor-icons/react/dist/csr/Export";
import { DotsThreeVertical } from "@phosphor-icons/react/dist/csr/DotsThreeVertical";

type InstallatieEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const VERBORGEN_SLEUTEL = "steca-installatie-verborgen";

/** open: meteen opengeklapt tonen. wegklikbaar: met een knop om de hulp op dit scherm niet meer te tonen. */
export function InstallatieHulp({ open = false, wegklikbaar = false }: { open?: boolean; wegklikbaar?: boolean } = {}) {
  const [toestel, setToestel] = useState<"iphone" | "android">(() => /Android/i.test(navigator.userAgent) ? "android" : "iphone");
  const [prompt, setPrompt] = useState<InstallatieEvent | null>(null);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState("");
  const [verborgen, setVerborgen] = useState(() => {
    if (!wegklikbaar) return false;
    try { return localStorage.getItem(VERBORGEN_SLEUTEL) === "1"; } catch { return false; }
  });
  function verberg() {
    try { localStorage.setItem(VERBORGEN_SLEUTEL, "1"); } catch { /* Optionele voorkeur. */ }
    setVerborgen(true);
  }
  const [geinstalleerd, setGeinstalleerd] = useState(() => window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
  useEffect(() => {
    const beschikbaar = (event: Event) => { event.preventDefault(); setPrompt(event as InstallatieEvent); };
    const klaar = () => { setGeinstalleerd(true); setPrompt(null); };
    const modus = window.matchMedia("(display-mode: standalone)");
    const wijzig = () => { if (modus.matches) klaar(); };
    window.addEventListener("beforeinstallprompt", beschikbaar);
    window.addEventListener("appinstalled", klaar);
    modus.addEventListener("change", wijzig);
    return () => { window.removeEventListener("beforeinstallprompt", beschikbaar); window.removeEventListener("appinstalled", klaar); modus.removeEventListener("change", wijzig); };
  }, []);
  async function installeer() {
    if (!prompt || bezig) return;
    setBezig(true); setMelding("");
    try {
      await prompt.prompt();
      const keuze = await prompt.userChoice;
      setMelding(keuze.outcome === "accepted" ? "Bevestig de installatie verder in je browser als die dat vraagt." : "Je kunt de app later toevoegen via het browsermenu hieronder.");
    } catch { setMelding("Gebruik de stappen hieronder om de app toe te voegen."); }
    finally { setPrompt(null); setBezig(false); }
  }
  if (geinstalleerd || verborgen) return null;
  return <details className="installatie-hulp" open={open}>
    <summary><DeviceMobile size={27} aria-hidden="true" /><span><strong>Zet op je beginscherm</strong><small>Open Steca rechtstreeks via het app-icoon.</small></span><span className="installatie-plus" aria-hidden="true">+</span></summary>
    <div className="installatie-inhoud">
      <div className="installatie-keuze" role="group" aria-label="Kies je telefoon"><button type="button" aria-pressed={toestel === "iphone"} onClick={() => setToestel("iphone")}>iPhone</button><button type="button" aria-pressed={toestel === "android"} onClick={() => setToestel("android")}>Android</button></div>
      <div className="installatie-logo"><img src={import.meta.env.BASE_URL + "icon-retro-180.png"} alt="" width="52" height="52" /><span>Steca Juniors Clubapp<small>Dit icoon komt op je beginscherm.</small></span></div>
      {toestel === "iphone" ? <ol>
        <li>Open deze website in <strong>Safari</strong>.</li>
        <li>Tik op <strong>Deel <Export size={18} aria-hidden="true" /></strong>, het vierkantje met de pijl omhoog. Staat het niet in beeld? Open eerst het menu <strong>…</strong>.</li>
        <li>Scrol in het deelmenu en kies <strong>Zet op beginscherm</strong>.</li>
        <li>Laat <strong>Open als webapp</strong> aan staan als je die optie ziet. Controleer de naam en tik op <strong>Voeg toe</strong>.</li>
      </ol> : <>
        {prompt && <button type="button" className="knop breed" disabled={bezig} onClick={installeer}>{bezig ? "Installatie openen…" : "Installeer Steca Juniors Clubapp"}</button>}
        <ol><li>Open deze website in <strong>Chrome</strong>.</li><li>Tik rechtsboven op het menu <strong>⋮ <DotsThreeVertical size={18} aria-hidden="true" /></strong>.</li><li>Kies <strong>Toevoegen aan startscherm</strong> of <strong>App installeren</strong>.</li><li>Bevestig met <strong>Installeren</strong> of <strong>Toevoegen</strong>.</li></ol>
      </>}
      {melding && <p className="klein" role="status">{melding}</p>}
      <p className="installatie-tip">Geopend vanuit WhatsApp, Facebook of Instagram? Open de link eerst in {toestel === "iphone" ? "Safari" : "Chrome"} via het menu van die app.</p>
      <p className="klein zacht">Je hoeft niets uit de App Store of Play Store te downloaden.</p>
      {wegklikbaar && <button type="button" className="knop licht breed" onClick={verberg}>Al gedaan, niet meer tonen</button>}
    </div>
  </details>;
}
