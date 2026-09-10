import { useLayoutEffect, useRef } from "react";

// iOS kan bottom: 0 na het sluiten van invoer op een oude schermhoogte tekenen.
// Veranker de balk aan de onderrand van het daadwerkelijk zichtbare scherm.
export function useNavViewport(route: string) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const nav = ref.current;
    const viewport = window.visualViewport;
    if (!nav || !viewport) return;
    let frame = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const meet = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (viewport.scale !== 1 || viewport.height <= 0) return;
        // Tijdens het doorveren boven- of onderaan (iOS) geeft offsetTop tijdelijk een negatieve of te grote
        // waarde; begrens de onderrand tot het scherm zodat de balk niet in het midden blijft hangen.
        const boven = Math.max(0, viewport.offsetTop);
        const onder = Math.min(boven + viewport.height, window.innerHeight);
        nav.style.setProperty("--nav-schermonderkant", `${onder}px`);
        nav.dataset.viewport = "zichtbaar";
      });
    };
    const herstel = () => {
      meet();
      // WebKit werkt de afmetingen soms pas na de toetsenbordanimatie bij.
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      for (const delay of [150, 450]) {
        const timer = setTimeout(() => { timers.delete(timer); meet(); }, delay);
        timers.add(timer);
      }
    };
    viewport.addEventListener("resize", herstel);
    viewport.addEventListener("scroll", meet);
    window.addEventListener("resize", herstel);
    window.addEventListener("pageshow", herstel);
    document.addEventListener("focusout", herstel);
    document.addEventListener("visibilitychange", herstel);
    // na het loslaatmoment van een veerbeweging komt niet altijd een scroll-event van de visual viewport
    window.addEventListener("touchend", herstel, { passive: true });
    window.addEventListener("scrollend", meet);
    herstel();
    return () => {
      cancelAnimationFrame(frame);
      for (const timer of timers) clearTimeout(timer);
      viewport.removeEventListener("resize", herstel);
      viewport.removeEventListener("scroll", meet);
      window.removeEventListener("resize", herstel);
      window.removeEventListener("pageshow", herstel);
      document.removeEventListener("focusout", herstel);
      document.removeEventListener("visibilitychange", herstel);
      window.removeEventListener("touchend", herstel);
      window.removeEventListener("scrollend", meet);
      delete nav.dataset.viewport;
      nav.style.removeProperty("--nav-schermonderkant");
    };
  }, [route]);
  return ref;
}
