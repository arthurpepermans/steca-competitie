import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  adminOntkoppelAccount, adminVerwijderLid, adminZetWachtwoord, haalLeden,
  haalLedenBasis, haalLid, haalLidBasis, voegLidToe, wijzigLid,
} from "../lib/api";
import { rechten, useAuth } from "../lib/auth";
import { FUNCTIES, FUNCTIE_LABEL, type Functie } from "../lib/config";
import { fmtDatum } from "../lib/datum";
import { foutTekst, useAsync } from "../lib/useAsync";
import { Fout, Laden } from "../components/Layout";
import { SpelerStatistieken } from "../components/SpelerStatistieken";
import type { LidStatus, Member, MemberBasis } from "../lib/types";

const STATUS_LABEL: Record<LidStatus, string> = { wacht_op_goedkeuring: "wacht op goedkeuring", actief: "actief", inactief: "inactief" };

export function Leden() {
  const { lid } = useAuth();
  const r = rechten(lid);
  const navigate = useNavigate();
  const [zoek, setZoek] = useState("");
  const [functie, setFunctie] = useState<string>("");
  const [toevoegen, setToevoegen] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const leden = useAsync<Array<Member | MemberBasis>>(() => (r.zietGegevens ? haalLeden() : haalLedenBasis()), [r.zietGegevens]);
  if (leden.laden) return <Laden />;
  const alle = leden.data ?? [];
  const heeftAccount = (m: Member | MemberBasis) => ("heeft_account" in m ? m.heeft_account : m.user_id !== null);
  const wachtend = alle.filter((m) => m.status === "wacht_op_goedkeuring");
  const lijst = alle
    .filter((m) => m.status !== "wacht_op_goedkeuring" || r.isAdmin)
    .filter((m) => !functie || m.functie === functie)
    .filter((m) => m.naam.toLowerCase().includes(zoek.toLowerCase()));

  async function nieuwLid(velden: Partial<Member>) {
    setFout(null);
    try {
      const m = await voegLidToe(velden);
      navigate(`/leden/${m.id}`);
    } catch (e) {
      setFout(foutTekst(e));
    }
  }

  return (
    <>
      <Fout tekst={leden.fout ?? fout} />
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
      {r.isAdmin && (
        <div style={{ marginBottom: 10 }}>
          <button type="button" className="knop licht klein" onClick={() => setToevoegen(!toevoegen)}>{toevoegen ? "Sluiten" : "+ Lid toevoegen zonder account"}</button>
          {toevoegen && (
            <div className="kaart" style={{ marginTop: 8 }}>
              <NieuwLidFormulier onOpslaan={nieuwLid} />
            </div>
          )}
        </div>
      )}
      <ul className="lijst omrand">
        {lijst.map((m) => (
          <li key={m.id}>
            <Link to={`/leden/${m.id}`} className="rij">
              <span>
                <strong>{m.naam}</strong>{m.is_hoofdadmin ? " ★" : m.is_admin ? " ☆" : ""}
                <br />
                <span className="zacht klein">
                  {FUNCTIE_LABEL[m.functie]}{m.status !== "actief" ? ` · ${STATUS_LABEL[m.status]}` : ""}{!heeftAccount(m) ? " · geen account" : ""}
                </span>
              </span>
              <span>›</span>
            </Link>
          </li>
        ))}
        {lijst.length === 0 && <li className="zacht">Geen leden gevonden.</li>}
      </ul>
      <p className="klein zacht">★ hoofdadmin · ☆ admin · {alle.filter((m) => m.status === "actief").length} actieve leden</p>
    </>
  );
}

