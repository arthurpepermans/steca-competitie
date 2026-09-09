import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, rechten, useAuth } from "./lib/auth";
import { configOk } from "./lib/supabase";
import { Laden, Layout } from "./components/Layout";
import { Geblokkeerd, Login, NieuwWachtwoord, Registreer, WachtOpGoedkeuring, WachtwoordVergeten } from "./pages/Auth";
import { Home } from "./pages/Home";
import { Kalender } from "./pages/Kalender";
import { Klassement } from "./pages/Klassement";
import { Ploegen, PloegDetail } from "./pages/Ploegen";
import { Opstelling } from "./pages/Opstelling";
import { Leden, LidDetail } from "./pages/Leden";
import { Profiel } from "./pages/Profiel";
import { Supporters } from "./pages/Supporters";
import { DriveBeheer } from "./pages/DriveBeheer";

function Poort() {
  const { klaar, session, lid, fout } = useAuth();
  const locatie = useLocation();
  if (!klaar) return <Laden tekst="Even geduld…" />;
  if (locatie.pathname === "/supporters") return <Supporters />;

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/registreer" element={<Registreer />} />
        <Route path="/wachtwoord-vergeten" element={<WachtwoordVergeten />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }
  if (locatie.pathname === "/nieuw-wachtwoord") return <NieuwWachtwoord />;
  if (fout) return <Geblokkeerd tekst={`Je gegevens konden niet geladen worden: ${fout}`} />;
  if (!lid) return <Geblokkeerd tekst="Er is geen lid gekoppeld aan dit account. Vraag een beheerder om hulp." />;
  if (lid.status === "wacht_op_goedkeuring") return <WachtOpGoedkeuring />;
  if (lid.status === "inactief") return <Geblokkeerd tekst="Dit account is gedeactiveerd. Vraag een beheerder om het opnieuw te activeren." />;

  const r = rechten(lid);
  if (!r.gegevensVolledig && locatie.pathname !== "/profiel") return <Navigate to="/profiel" replace />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/kalender" element={<Kalender />} />
        <Route path="/klassement" element={<Klassement />} />
        <Route path="/ploegen" element={<Ploegen />} />
        <Route path="/ploegen/:id" element={<PloegDetail />} />
        <Route path="/opstelling" element={<Opstelling />} />
        <Route path="/leden" element={<Leden />} />
        <Route path="/leden/:id" element={<LidDetail />} />
        <Route path="/profiel" element={<Profiel />} />
        <Route path="/drive" element={<DriveBeheer />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  if (!configOk) {
    return <div className="auth"><div className="melding fout">De app is niet geconfigureerd: VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY ontbreken.</div></div>;
  }
  return (
    <AuthProvider>
      <HashRouter>
        <Poort />
      </HashRouter>
    </AuthProvider>
  );
}
