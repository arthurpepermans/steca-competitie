import { ZoomGedrag } from "./components/ZoomGedrag";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./badges.css";

// Heropen dezelfde ploeg binnen de geinstalleerde clubapp.
try {
  if ((!location.hash || location.hash === '#/' || location.hash === '#') && localStorage.getItem('steca-ploeg') === 'vrouwen') location.hash = '/vrouwen';
} catch { /* Opslag van deze voorkeur is optioneel. */ }

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ZoomGedrag />
    <App />
  </StrictMode>,
);
