"""Pagina's ophalen: één request per pagina, schijfcache, nette User-Agent.

`HttpSource` haalt van de site, `FixtureSource` leest opgeslagen HTML (tests, --offline).
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Protocol

import requests

from .config import Settings

log = logging.getLogger(__name__)


class FetchError(RuntimeError):
    """Pagina kon niet opgehaald worden (netwerk of onverwachte HTTP-status)."""


@dataclass(frozen=True)
class Page:
    naam: str            # klassement | uitslagen | kalender | club_<ploegid>
    url: str
    html: str
    status: int
    fetched_at: datetime
    uit_cache: bool = False


class PageSource(Protocol):
    def klassement(self) -> Page: ...
    def uitslagen(self) -> Page: ...
    def kalender(self) -> Page: ...
    def club(self, ploegid: int) -> Page | None: ...


class HttpSource:
    """Haalt pagina's van de site, met cache op schijf zodat een herhaalde run niets opnieuw opvraagt."""

    def __init__(
        self,
        settings: Settings,
        *,
        ttl: timedelta = timedelta(hours=6),
        club_ttl: timedelta = timedelta(days=6),
        use_cache: bool = True,
        timeout: float = 30.0,
        session: requests.Session | None = None,
    ) -> None:
        self.settings = settings
        self.ttl = ttl
        self.club_ttl = club_ttl
        self.use_cache = use_cache
        self.timeout = timeout
        self.session = session or requests.Session()
        self._laatste_request: float | None = None

    # -- cache ---------------------------------------------------------
    def _cache_paden(self, url: str) -> tuple[Path, Path]:
        h = hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]
        base = self.settings.cache_dir / h
        return base.with_suffix(".html"), base.with_suffix(".json")

    def _uit_cache(self, naam: str, url: str, ttl: timedelta) -> Page | None:
        if not self.use_cache:
            return None
        html_pad, meta_pad = self._cache_paden(url)
        if not (html_pad.is_file() and meta_pad.is_file()):
            return None
        meta = json.loads(meta_pad.read_text(encoding="utf-8"))
        fetched_at = datetime.fromisoformat(meta["fetched_at"])
        if datetime.now(timezone.utc) - fetched_at > ttl:
            return None
        return Page(naam, url, html_pad.read_text(encoding="utf-8"), meta["status"], fetched_at, uit_cache=True)

    def _naar_cache(self, page: Page) -> None:
        html_pad, meta_pad = self._cache_paden(page.url)
        html_pad.parent.mkdir(parents=True, exist_ok=True)
        html_pad.write_text(page.html, encoding="utf-8")
        meta_pad.write_text(json.dumps({
            "url": page.url, "status": page.status, "fetched_at": page.fetched_at.isoformat(),
        }), encoding="utf-8")

    # -- http ----------------------------------------------------------
    def _get(self, naam: str, pad: str, ttl: timedelta, toegestaan: tuple[int, ...] = (200,)) -> Page:
        url = self.settings.base_url + pad
        cached = self._uit_cache(naam, url, ttl)
        if cached is not None:
            log.debug("%s: uit cache (%s)", naam, cached.fetched_at.isoformat())
            return cached
        if self._laatste_request is not None:
            wacht = self.settings.request_delay - (time.monotonic() - self._laatste_request)
            if wacht > 0:
                time.sleep(wacht)
        try:
            resp = self.session.get(
                url,
                headers={"User-Agent": self.settings.user_agent, "Accept-Language": "nl-BE,nl;q=0.9"},
                timeout=self.timeout,
            )
        except requests.RequestException as exc:
            raise FetchError(f"{naam}: {exc}") from exc
        finally:
            self._laatste_request = time.monotonic()
        if resp.status_code not in toegestaan:
            raise FetchError(f"{naam}: HTTP {resp.status_code} voor {url}")
        if not resp.encoding or resp.encoding.lower() == "iso-8859-1":
            resp.encoding = "utf-8"
        page = Page(naam, url, resp.text, resp.status_code, datetime.now(timezone.utc))
        log.info("%s: opgehaald (HTTP %s, %d bytes)", naam, resp.status_code, len(resp.content))
        self._naar_cache(page)
        return page

    def klassement(self) -> Page:
        return self._get("klassement", self.settings.pad_klassement, self.ttl)

    def uitslagen(self) -> Page:
        return self._get("uitslagen", self.settings.pad_uitslagen, self.ttl)

    def kalender(self) -> Page:
        return self._get("kalender", self.settings.pad_kalender, self.ttl)

    def club(self, ploegid: int) -> Page | None:
        # De site geeft op ploegpagina's HTTP 500 terug met wel volledige inhoud; de parser controleert de structuur.
        try:
            return self._get(f"club_{ploegid}", self.settings.pad_club(ploegid), self.club_ttl, toegestaan=(200, 500))
        except FetchError as exc:
            log.warning("ploegpagina %s overgeslagen: %s", ploegid, exc)
            return None


class FixtureSource:
    """Leest pagina's uit een map met opgeslagen HTML (tests/fixtures of een --offline map)."""

    def __init__(self, map_: Path) -> None:
        self.map = Path(map_)

    def _lees(self, naam: str, bestand: str) -> Page | None:
        pad = self.map / bestand
        if not pad.is_file():
            return None
        fetched_at = datetime.fromtimestamp(pad.stat().st_mtime, tz=timezone.utc)
        return Page(naam, f"fixture:{bestand}", pad.read_text(encoding="utf-8"), 200, fetched_at, uit_cache=True)

    def _verplicht(self, naam: str, bestand: str) -> Page:
        page = self._lees(naam, bestand)
        if page is None:
            raise FetchError(f"{naam}: fixture {self.map / bestand} ontbreekt")
        return page

    def klassement(self) -> Page:
        return self._verplicht("klassement", "klassement.html")

    def uitslagen(self) -> Page:
        return self._verplicht("uitslagen", "uitslagen.html")

    def kalender(self) -> Page:
        return self._verplicht("kalender", "kalender.html")

    def club(self, ploegid: int) -> Page | None:
        return self._lees(f"club_{ploegid}", f"club_uniek_{ploegid}.html")
