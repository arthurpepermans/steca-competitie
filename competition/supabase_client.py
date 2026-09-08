"""Minimale Supabase-client via de PostgREST-API, plus een in-memory variant voor tests en dry-runs."""
from __future__ import annotations

import copy
import logging
from typing import Any, Protocol

import requests

log = logging.getLogger(__name__)

Row = dict[str, Any]


class SupabaseError(RuntimeError):
    pass


class Database(Protocol):
    def select(self, tabel: str, kolommen: str = "*") -> list[Row]: ...
    def upsert(self, tabel: str, rijen: list[Row], on_conflict: list[str]) -> None: ...


class SupabaseRest:
    """Leest en schrijft via {url}/rest/v1 met de service-role key (omzeilt RLS; alleen server-side)."""

    def __init__(self, url: str, service_key: str, *, session: requests.Session | None = None,
                 page_size: int = 1000, batch_size: int = 500, timeout: float = 60.0) -> None:
        self.url = url.rstrip("/")
        self.session = session or requests.Session()
        self.session.headers.update({
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        })
        self.page_size = page_size
        self.batch_size = batch_size
        self.timeout = timeout

    def _check(self, resp: requests.Response, wat: str) -> None:
        if resp.status_code >= 300:
            raise SupabaseError(f"{wat}: HTTP {resp.status_code}: {resp.text[:500]}")

    def select(self, tabel: str, kolommen: str = "*") -> list[Row]:
        out: list[Row] = []
        start = 0
        while True:
            resp = self.session.get(
                f"{self.url}/rest/v1/{tabel}",
                params={"select": kolommen},
                headers={"Range-Unit": "items", "Range": f"{start}-{start + self.page_size - 1}"},
                timeout=self.timeout,
            )
            if resp.status_code == 416:  # range buiten bereik: niets meer
                break
            self._check(resp, f"select {tabel}")
            batch = resp.json()
            out.extend(batch)
            if len(batch) < self.page_size:
                break
            start += self.page_size
        return out

    def upsert(self, tabel: str, rijen: list[Row], on_conflict: list[str]) -> None:
        for i in range(0, len(rijen), self.batch_size):
            batch = rijen[i:i + self.batch_size]
            resp = self.session.post(
                f"{self.url}/rest/v1/{tabel}",
                params={"on_conflict": ",".join(on_conflict)},
                headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
                json=batch,
                timeout=self.timeout,
            )
            self._check(resp, f"upsert {tabel}")
            log.debug("upsert %s: %d rijen", tabel, len(batch))


class MemoryDatabase:
    """In-memory database met dezelfde interface; bootst ook de manual_override-trigger na."""

    def __init__(self) -> None:
        self.tabellen: dict[str, dict[tuple, Row]] = {}
        self.upserts: list[tuple[str, int]] = []

    def select(self, tabel: str, kolommen: str = "*") -> list[Row]:
        return [copy.deepcopy(r) for r in self.tabellen.get(tabel, {}).values()]

    def upsert(self, tabel: str, rijen: list[Row], on_conflict: list[str]) -> None:
        opslag = self.tabellen.setdefault(tabel, {})
        for rij in rijen:
            key = tuple(rij[k] for k in on_conflict)
            bestaand = opslag.get(key)
            if bestaand is not None and bestaand.get("manual_override"):
                continue  # zoals de databasetrigger: handmatig gecorrigeerde rijen blijven staan
            if bestaand is None:
                opslag[key] = copy.deepcopy(rij)
            else:
                bestaand.update(copy.deepcopy(rij))
        self.upserts.append((tabel, len(rijen)))
