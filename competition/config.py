"""Instellingen uit omgevingsvariabelen (en optioneel een .env-bestand)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

MODULE_ROOT = Path(__file__).resolve().parents[1]


def laad_dotenv(pad: Path, env: dict[str, str] | None = None) -> None:
    """Eenvoudige .env-lezer (KEY=value, # commentaar). Bestaande variabelen winnen."""
    doel = os.environ if env is None else env
    if not pad.is_file():
        return
    for regel in pad.read_text(encoding="utf-8").splitlines():
        regel = regel.strip()
        if not regel or regel.startswith("#") or "=" not in regel:
            continue
        key, _, val = regel.partition("=")
        key, val = key.strip(), val.strip().strip("'\"")
        doel.setdefault(key, val)


@dataclass
class Settings:
    base_url: str = "https://www.kavvv-vb-ov.be/"
    klassement_id: int = 7
    uitslagen_id: int = 6
    kalender_id: int = 5
    contact: str = ""                 # e-mail of URL die in de User-Agent meegaat
    supabase_url: str | None = None
    supabase_key: str | None = None   # service-role key: alleen server-side gebruiken
    cache_dir: Path = MODULE_ROOT / ".cache"
    incoming_dir: Path = MODULE_ROOT / "tests" / "fixtures" / "incoming"
    eigen_ploeg: str = "Steca Juniors"
    request_delay: float = 0.5

    @property
    def user_agent(self) -> str:
        ua = "StecaJuniorsCompetitionSync/1.0 (kavvv-vb-ov.be competitie-sync"
        return f"{ua}; contact: {self.contact})" if self.contact else f"{ua})"

    @property
    def pad_klassement(self) -> str:
        return f"index.php?view=klassement_db&id={self.klassement_id}"

    @property
    def pad_uitslagen(self) -> str:
        return f"index.php?view=uitslagen_db&id={self.uitslagen_id}"

    @property
    def pad_kalender(self) -> str:
        return f"index.php?view=kalender_db&id={self.kalender_id}"

    @staticmethod
    def pad_club(ploegid: int) -> str:
        return f"index.php?view=club_uniek&ploegid={ploegid}"

    @classmethod
    def from_env(cls, env: dict[str, str] | None = None) -> "Settings":
        e = os.environ if env is None else env
        s = cls()
        s.base_url = e.get("KAVVV_BASE_URL", s.base_url)
        if not s.base_url.endswith("/"):
            s.base_url += "/"
        s.klassement_id = int(e.get("KAVVV_KLASSEMENT_ID", s.klassement_id))
        s.uitslagen_id = int(e.get("KAVVV_UITSLAGEN_ID", s.uitslagen_id))
        s.kalender_id = int(e.get("KAVVV_KALENDER_ID", s.kalender_id))
        s.contact = e.get("SYNC_CONTACT", s.contact)
        s.supabase_url = e.get("SUPABASE_URL") or None
        s.supabase_key = e.get("SUPABASE_SERVICE_KEY") or None
        s.cache_dir = Path(e.get("SYNC_CACHE_DIR", s.cache_dir))
        s.incoming_dir = Path(e.get("SYNC_INCOMING_DIR", s.incoming_dir))
        s.eigen_ploeg = e.get("EIGEN_PLOEG", s.eigen_ploeg)
        s.request_delay = float(e.get("SYNC_REQUEST_DELAY", s.request_delay))
        return s
