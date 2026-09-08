"""Sync-orkestratie op fixtures met een in-memory database."""
import shutil
from datetime import datetime, timezone
from pathlib import Path

from competition.config import Settings
from competition.fetch import FixtureSource
from competition.supabase_client import MemoryDatabase
from competition.sync import bereken_diff, bouw_plan, pas_toe, run

FIX = Path(__file__).parent / "fixtures"
NU = datetime(2026, 9, 8, 18, 0, tzinfo=timezone.utc)
LATER = datetime(2026, 9, 12, 20, 0, tzinfo=timezone.utc)
VOLLEZELE_TERREIN = "Vollezele - Waterstraat 48 B - 1570 Vollezele"


def settings(tmp_path: Path) -> Settings:
    return Settings(cache_dir=tmp_path / "cache", incoming_dir=tmp_path / "incoming")


def test_bouw_plan_op_fixtures():
    plan = bouw_plan(FixtureSource(FIX), now=NU)
    assert plan.seizoen == "2026-2027"
    assert len(plan.teams) == 92
    assert len(plan.matches) == 934 + 34
    assert len(plan.standings) == 92 * 2
    assert len(plan.standings_state) == 8
    assert {r["bron"] for r in plan.standings} == {"kavvv", "berekend"}
    assert all(r["toon_bron"] == "kavvv" and r["label"] is None for r in plan.standings_state)

    gespeeld = [m for m in plan.matches if m["status"] == "gespeeld"]
    assert len(gespeeld) == 34 and all(m["thuis_id"] and m["uit_id"] for m in gespeeld)

    # terrein van de thuisploeg staat op elke wedstrijd waarvan we de ploegpagina hebben (alleen 149 in de fixtures)
    thuis_149 = [m for m in plan.matches if m["thuis_id"] == 149]
    assert thuis_149 and all(m["terrein"] == VOLLEZELE_TERREIN for m in thuis_149)
    assert next(m for m in thuis_149 if m["uit_id"] == 11)["uur"] == "14:00"
    assert next(m for m in thuis_149 if m["uit_id"] == 11)["match_key"] == "2026-2027|149|11"

    team_149 = next(t for t in plan.teams if t["ploegid"] == 149)
    assert team_149["terrein"] == VOLLEZELE_TERREIN
    assert team_149["secretaris"] == "Peeters Jan" and team_149["email"] == "secretariaat@example.com"
    steca = next(t for t in plan.teams if t["ploegid"] == 152)
    assert (steca["naam"], steca["reeks"], steca["terrein"]) == ("Steca Juniors", "DERDE AFDELING B", None)
    assert sum("niet beschikbaar" in w for w in plan.waarschuwingen) == 91


def test_run_schrijft_alles_en_is_idempotent(tmp_path):
    db = MemoryDatabase()
    assert run(settings(tmp_path), FixtureSource(FIX), db, dry_run=False, now=NU) == 0
    assert len(db.tabellen["teams"]) == 92
    assert len(db.tabellen["matches"]) == 968
    assert len(db.tabellen["standings"]) == 184
    status = db.select("sync_status")[0]
    assert status["status"] == "ok" and status["laatste_succes_at"] == NU.isoformat()

    plan = bouw_plan(FixtureSource(FIX), now=LATER, bestaande_matches=db.select("matches"))
    diff = bereken_diff(plan, db)
    assert all(not td.nieuw and not td.gewijzigd for td in diff.tabellen.values())
    assert diff.tabellen["matches"].ongewijzigd == 968


def test_dry_run_schrijft_niets(tmp_path):
    db = MemoryDatabase()
    assert run(settings(tmp_path), FixtureSource(FIX), db, dry_run=True, now=NU) == 0
    assert db.tabellen == {}


