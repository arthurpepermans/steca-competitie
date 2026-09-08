"""Parsers voor de HTML-pagina's van kavvv-vb-ov.be.

Elke parser krijgt een HTML-string en gooit ParseError zodra de verwachte
structuur ontbreekt, zodat een sitewijziging niet stil tot lege data leidt.
"""
from __future__ import annotations

import re
from datetime import date

from bs4 import BeautifulSoup, Tag

from .models import ClubInfo, ClubMatch, Fixture, Result, Standing

HTML_PARSER = "lxml"

KLASSEMENT_KOLOMMEN = ["Pos.", "Team", "Gesp", "W", "V", "G", "DV", "DT", "Pt."]

_PLOEGID_RE = re.compile(r"ploegid=(\d+)")
_ISO_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_DMY_DATE_RE = re.compile(r"^(\d{2})-(\d{2})-(\d{4})$")
_UUR_RE = re.compile(r"^(\d{1,2})[:.hu](\d{2})$")  # site gebruikt '15:00' maar ook '15.00'
_SPEELDAG_KOP_RE = re.compile(r"Speeldag (\d{2}-\d{2}-\d{4})")
_SEIZOEN_RE = re.compile(r"Seizoen\s+(\d{4}-\d{4})")
_KAL_DATE_RE = re.compile(
    r"^(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\s+"
    r"(\d{1,2})\s+([a-z]+)\s+(\d{4})$",
    re.IGNORECASE,
)
_MAANDEN = {
    "januari": 1, "februari": 2, "maart": 3, "april": 4, "mei": 5, "juni": 6,
    "juli": 7, "augustus": 8, "september": 9, "oktober": 10, "november": 11,
    "december": 12,
}
_TEL_RE = re.compile(r"^Tel:\s*(.*?)\s*-\s*Gsm:\s*(.*?)\s*E-mail:\s*(.*)$", re.IGNORECASE)
_VERANTW_RE = re.compile(r"^Naam Verantwoordelijke:\s*(.*?)\s*-\s*Tel Verantwoordelijke:\s*(.*)$", re.IGNORECASE)


class ParseError(ValueError):
    """De HTML heeft niet de verwachte structuur (site gewijzigd?)."""


# ---------------------------------------------------------------- helpers

def _soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, HTML_PARSER)


def _text(tag: Tag | None) -> str:
    if tag is None:
        return ""
    return " ".join(tag.get_text(" ", strip=True).split())


def _int(text: str, what: str) -> int:
    try:
        return int(text)
    except ValueError as exc:
        raise ParseError(f"{what}: geen geheel getal: {text!r}") from exc


def _int_or_none(text: str) -> int | None:
    text = text.strip()
    return int(text) if text.isdigit() else None


def _ploegid(tag: Tag | None) -> int | None:
    if tag is None:
        return None
    a = tag if tag.name == "a" else tag.find("a")
    if a is None:
        return None
    m = _PLOEGID_RE.search(a.get("href", ""))
    return int(m.group(1)) if m else None


def _dmy(text: str, what: str) -> date:
    m = _DMY_DATE_RE.match(text.strip())
    if not m:
        raise ParseError(f"{what}: geen datum DD-MM-JJJJ: {text!r}")
    d, mo, y = (int(g) for g in m.groups())
    return date(y, mo, d)


def _uur_or_none(text: str) -> str | None:
    """'15:00', '15.00' of '15u00' -> '15:00'; anders None."""
    m = _UUR_RE.match(text.strip())
    return f"{int(m.group(1)):02d}:{m.group(2)}" if m else None


def _own_rows(table: Tag) -> list[Tag]:
    """Rijen van deze tabel, zonder rijen van geneste tabellen."""
    return [tr for tr in table.find_all("tr") if tr.find_parent("table") is table]


def _own_cells(tr: Tag) -> list[Tag]:
    return [td for td in tr.find_all("td") if td.find_parent("tr") is tr]


