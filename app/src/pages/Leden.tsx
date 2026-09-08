import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { adminVerwijderLid, adminZetWachtwoord, haalLeden, haalLedenBasis, haalLid, haalLidBasis, wijzigLid } from "../lib/api";
import { rechten, useAuth } from "../lib/auth";
import { FUNCTIES, FUNCTIE_LABEL, type Functie } from "../lib/config";
import { fmtDatum } from "../lib/datum";
import { foutTekst, useAsync } from "../lib/useAsync";
import { Fout, Laden } from "../components/Layout";
import type { LidStatus, Member, MemberBasis } from "../lib/types";

const STATUS_LABEL: Record<LidStatus, string> = { wacht_op_goedkeuring: "wacht op goedkeuring", actief: "actief", inactief: "inactief" };

export function Leden() {
  const { lid } = useAuth();
  const r = rechten(lid);
  const [zoek, setZoek] = useState("");
  const [functie, setFunctie] = useState<string>("");
  const leden = useAsync<MemberBasis[]>(() => (r.zietGegevens ? haalLeden() : haalLedenBasis()), [r.zietGegevens]);
  if (leden.laden) return <Laden />;
  const alle = leden.data ?? [];
  const wachtend = alle.filter((m) => m.status === "wacht_op_goedkeuring");
  const lijst = alle
    .filter((m) => m.status !== "wacht_op_goedkeuring" || r.isAdmin)
    .filter((m) => !functie || m.functie === functie)
    .filter((m) => m.naam.toLowerCase().includes(zoek.toLowerCase()));

  return (
    <>
      <Fout tekst={leden.fout} />
      {r.isAdmin && wachtend.length > 0 && (
        <div className="melding info">{wachtend.length} account(s) wachten op goedkeuring: {wachtend.map((m) => m.naam).join(", ")}.</div>
      )}
      <div className="rij" style={{ gap: 8, marginBottom: 10 }}>
        <input placeholder="Zoeken…" value={zoek} onChange={(e) => setZoek(e.target.value)} style={{ flex: 1, padding: 9, border: "1px solid var(--rand)", borderRadius: 8 }} />
        <select value={functie} onChange={(e) => setFunctie(e.target.value)} style={{ padding: 9, border: "1px solid var(--rand)", borderRadius: 8 }}>
          <option value="">Alle functies</option>
          {FUNCTIES.map((f) => <option key={f} value={f}>{FUNCTIE_LABEL[f]}</option>)}
        </select>
      </div>
      <ul className="lijst omrand">
        {lijst.map((m) => (
          <li key={m.id}>
            <Link to={`/leden/${m.id}`} className="rij">
              <span>
                <strong>{m.naam}</strong>{m.is_hoofdadmin ? " ★" : m.is_admin ? " ☆" : ""}
                <br />
                <span className="zacht klein">{FUNCTIE_LABEL[m.functie]}{m.status !== "actief" ? ` · ${STATUS_LABEL[m.status]}` : ""}</span>
              </span>
              <span>›</span>
            </Link>
          </li>
        ))}
        {lijst.length === 0 && <li className="zacht">Geen leden gevonden.</li>}
      </ul>
      <p className="klein zacht">★ hoofdadmin · ☆ admin</p>
    </>
  );
}

