import { useEffect, useState } from "react";
import { rechten, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

export function DriveBeheer() {
  const { lid } = useAuth();
  const admin = rechten(lid).isAdmin;
  const [status, setStatus] = useState<{ connected: boolean; connection: { email: string; folder_id: string } | null } | null>(null);
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState(false);
  useEffect(() => {
    if (!admin) return;
    let actief = true;
    supabase.functions.invoke("drive-connect", { body: { action: "status" } }).then(({ data, error }) => {
      if (!actief) return;
      if (error || data?.error) setFout("De Drive-status kon niet geladen worden. Probeer later opnieuw.");
      else setStatus(data);
    });
    return () => { actief = false; };
  }, [admin]);
  if (!admin) return <p>Alleen admins kunnen Google Drive koppelen.</p>;
  async function verbind() {
    setBezig(true); setFout("");
    try {
      const { data, error } = await supabase.functions.invoke("drive-connect", { body: { action: "start" } });
      if (error || data?.error || !data?.url) throw new Error();
      const url = new URL(data.url);
      if (url.origin !== "https://accounts.google.com") throw new Error();
      window.location.assign(url.href);
    } catch { setFout("De koppeling kon niet worden gestart. Probeer opnieuw."); setBezig(false); }
  }
  return <>
    <h2>Google Drive</h2>
    <p>Opslag voor de foto's en video's van onze wedstrijden.</p>
    {fout && <p className="melding fout" role="alert">{fout}</p>}
    {!status && !fout && <p>Status laden…</p>}
    {status && <div className="kaart">
      <h3>{status.connected ? "Drive is gekoppeld" : "Clubaccount koppelen"}</h3>
      <p>{status.connected ? status.connection?.email : "Kies arthur.pepermanss@gmail.com bij Google."}</p>
      <p>We gebruiken een aparte clubmap. De app krijgt alleen toegang tot bestanden die hij zelf aanmaakt.</p>
      {status.connection && <p><a href={`https://drive.google.com/drive/folders/${encodeURIComponent(status.connection.folder_id)}`} target="_blank" rel="noreferrer">Clubmap openen in Google Drive</a></p>}
      <button className="knop" disabled={bezig} onClick={() => void verbind()}>{bezig ? "Google openen…" : status.connected ? "Opnieuw verbinden" : "Google Drive koppelen"}</button>
      <p className="klein zacht">Leden voegen foto's en video's toe via Sfeerbeelden bij een wedstrijd. Ze hoeven zelf geen Google-account te koppelen. Admins kunnen beelden verwijderen.</p>
    </div>}
  </>;
}

