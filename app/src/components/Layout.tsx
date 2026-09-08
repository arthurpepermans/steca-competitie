import { NavLink, Link, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";

const TABS = [
  { to: "/", label: "Home", icoon: "⌂" },
  { to: "/kalender", label: "Kalender", icoon: "📅" },
  { to: "/klassement", label: "Klassement", icoon: "🏆" },
  { to: "/opstelling", label: "Opstelling", icoon: "⚽" },
  { to: "/ploegen", label: "Ploegen", icoon: "🛡" },
  { to: "/leden", label: "Leden", icoon: "👥" },
];

export function Layout() {
  const { lid } = useAuth();
  return (
    <>
      <header className="kop">
        <h1>Steca Juniors</h1>
        <Link to="/profiel">{lid?.naam.split(" ")[0] ?? "Profiel"} ▸</Link>
      </header>
      <main className="inhoud">
        <Outlet />
      </main>
      <nav className="nav">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === "/"} className={({ isActive }) => (isActive ? "actief" : "")}>
            <span className="icoon">{t.icoon}</span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

export function Laden({ tekst = "Laden…" }: { tekst?: string }) {
  return <div className="laden">{tekst}</div>;
}

export function Fout({ tekst }: { tekst: string | null }) {
  return tekst ? <div className="melding fout">{tekst}</div> : null;
}
