import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load_script():
    spec = importlib.util.spec_from_file_location("fx", ROOT / "api" / "scripts" / "make_ondevice_fixtures.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def test_notes_parity_fixture_matches_server_output():
    """If this fails, the server's notes changed: run make_ondevice_fixtures.py and check the JS still agrees."""
    expected = load_script().notes_parity()
    on_disk = json.loads((ROOT / "tests-web" / "fixtures" / "notes_parity.json").read_text(encoding="utf-8"))
    assert on_disk == expected


def test_web_facts_copy_is_identical_to_server_copy():
    """The phone reads web/data/species_facts.json; the server reads api/app/data/species_facts.json."""
    a = (ROOT / "api" / "app" / "data" / "species_facts.json").read_bytes()
    b = (ROOT / "web" / "data" / "species_facts.json").read_bytes()
    assert a == b
