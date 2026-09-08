"""Orkestratie: ophalen -> parsen -> rijen bouwen -> diff -> upsert, met statusvlag bij fouten."""
from __future__ import annotations

import dataclasses
import json
import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Callable

from .config import Settings
from .fetch import FetchError, Page, PageSource
from .models import ClubInfo, Match, Standing
from .parsers import (
    ParseError, parse_club, parse_kalender, parse_klassement, parse_seizoen, parse_uitslagen,
)
from .standings import ReeksVergelijking, bereken_klassement, vergelijk
from .supabase_client import Database, Row
from .teams import TeamRegistry

log = logging.getLogger(__name__)

BRON_KAVVV = "kavvv"
BRON_BEREKEND = "berekend"
SYNC_STATUS_ID = "kavvv"

# tabel -> sleutelkolommen (moeten overeenkomen met de primary keys in supabase/schema.sql)
SLEUTELS: dict[str, list[str]] = {
    "teams": ["ploegid"],
    "matches": ["match_key"],
    "standings": ["seizoen", "reeks", "ploegid", "bron"],
    "standings_state": ["seizoen", "reeks"],
}
# kolommen die elke run veranderen en dus niet als "wijziging" tellen
NEGEER_BIJ_DIFF = {"fetched_at", "updated_at", "vergeleken_at"}


class SyncError(RuntimeError):
    """Parse- of ophaalfout, met de pagina erbij zodat de HTML bewaard kan worden."""

    def __init__(self, oorzaak: Exception, page: Page | None) -> None:
        super().__init__(str(oorzaak))
        self.oorzaak = oorzaak
        self.page = page


@dataclass
class Plan:
    seizoen: str
    teams: list[Row]
    matches: list[Row]
    standings: list[Row]
    standings_state: list[Row]
    vergelijking: dict[str, ReeksVergelijking]
    waarschuwingen: list[str] = field(default_factory=list)
    paginas: dict[str, Page] = field(default_factory=dict)

    def rijen(self) -> dict[str, list[Row]]:
        return {
            "teams": self.teams, "matches": self.matches,
            "standings": self.standings, "standings_state": self.standings_state,
        }


@dataclass
class TabelDiff:
    nieuw: list[Row] = field(default_factory=list)
    gewijzigd: list[tuple[Row, dict[str, tuple[Any, Any]]]] = field(default_factory=list)
    ongewijzigd: int = 0
    overgeslagen: list[Row] = field(default_factory=list)  # manual_override in de database

    @property
    def te_schrijven(self) -> list[Row]:
        return self.nieuw + [rij for rij, _ in self.gewijzigd]


@dataclass
class Diff:
    tabellen: dict[str, TabelDiff]


# ------------------------------------------------------------- rijen bouwen

def _iso(val: Any) -> Any:
    if isinstance(val, datetime):
        return val.isoformat()
    if isinstance(val, date):
        return val.isoformat()
    return val


def _match_rij(m: Match, fetched_at: datetime) -> Row:
    return {
        "match_key": m.key, "seizoen": m.seizoen, "reeks": m.reeks,
        "datum": _iso(m.datum), "uur": m.uur,
        "thuis_id": m.thuis_id, "uit_id": m.uit_id, "thuis": m.thuis, "uit": m.uit,
        "thuis_score": m.thuis_score, "uit_score": m.uit_score, "status": m.status,
        "terrein": m.terrein, "opmerking": m.opmerking or None,
        "bron": BRON_KAVVV, "fetched_at": _iso(fetched_at),
    }


def _standing_rij(s: Standing, seizoen: str, bron: str, fetched_at: datetime) -> Row:
    return {
        "seizoen": seizoen, "reeks": s.reeks, "ploegid": s.ploegid, "bron": bron,
        "positie": s.positie, "ploeg": s.ploeg, "gespeeld": s.gespeeld,
        "gewonnen": s.gewonnen, "gelijk": s.gelijk, "verloren": s.verloren,
        "doelpunten_voor": s.doelpunten_voor, "doelpunten_tegen": s.doelpunten_tegen,
        "saldo": s.saldo, "punten": s.punten, "fetched_at": _iso(fetched_at),
    }


