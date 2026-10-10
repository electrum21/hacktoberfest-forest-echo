import json

from app.models import AcousticObservation
from app.services import facts
from app.services.classifier import classify, parse_label
from app.services.mastra import article, local_fallback

DATA = json.loads(facts.DATA.read_text(encoding="utf-8"))["species"]


def obs(**kw):
    base = dict(species_name="Unknown Bird", scientific_name="", confidence=0.9, source="birdnet")
    base.update(kw)
    return AcousticObservation(**base)


def test_lookup_by_scientific_then_common_name():
    assert facts.lookup("Turdus migratorius")["common_name"] == "American Robin"
    assert facts.lookup("", "Northern Cardinal")["scientific_name"] == "Cardinalis cardinalis"
    assert facts.lookup("Turdus  MIGRATORIUS ", "")["common_name"] == "American Robin"  # tolerant of case/space
    assert facts.lookup("Not a bird", "Nope") is None


def test_birdnet_label_format_resolves():
    sci, common = parse_label("Dryobates pubescens_Downy Woodpecker")
    assert facts.lookup(sci, common)["common_name"] == "Downy Woodpecker"


def test_enrich_fills_blanks_and_never_overwrites():
    e = facts.enrich(obs(species_name="American Robin", scientific_name="Turdus migratorius"))
    assert e.habitat and e.fun_fact and e.look_tip
    kept = facts.enrich(obs(species_name="American Robin", scientific_name="Turdus migratorius", fun_fact="Mine."))
    assert kept.fun_fact == "Mine."
    unknown = obs()
    assert facts.enrich(unknown) == unknown  # unknown species: unchanged, no invented facts


def test_one_detail_keeps_a_single_idea():
    both = facts.enrich(obs(species_name="Blue Jay", scientific_name="Cyanocitta cristata"))
    assert both.look_tip and both.fun_fact
    for seed in (b"", b"a", b"b", b"c", b"d"):
        d = facts.one_detail(both, seed)
        assert bool(d.look_tip) != bool(d.fun_fact), "exactly one of look_tip / fun_fact"
        assert facts.one_detail(both, seed) == d, "deterministic for a given recording"
    assert facts.one_detail(both).look_tip, "no seed prefers the look cue"
    kinds = {bool(facts.one_detail(both, bytes([i])).look_tip) for i in range(64)}
    assert kinds == {True, False}, "varies between recordings"


def test_classify_demo_returns_one_detail_and_fallback_speaks_it():
    o = classify(b"some-audio", "demo")
    assert o.source == "demo" and bool(o.look_tip) != bool(o.fun_fact)
    note = local_fallback(o, 1, 12).spoken_text
    assert note.startswith(f"That’s {article(o.species_name)} {o.species_name}.") and (o.look_tip or o.fun_fact) in note


def test_curated_data_is_safe_to_speak():
    assert len(DATA) >= 30
    assert len({d["scientific_name"] for d in DATA}) == len(DATA)
    assert len({d["common_name"] for d in DATA}) == len(DATA)
    for d in DATA:
        for key in ("scientific_name", "common_name", "habitat", "look_tip", "fun_fact"):
            assert d[key].strip(), (d["common_name"], key)
        assert d["look_tip"].startswith("Look"), d["common_name"]
        for key in ("look_tip", "fun_fact"):
            text = d[key]
            assert text.endswith("."), (d["common_name"], key)
            assert "?" not in text and "badge" not in text.lower() and "phone" not in text.lower()
            assert len(text.split()) <= 18, (d["common_name"], key)
        # species name once + one sentence stays well inside the 35-word spoken limit
        assert 4 + max(len(d["look_tip"].split()), len(d["fun_fact"].split())) <= 30, d["common_name"]
