import {lichtkrantPositie} from "../lib/lichtkrantPositie";
import { useEffect, useRef, useState } from "react";
import { haalBoetes, haalLedenBasis, haalLichtkrantBerichten, haalMatches, haalStats, haalStemPunten, haalWasbeurten } from "../lib/api";
import { LICHTKRANT_HERLADEN } from "./LichtkrantBeheer";
import { useAuth } from "../lib/auth";
import { boeteItems, boeteTotalen, fmtEuro, potTotaal } from "../lib/boetes";
import { fmtDatum, isEigen, isThuis, laatsteUitslag, sorteerOpDatum, tegenstander, volgendeMatch } from "../lib/datum";
import { juniorVanDeMatch } from "../lib/stemmen";
import { useAsync } from "../lib/useAsync";

/** Beweging per frame in plaats van een CSS-animatie: iOS Safari tekent bij een CSS-animatie de tekst
 *  van een brede band soms pas als ze al in beeld staat. Hier verschuiven we een handvol kleine kopieën
 *  van de tekst zelf, elk frame, zodat de band doorlopend gevuld is zonder lege stukken. */
const KOPIEEN = 6;
const TUSSENRUIMTE = 56;

function useLichtkrant(tekst: string, wijn = false) {
  const band = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const b = band.current;
    if (!b) return;
    const kopieen = Array.from(b.querySelectorAll<HTMLSpanElement>("span"));
    if (kopieen.length === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      kopieen.forEach((k, i) => { k.style.transform = "none"; k.style.visibility = i === 0 ? "visible" : "hidden"; });
      return;
    }
    const SNELHEID = 0.05; // pixels per milliseconde
    let basis = b.clientWidth * 0.3; // de eerste kopie start een eind in beeld, de volgende erachter
    let vorige = performance.now();
    let frame = 0;
    let vast = false;
    let gestopt = false;
    const teken = () => {
      if (gestopt || !b.isConnected) return;
      const breedte = kopieen[0].offsetWidth;
      if (breedte <= 0) return;
      const periode = breedte + (wijn ? 0 : TUSSENRUIMTE);
      const totaal = KOPIEEN * periode;
      kopieen.forEach((k, i) => {
        const x = lichtkrantPositie(basis + i * periode, breedte, totaal);
        if (x === null) return;
        k.style.transform = `translate3d(${x}px,0,0)`;
      });
    };
    teken();
    const stap = (nu: number) => {
      if (gestopt) return;
      const dt = Math.min(64, nu - vorige);
      vorige = nu;
      if (!vast && !document.hidden) {
        basis -= dt * SNELHEID;
        teken();
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
      gestopt = true;
      cancelAnimationFrame(frame);
      b.removeEventListener("pointerdown", houdVast);
      b.removeEventListener("pointerup", laatLos);
      b.removeEventListener("pointercancel", laatLos);
      b.removeEventListener("pointerleave", laatLos);
    };
  }, [tekst, wijn]);
  return band;
}

function Wijnpictogram() {
  return <svg viewBox="0 0 59 46" width="32" height="25" aria-hidden="true" className="lichtkrant-fles">
    <ellipse cx="29" cy="43" rx="27" ry="2" fill="currentColor" opacity=".12"/>
    {/* Het achterste glas staat hoger en bevat minder wijn. */}
    <g transform="translate(39 -4)" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9h10l2 11c1 6-2 10-7 10S0 26 1 20Z" fill="var(--accent)"/>
      <path d="M2 24h12c-1 4-3 6-6 6s-5-2-6-6" fill="currentColor" stroke="none"/>
      <path d="M8 30v8m-5 0h10" fill="none"/><path d="M4 13 3 20" stroke="white" opacity=".65"/>
    </g>
    <g transform="translate(3 2)">
      <path d="M6 2h4v12c0 3 3 4 3 7v16q0 2-2 2H5q-2 0-2-2V21c0-3 3-4 3-7Z" fill="currentColor"/>
      <path d="M6 1h4v4H6zM4 25h8v9H4z" fill="#f5b5d1"/>
      <path d="M6 7v9l-1 4v15" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity=".4"/>
    </g>
    {/* Het voorste glas staat lager en is voller. */}
    <g transform="translate(23 3)" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9h10l2 11c1 6-2 10-7 10S0 26 1 20Z" fill="var(--accent)"/>
      <path d="M1 20h14c1 6-2 10-7 10S0 26 1 20" fill="currentColor" stroke="none"/>
      <path d="M8 30v8m-5 0h10" fill="none"/><path d="M4 13 3 20q-1 4 1 6" fill="none" stroke="white" opacity=".65"/>
    </g>
  </svg>;
}

export function Band({ tekst,wijn=false }: { tekst: string;wijn?:boolean }) {
  const band = useLichtkrant(tekst, wijn);
  return (
    <div className={"lichtkrant"+(wijn?" lichtkrant-wijn":"")} ref={band} role="marquee" aria-label="Clubnieuws">
      {Array.from({ length: KOPIEEN }, (_, i) => <span key={i} aria-hidden={i > 0 || undefined}>{wijn?tekst.split(" / ").map((t,j)=><i key={j} className="lichtkrant-item"><Wijnpictogram/>{t}</i>):tekst}</span>)}
    </div>
  );
}

/** Lichtkrant onder de kop: laatste uitslag, volgende match, Junior van de match, boetepot en wasmand. */
export function Lichtkrant() {
  const { lid } = useAuth();
  const [versie, setVersie] = useState(0);
  useEffect(() => {
    const herlaad = () => setVersie((v) => v + 1);
    window.addEventListener(LICHTKRANT_HERLADEN, herlaad);
    return () => window.removeEventListener(LICHTKRANT_HERLADEN, herlaad);
  }, []);
  const data = useAsync(async () => {
    if (!lid) return null;
    const [matches, punten, boetes, leden, stats, wasbeurten, berichten] = await Promise.all([
      haalMatches(), haalStemPunten(), haalBoetes().catch(() => []), haalLedenBasis(), haalStats(), haalWasbeurten().catch(() => []), haalLichtkrantBerichten().catch(() => []),
    ]);
    return { matches, punten, boetes, leden, stats, wasbeurten, berichten };
  }, [lid?.id, versie]);

  if (!lid || data.laden || data.fout || !data.data) return null;
  const { matches, punten, boetes, leden, stats, wasbeurten, berichten } = data.data;
  const namen = new Map(leden.map((m) => [m.id, m.naam]));
  const eigen = sorteerOpDatum(matches.filter(isEigen));
  // eigen boodschappen van de admins eerst, daarna de automatische berichten
  const items: string[] = berichten.filter((b) => b.actief).map((b) => b.tekst.trim()).filter(Boolean);

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
