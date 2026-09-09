/** Blokkeer knijpgebaren, maar laat scrollen met één vinger ongemoeid. */
export function blokkeerKnijpzoom(doel: EventTarget): () => void {
  const blokkeer = (event: Event) => { if (event.cancelable) event.preventDefault(); };
  const aanraking = (event: Event) => {
    if ((event as TouchEvent).touches.length > 1) blokkeer(event);
  };
  const opties = { passive: false };
  doel.addEventListener("touchmove", aanraking, opties);
  doel.addEventListener("gesturestart", blokkeer, opties);
  doel.addEventListener("gesturechange", blokkeer, opties);
  return () => {
    doel.removeEventListener("touchmove", aanraking);
    doel.removeEventListener("gesturestart", blokkeer);
    doel.removeEventListener("gesturechange", blokkeer);
  };
}