def _team_rij(ploegid: int, naam: str, reeks: str | None, club: ClubInfo | None,
              seizoen: str, fetched_at: datetime) -> Row:
    rij: Row = {
        "ploegid": ploegid, "seizoen": seizoen, "naam": naam, "reeks": reeks,
        "clubnummer": None, "afdeling": None, "terrein": None, "kleuren": None,
        "secretaris": None, "secretaris_adres": None, "tel": None, "gsm": None, "email": None,
        "verantwoordelijke": None, "verantwoordelijke_tel": None, "wegwijzer": None,
        "bron": BRON_KAVVV, "fetched_at": _iso(fetched_at),
    }
    if club is not None:
        rij.update({
            "clubnummer": club.clubnummer, "afdeling": club.afdeling, "terrein": club.terrein,
            "kleuren": club.kleuren, "secretaris": club.secretaris, "secretaris_adres": club.secretaris_adres,
            "tel": club.tel, "gsm": club.gsm, "email": club.email,
            "verantwoordelijke": club.verantwoordelijke, "verantwoordelijke_tel": club.verantwoordelijke_tel,
            "wegwijzer": club.wegwijzer,
        })
    return rij


def _rij_naar_match(rij: Row) -> Match:
    """Bestaande databaserij terug naar Match (voor eerder gespeelde wedstrijden)."""
    return Match(
        seizoen=rij["seizoen"], reeks=rij["reeks"],
        datum=date.fromisoformat(rij["datum"]) if rij.get("datum") else None, uur=rij.get("uur"),
        thuis=rij["thuis"], uit=rij["uit"], thuis_id=rij.get("thuis_id"), uit_id=rij.get("uit_id"),
        thuis_score=rij.get("thuis_score"), uit_score=rij.get("uit_score"),
        terrein=rij.get("terrein"), opmerking=rij.get("opmerking") or "",
    )