export function LidDetail() {
  const { id } = useParams();
  const { lid, herlaad } = useAuth();
  const r = rechten(lid);
  const navigate = useNavigate();
  const data = useAsync<Member | MemberBasis | null>(() => (r.zietGegevens ? haalLid(id!) : haalLidBasis(id!)), [id, r.zietGegevens]);
  const [fout, setFout] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  if (data.laden) return <Laden />;
  const m = data.data;
  if (!m) return <div className="melding fout">Lid niet gevonden of geen toegang.</div>;
  const vol = "email" in m ? (m as Member) : null;
  const magBewerken = r.isAdmin && (!m.is_hoofdadmin || r.isHoofdadmin);

  async function doe(actie: () => Promise<void>, melding: string) {
    setFout(null);
    setOk(null);
    try {
      await actie();
      await data.herlaad();
      if (m && lid && m.id === lid.id) await herlaad();
      setOk(melding);
    } catch (e) {
      setFout(foutTekst(e));
    }
  }

  return (
    <>
      <Link to="/leden" className="klein">‹ Alle leden</Link>
      <h2 style={{ marginTop: 6 }}>{m.naam}{m.is_hoofdadmin ? " ★" : m.is_admin ? " ☆" : ""}</h2>
      <Fout tekst={data.fout ?? fout} />
      {ok && <div className="melding ok">{ok}</div>}
      <div className="kaart">
        <p><strong>Functie</strong><br />{FUNCTIE_LABEL[m.functie]}{m.is_admin ? " · admin" : ""}</p>
        <p><strong>Status</strong><br />{STATUS_LABEL[m.status]}</p>
        {vol && (
          <>
            <p><strong>Telefoon</strong><br />{vol.telefoon ? <a href={`tel:${vol.telefoon}`}>{vol.telefoon}</a> : <span className="zacht">niet ingevuld</span>}</p>
            <p><strong>E-mail</strong><br /><a href={`mailto:${vol.email}`}>{vol.email}</a></p>
            <p><strong>Geboortedatum</strong><br />{vol.geboortedatum ? fmtDatum(vol.geboortedatum) : <span className="zacht">niet ingevuld</span>}</p>
            <p><strong>Adres</strong><br />{vol.adres ?? <span className="zacht">niet ingevuld</span>}</p>
          </>
        )}
      </div>

      {r.isAdmin && vol && (
        <div className="kaart">
          <h3>Beheer</h3>
          {!magBewerken && <p className="zacht">De hoofdadmin kan alleen door zichzelf gewijzigd worden.</p>}
          {magBewerken && (
            <>
              {vol.status === "wacht_op_goedkeuring" && (
                <div className="knoppen" style={{ marginBottom: 10 }}>
                  <button type="button" className="knop" onClick={() => doe(() => wijzigLid(vol.id, { status: "actief" }), "Account goedgekeurd.")}>Goedkeuren</button>
                  <button type="button" className="knop gevaar" onClick={() => { if (confirm(`Registratie van ${vol.naam} afwijzen en verwijderen?`)) doe(async () => { await adminVerwijderLid(vol.id); navigate("/leden"); }, ""); }}>Afwijzen</button>
                </div>
              )}
              <LidFormulier lid={vol} onOpslaan={(velden) => doe(() => wijzigLid(vol.id, velden), "Gegevens opgeslagen.")} />
              <div className="knoppen" style={{ marginTop: 10 }}>
                {vol.status === "actief" && <button type="button" className="knop licht" onClick={() => doe(() => wijzigLid(vol.id, { status: "inactief" }), "Lid gedeactiveerd.")}>Deactiveren</button>}
                {vol.status === "inactief" && <button type="button" className="knop licht" onClick={() => doe(() => wijzigLid(vol.id, { status: "actief" }), "Lid opnieuw actief.")}>Opnieuw activeren</button>}
                {!vol.is_hoofdadmin && (
                  <button type="button" className="knop licht" onClick={() => doe(() => wijzigLid(vol.id, { is_admin: !vol.is_admin }), vol.is_admin ? "Adminrechten afgenomen." : "Lid is nu admin.")}>
                    {vol.is_admin ? "Admin afnemen" : "Admin maken"}
                  </button>
                )}
                {!vol.is_hoofdadmin && vol.user_id && (
                  <button type="button" className="knop licht" onClick={() => {
                    const w = prompt(`Nieuw wachtwoord voor ${vol.naam} (minstens 8 tekens):`);
                    if (w) doe(() => adminZetWachtwoord(vol.id, w), "Wachtwoord ingesteld. Dit is gelogd.");
                  }}>Wachtwoord instellen</button>
                )}
                {!vol.is_hoofdadmin && vol.id !== lid?.id && (
                  <button type="button" className="knop gevaar" onClick={() => { if (confirm(`${vol.naam} en zijn account definitief verwijderen?`)) doe(async () => { await adminVerwijderLid(vol.id); navigate("/leden"); }, ""); }}>Verwijderen</button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

export function LidFormulier({ lid, onOpslaan, eigen = false }: { lid: Member; onOpslaan: (velden: Partial<Member>) => void; eigen?: boolean }) {
  const [naam, setNaam] = useState(lid.naam);
  const [functie, setFunctie] = useState<Functie>(lid.functie);
  const [telefoon, setTelefoon] = useState(lid.telefoon ?? "");
  const [geboortedatum, setGeboortedatum] = useState(lid.geboortedatum ?? "");
  const [adres, setAdres] = useState(lid.adres ?? "");
  function submit(e: FormEvent) {
    e.preventDefault();
    const velden: Partial<Member> = { naam: naam.trim(), telefoon: telefoon.trim() || null, geboortedatum: geboortedatum || null, adres: adres.trim() || null };
    if (!eigen) velden.functie = functie;
    onOpslaan(velden);
  }
  return (
    <form onSubmit={submit}>
      <div className="veld"><label>Naam</label><input value={naam} onChange={(e) => setNaam(e.target.value)} required /></div>
      {!eigen && (
        <div className="veld">
          <label>Functie</label>
          <select value={functie} onChange={(e) => setFunctie(e.target.value as Functie)}>
            {FUNCTIES.map((f) => <option key={f} value={f}>{FUNCTIE_LABEL[f]}</option>)}
          </select>
        </div>
      )}
      <div className="veld"><label>Telefoon</label><input type="tel" value={telefoon} onChange={(e) => setTelefoon(e.target.value)} /></div>
      <div className="veld"><label>Geboortedatum</label><input type="date" value={geboortedatum} onChange={(e) => setGeboortedatum(e.target.value)} /></div>
      <div className="veld"><label>Adres</label><input value={adres} onChange={(e) => setAdres(e.target.value)} placeholder="Straat nummer, postcode gemeente" /></div>
      <button className="knop">Opslaan</button>
    </form>
  );
}
