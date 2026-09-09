import { ZoomGedrag } from "./components/ZoomGedrag";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ZoomGedrag />
    <App />
  </StrictMode>,
);