def bouw_plan(
    source: PageSource,
    *,
    now: datetime | None = None,
    met_clubs: bool = True,
    bestaande_matches: list[Row] | None = None,
    bewaar_fout: Callable[[Page, Exception], None] | None = None,
) -> Plan:
    """Haalt alle pagina's op, parset ze en bouwt de rijen voor Supabase.

    `bestaande_matches` (huidige databaserijen) dient om (a) eerder gespeelde wedstrijden
    mee te tellen als de uitslagenpagina ze niet meer toont en (b) het aanvangsuur van
    gespeelde wedstrijden te bewaren, want de uitslagenpagina vermeldt geen uur.
    """
    now = now or datetime.now(timezone.utc)
    waarschuwingen: list[str] = []
    paginas: dict[str, Page] = {}
    page: Page | None = None
    try:
        page = source.klassement()
        paginas["klassement"] = page
        seizoen = parse_seizoen(page.html)
        officieel = parse_klassement(page.html)
        page = source.uitslagen()
        paginas["uitslagen"] = page
        results = parse_uitslagen(page.html)
        page = source.kalender()
        paginas["kalender"] = page
        fixtures = parse_kalender(page.html)
    except (ParseError, FetchError) as exc:
        raise SyncError(exc, page) from exc

    registry = TeamRegistry()
    for s in officieel:
        registry.add(s.ploeg, s.ploegid, s.reeks)
    for f in fixtures:
        registry.add(f.thuis, f.thuis_id, f.reeks)
        registry.add(f.uit, f.uit_id, f.reeks)
    for naam, id_a, id_b in registry.conflicten:
        waarschuwingen.append(f"ploegnaam {naam!r} hoort bij twee ploegids: {id_a} en {id_b}")

    clubs: dict[int, ClubInfo] = {}
    club_fetched: dict[int, datetime] = {}
    if met_clubs:
        for ploegid in sorted(registry.ids()):
            cp = source.club(ploegid)
            if cp is None:
                waarschuwingen.append(f"ploegpagina {ploegid} ({registry.naam(ploegid)}) niet beschikbaar")
                continue
            try:
                clubs[ploegid] = parse_club(cp.html, ploegid)
                club_fetched[ploegid] = cp.fetched_at
            except ParseError as exc:
                waarschuwingen.append(f"ploegpagina {ploegid} ({registry.naam(ploegid)}): {exc}")
                if bewaar_fout is not None:
                    bewaar_fout(cp, exc)

    bestaand_per_key = {r["match_key"]: r for r in (bestaande_matches or [])}

    def terrein_van(ploegid: int | None) -> str | None:
        """Terrein van de thuisploeg (uit haar ploegpagina); anders None en later uit de database."""
        club = clubs.get(ploegid) if ploegid is not None else None
        return club.terrein if club is not None else None

    matches: list[Match] = []
    for r in results:
        thuis_id, uit_id = registry.resolve(r.thuis), registry.resolve(r.uit)
        for naam, pid in ((r.thuis, thuis_id), (r.uit, uit_id)):
            if pid is None:
                waarschuwingen.append(f"uitslag {r.speeldag} {r.reeks}: ploeg {naam!r} niet gekoppeld aan een ploegid")
        m = Match(
            seizoen=seizoen, reeks=r.reeks, datum=r.datum, uur=None, thuis=r.thuis, uit=r.uit,
            thuis_id=thuis_id, uit_id=uit_id, thuis_score=r.thuis_score, uit_score=r.uit_score,
            terrein=terrein_van(thuis_id), opmerking=r.opmerking,
        )
        oud = bestaand_per_key.get(m.key)
        if oud is not None:
            m = dataclasses.replace(m, uur=m.uur or oud.get("uur"), terrein=m.terrein or oud.get("terrein"))
        matches.append(m)
    for f in fixtures:
        m = Match(
            seizoen=seizoen, reeks=f.reeks, datum=f.datum, uur=f.uur, thuis=f.thuis, uit=f.uit,
            thuis_id=f.thuis_id, uit_id=f.uit_id, terrein=terrein_van(f.thuis_id),
        )
        oud = bestaand_per_key.get(m.key)
        if oud is not None and m.terrein is None:
            m = dataclasses.replace(m, terrein=oud.get("terrein"))
        matches.append(m)

    keys = {m.key for m in matches}
    dubbel = len(matches) - len(keys)
    if dubbel:
        waarschuwingen.append(f"{dubbel} wedstrijd(en) komen dubbel voor (uitslagen én kalender?)")
    eerder_gespeeld = [
        _rij_naar_match(r) for r in (bestaande_matches or [])
        if r.get("seizoen") == seizoen and r.get("status") == "gespeeld" and r["match_key"] not in keys
    ]
    if eerder_gespeeld:
        waarschuwingen.append(
            f"{len(eerder_gespeeld)} eerder gespeelde wedstrijd(en) staan niet meer op de uitslagenpagina; "
            "ze tellen mee uit de database")

    ploegen_per_reeks: dict[str, list[tuple[int | None, str]]] = {}
    for s in officieel:
        ploegen_per_reeks.setdefault(s.reeks, []).append((s.ploegid, s.ploeg))
    berekend = bereken_klassement([m for m in matches if m.gespeeld] + eerder_gespeeld, ploegen_per_reeks)
    vergelijking = vergelijk(officieel, berekend)

    kl_at = paginas["klassement"].fetched_at
    ui_at = paginas["uitslagen"].fetched_at
    ka_at = paginas["kalender"].fetched_at
    teams = [
        _team_rij(pid, registry.naam(pid) or "", registry.reeks(pid), clubs.get(pid), seizoen,
                  club_fetched.get(pid, kl_at))
        for pid in sorted(registry.ids())
    ]
    match_rijen = [_match_rij(m, ui_at if m.gespeeld else ka_at) for m in matches]
    standing_rijen = [_standing_rij(s, seizoen, BRON_KAVVV, kl_at) for s in officieel]
    standing_rijen += [_standing_rij(s, seizoen, BRON_BEREKEND, now) for s in berekend]
    state_rijen = [{
        "seizoen": seizoen, "reeks": reeks, "toon_bron": v.toon_bron, "label": v.label, "status": v.status,
        "verschillen": [dataclasses.asdict(d) for d in v.verschillen], "vergeleken_at": _iso(now),
    } for reeks, v in vergelijking.items()]

    return Plan(seizoen, teams, match_rijen, standing_rijen, state_rijen, vergelijking, waarschuwingen, paginas)


