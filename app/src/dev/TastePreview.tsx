import { ZoomGedrag } from "../components/ZoomGedrag";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import { AuthContext } from "../lib/auth";
import { Layout } from "../components/Layout";
import { Home } from "../pages/Home";
import { Kalender } from "../pages/Kalender";
import { Klassement } from "../pages/Klassement";
import { Opstelling } from "../pages/Opstelling";
import { Ploegen, PloegDetail } from "../pages/Ploegen";
import { Leden, LidDetail } from "../pages/Leden";
import { Profiel } from "../pages/Profiel";
import { voorbeeldLid } from "./taste-data";
import "../styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ZoomGedrag />
    <AuthContext.Provider value={{ klaar: true, lid: voorbeeldLid, session: null, fout: null, herlaad: async () => {} }}>
      <div className="voorbeeld-balk">Ontwerpvoorbeeld met testgegevens. Aanwezigheid en opstelling worden tijdelijk bewaard.</div>
      <HashRouter><Routes><Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/kalender" element={<Kalender />} />
        <Route path="/klassement" element={<Klassement />} />
        <Route path="/opstelling" element={<Opstelling />} />
        <Route path="/ploegen" element={<Ploegen />} />
        <Route path="/ploegen/:id" element={<PloegDetail />} />
        <Route path="/leden" element={<Leden />} />
        <Route path="/leden/:id" element={<LidDetail />} />
        <Route path="/profiel" element={<Profiel />} />
      </Route></Routes></HashRouter>
    </AuthContext.Provider>
  </StrictMode>
);