def test_manual_override_wordt_niet_overschreven(tmp_path):
    db = MemoryDatabase()
    run(settings(tmp_path), FixtureSource(FIX), db, dry_run=False, now=NU)
    rij = db.tabellen["teams"][(149,)]
    rij["terrein"] = "Handmatig gecorrigeerd terrein"
    rij["manual_override"] = True

    plan = bouw_plan(FixtureSource(FIX), now=LATER)
    diff = pas_toe(plan, db, dry_run=False)
    assert [r["ploegid"] for r in diff.tabellen["teams"].overgeslagen] == [149]
    assert db.tabellen["teams"][(149,)]["terrein"] == "Handmatig gecorrigeerd terrein"
    assert db.tabellen["teams"][(11,)]["fetched_at"] == db.tabellen["teams"][(11,)]["fetched_at"]
    assert db.upserts[-1][0] == "standings_state"  # de andere tabellen zijn wel geschreven


def test_parsefout_zet_statusvlag_en_bewaart_html(tmp_path):
    db = MemoryDatabase()
    s = settings(tmp_path)
    assert run(s, FixtureSource(FIX), db, dry_run=False, now=NU) == 0

    kapot = tmp_path / "kapot"
    kapot.mkdir()
    for naam in ("klassement.html", "uitslagen.html", "kalender.html", "club_uniek_149.html"):
        shutil.copy(FIX / naam, kapot / naam)
    html = (kapot / "klassement.html").read_text(encoding="utf-8").replace("<th>Pt.</th>", "<th>Punten</th>")
    (kapot / "klassement.html").write_text(html, encoding="utf-8")

    assert run(s, FixtureSource(kapot), db, dry_run=False, now=LATER) == 1
    status = db.select("sync_status")[0]
    assert status["status"] == "fout" and status["pagina"] == "klassement"
    assert "onverwachte kolommen" in status["fout"]
    assert status["laatste_poging_at"] == LATER.isoformat()
    assert status["laatste_succes_at"] == NU.isoformat()  # blijft staan: app toont "niet bijgewerkt sinds"
    bewaard = sorted(p.name for p in s.incoming_dir.iterdir())
    assert bewaard == ["klassement_20260912-200000.html", "klassement_20260912-200000.txt"]
    assert len(db.tabellen["matches"]) == 968  # oude data blijft staan


def test_eerder_gespeelde_wedstrijd_blijft_meetellen_en_uur_blijft_bewaard():
    bestaand = [{
        "match_key": "2026-2027|21|11", "seizoen": "2026-2027", "reeks": "EERSTE AFDELING",
        "datum": "2026-09-05", "uur": "15:00", "thuis_id": 21, "uit_id": 11, "thuis": "FC Depot",
        "uit": "Dynamo Wijndaal", "thuis_score": 1, "uit_score": 3, "status": "gespeeld",
        "terrein": "Terrein uit database", "opmerking": None,
    }, {
        # een wedstrijd die niet (meer) op de uitslagenpagina staat: telt mee vanuit de database
        "match_key": "2026-2027|152|999", "seizoen": "2026-2027", "reeks": "DERDE AFDELING B",
        "datum": "2026-08-29", "uur": "15:00", "thuis_id": 152, "uit_id": 999, "thuis": "Steca Juniors",
        "uit": "Spookploeg", "thuis_score": 4, "uit_score": 0, "status": "gespeeld",
        "terrein": None, "opmerking": None,
    }]
    plan = bouw_plan(FixtureSource(FIX), now=NU, met_clubs=False, bestaande_matches=bestaand)
    depot = next(m for m in plan.matches if m["match_key"] == "2026-2027|21|11")
    assert depot["uur"] == "15:00" and depot["terrein"] == "Terrein uit database"
    steca = next(r for r in plan.standings if r["ploegid"] == 152 and r["bron"] == "berekend")
    assert (steca["gespeeld"], steca["gewonnen"], steca["doelpunten_voor"], steca["punten"]) == (1, 1, 4, 3)
    assert plan.vergelijking["DERDE AFDELING B"].status == "afwijking"
    assert any("eerder gespeelde" in w for w in plan.waarschuwingen)