# --------------------------------------------------------------------- diff

def _sleutel_van(rij: Row, kolommen: list[str]) -> tuple:
    return tuple(rij[k] for k in kolommen)


def _genormaliseerd(val: Any) -> Any:
    # jsonb komt als list/dict terug; datums als str. Vergelijk op JSON-niveau.
    return json.loads(json.dumps(val, sort_keys=True, default=str))


def bereken_diff(plan: Plan, db: Database) -> Diff:
    tabellen: dict[str, TabelDiff] = {}
    for tabel, rijen in plan.rijen().items():
        sleutels = SLEUTELS[tabel]
        bestaand = {_sleutel_van(r, sleutels): r for r in db.select(tabel)}
        td = TabelDiff()
        for rij in rijen:
            oud = bestaand.get(_sleutel_van(rij, sleutels))
            if oud is None:
                td.nieuw.append(rij)
                continue
            if oud.get("manual_override"):
                td.overgeslagen.append(rij)
                continue
            wijzigingen = {
                k: (oud.get(k), v) for k, v in rij.items()
                if k not in NEGEER_BIJ_DIFF and _genormaliseerd(oud.get(k)) != _genormaliseerd(v)
            }
            if wijzigingen:
                td.gewijzigd.append((rij, wijzigingen))
            else:
                td.ongewijzigd += 1
        tabellen[tabel] = td
    return Diff(tabellen)


def pas_toe(plan: Plan, db: Database, *, dry_run: bool) -> Diff:
    """Upsert alle rijen (ook ongewijzigde: fetched_at moet mee), behalve manual_override-rijen."""
    diff = bereken_diff(plan, db)
    if dry_run:
        return diff
    overgeslagen = {tabel: {_sleutel_van(r, SLEUTELS[tabel]) for r in td.overgeslagen}
                    for tabel, td in diff.tabellen.items()}
    for tabel, rijen in plan.rijen().items():
        te_schrijven = [r for r in rijen if _sleutel_van(r, SLEUTELS[tabel]) not in overgeslagen[tabel]]
        if te_schrijven:
            db.upsert(tabel, te_schrijven, SLEUTELS[tabel])
    return diff


# ------------------------------------------------------------------- status

def schrijf_status(db: Database, *, now: datetime, ok: bool, fout: str | None = None,
                   pagina: str | None = None) -> None:
    rij: Row = {"id": SYNC_STATUS_ID, "laatste_poging_at": _iso(now), "status": "ok" if ok else "fout",
                "fout": fout, "pagina": pagina}
    if ok:
        rij["laatste_succes_at"] = _iso(now)  # bij een fout blijft laatste_succes_at onaangeroerd
    db.upsert("sync_status", [rij], ["id"])


def bewaar_html(page: Page, exc: Exception, incoming_dir: Path, now: datetime) -> Path:
    """Bewaart de HTML die niet geparset kon worden, zodat de parser bijgewerkt kan worden."""
    incoming_dir.mkdir(parents=True, exist_ok=True)
    stempel = now.strftime("%Y%m%d-%H%M%S")
    pad = incoming_dir / f"{page.naam}_{stempel}.html"
    pad.write_text(page.html, encoding="utf-8")
    (incoming_dir / f"{page.naam}_{stempel}.txt").write_text(
        f"url: {page.url}\nstatus: {page.status}\nfetched_at: {page.fetched_at.isoformat()}\nfout: {exc}\n",
        encoding="utf-8")
    return pad


# ---------------------------------------------------------------------- run

