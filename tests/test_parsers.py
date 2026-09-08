"""Parsertests: draaien uitsluitend op tests/fixtures, nooit tegen het internet."""
from datetime import date
from pathlib import Path

import pytest

from competition.models import Result, Standing
from competition.parsers import (
    ParseError, parse_club, parse_kalender, parse_klassement, parse_klassement_historie,
    parse_seizoen, parse_uitslagen,
)

FIX = Path(__file__).parent / "fixtures"
REEKSEN = [
    "EERSTE AFDELING", "TWEEDE AFDELING A", "TWEEDE AFDELING B", "DERDE AFDELING A",
    "DERDE AFDELING B", "DERDE AFDELING C", "DERDE AFDELING D", "DERDE AFDELING E",
]


def lees(naam: str) -> str:
    return (FIX / naam).read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def klassement() -> list[Standing]:
    return parse_klassement(lees("klassement.html"))


@pytest.fixture(scope="module")
def uitslagen() -> list[Result]:
    return parse_uitslagen(lees("uitslagen.html"))


@pytest.fixture(scope="module")
def kalender():
    return parse_kalender(lees("kalender.html"))


class TestKlassement:
    def test_alle_reeksen_en_ploegen(self, klassement):
        assert len(klassement) == 92
        assert sorted({s.reeks for s in klassement}) == sorted(REEKSEN)
        assert all(s.ploegid is not None for s in klassement)
        assert len({s.ploegid for s in klassement}) == 92

    def test_eerste_rij(self, klassement):
        assert klassement[0] == Standing(
            reeks="EERSTE AFDELING", positie=1, ploeg="KV SKO Vollezele", ploegid=149,
            gespeeld=1, gewonnen=1, gelijk=0, verloren=0, doelpunten_voor=5, doelpunten_tegen=2, punten=3,
        )

    def test_kolom_v_is_verlies_en_g_is_gelijk(self, klassement):
        depot = next(s for s in klassement if s.ploeg == "FC Depot")  # verloor 1-3
        assert (depot.gewonnen, depot.gelijk, depot.verloren, depot.punten) == (0, 0, 1, 0)
        assert depot.saldo == -2

    def test_steca_juniors(self, klassement):
        steca = next(s for s in klassement if s.ploeg == "Steca Juniors")
        assert steca.ploegid == 152
        assert steca.reeks == "DERDE AFDELING B"

    def test_naam_zonder_trailing_spatie(self, klassement):
        assert next(s for s in klassement if s.ploegid == 11).ploeg == "Dynamo Wijndaal"

    def test_gewijzigde_kolommen_geven_parse_error(self):
        html = lees("klassement.html").replace("<th>Pt.</th>", "<th>Punten</th>")
        with pytest.raises(ParseError, match="onverwachte kolommen"):
            parse_klassement(html)

    def test_ontbrekende_ploegid_link_geeft_parse_error(self):
        html = lees("klassement.html").replace("<a href='index.php?view=club_uniek&ploegid=149'>", "")
        with pytest.raises(ParseError, match="geen ploegid-link"):
            parse_klassement(html)

    def test_lege_pagina(self):
        with pytest.raises(ParseError):
            parse_klassement("<html><body>niks</body></html>")


class TestUitslagen:
    def test_aantallen(self, uitslagen):
        assert len(uitslagen) == 34
        assert all(r.gespeeld for r in uitslagen)
        assert {r.speeldag for r in uitslagen} == {date(2026, 9, 5)}
        assert sorted({r.reeks for r in uitslagen}) == sorted(REEKSEN)

    def test_eerste_rij(self, uitslagen):
        assert uitslagen[0] == Result(
            speeldag=date(2026, 9, 5), datum=date(2026, 9, 5), reeks="EERSTE AFDELING",
            thuis="FC Depot", uit="Dynamo Wijndaal", thuis_score=1, uit_score=3,
        )

    def test_forfait_tekst_blijft_bewaard(self):
        html = """
        <span class='speeldag' id='speeldag-2026-09-12'><i class='material-icons'>expand_more</i>Speeldag 12-09-2026</span>
        <table id='2026-09-12'>
          <tr><td><b>TEST REEKS</b></td></tr>
          <tr><td>A</td><td>-</td><td>B</td><td></td><td>5</td><td>-</td><td>0</td><td>FF</td></tr>
          <tr><td>C</td><td>-</td><td>D</td><td></td><td>ff</td><td>-</td><td></td><td>&nbsp;</td></tr>
        </table>"""
        rows = parse_uitslagen(html)
        assert (rows[0].thuis_score, rows[0].uit_score, rows[0].opmerking) == (5, 0, "FF")
        assert (rows[1].thuis_score, rows[1].uit_score, rows[1].opmerking) == (None, None, "ff")
        assert rows[1].gespeeld is False

    def test_speeldag_kop_moet_bij_id_passen(self):
        html = lees("uitslagen.html").replace("Speeldag 05-09-2026", "Speeldag 06-09-2026")
        with pytest.raises(ParseError, match="past niet bij id"):
            parse_uitslagen(html)

    def test_lege_pagina(self):
        with pytest.raises(ParseError):
            parse_uitslagen("<html><body></body></html>")


