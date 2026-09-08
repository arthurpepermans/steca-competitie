"""Klassementsberekening (reglement art. 159) en vergelijking met het officiële klassement."""
import dataclasses
from pathlib import Path

from competition.models import Match
from competition.parsers import parse_klassement, parse_uitslagen
from competition.standings import bereken_klassement, vergelijk
from competition.teams import TeamRegistry

FIX = Path(__file__).parent / "fixtures"


def M(thuis: str, uit: str, hs: int | None, us: int | None, reeks: str = "R") -> Match:
    return Match(seizoen="2026-2027", reeks=reeks, datum=None, uur=None, thuis=thuis, uit=uit,
                 thuis_id=None, uit_id=None, thuis_score=hs, uit_score=us)


def volgorde(standings, reeks="R"):
    return [s.ploeg for s in sorted((s for s in standings if s.reeks == reeks), key=lambda s: s.positie)]


def test_punten_3_1_0_en_telling():
    st = bereken_klassement([M("A", "B", 2, 0), M("B", "C", 1, 1), M("C", "A", 0, 3)])
    by = {s.ploeg: s for s in st}
    assert (by["A"].punten, by["A"].gewonnen, by["A"].gelijk, by["A"].verloren) == (6, 2, 0, 0)
    assert (by["B"].punten, by["B"].gespeeld, by["B"].saldo) == (1, 2, -2)
    assert (by["C"].punten, by["C"].doelpunten_voor, by["C"].doelpunten_tegen) == (1, 1, 4)
    assert volgorde(st) == ["A", "B", "C"]


def test_tiebreak_reglement_punten_dan_gewonnen_dan_saldo():
    # X: 6 pt uit 2 zeges, saldo +1.  Y: 6 pt uit 1 zege + 3 gelijke spelen, saldo +10.
    # Reglement: meer gewonnen wedstrijden gaat vóór doelsaldo, dus X boven Y.
    # Z: 6 pt uit 2 zeges, saldo +5: boven X (zelfde punten en zeges, beter saldo).
    matches = [
        M("X", "P", 1, 0), M("X", "Q", 1, 0), M("R", "X", 1, 0),
        M("Y", "P", 5, 5), M("Y", "Q", 5, 5), M("Y", "R", 5, 5), M("Y", "S", 10, 0),
        M("Z", "P", 3, 0), M("Z", "Q", 2, 0),
    ]
    st = bereken_klassement(matches)
    top = volgorde(st)[:3]
    assert top == ["Z", "X", "Y"]


def test_ploegen_zonder_wedstrijd_krijgen_rij_met_nullen():
    st = bereken_klassement([M("A", "B", 1, 0)], {"R": [(1, "A"), (2, "B"), (3, "C")]})
    assert len(st) == 3  # wedstrijden zonder ploegid koppelen op naam aan de gekende ploegen
    by = {s.ploeg: s for s in st}
    assert by["C"].gespeeld == 0 and by["C"].punten == 0 and by["C"].positie == 2  # saldo 0 boven B (-1)
    assert by["B"].positie == 3
    assert by["A"].ploegid == 1 and by["A"].gewonnen == 1  # ploegid uit de lijst wordt overgenomen


def test_niet_gespeelde_wedstrijden_tellen_niet():
    st = bereken_klassement([M("A", "B", None, None)], {"R": [(1, "A"), (2, "B")]})
    assert all(s.gespeeld == 0 for s in st)


def _fixture_officieel_en_berekend():
    officieel = parse_klassement((FIX / "klassement.html").read_text(encoding="utf-8"))
    results = parse_uitslagen((FIX / "uitslagen.html").read_text(encoding="utf-8"))
    reg = TeamRegistry()
    for s in officieel:
        reg.add(s.ploeg, s.ploegid, s.reeks)
    matches = [
        Match(seizoen="2026-2027", reeks=r.reeks, datum=r.datum, uur=None, thuis=r.thuis, uit=r.uit,
              thuis_id=reg.resolve(r.thuis), uit_id=reg.resolve(r.uit),
              thuis_score=r.thuis_score, uit_score=r.uit_score)
        for r in results
    ]
    ploegen = {}
    for s in officieel:
        ploegen.setdefault(s.reeks, []).append((s.ploegid, s.ploeg))
    return officieel, bereken_klassement(matches, ploegen)


def test_fixture_berekend_klopt_met_officieel():
    officieel, berekend = _fixture_officieel_en_berekend()
    assert len(berekend) == len(officieel) == 92
    v = vergelijk(officieel, berekend)
    assert {r.status for r in v.values()} == {"gelijk"}
    assert all(r.toon_bron == "kavvv" and r.label is None for r in v.values())


def test_officieel_loopt_achter_toont_berekend_als_voorlopig():
    officieel, berekend = _fixture_officieel_en_berekend()
    # officieel nog op nul voor EERSTE AFDELING: alsof de site de uitslagen nog niet verwerkte
    oud = [
        dataclasses.replace(s, gespeeld=0, gewonnen=0, gelijk=0, verloren=0,
                            doelpunten_voor=0, doelpunten_tegen=0, punten=0)
        if s.reeks == "EERSTE AFDELING" else s
        for s in officieel
    ]
    v = vergelijk(oud, berekend)
    eerste = v["EERSTE AFDELING"]
    assert (eerste.status, eerste.toon_bron, eerste.label) == ("officieel_loopt_achter", "berekend", "voorlopig")
    assert eerste.verschillen and all(d.officieel == 0 for d in eerste.verschillen)
    assert v["TWEEDE AFDELING A"].status == "gelijk"


def test_officieel_loopt_voor_toont_officieel():
    officieel, _ = _fixture_officieel_en_berekend()
    leeg = bereken_klassement([], {r: [(s.ploegid, s.ploeg) for s in officieel if s.reeks == r]
                                   for r in {s.reeks for s in officieel}})
    v = vergelijk(officieel, leeg)
    assert {r.status for r in v.values()} == {"officieel_loopt_voor"}
    assert all(r.toon_bron == "kavvv" and r.label is None for r in v.values())


def test_afwijking_toont_officieel_en_meldt_verschil():
    officieel, berekend = _fixture_officieel_en_berekend()
    fout = [dataclasses.replace(s, punten=s.punten + 1) if s.ploeg == "Steca Juniors" else s for s in officieel]
    v = vergelijk(fout, berekend)
    derde_b = v["DERDE AFDELING B"]
    assert (derde_b.status, derde_b.toon_bron) == ("afwijking", "kavvv")
    assert [(d.ploeg, d.veld) for d in derde_b.verschillen] == [("Steca Juniors", "punten")]
