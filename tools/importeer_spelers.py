"""Importeert de spelerslijst (Excel) in de tabel members van Supabase.

Gebruik:  python tools/importeer_spelers.py "pad/naar/Spelerslijst.xlsx" [--dry-run]

- Koppelt op e-mailadres, anders op voor- en achternaam. Bestaande leden (ook met account) worden
  aangevuld: alleen lege velden worden ingevuld, niets wordt overschreven.
- Nieuwe leden krijgen functie speler, status actief, bron import, zonder account.
- Het rijksregisternummer gaat naar members_gevoelig (alleen admins en de persoon zelf).
- Vereist .env met SUPABASE_URL en SUPABASE_SERVICE_KEY (zoals de sync).
"""
from __future__ import annotations

import sys
from datetime import date, datetime
from pathlib import Path

import openpyxl
import truststore

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from competition.config import MODULE_ROOT, Settings, laad_dotenv  # noqa: E402
from competition.supabase_client import SupabaseRest  # noqa: E402

KOLOMMEN = {
    "nr": "Nr", "voornaam": "Voornaam", "achternaam": "Achternaam", "geboortedatum": "Geboortedatum",
    "rijksregisternummer": "Rijksregisternummer", "adres": "Adres", "nationaliteit": "Nationaliteit",
    "telefoon": "GSM", "email": "Email", "mail_inschrijving": "Mail Inschrijving", "ingeschreven": "Ingeschreven",
}
AANVULBAAR = ("email", "telefoon", "geboortedatum", "adres", "nationaliteit", "nr", "ingeschreven", "mail_inschrijving")


def tekst(v) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def gsm(v) -> str | None:
    if v is None or v == "":
        return None
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    s = "".join(ch for ch in str(v) if ch.isdigit() or ch == "+")
    if not s:
        return None
    if s.startswith("+"):
        return s
    if s.startswith("32") and len(s) == 11:
        return "0" + s[2:]
    if len(s) == 9:
        return "0" + s
    return s


def datum(v) -> str | None:
    if isinstance(v, datetime):
        return v.date().isoformat()
    if isinstance(v, date):
        return v.isoformat()
    s = tekst(v)
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s[:10], fmt).date().isoformat()
        except ValueError:
            pass
    raise ValueError(f"onbekend datumformaat: {s!r}")


