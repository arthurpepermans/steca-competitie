"""Datamodellen voor klassement, uitslagen, kalender en ploegen."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from .teams import normalize_name


@dataclass(frozen=True)
class Standing:
    reeks: str
    positie: int
    ploeg: str
    ploegid: int | None
    gespeeld: int
    gewonnen: int
    gelijk: int
    verloren: int
    doelpunten_voor: int
    doelpunten_tegen: int
    punten: int

    @property
    def saldo(self) -> int:
        return self.doelpunten_voor - self.doelpunten_tegen

    @property
    def sleutel(self) -> str:
        return str(self.ploegid) if self.ploegid is not None else normalize_name(self.ploeg)


@dataclass(frozen=True)
class Result:
    speeldag: date
    datum: date
    reeks: str
    thuis: str
    uit: str
    thuis_score: int | None
    uit_score: int | None
    opmerking: str = ""

    @property
    def gespeeld(self) -> bool:
        return self.thuis_score is not None and self.uit_score is not None


@dataclass(frozen=True)
class Fixture:
    datum: date
    uur: str | None  # 'HH:MM'
    reeks: str
    thuis: str
    uit: str
    thuis_id: int | None
    uit_id: int | None


@dataclass(frozen=True)
class ClubMatch:
    datum: date
    thuis: str
    uit: str
    thuis_score: int | None
    uit_score: int | None
    uur: str | None
    opmerking: str = ""


@dataclass(frozen=True)
class ClubInfo:
    ploegid: int | None
    clubnummer: str
    naam: str
    afdeling: str
    terrein: str | None
    kleuren: str | None
    secretaris: str | None = None
    secretaris_adres: str | None = None
    tel: str | None = None
    gsm: str | None = None
    email: str | None = None
    verantwoordelijke: str | None = None
    verantwoordelijke_tel: str | None = None
    wegwijzer: str | None = None
    wedstrijden: list[ClubMatch] = field(default_factory=list)


@dataclass(frozen=True)
class Match:
    """Eén wedstrijd, gepland of gespeeld: de rij zoals ze in de app-tabel komt."""

    seizoen: str
    reeks: str
    datum: date | None
    uur: str | None
    thuis: str
    uit: str
    thuis_id: int | None
    uit_id: int | None
    thuis_score: int | None = None
    uit_score: int | None = None
    terrein: str | None = None
    opmerking: str = ""

    @property
    def gespeeld(self) -> bool:
        return self.thuis_score is not None and self.uit_score is not None

    @property
    def status(self) -> str:
        return "gespeeld" if self.gespeeld else "gepland"

    @property
    def key(self) -> str:
        """Stabiele sleutel: elke ploegcombinatie speelt één keer thuis per seizoen."""
        thuis = str(self.thuis_id) if self.thuis_id is not None else normalize_name(self.thuis)
        uit = str(self.uit_id) if self.uit_id is not None else normalize_name(self.uit)
        return f"{self.seizoen}|{thuis}|{uit}"
