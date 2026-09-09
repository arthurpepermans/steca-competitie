import { useEffect, useState } from "react";
import { NavLink, Link, Outlet, useLocation } from "react-router-dom";
import { House } from "@phosphor-icons/react/dist/csr/House";
import { CalendarDots } from "@phosphor-icons/react/dist/csr/CalendarDots";
import { Trophy } from "@phosphor-icons/react/dist/csr/Trophy";
import { SoccerBall } from "@phosphor-icons/react/dist/csr/SoccerBall";
import { Shield } from "@phosphor-icons/react/dist/csr/Shield";
import { UsersThree } from "@phosphor-icons/react/dist/csr/UsersThree";
import { Moon } from "@phosphor-icons/react/dist/csr/Moon";
import { Sun } from "@phosphor-icons/react/dist/csr/Sun";
import { useAuth } from "../lib/auth";
import { NieuweVersie } from "./NieuweVersie";

const TABS = [
  { to: "/", label: "Home", Icon: House },
  { to: "/kalender", label: "Kalender", Icon: CalendarDots },
  { to: "/klassement", label: "Klassement", Icon: Trophy },
  { to: "/opstelling", label: "Opstelling", Icon: SoccerBall },
  { to: "/ploegen", label: "Ploegen", Icon: Shield },
  { to: "/leden", label: "Leden", Icon: UsersThree },
];

export function Layout() {
  const { lid } = useAuth();
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  const [donker, setDonker] = useState(() => {
    try {
      const opgeslagen = localStorage.getItem("steca-retro-thema");
      if (opgeslagen) return opgeslagen === "dark";
    } catch { /* Optionele voorkeur. */ }
    return false;
  });
  useEffect(() => {
    document.documentElement.dataset.theme = donker ? "dark" : "light";
    try { localStorage.setItem("steca-retro-thema", donker ? "dark" : "light"); } catch { /* Optionele voorkeur. */ }
  }, [donker]);
  return (
    <>
      <a href="#inhoud" className="skip-link" onClick={(event) => { event.preventDefault(); document.getElementById("inhoud")?.focus(); }}>Naar inhoud</a>
      <header className="kop">
        <Link to="/" className="clubmerk">
          <img src={import.meta.env.BASE_URL + "logo-retro.png"} alt="" width="44" height="52" />
          <span>STECA JUNIORS<small>CLUBAPP</small></span>
        </Link>
        <div className="kop-acties">
          <button className="thema-knop" type="button" onClick={() => setDonker(!donker)} aria-label={donker ? "Licht thema" : "Donker thema"}>
            {donker ? <Sun size={21} /> : <Moon size={21} />}
          </button>
          <Link className="profiel-link" to="/profiel" aria-label={"Profiel van " + (lid?.voornaam ?? "lid")}>
            <span className="initialen" aria-hidden="true">{lid?.voornaam?.slice(0, 1) ?? "S"}{lid?.achternaam?.slice(0, 1) ?? "J"}</span>
            <span className="profiel-naam">{lid?.voornaam ?? "Profiel"}</span>
          </Link>
        </div>
      </header>
      <main id="inhoud" className="inhoud" tabIndex={-1}><NieuweVersie /><Outlet /></main>
      <nav className="nav" aria-label="Hoofdnavigatie">
        {TABS.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => isActive ? "actief" : ""}>
            {({ isActive }) => <><Icon size={23} weight={isActive ? "fill" : "regular"} aria-hidden="true" /><span>{label}</span></>}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
export function Laden({ tekst = "Laden…" }: { tekst?: string }) {
  return <div className="laden" role="status"><div className="laad-vlak" /><span>{tekst}</span></div>;
}
export function Fout({ tekst }: { tekst: string | null }) {
  return tekst ? <div className="melding fout" role="alert">{tekst}</div> : null;
}
