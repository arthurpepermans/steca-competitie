from pathlib import Path

from competition.config import Settings, laad_dotenv


def test_witruimte_en_regeleindes_in_sleutels_worden_genegeerd():
    s = Settings.from_env({
        "SUPABASE_URL": " https://abc.supabase.co/\n",
        "SUPABASE_SERVICE_KEY": "eyJ.abc\n.def \r\n",
        "SYNC_CONTACT": "iemand@example.com",
    })
    assert s.supabase_url == "https://abc.supabase.co"
    assert s.supabase_key == "eyJ.abc.def"
    assert "iemand@example.com" in s.user_agent


def test_lege_sleutels_zijn_none():
    s = Settings.from_env({})
    assert s.supabase_url is None and s.supabase_key is None
    assert s.user_agent.endswith("competitie-sync)")


def test_dotenv_lezer(tmp_path: Path):
    env_bestand = tmp_path / ".env"
    env_bestand.write_text("# commentaar\nSUPABASE_URL='https://x.supabase.co'\nLEEG=\n\nEIGEN_PLOEG=Steca Juniors\n", encoding="utf-8")
    env: dict[str, str] = {"EIGEN_PLOEG": "Al gezet"}
    laad_dotenv(env_bestand, env)
    assert env["SUPABASE_URL"] == "https://x.supabase.co"
    assert env["EIGEN_PLOEG"] == "Al gezet"  # bestaande variabelen winnen
    assert env["LEEG"] == ""
