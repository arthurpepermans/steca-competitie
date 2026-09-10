import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Home } from "./Home";
import { OpenbareOpstelling } from "../components/OpenbareOpstelling";
import { haalSupportersData } from "../lib/supporters";
import { useAsync } from "../lib/useAsync";
import { isEigen, sorteerOpDatum } from "../lib/datum";
import { EIGEN_PLOEGID } from "../lib/config";
import { Fout, Laden } from "../components/Layout";
import { MapsKnop, MatchKaart } from "../components/MatchKaart";
import { Klassementstabel } from "../components/Klassementstabel";
import { OpenbareStatistieken } from "../components/OpenbareStatistieken";

import { Kantine } from "./Kantine";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

export function Supporters() {
  const {supporter}=useAuth();
  const [kalenderTab,setKalenderTab]=useState("Steca Juniors");
  const info = useAsync(haalSupportersData);
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "Home";
  const setTab = (naam: string) => setParams({ tab: naam });
  const [ranglijst, setRanglijst] = useState("Ploegenklassement");
  const [reeks, setReeks] = useState<string | null>(null);
  const data = info.data;
  const reeksen = [...new Set(data?.klassement.map((r) => r.reeks) ?? [])].sort();
  const gekozen = reeks ?? data?.ploegen.find((p) => p.ploegid === EIGEN_PLOEGID)?.reeks ?? reeksen[0];
  const matches = sorteerOpDatum((data?.matches ?? []).filter(isEigen));
  const komende = matches.filter((m) => m.status === "gepland");
  const gespeeld = matches.filter((m) => m.status === "gespeeld").reverse();
  return <>
    <header className="kop">
      <Link to="/supporters" className="clubmerk"><img src={import.meta.env.BASE_URL + "logo-retro.png"} alt="" width="44" height="52" /><span>STECA JUNIORS<small>SUPPORTERS</small></span></Link>
      {supporter ? <button className="knop licht klein" onClick={()=>supabase.auth.signOut()}>Uitloggen</button> : <Link to="/login" className="knop licht klein">Inloggen</Link>}
    </header>
    <main className="inhoud supporters-inhoud">
      <h1>Volg Steca Juniors</h1>
      <p className="zacht">Matchdag, opstellingen, uitslagen en de weg naar het terrein.</p>
      <nav className="supporters-tabs" aria-label="Supportersnavigatie">
        {["Home", "Kalender", "Klassement", "Opstelling", "Kantine"].map((naam) => <button type="button" key={naam} className={`knop ${tab === naam ? "" : "licht"}`} aria-pressed={tab === naam} onClick={() => setTab(naam)}>{naam}</button>)}
      </nav>
      {info.laden && <Laden />}
      <Fout tekst={info.fout} />
      {info.fout && <button className="knop" onClick={() => window.location.reload()}>Opnieuw proberen</button>}
      {data && tab === "Home" && <Home openbaar={data} />}
      {data && tab === "Opstelling" && <OpenbareOpstelling matches={matches} />}
      {data && tab === "Kantine" && <Kantine openbaar />}
      {data && tab === "Kalender" && <div className="tabs">{["Steca Juniors","Hele reeks","Ploegen"].map(n=><button key={n} className={kalenderTab===n?'actief':''} onClick={()=>setKalenderTab(n)}>{n}</button>)}</div>}
      {data && tab === "Kalender" && kalenderTab === "Hele reeks" && sorteerOpDatum(data.matches.filter(m=>m.reeks===gekozen)).map(m=><MatchKaart key={m.match_key} match={m}/>)}
      {data && tab === "Kalender" && kalenderTab === "Steca Juniors" && <>
        <h2>Volgende wedstrijden</h2>
        {!komende.length && <p>Er zijn nog geen wedstrijden gepland.</p>}
        {komende.map((m) => <MatchKaart key={m.match_key} match={m} />)}
        <h2>Uitslagen</h2>
        {!gespeeld.length && <p>Er zijn nog geen uitslagen.</p>}
        {gespeeld.map((m) => <MatchKaart key={m.match_key} match={m} />)}
      </>}
      {data && tab === "Klassement" && <>
        <h2>Klassement</h2>
        <div className="supporters-tabs" aria-label="Klassementonderdelen">{["Ploegenklassement", "Statistieken", "Boetepot"].map((naam) => <button type="button" key={naam} className={`knop ${ranglijst === naam ? "" : "licht"}`} aria-pressed={ranglijst === naam} onClick={() => setRanglijst(naam)}>{naam}</button>)}</div>
        {ranglijst === "Ploegenklassement" && <>
        {reeksen.length > 1 && <div className="veld"><label htmlFor="supporters-reeks">Reeks</label><select id="supporters-reeks" value={gekozen ?? ""} onChange={(e) => setReeks(e.target.value)}>{reeksen.map((r) => <option key={r}>{r}</option>)}</select></div>}
        {data.klassement.some((r) => r.reeks === gekozen) ? <Klassementstabel rijen={data.klassement.filter((r) => r.reeks === gekozen)} /> : <p>Het klassement is nog niet beschikbaar.</p>}
        </>}
        {ranglijst !== "Ploegenklassement" && <OpenbareStatistieken matches={matches} boetepot={ranglijst === "Boetepot"} />}
      </>}
      {data && tab === "Kalender" && kalenderTab === "Ploegen" && <>
        <h2>Ploegen en terreinen</h2>
        {!data.ploegen.length && <p>Er is nog geen ploeginfo.</p>}
        {data.ploegen.map((p) => <article className="kaart" key={p.ploegid}><h3>{p.naam}</h3><p className="zacht">{p.reeks}</p><p>{p.terrein ?? "Terrein wordt nog bekendgemaakt."}</p>{p.kleuren && <p>Clubkleuren: {p.kleuren}</p>}<MapsKnop terrein={p.terrein} /></article>)}
      </>}
    </main>
  </>;
}