def lees_lijst(pad: Path) -> list[dict]:
    ws = openpyxl.load_workbook(pad, data_only=True)["Spelers"]
    rijen = list(ws.iter_rows(values_only=True))
    kop = [str(c).strip() if c is not None else "" for c in rijen[0]]

    def kol(naam: str) -> int:
        for i, k in enumerate(kop):
            if k.lower().startswith(naam.lower()):
                return i
        raise KeyError(f"kolom {naam!r} niet gevonden in {kop}")

    idx = {veld: kol(naam) for veld, naam in KOLOMMEN.items()}
    out = []
    for r in rijen[1:]:
        if not any(r):
            continue
        voornaam, achternaam = tekst(r[idx["voornaam"]]), tekst(r[idx["achternaam"]])
        if not voornaam or not achternaam:
            continue
        out.append({
            "voornaam": voornaam, "achternaam": achternaam,
            "email": (tekst(r[idx["email"]]) or "").lower() or None,
            "telefoon": gsm(r[idx["telefoon"]]),
            "geboortedatum": datum(r[idx["geboortedatum"]]),
            "adres": tekst(r[idx["adres"]]),
            "nationaliteit": tekst(r[idx["nationaliteit"]]),
            "nr": int(r[idx["nr"]]) if r[idx["nr"]] not in (None, "") else None,
            "ingeschreven": bool(r[idx["ingeschreven"]]) if r[idx["ingeschreven"]] is not None else None,
            "mail_inschrijving": bool(r[idx["mail_inschrijving"]]) if r[idx["mail_inschrijving"]] is not None else None,
            "rijksregisternummer": tekst(r[idx["rijksregisternummer"]]),
        })
    return out


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry_run = "--dry-run" in sys.argv
    if not args:
        print(__doc__)
        return 2
    lijst = lees_lijst(Path(args[0]))
    truststore.inject_into_ssl()
    laad_dotenv(MODULE_ROOT / ".env")
    s = Settings.from_env()
    if not (s.supabase_url and s.supabase_key):
        print("SUPABASE_URL en SUPABASE_SERVICE_KEY ontbreken in .env")
        return 2
    db = SupabaseRest(s.supabase_url, s.supabase_key)
    bestaand = db.select("members", "id,email,voornaam,achternaam,telefoon,geboortedatum,adres,nationaliteit,nr,ingeschreven,mail_inschrijving,user_id,bron")
    op_email = {(m["email"] or "").lower(): m for m in bestaand if m.get("email")}
    op_naam = {((m["voornaam"] or "").lower(), (m["achternaam"] or "").lower()): m for m in bestaand}

    nieuw: list[dict] = []
    updates: list[tuple[dict, dict]] = []
    gevoelig: list[tuple[str | None, dict, str]] = []  # (member_id of None, spelerrij, rrn)
    for p in lijst:
        m = (op_email.get(p["email"]) if p["email"] else None) or op_naam.get((p["voornaam"].lower(), p["achternaam"].lower()))
        rrn = p.pop("rijksregisternummer")
        if m is None:
            nieuw.append({**p, "functie": "speler", "status": "actief", "bron": "import"})
            if rrn:
                gevoelig.append((None, p, rrn))
            continue
        velden = {k: v for k, v in p.items() if k in AANVULBAAR and v is not None and not m.get(k)}
        if velden:
            updates.append((m, velden))
        if rrn:
            gevoelig.append((m["id"], p, rrn))

    print(f"spelerslijst: {len(lijst)} personen | in database: {len(bestaand)} leden")
    print(f"  nieuw toe te voegen: {len(nieuw)}: " + ", ".join(f"{p['voornaam']} {p['achternaam']}" for p in nieuw))
    print(f"  bestaand aan te vullen: {len(updates)}: " + ", ".join(f"{m['voornaam']} {m['achternaam']} ({', '.join(v)})" for m, v in updates))
    print(f"  rijksregisternummers: {len(gevoelig)}")
    if dry_run:
        print("dry-run: niets geschreven")
        return 0

    if nieuw:
        resp = db.session.post(f"{db.url}/rest/v1/members", json=nieuw, headers={"Prefer": "return=minimal"}, timeout=60)
        if resp.status_code >= 300:
            print("insert mislukt:", resp.status_code, resp.text[:300])
            return 1
    for m, velden in updates:
        resp = db.session.patch(f"{db.url}/rest/v1/members", params={"id": f"eq.{m['id']}"}, json=velden,
                                headers={"Prefer": "return=minimal"}, timeout=60)
        if resp.status_code >= 300:
            print("update mislukt:", m["voornaam"], resp.status_code, resp.text[:300])
            return 1

    # ids ophalen voor de gevoelige gegevens
    na = db.select("members", "id,email,voornaam,achternaam")
    op_email = {(m["email"] or "").lower(): m for m in na if m.get("email")}
    op_naam = {((m["voornaam"] or "").lower(), (m["achternaam"] or "").lower()): m for m in na}
    rijen = []
    for member_id, p, rrn in gevoelig:
        if member_id is None:
            m = (op_email.get(p["email"]) if p["email"] else None) or op_naam.get((p["voornaam"].lower(), p["achternaam"].lower()))
            member_id = m["id"] if m else None
        if member_id:
            rijen.append({"member_id": member_id, "rijksregisternummer": rrn})
    bestaand_rrn = {g["member_id"] for g in db.select("members_gevoelig", "member_id,rijksregisternummer") if g.get("rijksregisternummer")}
    rijen = [r for r in rijen if r["member_id"] not in bestaand_rrn]
    if rijen:
        db.upsert("members_gevoelig", rijen, ["member_id"])
    print(f"klaar: {len(nieuw)} toegevoegd, {len(updates)} aangevuld, {len(rijen)} rijksregisternummers bewaard")
    return 0


if __name__ == "__main__":
    sys.exit(main())
