import { Link } from "react-router-dom";
import { ArrowUpRight } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { CalendarBlank } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { MapPin } from "@phosphor-icons/react/dist/csr/MapPin";
import { ArrowRight } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { Trophy } from "@phosphor-icons/react/dist/csr/Trophy";
import { SoccerBall } from "@phosphor-icons/react/dist/csr/SoccerBall";
import { haalAanwezigheden, haalKlassement, haalLedenBasis, haalMatches } from "../lib/api";
import { isSpelerLid, rechten, useAuth } from "../lib/auth";
import { EIGEN_PLOEGID } from "../lib/config";
import { fmtDatum, isEigen, isThuis, laatsteUitslag, resultaat, sorteerOpDatum, tegenstander, volgendeMatch } from "../lib/datum";
import { useAsync } from "../lib/useAsync";
import { Aanwezigheid } from "../components/Aanwezigheid";
import { Fout, Laden } from "../components/Layout";
import { LaatstBijgewerkt } from "../components/LaatstBijgewerkt";
import { MapsKnop } from "../components/MatchKaart";
import { InstallatieHulp } from "../components/InstallatieHulp";
import { Aftelling } from "../components/Aftelling";
import { StandPijl } from "../components/Klassementstabel";
import { standBeweging } from "../lib/stand";
import { haalStandGeschiedenis } from "../lib/api";