def _split_score(rest: list[str]) -> tuple[int | None, int | None, str | None, str]:
    """Cellen na 'thuis - uit': ['', hg, '-', ag, opm...] als gespeeld, anders ['', uur].

    Geeft (thuis_score, uit_score, uur, opmerking). Niet-numerieke scorecellen
    (bv. een forfait-aanduiding) blijven bewaard in de opmerking.
    """
    if len(rest) >= 4 and rest[2] == "-":
        thuis, uit = _int_or_none(rest[1]), _int_or_none(rest[3])
        extra = [x for x in rest[4:] if x]
        if thuis is None or uit is None:
            extra = [x for x in (rest[1], rest[3]) if x] + extra
        return thuis, uit, None, " ".join(extra)
    uur = _uur_or_none(rest[-1]) if rest else None
    overige = rest[:-1] if uur is not None else rest
    return None, None, uur, " ".join(x for x in overige if x)


# ----------------------------------------------------------------- seizoen

def parse_seizoen(html: str) -> str:
    """Seizoenlabel uit de navigatie ('Seizoen 2026-2027'), aanwezig op elke pagina."""
    m = _SEIZOEN_RE.search(html)
    if not m:
        raise ParseError("geen 'Seizoen JJJJ-JJJJ' in de navigatie gevonden")
    return m.group(1)


# ------------------------------------------------------------- klassement

def _parse_standing_rows(table: Tag, reeks: str, *, ploegid_verplicht: bool) -> list[Standing]:
    header = [_text(th) for th in table.find_all("th")]
    if header != KLASSEMENT_KOLOMMEN:
        raise ParseError(f"klassement {reeks}: onverwachte kolommen {header}")
    rows: list[Standing] = []
    for tr in _own_rows(table):
        tds = _own_cells(tr)
        if not tds:
            continue  # kopregel met th
        if len(tds) != len(KLASSEMENT_KOLOMMEN):
            raise ParseError(f"klassement {reeks}: rij met {len(tds)} cellen: {_text(tr)!r}")
        t = [_text(td) for td in tds]
        ploegid = _ploegid(tds[1])
        if ploegid is None and ploegid_verplicht:
            raise ParseError(f"klassement {reeks}: geen ploegid-link voor {t[1]!r}")
        rows.append(Standing(
            reeks=reeks,
            positie=_int(t[0], "positie"),
            ploeg=t[1],
            ploegid=ploegid,
            gespeeld=_int(t[2], "gespeeld"),
            gewonnen=_int(t[3], "gewonnen"),
            verloren=_int(t[4], "verloren"),  # kolom V = verlies
            gelijk=_int(t[5], "gelijk"),      # kolom G = gelijk
            doelpunten_voor=_int(t[6], "doelpunten voor"),
            doelpunten_tegen=_int(t[7], "doelpunten tegen"),
            punten=_int(t[8], "punten"),
        ))
    if not rows:
        raise ParseError(f"klassement {reeks}: geen rijen")
    return rows


def parse_klassement(html: str) -> list[Standing]:
    """index.php?view=klassement_db&id=7: alle reeksen, met ploegid-links."""
    soup = _soup(html)
    labels = [s for s in soup.select("span.label") if _text(s).startswith("Klassement ")]
    if not labels:
        raise ParseError("geen 'Klassement <reeks>'-koppen gevonden")
    out: list[Standing] = []
    for label in labels:
        reeks = _text(label)[len("Klassement "):].strip()
        table = label.find_next("table")
        if table is None:
            raise ParseError(f"klassement {reeks}: geen tabel na de kop")
        out.extend(_parse_standing_rows(table, reeks, ploegid_verplicht=True))
    return out


def parse_klassement_historie(html: str) -> dict[str, list[Standing]]:
    """index.php?view=klassement_historie&id=181: eindklassementen per seizoen (zonder ploegid)."""
    soup = _soup(html)
    content = soup.select_one("div.pageContent")
    if content is None:
        raise ParseError("historie: geen div.pageContent")
    out: dict[str, list[Standing]] = {}
    seizoen: str | None = None
    reeks: str | None = None
    for el in content.find_all(["b", "table"]):
        if el.name == "b":
            txt = _text(el)
            if txt.startswith("Seizoen"):
                seizoen = txt[len("Seizoen"):].strip()
            elif txt.startswith("Klassement "):
                reeks = txt[len("Klassement "):].strip()
            continue
        if el.find("th") is None:
            continue  # lay-out tabel van het CMS (table#cms_table), geen klassement
        if seizoen is None or reeks is None:
            raise ParseError("historie: tabel zonder seizoen/reeks-kop")
        out.setdefault(seizoen, []).extend(_parse_standing_rows(el, reeks, ploegid_verplicht=False))
    if not out:
        raise ParseError("historie: geen klassementen gevonden")
    return out


