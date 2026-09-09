import { useEffect } from "react";
import { blokkeerKnijpzoom } from "../lib/zoom";

export function ZoomGedrag() {
  useEffect(() => blokkeerKnijpzoom(document), []);
  return null;
}
