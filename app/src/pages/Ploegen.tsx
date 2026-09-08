import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { haalKlassement, haalMatches, haalTeams } from "../lib/api";
import { EIGEN_PLOEGID } from "../lib/config";
import { sorteerOpDatum } from "../lib/datum";
import { useAsync } from "../lib/useAsync";
import { Klassementstabel } from "../components/Klassementstabel";
import { Fout, Laden } from "../components/Layout";
import { MapsKnop, MatchKaart } from "../components/MatchKaart";

export function Ploegen() {
  const [reeks, setReeks] = useState<string | null>(null);
  const teams = useAsync(haalTeams);
  if (teams.laden) return <Laden />;
  const alle = teams.data ?? [];
  const eigenReeks = alle.find((t) => t.ploegid === EIGEN_PLOEGID)?.reeks ?? "";
  const reeksen = [...new Set(alle.map((t) => t.reeks ?? "").filter(Boolean))].sort();
  const gekozen = reeks ?? eigenReeks;
  return (
    <>
      <Fout tekst={teams.fout} />
      <div className="veld">
        <select value={gekozen} onChange={(e) => setReeks(e.target.value)}>
          {reeksen.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
      <ul className="lijst omrand">
        {alle.filter((t) => t.reeks === gekozen).map((t) => (
          <li key={t.ploegid}>
            <Link to={`/ploegen/${t.ploegid}`} className="rij">
              <span><strong>{t.naam}</strong><br /><span className="zacht klein">{t.terrein ?? "terrein onbekend"}</span></span>
              <span>›</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export function PloegDetail() {
  const { id } = useParams();
  const ploegid = Number(id);
  const teams = useAsync(haalTeams);
  const matches = useAsync(haalMatches);
  const klassement = useAsync(haalKlassement);
  if (teams.laden || matches.laden || klassement.laden) return <Laden />;
  const t = teams.data?.find((x) => x.ploegid === ploegid);
  if (!t) return <div className="melding fout">Ploeg niet gevonden.</div>;
  const eigen = sorteerOpDatum((matches.data ?? []).filter((m) => m.thuis_id === ploegid || m.uit_id === ploegid));
  const laatste = eigen.filter((m) => m.status === "gespeeld").slice(-5).reverse();
  const volgende = eigen.filter((m) => m.status === "gepland").slice(0, 3);
  const stand = (klassement.data ?? []).filter((s) => s.reeks === t.reeks);
  const rij = stand.find((s) => s.ploegid === ploegid);

  return (
    <>
      <Fout tekst={teams.fout ?? matches.fout} />
      <Link to="/ploegen" className="klein">‹ Alle ploegen</Link>
      <h2 style={{ marginTop: 6 }}>{t.naam}</h2>
      <div className="kaart">
        <div className="rij boven">
          <div>
            <div><strong>Terrein</strong><br />{t.terrein ?? "onbekend"}</div>
            {t.wegwijzer && <div className="klein zacht">Wegwijzer: {t.wegwijzer}</div>}
          </div>
          <MapsKnop terrein={t.terrein} />
        </div>
        <p style={{ marginTop: 8 }}><strong>Kleuren</strong><br />{t.kleuren ?? "onbekend"}</p>
        <p><strong>Secretariaat</strong><br />
          {t.secretaris ?? "onbekend"}{t.secretaris_adres ? `, ${t.secretaris_adres}` : ""}<br />
          {t.gsm && <a href={`tel:${t.gsm}`}>{t.gsm}</a>}{t.gsm && t.tel ? " · " : ""}{t.tel && <a href={`tel:${t.tel}`}>{t.tel}</a>}
          {t.email && <><br /><a href={`mailto:${t.email}`}>{t.email}</a></>}
        </p>
        <p><strong>Verantwoordelijke</strong><br />{t.verantwoordelijke ?? "onbekend"}{t.verantwoordelijke_tel && <> · <a href={`tel:${t.verantwoordelijke_tel}`}>{t.verantwoordelijke_tel}</a></>}</p>
        <p className="klein zacht">Reeks: {t.reeks} · clubnummer {t.clubnummer}</p>
      </div>

      <h3>Stand</h3>
      {rij ? <Klassementstabel rijen={stand} compact /> : <p className="zacht">Geen klassement.</p>}

      <h3>Laatste uitslagen</h3>
      {laatste.length === 0 && <p className="zacht">Nog geen gespeelde matchen.</p>}
      {laatste.map((m) => <MatchKaart key={m.match_key} match={m} />)}

      <h3>Volgende matchen</h3>
      {volgende.map((m) => <MatchKaart key={m.match_key} match={m} />)}
    </>
  );
}
