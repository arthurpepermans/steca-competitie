from competition.teams import TeamRegistry, normalize_name


def test_normalize_name():
    assert normalize_name("Dynamo Wijndaal ") == "dynamo wijndaal"
    assert normalize_name("  V.O.K.   Jezus Eik A") == "v.o.k. jezus eik a"
    assert normalize_name("FC Caféboontjes A") == normalize_name("FC Caféboontjes A")


def test_registry_koppelt_namen_aan_ploegid():
    reg = TeamRegistry()
    reg.add("Dynamo Wijndaal ", 11, "EERSTE AFDELING")
    reg.add("Steca Juniors", 152, "DERDE AFDELING B")
    assert reg.resolve("dynamo wijndaal") == 11
    assert reg.resolve("Steca  Juniors") == 152
    assert reg.resolve("Onbekend FC") is None
    assert reg.naam(11) == "Dynamo Wijndaal"
    assert reg.reeks(152) == "DERDE AFDELING B"
    assert sorted(reg.ids()) == [11, 152]
    assert len(reg) == 2


def test_registry_meldt_conflicten():
    reg = TeamRegistry()
    reg.add("FC Dubbel", 1)
    reg.add("FC Dubbel", 2)
    assert reg.conflicten == [("FC Dubbel", 1, 2)]
    assert reg.resolve("FC Dubbel") == 1


def test_registry_negeert_rijen_zonder_id():
    reg = TeamRegistry()
    reg.add("Zonder Id", None)
    assert len(reg) == 0
