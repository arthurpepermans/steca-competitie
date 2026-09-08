"""Klassement berekenen uit uitslagen en vergelijken met het officiële klassement.

Rangschikking volgens reglement art. 159: 1) meeste punten, 2) meeste gewonnen
wedstrijden, 3) doelpuntensaldo. Daarna, alleen om een vaste volgorde te
garanderen (buiten het reglement): doelpunten voor, dan ploegnaam.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

from .models import Match, Standing
from .teams import normalize_name

PUNTEN_WINST = 3
PUNTEN_GELIJK = 1
PUNTEN_VERLIES = 0

VERGELIJK_VELDEN = (
    "gespeeld", "gewonnen", "gelijk", "verloren", "doelpunten_voor", "doelpunten_tegen", "punten",
)


@dataclass
class _Telling:
    ploegid: int | None
    naam: str
    gespeeld: int = 0
    gewonnen: int = 0
    gelijk: int = 0
    verloren: int = 0
    doelpunten_voor: int = 0
    doelpunten_tegen: int = 0

    @property
    def punten(self) -> int:
        return self.gewonnen * PUNTEN_WINST + self.gelijk * PUNTEN_GELIJK + self.verloren * PUNTEN_VERLIES

    @property
    def saldo(self) -> int:
        return self.doelpunten_voor - self.doelpunten_tegen

    def verwerk(self, voor: int, tegen: int) -> None:
        self.gespeeld += 1
        self.doelpunten_voor += voor
        self.doelpunten_tegen += tegen
        if voor > tegen:
            self.gewonnen += 1
        elif voor == tegen:
            self.gelijk += 1
        else:
            self.verloren += 1


def bereken_klassement(
    matches: Iterable[Match],
    ploegen_per_reeks: dict[str, list[tuple[int | None, str]]] | None = None,
) -> list[Standing]:
    """Klassement per reeks uit gespeelde wedstrijden.

    `ploegen_per_reeks` (uit het officiële klassement) zorgt dat ploegen zonder
    gespeelde wedstrijd ook een rij krijgen.
    """
    # per reeks: tellingen, opzoekbaar op ploegid én op genormaliseerde naam
    tellingen: dict[str, list[_Telling]] = {}
    op_id: dict[str, dict[int, _Telling]] = {}
    op_naam: dict[str, dict[str, _Telling]] = {}

    def vind(reeks: str, ploegid: int | None, naam: str) -> _Telling:
        t = None
        if ploegid is not None:
            t = op_id.setdefault(reeks, {}).get(ploegid)
        if t is None:
            t = op_naam.setdefault(reeks, {}).get(normalize_name(naam))
        if t is None:
            t = _Telling(ploegid, naam)
            tellingen.setdefault(reeks, []).append(t)
            op_naam[reeks][normalize_name(naam)] = t
        if ploegid is not None:
            op_id[reeks][ploegid] = t
            if t.ploegid is None:
                t.ploegid = ploegid
        return t

    for reeks, ploegen in (ploegen_per_reeks or {}).items():
        for ploegid, naam in ploegen:
            vind(reeks, ploegid, naam)
    for m in matches:
        if not m.gespeeld:
            continue
        thuis = vind(m.reeks, m.thuis_id, m.thuis)
        uit = vind(m.reeks, m.uit_id, m.uit)
        thuis.verwerk(m.thuis_score, m.uit_score)  # type: ignore[arg-type]
        uit.verwerk(m.uit_score, m.thuis_score)  # type: ignore[arg-type]

    out: list[Standing] = []
    for reeks, per_ploeg in tellingen.items():
        volgorde = sorted(
            per_ploeg,
            key=lambda t: (-t.punten, -t.gewonnen, -t.saldo, -t.doelpunten_voor, normalize_name(t.naam)),
        )
        for positie, t in enumerate(volgorde, start=1):
            out.append(Standing(
                reeks=reeks, positie=positie, ploeg=t.naam, ploegid=t.ploegid,
                gespeeld=t.gespeeld, gewonnen=t.gewonnen, gelijk=t.gelijk, verloren=t.verloren,
                doelpunten_voor=t.doelpunten_voor, doelpunten_tegen=t.doelpunten_tegen,
                punten=t.punten,
            ))
    return out


@dataclass(frozen=True)
class Verschil:
    ploeg: str
    veld: str
    officieel: int | None
    berekend: int | None


@dataclass
class ReeksVergelijking:
    reeks: str
    status: str            # gelijk | officieel_loopt_achter | officieel_loopt_voor | afwijking
    toon_bron: str         # kavvv | berekend
    label: str | None      # 'voorlopig' of None
    verschillen: list[Verschil] = field(default_factory=list)


def vergelijk(officieel: list[Standing], berekend: list[Standing]) -> dict[str, ReeksVergelijking]:
    """Per reeks: is het officiële klassement actueel, en welk klassement toont de app?

    Vergeleken worden de cijfers per ploeg (gespeeld, W, G, V, DV, DT, punten), niet de
    positie: bij gelijke cijfers geldt het officiële klassement, ook als de site een
    andere tie-break toepast dan het reglement.
    """
    reeksen = sorted({s.reeks for s in officieel} | {s.reeks for s in berekend})
    out: dict[str, ReeksVergelijking] = {}
    for reeks in reeksen:
        off = {s.sleutel: s for s in officieel if s.reeks == reeks}
        ber = {s.sleutel: s for s in berekend if s.reeks == reeks}
        verschillen: list[Verschil] = []
        for key in sorted(set(off) | set(ber)):
            o, b = off.get(key), ber.get(key)
            if o is None or b is None:
                naam = (o or b).ploeg  # type: ignore[union-attr]
                verschillen.append(Verschil(naam, "ontbreekt", o and o.gespeeld, b and b.gespeeld))
                continue
            for veld in VERGELIJK_VELDEN:
                if getattr(o, veld) != getattr(b, veld):
                    verschillen.append(Verschil(o.ploeg, veld, getattr(o, veld), getattr(b, veld)))
        if not verschillen:
            out[reeks] = ReeksVergelijking(reeks, "gelijk", "kavvv", None)
            continue
        gemeenschappelijk = set(off) & set(ber)
        off_gesp = sum(off[k].gespeeld for k in gemeenschappelijk)
        ber_gesp = sum(ber[k].gespeeld for k in gemeenschappelijk)
        achter = ber_gesp > off_gesp and all(ber[k].gespeeld >= off[k].gespeeld for k in gemeenschappelijk)
        voor = off_gesp > ber_gesp and all(off[k].gespeeld >= ber[k].gespeeld for k in gemeenschappelijk)
        if achter and set(off) == set(ber):
            out[reeks] = ReeksVergelijking(reeks, "officieel_loopt_achter", "berekend", "voorlopig", verschillen)
        elif voor:
            out[reeks] = ReeksVergelijking(reeks, "officieel_loopt_voor", "kavvv", None, verschillen)
        else:
            out[reeks] = ReeksVergelijking(reeks, "afwijking", "kavvv", None, verschillen)
    return out
