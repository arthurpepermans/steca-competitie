"""CLI: sync-competition [--dry-run] [--offline MAP] [--no-cache] [--skip-clubs]"""
from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from .config import MODULE_ROOT, Settings, laad_dotenv
from .fetch import FixtureSource, HttpSource
from .supabase_client import MemoryDatabase, SupabaseRest
from .sync import run


def _gebruik_systeemcertificaten() -> None:
    """Laat Python de certificaten van het besturingssysteem vertrouwen.

    Nodig op pc's waar een virusscanner of proxy HTTPS onderschept (bv. Norton): die
    zet zijn eigen root-certificaat in de Windows-store, maar niet in de certifi-bundel
    van Python, waardoor requests anders 'CERTIFICATE_VERIFY_FAILED' geeft.
    """
    try:
        import truststore
    except ImportError:  # optioneel; op GitHub Actions volstaat de gewone bundel
        return
    truststore.inject_into_ssl()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="sync-competition",
        description="Haalt klassement, uitslagen en kalender van kavvv-vb-ov.be en synct naar Supabase.",
    )
    parser.add_argument("--dry-run", action="store_true", help="toon wat er zou wijzigen, schrijf niets")
    parser.add_argument("--offline", metavar="MAP", type=Path,
                        help="lees de pagina's uit een map met HTML (bv. tests/fixtures) in plaats van de site")
    parser.add_argument("--no-cache", action="store_true", help="negeer de schijfcache en haal alles opnieuw op")
    parser.add_argument("--skip-clubs", action="store_true",
                        help="sla de 92 ploegpagina's over (geen terrein/secretariaat-update)")
    parser.add_argument("--env", type=Path, default=MODULE_ROOT / ".env", help="pad naar .env (standaard: .env in de root van de repo)")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        stream=sys.stderr,
    )
    laad_dotenv(args.env)
    settings = Settings.from_env()
    _gebruik_systeemcertificaten()

    source = FixtureSource(args.offline) if args.offline else HttpSource(settings, use_cache=not args.no_cache)

    if settings.supabase_url and settings.supabase_key:
        db = SupabaseRest(settings.supabase_url, settings.supabase_key)
    elif args.dry_run:
        logging.getLogger(__name__).warning(
            "SUPABASE_URL/SUPABASE_SERVICE_KEY niet gezet: dry-run vergelijkt met een lege database")
        db = MemoryDatabase()
    else:
        print("SUPABASE_URL en SUPABASE_SERVICE_KEY zijn verplicht (of gebruik --dry-run)", file=sys.stderr)
        return 2

    return run(settings, source, db, dry_run=args.dry_run, met_clubs=not args.skip_clubs)


if __name__ == "__main__":
    sys.exit(main())
