import { InstallatieHulp } from "../components/InstallatieHulp";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { wijzigLid } from "../lib/api";
import { rechten, useAuth } from "../lib/auth";
import { FUNCTIE_LABEL } from "../lib/config";
import { supabase } from "../lib/supabase";
import { foutTekst } from "../lib/useAsync";
import { LidFormulier } from "./Leden";

export function Profiel() {
  const { lid, herlaad, session } = useAuth();
  const r = rechten(lid);
  const navigate = useNavigate();
  const [fout, setFout] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ww, setWw] = useState("");
  const onboarding = !r.gegevensVolledig;

  if (!lid) return null;

  async function opslaan(velden: Parameters<typeof wijzigLid>[1]) {
    setFout(null);
    setOk(null);
    try {
      await wijzigLid(lid!.id, velden);
      await herlaad();
      if (onboarding && velden.telefoon && velden.geboortedatum && velden.adres) {
        navigate("/");
        return;
      }
      setOk("Gegevens opgeslagen.");
    } catch (e) {
      setFout(foutTekst(e));
    }
  }

  async function wachtwoord(e: FormEvent) {
    e.preventDefault();
    if (ww.length < 8) return setFout("Wachtwoord moet minstens 8 tekens hebben.");
    const { error } = await supabase.auth.updateUser({ password: ww });
    if (error) return setFout(error.message);
    setWw("");
    setOk("Wachtwoord gewijzigd.");
  }

  return (
    <>
      <h2>{onboarding ? "Welkom, vul je gegevens aan" : "Mijn profiel"}</h2>
      {onboarding && <div className="melding info">Telefoonnummer, geboortedatum en adres zijn verplicht voor spelers en staf. Na het opslaan kom je in de app.</div>}
      {fout && <div className="melding fout">{fout}</div>}
      {ok && <div className="melding ok">{ok}</div>}
      <InstallatieHulp />
      <div className="kaart">
        <p className="zacht">{FUNCTIE_LABEL[lid.functie]}{lid.is_hoofdadmin ? " · hoofdadmin" : lid.is_admin ? " · admin" : ""} · {session?.user.email}</p>
        <LidFormulier lid={lid} eigen onOpslaan={opslaan} />
      </div>
      {!onboarding && (
        <>
          <div className="kaart">
            <h3>Wachtwoord wijzigen</h3>
            <form onSubmit={wachtwoord}>
              <div className="veld"><label>Nieuw wachtwoord (minstens 8 tekens)</label><input type="password" value={ww} onChange={(e) => setWw(e.target.value)} autoComplete="new-password" required /></div>
              <button className="knop licht">Wachtwoord wijzigen</button>
            </form>
          </div>
          <div className="kaart">

            <button type="button" className="knop licht" onClick={() => supabase.auth.signOut()}>Uitloggen</button>
          </div>
        </>
      )}
    </>
  );
}
