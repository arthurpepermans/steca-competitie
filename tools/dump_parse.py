"""Eerste parse-output op de fixtures: samenvatting + voorbeelden."""
from __future__ import annotations

import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from competition.parsers import (  # noqa: E402
    parse_club, parse_kalender, parse_klassement, parse_klassement_historie, parse_uitslagen,
)
from competition.teams import TeamRegistry  # noqa: E402

FIX = Path(__file__).resolve().parents[1] / "tests" / "fixtures"


def read(name: str) -> str:
    return (FIX / name).read_text(encoding="utf-8")


standings = parse_klassement(read("klassement.html"))
results = parse_uitslagen(read("uitslagen.html"))
fixtures = parse_kalender(read("kalender.html"))
club = parse_club(read("club_uniek_149.html"), ploegid=149)
historie = parse_klassement_historie(read("klassement_historie.html"))

print("== KLASSEMENT:", len(standings), "rijen;", dict(Counter(s.reeks for s in standings)))
for s in standings[:4]:
    print("  ", s)
print("   zonder ploegid:", [s.ploeg for s in standings if s.ploegid is None])

print("\n== UITSLAGEN:", len(results), "wedstrijden;", dict(Counter(str(r.speeldag) for r in results)))
print("   per reeks:", dict(Counter(r.reeks for r in results)))
for r in results[:3]:
    print("  ", r)
print("   zonder score:", [(r.thuis, r.uit) for r in results if not r.gespeeld])
print("   opmerkingen:", dict(Counter(r.opmerking for r in results)))

print("\n== KALENDER:", len(fixtures), "wedstrijden;", len({f.datum for f in fixtures}), "speeldagen",
      min(f.datum for f in fixtures), "->", max(f.datum for f in fixtures))
print("   per reeks:", dict(Counter(f.reeks for f in fixtures)))
for f in fixtures[:3]:
    print("  ", f)
print("   zonder uur:", sum(1 for f in fixtures if f.uur is None),
      "| zonder ploegid:", sum(1 for f in fixtures if f.thuis_id is None or f.uit_id is None))

print("\n== CLUB 149:", club.clubnummer, club.naam, "afd", club.afdeling, "| terrein:", club.terrein,
      "| kleuren:", club.kleuren)
print("   wedstrijden:", len(club.wedstrijden), "gespeeld:",
      sum(1 for w in club.wedstrijden if w.thuis_score is not None))
for w in club.wedstrijden[:3]:
    print("  ", w)

print("\n== HISTORIE:", {k: len(v) for k, v in historie.items()})

# Naam -> ploegid koppeling
reg = TeamRegistry()
for s in standings:
    reg.add(s.ploeg, s.ploegid, s.reeks)
for f in fixtures:
    reg.add(f.thuis, f.thuis_id, f.reeks)
    reg.add(f.uit, f.uit_id, f.reeks)
print("\n== TEAMS:", len(reg), "ploegen; conflicten:", reg.conflicten)
onbekend = sorted({n for r in results for n in (r.thuis, r.uit) if reg.resolve(n) is None})
print("   uitslag-namen zonder ploegid:", onbekend)
mism = [(r.reeks, r.thuis, reg.reeks(reg.resolve(r.thuis))) for r in results
        if reg.resolve(r.thuis) and reg.reeks(reg.resolve(r.thuis)) != r.reeks]
print("   reeks-mismatch uitslag vs klassement:", mism)

# Tie-break check op de historiek: welke regel verklaart de officiële volgorde bij gelijke punten?
crit = {
    "W desc": lambda a, b: (a.gewonnen > b.gewonnen) - (a.gewonnen < b.gewonnen),
    "saldo desc": lambda a, b: (a.saldo > b.saldo) - (a.saldo < b.saldo),
    "DV desc": lambda a, b: (a.doelpunten_voor > b.doelpunten_voor) - (a.doelpunten_voor < b.doelpunten_voor),
    "DT asc": lambda a, b: (a.doelpunten_tegen < b.doelpunten_tegen) - (a.doelpunten_tegen > b.doelpunten_tegen),
}
ties = 0
schendingen: Counter[str] = Counter()
voorbeelden: dict[str, list[str]] = {k: [] for k in crit}
for seizoen, rows in historie.items():
    by_reeks: dict[str, list] = {}
    for s in rows:
        by_reeks.setdefault(s.reeks, []).append(s)
    for reeks, rs in by_reeks.items():
        rs.sort(key=lambda s: s.positie)
        for a, b in zip(rs, rs[1:]):
            if a.punten != b.punten:
                continue
            ties += 1
            for name, fn in crit.items():
                if fn(a, b) < 0:
                    schendingen[name] += 1
                    if len(voorbeelden[name]) < 3:
                        voorbeelden[name].append(
                            f"{seizoen} {reeks}: #{a.positie} {a.ploeg} (W{a.gewonnen} "
                            f"{a.doelpunten_voor}-{a.doelpunten_tegen}) boven #{b.positie} {b.ploeg} "
                            f"(W{b.gewonnen} {b.doelpunten_voor}-{b.doelpunten_tegen}), {a.punten} pt")
print(f"\n== TIE-BREAK CHECK historiek: {ties} paren met gelijke punten")
for name in crit:
    print(f"   {name:10s} geschonden in {schendingen[name]:3d} paren",
          *("\n      " + v for v in voorbeelden[name]))
