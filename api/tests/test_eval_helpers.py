import importlib.util
from datetime import date
from pathlib import Path
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location("eval_location", Path(__file__).parents[1] / "scripts" / "eval_location.py")
ev = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ev)


def test_match_prefers_scientific_name():
    assert ev.is_match("Turdus migratorius", "American Robin", "Turdus migratorius", "Whatever")
    assert ev.is_match("", "Northern Cardinal", "", "northern cardinal")
    assert not ev.is_match("Corvus brachyrhynchos", "American Crow", "Corvus corax", "Common Raven")


def test_parse_date():
    assert ev.parse_recording_date("2023-05-12") == date(2023, 5, 12)
    assert ev.parse_recording_date("") is None
    assert ev.parse_recording_date("0000-00-00") is None


def test_evaluate_and_summarize(tmp_path):
    clip = tmp_path / "a.wav"
    clip.write_bytes(b"x")
    items = [{"path": str(clip), "sci": "Turdus migratorius", "common": "American Robin", "lat": 40.7, "lon": -74.0, "week": 37}]

    def classify(audio, location, week):
        if location is None:
            return SimpleNamespace(species_name="Wrong Bird", scientific_name="Nope nope")
        return SimpleNamespace(species_name="American Robin", scientific_name="Turdus migratorius")

    rows = ev.evaluate(items, classify, lambda lat, lon, wk: ["Turdus migratorius_American Robin"])
    assert rows[0]["plain"] == "wrong" and rows[0]["located"] == "correct" and rows[0]["in_geo_list"] is True
    s = ev.summarize(rows)
    assert s["plain_wrong_%"] == 100.0 and s["located_correct_%"] == 100.0
