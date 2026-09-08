"""Normalisatie van ploegnamen en koppeling naam -> ploegid."""
from __future__ import annotations

import re
import unicodedata


def normalize_name(naam: str) -> str:
    s = unicodedata.normalize("NFKC", naam)
    s = re.sub(r"\s+", " ", s).strip()
    return s.casefold()


class TeamRegistry:
    """Bekende ploegen (uit klassement en kalender, die wel ploegid-links hebben)."""

    def __init__(self) -> None:
        self._id_by_name: dict[str, int] = {}
        self._name_by_id: dict[int, str] = {}
        self._reeks_by_id: dict[int, str] = {}
        self.conflicten: list[tuple[str, int, int]] = []

    def add(self, naam: str, ploegid: int | None, reeks: str | None = None) -> None:
        if ploegid is None:
            return
        key = normalize_name(naam)
        bestaand = self._id_by_name.get(key)
        if bestaand is not None and bestaand != ploegid:
            self.conflicten.append((naam, bestaand, ploegid))
            return
        self._id_by_name[key] = ploegid
        self._name_by_id.setdefault(ploegid, " ".join(naam.split()))
        if reeks:
            self._reeks_by_id[ploegid] = reeks

    def resolve(self, naam: str) -> int | None:
        return self._id_by_name.get(normalize_name(naam))

    def naam(self, ploegid: int) -> str | None:
        return self._name_by_id.get(ploegid)

    def reeks(self, ploegid: int) -> str | None:
        return self._reeks_by_id.get(ploegid)

    def ids(self) -> list[int]:
        return list(self._name_by_id)

    def __len__(self) -> int:
        return len(self._name_by_id)