# -------------------------------------------------------------- uitslagen

def parse_uitslagen(html: str) -> list[Result]:
    """index.php?view=uitslagen_db&id=6: per speeldag, per reeks, gespeelde wedstrijden."""
    soup = _soup(html)
    spans = soup.select("span.speeldag")
    if not spans:
        raise ParseError("uitslagen: geen span.speeldag gevonden")
    out: list[Result] = []
    for span in spans:
        span_id = span.get("id", "")
        if not span_id.startswith("speeldag-") or not _ISO_DATE_RE.match(span_id[9:]):
            raise ParseError(f"uitslagen: onverwacht speeldag-id {span_id!r}")
        speeldag = date.fromisoformat(span_id[9:])
        kop = _SPEELDAG_KOP_RE.search(_text(span))  # tekst bevat ook de icoon-naam 'expand_more'
        if kop is None or _dmy(kop.group(1), "speeldag-kop") != speeldag:
            raise ParseError(f"uitslagen: speeldag-kop {_text(span)!r} past niet bij id {span_id!r}")
        table = soup.find("table", id=span_id[9:])
        if table is None:
            raise ParseError(f"uitslagen: geen tabel voor speeldag {speeldag}")
        reeks: str | None = None
        for tr in _own_rows(table):
            tds = _own_cells(tr)
            if len(tds) == 1 and tds[0].find("b") is not None:
                reeks = _text(tds[0])
                continue
            if not tds:
                continue
            t = [_text(td) for td in tds]
            if len(t) < 3 or t[1] != "-":
                raise ParseError(f"uitslagen {speeldag}: onverwachte rij {t}")
            if reeks is None:
                raise ParseError(f"uitslagen {speeldag}: wedstrijd zonder reeks-kop: {t}")
            thuis_score, uit_score, _uur, opmerking = _split_score(t[3:])
            out.append(Result(
                speeldag=speeldag, datum=speeldag, reeks=reeks,
                thuis=t[0], uit=t[2],
                thuis_score=thuis_score, uit_score=uit_score, opmerking=opmerking,
            ))
    return out


# --------------------------------------------------------------- kalender

def _kal_date(text: str) -> date | None:
    m = _KAL_DATE_RE.match(text)
    if not m:
        return None
    maand = _MAANDEN.get(m.group(2).lower())
    if maand is None:
        raise ParseError(f"kalender: onbekende maand in {text!r}")
    return date(int(m.group(3)), maand, int(m.group(1)))


def parse_kalender(html: str) -> list[Fixture]:
    """index.php?view=kalender_db&id=5: per datum, per reeks, nog te spelen wedstrijden (met ploegid-links)."""
    soup = _soup(html)
    content = soup.select_one("div.pageContent")
    if content is None:
        raise ParseError("kalender: geen div.pageContent")
    out: list[Fixture] = []
    datum: date | None = None
    reeks: str | None = None
    for el in content.find_all(["center", "table"]):
        if el.name == "center":
            txt = _text(el)
            if not txt:
                continue
            d = _kal_date(txt)
            if d is not None:
                datum = d
            else:
                reeks = txt
            continue
        if datum is None or reeks is None:
            raise ParseError("kalender: tabel zonder datum/reeks-kop")
        for tr in _own_rows(el):
            tds = _own_cells(tr)
            if not tds:
                continue
            t = [_text(td) for td in tds]
            if len(t) < 5 or t[3] != "-":
                raise ParseError(f"kalender {datum} {reeks}: onverwachte rij {t}")
            out.append(Fixture(
                datum=datum, uur=_uur_or_none(t[0]), reeks=reeks,
                thuis=t[2], uit=t[4],
                thuis_id=_ploegid(tds[2]), uit_id=_ploegid(tds[4]),
            ))
    if not out:
        raise ParseError("kalender: geen wedstrijden gevonden")
    return out