function NieuwLidFormulier({ onOpslaan }: { onOpslaan: (velden: Partial<Member>) => void }) {
  const [voornaam, setVoornaam] = useState("");
  const [achternaam, setAchternaam] = useState("");
  const [email, setEmail] = useState("");
  const [functie, setFunctie] = useState<Functie>("speler");
  function submit(e: FormEvent) {
    e.preventDefault();
    onOpslaan({ voornaam: voornaam.trim(), achternaam: achternaam.trim(), email: email.trim().toLowerCase(), functie });
  }
  return (
    <form onSubmit={submit}>
      <p className="klein zacht">Het lid verschijnt meteen in de lijst en kan opgesteld worden. Registreert de persoon later met dit e-mailadres, dan wordt zijn account automatisch gekoppeld.</p>
      <div className="veld"><label>Voornaam</label><input value={voornaam} onChange={(e) => setVoornaam(e.target.value)} required /></div>
      <div className="veld"><label>Achternaam</label><input value={achternaam} onChange={(e) => setAchternaam(e.target.value)} required /></div>
      <div className="veld"><label>E-mailadres</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
      <div className="veld">
        <label>Functie</label>
        <select value={functie} onChange={(e) => setFunctie(e.target.value as Functie)}>
          {FUNCTIES.map((f) => <option key={f} value={f}>{FUNCTIE_LABEL[f]}</option>)}
        </select>
      </div>
      <button className="knop">Toevoegen</button>
    </form>
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

  async function volledigVerwijderen(v: Member) {
    if (!confirm(`${v.naam} volledig verwijderen? Zowel het account als alle gegevens (adres, telefoon, geboortedatum) verdwijnen.`)) return;
    if (!confirm(`Ben je zeker? Dit kan niet ongedaan gemaakt worden. ${v.naam} wordt definitief verwijderd.`)) return;
    await doe(async () => { await adminVerwijderLid(v.id); navigate("/leden"); }, "");
  }

  async function afwijzen(v: Member) {
    // een registratie die aan een bestaand lid (uit de spelerslijst) gekoppeld werd: alleen het account weg,
    // de gegevens blijven; een volledig nieuwe registratie: alles weg
    if (v.bron === "registratie") {
      if (!confirm(`Registratie van ${v.naam} afwijzen en verwijderen?`)) return;
      await doe(async () => { await adminVerwijderLid(v.id); navigate("/leden"); }, "");
    } else {
      if (!confirm(`Koppeling afwijzen? Het account wordt verwijderd, de gegevens van ${v.naam} blijven staan.`)) return;
      await doe(() => adminOntkoppelAccount(v.id), "Account verwijderd, gegevens bewaard.");
    }
  }

  return (
    <>
      <Link to="/leden" className="klein">‹ Alle leden</Link>
      <h2 style={{ marginTop: 6 }}>{m.naam}{m.is_hoofdadmin ? " ★" : m.is_admin ? " ☆" : ""}</h2>
      <Fout tekst={data.fout ?? fout} />
      {ok && <div className="melding ok">{ok}</div>}
      <div className="kaart">
        <p><strong>Functie</strong><br />{FUNCTIE_LABEL[m.functie]}{m.speelt && m.functie !== "speler" && m.functie !== "spelercoach" ? " · speelt mee" : ""}{m.is_admin ? " · admin" : ""}</p>
        <p><strong>Status</strong><br />{STATUS_LABEL[m.status]}{vol && !vol.user_id ? " · geen account" : ""}</p>
        {vol && (
          <>
            <p><strong>Telefoon</strong><br />{vol.telefoon ? <a href={`tel:${vol.telefoon}`}>{vol.telefoon}</a> : <span className="zacht">niet ingevuld</span>}</p>
            <p><strong>E-mail</strong><br /><a href={`mailto:${vol.email}`}>{vol.email}</a></p>
            <p><strong>Geboortedatum</strong><br />{vol.geboortedatum ? fmtDatum(vol.geboortedatum) : <span className="zacht">niet ingevuld</span>}</p>
            <p><strong>Adres</strong><br />{vol.adres ?? <span className="zacht">niet ingevuld</span>}</p>
            {vol.nationaliteit && <p><strong>Nationaliteit</strong><br />{vol.nationaliteit}</p>}
            {r.isAdmin && (
              <p className="klein zacht">
                {vol.bron === "import" ? "Uit de spelerslijst" : vol.bron === "admin" ? "Toegevoegd door een admin" : "Zelf geregistreerd"}
                {vol.nr ? ` · nr ${vol.nr}` : ""}{vol.ingeschreven === true ? " · ingeschreven bij de federatie" : vol.ingeschreven === false ? " · nog niet ingeschreven" : ""}
              </p>
            )}
          </>
        )}
      </div>

      {m.speelt && <SpelerStatistieken memberId={m.id} />}

      {r.isAdmin && vol && (
        <div className="kaart">
          <h3>Beheer</h3>
          {!magBewerken && <p className="zacht">De hoofdadmin kan alleen door zichzelf gewijzigd worden.</p>}
          {magBewerken && (
            <>
              {vol.status === "wacht_op_goedkeuring" && (
                <div className="knoppen" style={{ marginBottom: 10 }}>
                  <button type="button" className="knop" onClick={() => doe(() => wijzigLid(vol.id, { status: "actief" }), "Account goedgekeurd.")}>Goedkeuren</button>
                  <button type="button" className="knop gevaar" onClick={() => afwijzen(vol)}>Afwijzen</button>
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
                {!vol.is_hoofdadmin && vol.user_id && vol.id !== lid?.id && (
                  <button type="button" className="knop licht" onClick={() => { if (confirm(`Account van ${vol.naam} verwijderen? De gegevens blijven staan; bij een nieuwe registratie worden ze opnieuw gekoppeld.`)) doe(() => adminOntkoppelAccount(vol.id), "Account verwijderd, gegevens bewaard."); }}>Account verwijderen</button>
                )}
                {!vol.is_hoofdadmin && vol.id !== lid?.id && (
                  <button type="button" className="knop gevaar" onClick={() => volledigVerwijderen(vol)}>Volledig verwijderen</button>
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
  const [voornaam, setVoornaam] = useState(lid.voornaam ?? "");
  const [achternaam, setAchternaam] = useState(lid.achternaam ?? "");
  const [functie, setFunctie] = useState<Functie>(lid.functie);
  const [telefoon, setTelefoon] = useState(lid.telefoon ?? "");
  const [geboortedatum, setGeboortedatum] = useState(lid.geboortedatum ?? "");
  const [adres, setAdres] = useState(lid.adres ?? "");
  const [nationaliteit, setNationaliteit] = useState(lid.nationaliteit ?? "");
  function submit(e: FormEvent) {
    e.preventDefault();
    const velden: Partial<Member> = {
      voornaam: voornaam.trim(), achternaam: achternaam.trim(), telefoon: telefoon.trim() || null,
      geboortedatum: geboortedatum || null, adres: adres.trim() || null, nationaliteit: nationaliteit.trim() || null,
    };
    if (!eigen) velden.functie = functie;
    onOpslaan(velden);
  }
  return (
    <form onSubmit={submit}>
      <div className="veld"><label>Voornaam</label><input value={voornaam} onChange={(e) => setVoornaam(e.target.value)} required autoComplete="given-name" /></div>
      <div className="veld"><label>Achternaam</label><input value={achternaam} onChange={(e) => setAchternaam(e.target.value)} required autoComplete="family-name" /></div>
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
      <div className="veld"><label>Nationaliteit</label><input value={nationaliteit} onChange={(e) => setNationaliteit(e.target.value)} /></div>
      <button className="knop">Opslaan</button>
    </form>
  );
}
