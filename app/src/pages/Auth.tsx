import { InstallatieHulp } from "../components/InstallatieHulp";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { FUNCTIES, FUNCTIE_LABEL, type Functie } from "../lib/config";
import { useAuth } from "../lib/auth";

function Kader({ titel, children }: { titel: string; children: React.ReactNode }) {
  return (
    <div className="auth">
      <h1>Steca Juniors Clubapp</h1>
      <div className="kaart">
        <h2>{titel}</h2>
        {children}
      </div>
      <InstallatieHulp />
    </div>
  );
}

export function Login() {
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBezig(true);
    setFout(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: wachtwoord });
    if (error) setFout(error.message === "Invalid login credentials" ? "E-mailadres of wachtwoord klopt niet." : error.message);
    setBezig(false);
  }

  return (
    <Kader titel="Inloggen">
      <form onSubmit={submit}>
        {fout && <div className="melding fout">{fout}</div>}
        <div className="veld"><label>E-mailadres</label><input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="veld"><label>Wachtwoord</label><input type="password" autoComplete="current-password" value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} required /></div>
        <button className="knop breed" disabled={bezig}>Inloggen</button>
      </form>
      <p style={{ marginTop: 12 }} className="midden">
        <Link to="/registreer">Account aanmaken</Link> · <Link to="/wachtwoord-vergeten">Wachtwoord vergeten</Link>
      </p>
    </Kader>
  );
}

export function Registreer() {
  const [voornaam, setVoornaam] = useState("");
  const [achternaam, setAchternaam] = useState("");
  const [email, setEmail] = useState("");
  const [functie, setFunctie] = useState<Functie>("speler");
  const [wachtwoord, setWachtwoord] = useState("");
  const [herhaal, setHerhaal] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [klaarZonderSessie, setKlaarZonderSessie] = useState(false);
  const [bezig, setBezig] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (wachtwoord.length < 8) return setFout("Kies een wachtwoord van minstens 8 tekens.");
    if (wachtwoord !== herhaal) return setFout("De twee wachtwoorden zijn niet gelijk.");
    setBezig(true);
    setFout(null);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: wachtwoord,
      options: { data: { voornaam: voornaam.trim(), achternaam: achternaam.trim(), naam: `${voornaam.trim()} ${achternaam.trim()}`.trim(), functie } },
    });
    setBezig(false);
    if (error) return setFout(error.message);
    if (!data.session) setKlaarZonderSessie(true); // e-mailbevestiging staat nog aan in Supabase
  }

  if (klaarZonderSessie) {
    return (
      <Kader titel="Bijna klaar">
        <p>Je account is aangemaakt. Controleer je mailbox en klik op de bevestigingslink, log daarna in.</p>
        <Link className="knop breed" to="/login">Naar inloggen</Link>
      </Kader>
    );
  }

  return (
    <Kader titel="Account aanmaken">
      <form onSubmit={submit}>
        {fout && <div className="melding fout">{fout}</div>}
        <div className="veld"><label>Voornaam</label><input value={voornaam} onChange={(e) => setVoornaam(e.target.value)} required autoComplete="given-name" /></div>
        <div className="veld"><label>Achternaam</label><input value={achternaam} onChange={(e) => setAchternaam(e.target.value)} required autoComplete="family-name" /></div>
        <div className="veld"><label>E-mailadres</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></div>
        <div className="veld">
          <label>Ik ben</label>
          <select value={functie} onChange={(e) => setFunctie(e.target.value as Functie)}>
            {FUNCTIES.map((f) => <option key={f} value={f}>{FUNCTIE_LABEL[f]}</option>)}
          </select>
        </div>
        <div className="veld"><label>Wachtwoord (minstens 8 tekens)</label><input type="password" value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} required autoComplete="new-password" /></div>
        <div className="veld"><label>Wachtwoord herhalen</label><input type="password" value={herhaal} onChange={(e) => setHerhaal(e.target.value)} required autoComplete="new-password" /></div>
        <button className="knop breed" disabled={bezig}>Account aanmaken</button>
      </form>
      <p className="zacht" style={{ marginTop: 10 }}>Na het aanmaken moet een beheerder je account goedkeuren voor je alles kunt zien.</p>
      <p className="midden" style={{ marginTop: 8 }}><Link to="/login">Ik heb al een account</Link></p>
    </Kader>
  );
}

export function WachtwoordVergeten() {
  const [email, setEmail] = useState("");
  const [verstuurd, setVerstuurd] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    if (error) setFout(error.message);
    else setVerstuurd(true);
  }

  return (
    <Kader titel="Wachtwoord vergeten">
      {verstuurd ? (
        <p>Als dit e-mailadres bekend is, krijg je een e-mail met een link om een nieuw wachtwoord te kiezen.</p>
      ) : (
        <form onSubmit={submit}>
          {fout && <div className="melding fout">{fout}</div>}
          <div className="veld"><label>E-mailadres</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <button className="knop breed">Verstuur link</button>
        </form>
      )}
      <p className="midden" style={{ marginTop: 8 }}><Link to="/login">Terug naar inloggen</Link></p>
    </Kader>
  );
}

export function NieuwWachtwoord() {
  const [wachtwoord, setWachtwoord] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (wachtwoord.length < 8) return setFout("Minstens 8 tekens.");
    const { error } = await supabase.auth.updateUser({ password: wachtwoord });
    if (error) return setFout(error.message);
    navigate("/");
  }

  return (
    <Kader titel="Nieuw wachtwoord kiezen">
      <form onSubmit={submit}>
        {fout && <div className="melding fout">{fout}</div>}
        <div className="veld"><label>Nieuw wachtwoord</label><input type="password" value={wachtwoord} onChange={(e) => setWachtwoord(e.target.value)} required autoComplete="new-password" /></div>
        <button className="knop breed">Opslaan</button>
      </form>
    </Kader>
  );
}

export function WachtOpGoedkeuring() {
  const { lid, herlaad } = useAuth();
  return (
    <Kader titel="Wacht op goedkeuring">
      <p>Dag {lid?.naam ?? ""}, je account is aangemaakt. Een beheerder moet het nog goedkeuren. Daarna kun je alles zien.</p>
      <div className="knoppen">
        <button type="button" className="knop" onClick={() => herlaad()}>Opnieuw controleren</button>
        <button type="button" className="knop licht" onClick={() => supabase.auth.signOut()}>Uitloggen</button>
      </div>
    </Kader>
  );
}

export function Geblokkeerd({ tekst }: { tekst: string }) {
  return (
    <Kader titel="Geen toegang">
      <p>{tekst}</p>
      <button type="button" className="knop licht" onClick={() => supabase.auth.signOut()}>Uitloggen</button>
    </Kader>
  );
}