def rapport(plan: Plan, diff: Diff, *, dry_run: bool, eigen_ploeg: str | None = None,
            max_wijzigingen: int = 40) -> str:
    regels: list[str] = []
    kop = "DRY-RUN: dit zou wijzigen" if dry_run else "Gesynchroniseerd"
    regels.append(f"{kop} | seizoen {plan.seizoen}")
    for naam, page in plan.paginas.items():
        bron = "cache" if page.uit_cache else "live"
        regels.append(f"  pagina {naam:10s} {bron:5s} {page.fetched_at.strftime('%Y-%m-%d %H:%M')} UTC")
    for tabel, td in diff.tabellen.items():
        regels.append(
            f"  {tabel:16s} {len(td.nieuw):4d} nieuw, {len(td.gewijzigd):4d} gewijzigd, "
            f"{td.ongewijzigd:4d} ongewijzigd, {len(td.overgeslagen):3d} overgeslagen (manual_override)")
    getoond = 0
    for tabel, td in diff.tabellen.items():
        for rij, wijzigingen in td.gewijzigd:
            if getoond >= max_wijzigingen:
                break
            sleutel = "|".join(str(rij[k]) for k in SLEUTELS[tabel])
            delta = ", ".join(f"{k}: {o!r} -> {n!r}" for k, (o, n) in wijzigingen.items())
            regels.append(f"    {tabel} {sleutel}: {delta}")
            getoond += 1
    regels.append("  klassement per reeks:")
    for reeks, v in plan.vergelijking.items():
        extra = f" ({len(v.verschillen)} verschillen)" if v.verschillen else ""
        label = f" [{v.label}]" if v.label else ""
        regels.append(f"    {reeks:20s} {v.status:24s} -> toon {v.toon_bron}{label}{extra}")
    if eigen_ploeg:
        eigen = [r for r in plan.standings if r["ploeg"].casefold() == eigen_ploeg.casefold()]
        for r in eigen:
            regels.append(
                f"  {eigen_ploeg} ({r['bron']}): {r['reeks']} positie {r['positie']}, "
                f"{r['gespeeld']} gesp, {r['punten']} pt, {r['doelpunten_voor']}-{r['doelpunten_tegen']}")
    if plan.waarschuwingen:
        regels.append(f"  waarschuwingen ({len(plan.waarschuwingen)}):")
        regels.extend(f"    - {w}" for w in plan.waarschuwingen[:20])
        if len(plan.waarschuwingen) > 20:
            regels.append(f"    ... nog {len(plan.waarschuwingen) - 20}")
    return "\n".join(regels)


def run(settings: Settings, source: PageSource, db: Database, *, dry_run: bool,
        met_clubs: bool = True, now: datetime | None = None) -> int:
    """Volledige sync. Geeft 0 terug bij succes, 1 bij een parse-/ophaalfout."""
    now = now or datetime.now(timezone.utc)

    def bewaar(page: Page, exc: Exception) -> None:
        pad = bewaar_html(page, exc, settings.incoming_dir, now)
        log.error("HTML bewaard als %s", pad)

    try:
        bestaand = db.select("matches")
    except Exception as exc:  # database onbereikbaar: wel doorgaan, zonder oude rijen
        log.warning("bestaande wedstrijden niet gelezen: %s", exc)
        bestaand = []
    try:
        plan = bouw_plan(source, now=now, met_clubs=met_clubs, bestaande_matches=bestaand, bewaar_fout=bewaar)
    except SyncError as exc:
        pagina = exc.page.naam if exc.page else None
        log.error("sync mislukt op pagina %s: %s", pagina, exc)
        if exc.page is not None and isinstance(exc.oorzaak, ParseError):
            bewaar(exc.page, exc.oorzaak)
        if not dry_run:
            schrijf_status(db, now=now, ok=False, fout=str(exc), pagina=pagina)
        return 1
    diff = pas_toe(plan, db, dry_run=dry_run)
    if not dry_run:
        schrijf_status(db, now=now, ok=True)
    print(rapport(plan, diff, dry_run=dry_run, eigen_ploeg=settings.eigen_ploeg))
    for w in plan.waarschuwingen:
        log.warning(w)
    return 0
