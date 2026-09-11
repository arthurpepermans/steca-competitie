import { useEffect, useRef } from "react";
import { haalBoetes, haalLedenBasis, haalMatches, haalStats, haalStemPunten, haalWasbeurten } from "../lib/api";
import { useAuth } from "../lib/auth";
import { boeteItems, boeteTotalen, fmtEuro, potTotaal } from "../lib/boetes";
import { fmtDatum, isEigen, isThuis, laatsteUitslag, sorteerOpDatum, tegenstander, volgendeMatch } from "../lib/datum";
import { juniorVanDeMatch } from "../lib/stemmen";
import { useAsync } from "../lib/useAsync";

/** Beweging per frame in plaats van een CSS-animatie: iOS Safari tekent bij een CSS-animatie de tekst
 *  van een brede band soms pas als ze al in beeld staat. Hier verschuiven we de tekst zelf, elk frame. */
function useLichtkrant(tekst: string) {
  const band = useRef<HTMLDivElement>(null);
  const span = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const b = band.current, s = span.current;
    if (!b || !s) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      s.style.transform = "none";
      return;
    }
    const SNELHEID = 0.05; // pixels per milliseconde
    let x = b.clientWidth * 0.5; // eerste keer al halverwege, daarna telkens van de rechterrand
    let vorige = performance.now();
    let frame = 0;
    let vast = false;
    s.style.transform = `translate3d(${x}px,0,0)`;
    const stap = (nu: number) => {
      const dt = Math.min(64, nu - vorige);
      vorige = nu;
      if (!vast && !document.hidden) {
        x -= dt * SNELHEID;
        if (x < -s.offsetWidth) x = b.clientWidth;
        s.style.transform = `translate3d(${x}px,0,0)`;
      }
      frame = requestAnimationFrame(stap);
    };
    frame = requestAnimationFrame(stap);
    const houdVast = () => { vast = true; };
    const laatLos = () => { vast = false; };
    b.addEventListener("pointerdown", houdVast);
    b.addEventListener("pointerup", laatLos);
    b.addEventListener("pointercancel", laatLos);
    b.addEventListener("pointerleave", laatLos);
    return () => {
      cancelAnimationFrame(frame);
      b.removeEventListener("pointerdown", houdVast);
      b.removeEventListener("pointerup", laatLos);
      b.removeEventListener("pointercancel", laatLos);
      b.removeEventListener("pointerleave", laatLos);
    };
  }, [tekst]);
  return { band, span };
}

function Band({ tekst }: { tekst: string }) {
  const { band, span } = useLichtkrant(tekst);
  return (
    <div className="lichtkrant" ref={band} role="marquee" aria-label="Clubnieuws">
      <span ref={span}>{tekst}</span>
    </div>
  );
}

/** Lichtkrant onder de kop: laatste uitslag, volgende match, Junior van de match, boetepot en wasmand. */
export function Lichtkrant() {
  const { lid } = useAuth();
  const data = useAsync(async () => {
    if (!lid) return null;
    const [matches, punten, boetes, leden, stats, wasbeurten] = await Promise.all([
      haalMatches(), haalStemPunten(), haalBoetes().catch(() => []), haalLedenBasis(), haalStats(), haalWasbeurten().catch(() => []),
    ]);
    return { matches, punten, boetes, leden, stats, wasbeurten };
  }, [lid?.id]);

  if (!lid || data.laden || data.fout || !data.data) return null;
  const { matches, punten, boetes, leden, stats, wasbeurten } = data.data;
  const namen = new Map(leden.map((m) => [m.id, m.naam]));
  const eigen = sorteerOpDatum(matches.filter(isEigen));
  const items: string[] = [];

  const laatste = laatsteUitslag(eigen);
  if (laatste) items.push(`Laatste uitslag: ${laatste.thuis} ${laatste.thuis_score} - ${laatste.uit_score} ${laatste.uit}`);

  const volgende = volgendeMatch(eigen);
  if (volgende) items.push(`Volgende: ${tegenstander(volgende)} (${isThuis(volgende) ? "thuis" : "uit"}), ${fmtDatum(volgende.datum)}${volgende.uur ? ` om ${volgende.uur}` : ""}`);

  const metStemmen = [...eigen].reverse().find((m) => m.status === "gespeeld" && punten.some((p) => p.match_key === m.match_key));
  if (metStemmen) {
    const winnaars = juniorVanDeMatch(punten, metStemmen.match_key).map((w) => namen.get(w.member_id)).filter(Boolean);
    if (winnaars.length) items.push(`Junior van de match tegen ${tegenstander(metStemmen)}: ${winnaars.join(" en ")}`);
  }

  const pot = potTotaal(boeteTotalen(boeteItems(boetes, stats, eigen)));
  if (pot.cent > 0 || pot.bakBier > 0) items.push(`Boetepot: ${fmtEuro(pot.cent)}${pot.bakBier ? ` en ${pot.bakBier} bak${pot.bakBier === 1 ? "" : "ken"} bier` : ""}`);

  const wasbeurt = volgende ? wasbeurten.find((w) => w.match_key === volgende.match_key) : undefined;
  if (wasbeurt && namen.get(wasbeurt.member_id)) items.push(`Wasmand: ${namen.get(wasbeurt.member_id)}`);

  if (items.length === 0) return null;
  return <Band tekst={items.map((t) => `★ ${t}`).join("    ")} />;
}