class TestKalender:
    def test_aantallen(self, kalender):
        assert len(kalender) == 934
        assert len({f.datum for f in kalender}) == 27
        assert min(f.datum for f in kalender) == date(2026, 9, 12)
        assert max(f.datum for f in kalender) == date(2027, 3, 27)
        assert all(f.thuis_id is not None and f.uit_id is not None for f in kalender)

    def test_kalender_plus_uitslagen_is_volledig_programma(self, kalender, uitslagen, klassement):
        for reeks in REEKSEN:
            n = sum(1 for s in klassement if s.reeks == reeks)
            gepland = sum(1 for f in kalender if f.reeks == reeks)
            gespeeld = sum(1 for r in uitslagen if r.reeks == reeks)
            assert gepland + gespeeld == n * (n - 1), reeks

    def test_eerste_rij(self, kalender):
        f = kalender[0]
        assert (f.datum, f.uur, f.reeks) == (date(2026, 9, 12), "14:00", "EERSTE AFDELING")
        assert (f.thuis, f.thuis_id, f.uit, f.uit_id) == ("KV SKO Vollezele", 149, "Dynamo Wijndaal", 11)

    def test_uur_altijd_hh_mm(self, kalender):
        # de site schrijft soms '15.00'; dat moet '15:00' worden
        assert all(f.uur is not None and len(f.uur) == 5 and f.uur[2] == ":" for f in kalender)
        assert "15.00" in lees("kalender.html")

    def test_zonder_inhoud_geeft_parse_error(self):
        with pytest.raises(ParseError):
            parse_kalender("<html><body><div class='pageContent'></div></body></html>")


class TestClub:
    def test_gegevens(self):
        club = parse_club(lees("club_uniek_149.html"), ploegid=149)
        assert (club.ploegid, club.clubnummer, club.naam, club.afdeling) == (149, "3239", "KV SKO Vollezele", "1")
        assert club.terrein == "Vollezele - Waterstraat 48 B - 1570 Vollezele"
        assert club.kleuren == "groen/wit - Broek:groen"
        assert club.secretaris == "Peeters Jan"
        assert club.secretaris_adres == "Teststraat 12- 9999 Testdorp"
        assert (club.tel, club.gsm, club.email) == ("021234567", "0470000000", "secretariaat@example.com")
        assert (club.verantwoordelijke, club.verantwoordelijke_tel) == ("Janssens Piet", "0480000000")
        assert club.wegwijzer is None

    def test_wedstrijden(self):
        club = parse_club(lees("club_uniek_149.html"), ploegid=149)
        assert len(club.wedstrijden) == 22
        gespeeld = club.wedstrijden[0]
        assert (gespeeld.datum, gespeeld.thuis, gespeeld.uit) == (date(2026, 9, 5), "KV SKO Vollezele", "FC De Leeuwerik")
        assert (gespeeld.thuis_score, gespeeld.uit_score, gespeeld.uur) == (5, 2, None)
        gepland = club.wedstrijden[1]
        assert (gepland.datum, gepland.uur, gepland.thuis_score) == (date(2026, 9, 12), "14:00", None)

    def test_zonder_terrein_geeft_parse_error(self):
        html = lees("club_uniek_149.html").replace("Terrein:", "Veld:")
        with pytest.raises(ParseError, match="Terrein"):
            parse_club(html)


class TestHistorie:
    def test_seizoenen(self):
        h = parse_klassement_historie(lees("klassement_historie.html"))
        assert sorted(h) == ["2021", "2022", "2023", "2024", "2025", "2026"]
        assert len(h["2026"]) == 92
        assert h["2026"][0].ploeg == "Dynamo Wijndaal"
        assert h["2026"][0].punten == 63


def test_seizoen():
    assert parse_seizoen(lees("home.html")) == "2026-2027"
    assert parse_seizoen(lees("klassement.html")) == "2026-2027"
    with pytest.raises(ParseError):
        parse_seizoen("<html></html>")
