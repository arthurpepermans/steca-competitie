import { useState, type FormEvent } from "react";
import { wijzigLid } from "../lib/api";
import { rechten, useAuth } from "../lib/auth";
import { FUNCTIE_LABEL } from "../lib/config";
import { supabase } from "../lib/supabase";
import { foutTekst } from "../lib/useAsync";
import { LidFormulier } from "./Leden";

export function Profiel() {
  const { lid, herlaad, session } = useAuth();
  const r = rechten(lid);
  const [fout, setFout] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [ww, setWw] = useState("");
  if (!lid) return null;

  async function opslaan(velden: Parameters<typeof wijzigLid>[1]) {
    setFout(null);
    setOk(null);
    try {
      await wijzigLid(lid!.id, velden);
      await herlaad();
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
      <h2>Mijn profiel</h2>
      {!r.gegevensVolledig && <div className="melding waarschuwing">Vul je telefoonnummer, geboortedatum en adres in. Dat is verplicht voor spelers en staf.</div>}
      {fout && <div className="melding fout">{fout}</div>}
      {ok && <div className="melding ok">{ok}</div>}
      <div className="kaart">
        <p className="zacht">{FUNCTIE_LABEL[lid.functie]}{lid.is_hoofdadmin ? " · hoofdadmin" : lid.is_admin ? " · admin" : ""} · {session?.user.email}</p>
        <LidFormulier lid={lid} eigen onOpslaan={opslaan} />
      </div>
      <div className="kaart">
        <h3>Wachtwoord wijzigen</h3>
        <form onSubmit={wachtwoord}>
          <div className="veld"><label>Nieuw wachtwoord (minstens 8 tekens)</label><input type="password" value={ww} onChange={(e) => setWw(e.target.value)} autoComplete="new-password" required /></div>
          <button className="knop licht">Wachtwoord wijzigen</button>
        </form>
      </div>
      <div className="kaart">
        <p className="klein zacht">Tip: zet deze app op je beginscherm. iPhone: Deel-knop, "Zet op beginscherm". Android: menu, "Toevoegen aan startscherm".</p>
        <button type="button" className="knop gevaar" onClick={() => supabase.auth.signOut()}>Uitloggen</button>
      </div>
    </>
  );
}