export function Home({ openbaar }: { openbaar?: import("../lib/supporters").SupportersData }) {
  const { lid } = useAuth();
  const r = rechten(lid);
  const matches = useAsync(() => openbaar ? Promise.resolve(openbaar.matches) : haalMatches(), [openbaar]);
  const klassement = useAsync(() => openbaar ? Promise.resolve(openbaar.klassement) : haalKlassement(), [openbaar]);
  const leden = useAsync(() => openbaar ? Promise.resolve([]) : haalLedenBasis(), [openbaar]);
  const aanw = useAsync(() => openbaar ? Promise.resolve([]) : haalAanwezigheden(), [openbaar]);
  const geschiedenis = useAsync(() => haalStandGeschiedenis().catch(() => []), []);
  if (matches.laden || klassement.laden || leden.laden) return <Laden />;
  const volgende = volgendeMatch(matches.data ?? []);
  const laatste = laatsteUitslag(matches.data ?? []);
  const eigen = klassement.data?.find((s) => s.ploegid === EIGEN_PLOEGID);
  const beweging = eigen ? standBeweging([eigen], geschiedenis.data ?? []).get(EIGEN_PLOEGID) : undefined;
  const spelers = (leden.data ?? []).filter(isSpelerLid).map((m) => ({ id: m.id, naam: m.naam }));
  const daarna = sorteerOpDatum((matches.data ?? []).filter((m) => isEigen(m) && m.status === "gepland" && m.match_key !== volgende?.match_key && (m.datum ?? "") >= (volgende?.datum ?? "9999"))).slice(0, 2);
  return (
    <div className="home-pagina">
      <Fout tekst={matches.fout ?? klassement.fout ?? leden.fout} />
      <InstallatieHulp open wegklikbaar />
      <div className="matchdag-kop"><h1>Matchdag</h1><span>Seizoen {volgende?.seizoen ?? eigen?.seizoen ?? "2026-2027"}</span></div>
      <div className="home-grid">
        <section className="match-blok" aria-labelledby="volgende-titel">
          <div className="sectie-kop"><h2 id="volgende-titel">01 / Volgende match</h2><Link to={openbaar ? "/supporters?tab=Kalender" : "/kalender"} aria-label="Bekijk de kalender"><ArrowUpRight size={23} /></Link></div>
          {volgende ? <>
            <div className="match-affiche">
              <div className="affiche-meta"><span>WEDSTRIJDTICKET · {volgende.reeks.replace("DERDE AFDELING", "3e afdeling")}</span><span className="locatie-label">{isThuis(volgende) ? "Thuismatch" : "Uitmatch"}</span></div>
              <div className="affiche-ploegen">
                <div className="team-naam"><span className="team-boven">{volgende.thuis}</span><span className="versus">tegen</span><span className="team-onder">{volgende.uit}</span></div>
                <img className="affiche-logo" src={import.meta.env.BASE_URL + "logo-retro.png"} alt="Clublogo Steca Juniors" width="150" height="174" />
              </div>
              <div className="match-moment"><CalendarBlank size={22} /><span>{fmtDatum(volgende.datum)}</span><strong>{volgende.uur ?? "uur volgt"}</strong></div>
              <Aftelling match={volgende} />
              <div className="match-terrein"><MapPin size={20} /><span>{volgende.terrein ?? "Terrein nog niet bekend"}</span><MapsKnop terrein={volgende.terrein} /></div>
            </div>
            {!openbaar && <div className="ticket-scheur" aria-hidden="true" />}
            {!openbaar && <div className="match-aanwezigheid">
              <div className="sectie-kop"><h3>{r.isSpeler ? "Ben je erbij?" : "Wie is erbij?"}</h3>{r.isSpeler && <span className="zacht">Laat je ploeg iets weten.</span>}</div>
              {aanw.laden ? <Laden tekst="Aanwezigheden laden…" /> : <><Fout tekst={aanw.fout} /><Aanwezigheid match={volgende} spelers={spelers} aanwezigheden={aanw.data ?? []} eigenLidId={lid?.id ?? null} isSpeler={r.isSpeler} isStaf={r.isStaf} isAdmin={r.isAdmin} onGewijzigd={aanw.herlaad} /></>}
            </div>}
          </> : <div className="lege-staat"><CalendarBlank size={32} /><h3>Even geen match gepland</h3><p>De volgende match verschijnt hier zodra de kalender is bijgewerkt.</p><Link to={openbaar ? "/supporters?tab=Kalender" : "/kalender"}>Bekijk de kalender <ArrowRight size={16} /></Link></div>}
        </section>
        <aside className="home-zijde">
          <div className="club-embleem"><span>SAMEN UIT. SAMEN THUIS.</span><img src={import.meta.env.BASE_URL + "logo-retro.png"} alt="Steca Juniors" /><span>DE DERDE HELFT</span><strong>BACOTIME.</strong></div>
          <section className="stand-blok">
            <div className="sectie-kop"><h2>02 / De rangschikking</h2><Trophy size={23} /></div>
            {eigen ? <>
              <p className="zacht">{eigen.reeks}</p>
              <div className="stand-cijfer">{eigen.gespeeld > 0 ? <><strong>{eigen.positie}</strong><span>e plaats</span><StandPijl beweging={beweging} /></> : <strong className="seizoen-start">Nieuw seizoen.</strong>}</div>
              <div className="stand-statistieken"><div><strong>{eigen.punten}</strong><span>punten</span></div><div><strong>{eigen.gespeeld}</strong><span>gespeeld</span></div><div><strong>{eigen.doelpunten_voor}</strong><span>goals</span></div></div>
              {eigen.label && <span className="badge waarschuwing">{eigen.label}</span>}
            </> : <p className="zacht">Het klassement is nog niet beschikbaar.</p>}
            <Link className="tekst-link" to={openbaar ? "/supporters?tab=Klassement" : "/klassement"}>Volledig klassement <ArrowUpRight size={19} /></Link>
          </section>
          <section className="resultaat-blok"><div className="sectie-kop"><h2>Laatste uitslag</h2><SoccerBall size={23} /></div>
            {laatste ? <><p className="zacht">{fmtDatum(laatste.datum)}</p><div className="laatste-score"><strong>{laatste.thuis_score} : {laatste.uit_score}</strong><span className={"res " + resultaat(laatste)}>{resultaat(laatste)}</span></div><p>{laatste.thuis} - {laatste.uit}</p></> : <><h3>Nog geen uitslag</h3><p className="zacht">Er zijn nog geen gespeelde wedstrijden.</p></>}
          </section>
        </aside>
        {daarna.length > 0 && <section className="binnenkort"><div className="sectie-kop"><h2>Daarna op de kalender</h2><Link className="tekst-link" to={openbaar ? "/supporters?tab=Kalender" : "/kalender"}>Alle matchen <ArrowRight size={18} /></Link></div>
          <div className="komende-lijst">{daarna.map((m) => <Link className="komende-match" key={m.match_key} to={openbaar ? "/supporters?tab=Kalender" : "/kalender"}><time dateTime={m.datum ?? undefined}><strong>{m.datum ? Number(m.datum.slice(8)) : "?"}</strong><span>{m.datum ? new Date(m.datum + "T12:00:00").toLocaleDateString("nl-BE", { month: "short" }) : "datum volgt"}</span></time><div><h3>{tegenstander(m)}</h3><p>{isThuis(m) ? "Thuis" : "Uit"} <span> / </span> {m.uur ?? "uur volgt"}</p></div><ArrowUpRight size={22} /></Link>)}</div>
        </section>}
      </div>
      {!openbaar && <LaatstBijgewerkt />}
    </div>
  );
}