# ------------------------------------------------------------- ploegpagina

def _schoon(val: str | None) -> str | None:
    if val is None:
        return None
    val = val.strip(" -")
    return val or None


def _splits_naam_adres(val: str) -> tuple[str | None, str | None]:
    """'Peeters Jan - Teststraat 12- 9999 Testdorp' -> naam, adres."""
    naam, sep, adres = val.partition(" - ")
    if not sep:
        return _schoon(val), None
    return _schoon(naam), _schoon(adres)


def parse_club(html: str, ploegid: int | None = None) -> ClubInfo:
    """index.php?view=club_uniek&ploegid=NN: clubgegevens, terrein, secretariaat, eigen kalender/uitslagen.

    Let op: de site antwoordt op deze pagina met HTTP 500 maar levert wel de volledige inhoud.
    """
    soup = _soup(html)
    kop = soup.select_one("div.row-even")
    if kop is None:
        raise ParseError("club: geen kopregel (div.row-even)")
    kopcellen = [_text(d) for d in kop.find_all("div", recursive=False)]
    if len(kopcellen) < 3:
        raise ParseError(f"club: kopregel onvolledig {kopcellen}")

    velden: dict[str, str | None] = {}
    for div in soup.select("div.firstLine div.col-md-12"):
        txt = _text(div)
        if txt.startswith("Secretariaat:"):
            velden["secretaris"], velden["secretaris_adres"] = _splits_naam_adres(txt[len("Secretariaat:"):])
        elif txt.startswith("Tel:"):
            m = _TEL_RE.match(txt)
            if m:
                velden["tel"], velden["gsm"], velden["email"] = (_schoon(g) for g in m.groups())
            else:
                velden["tel"] = _schoon(txt[len("Tel:"):])
        elif txt.startswith("Naam Verantwoordelijke:"):
            m = _VERANTW_RE.match(txt)
            if m:
                velden["verantwoordelijke"], velden["verantwoordelijke_tel"] = (_schoon(g) for g in m.groups())
            else:
                velden["verantwoordelijke"] = _schoon(txt[len("Naam Verantwoordelijke:"):])
        elif txt.startswith("Kleuren Trui:"):
            velden["kleuren"] = _schoon(txt[len("Kleuren Trui:"):])
        elif txt.startswith("Terrein:"):
            velden["terrein"] = _schoon(txt[len("Terrein:"):])
        elif txt.startswith("Wegwijzer:"):
            velden["wegwijzer"] = _schoon(txt[len("Wegwijzer:"):])
    if "terrein" not in velden:
        raise ParseError("club: geen 'Terrein:'-regel gevonden")

    table = None
    for tb in soup.select("table.table-striped"):
        if "KALENDER/UITSLAGEN" in _text(tb):
            table = tb
            break
    if table is None:
        raise ParseError("club: geen KALENDER/UITSLAGEN-tabel")
    wedstrijden: list[ClubMatch] = []
    for tr in _own_rows(table):
        tds = _own_cells(tr)
        if not tds:
            continue
        t = [_text(td) for td in tds]
        if len(t) < 4 or t[2] != "-":
            raise ParseError(f"club: onverwachte wedstrijdrij {t}")
        thuis_score, uit_score, uur, opmerking = _split_score(t[4:])
        wedstrijden.append(ClubMatch(
            datum=_dmy(t[0], "club wedstrijddatum"), thuis=t[1], uit=t[3],
            thuis_score=thuis_score, uit_score=uit_score, uur=uur, opmerking=opmerking,
        ))
    return ClubInfo(
        ploegid=ploegid, clubnummer=kopcellen[0], naam=kopcellen[1], afdeling=kopcellen[2],
        terrein=velden.get("terrein"), kleuren=velden.get("kleuren"),
        secretaris=velden.get("secretaris"), secretaris_adres=velden.get("secretaris_adres"),
        tel=velden.get("tel"), gsm=velden.get("gsm"), email=velden.get("email"),
        verantwoordelijke=velden.get("verantwoordelijke"),
        verantwoordelijke_tel=velden.get("verantwoordelijke_tel"),
        wegwijzer=velden.get("wegwijzer"),
        wedstrijden=wedstrijden,
    )
