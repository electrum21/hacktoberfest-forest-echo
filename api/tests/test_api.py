import pytest
from fastapi.testclient import TestClient

from app import main
from app.config import settings
from app.services import classifier
from app.services.classifier import demo_classify, parse_label


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(settings, "classifier", "demo")
    monkeypatch.setattr(settings, "elevenlabs_api_key", "")
    monkeypatch.setattr(settings, "mastra_url", "http://127.0.0.1:9")  # nothing listens -> fallback
    monkeypatch.setattr(settings, "rate_limit_per_min", 0)
    return TestClient(main.app)


def post(client, data=b"fake-audio", **form):
    return client.post("/api/v1/analyze", files={"audio": ("s.webm", data, "audio/webm")}, data=form)


def test_parse_label():
    assert parse_label("Turdus migratorius_American Robin") == ("Turdus migratorius", "American Robin")
    assert parse_label("Mystery") == ("", "Mystery")


def test_demo_is_labelled_demo():
    assert demo_classify(b"x").source == "demo"


def test_analyze_demo_uses_fallback_and_labels_source(client):
    r = post(client)
    assert r.status_code == 200
    body = r.json()
    assert body["detected"] is True
    assert body["species"]["source"] == "demo"
    assert body["narration"]["source"] == "fallback"


def test_no_detection_stays_silent(client, monkeypatch):
    monkeypatch.setattr(main, "classify", lambda *_: None)
    body = post(client).json()
    assert body["detected"] is False and body["audio"] is False


def test_rejects_empty_and_bad_hour(client):
    assert post(client, data=b"").status_code == 400
    assert post(client, local_hour="99").status_code == 400


def test_decode_failure_is_422(client, monkeypatch):
    def boom(*_):
        raise RuntimeError("ffmpeg failed")
    monkeypatch.setattr(main, "classify", boom)
    assert post(client).status_code == 422


def test_static_traversal_is_blocked(client):
    r = client.get("/..%2fapi%2fapp%2fconfig.py")
    assert "class Settings" not in r.text


def test_rate_limit(client, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_per_min", 2)
    main._hits.clear()
    codes = [post(client).status_code for _ in range(3)]
    assert codes == [200, 200, 429]


# --- location / nearby ---------------------------------------------------

from datetime import date

from app.services import nearby as nearby_mod


def test_birdnet_week_calendar():
    assert nearby_mod.birdnet_week(date(2026, 1, 1)) == 1
    assert nearby_mod.birdnet_week(date(2026, 10, 6)) == 37
    assert nearby_mod.birdnet_week(date(2026, 12, 31)) == 48
    assert nearby_mod.birdnet_week(date(2026, 3, 31)) == 12


def test_nearby_demo_is_labelled(client):
    r = client.post("/api/v1/nearby", json={"lat": 40.71, "lon": -74.01})
    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "demo" and body["species"]


def test_nearby_validates_coordinates(client):
    assert client.post("/api/v1/nearby", json={"lat": 123, "lon": 0}).status_code == 422


def test_analyze_requires_both_coordinates(client):
    assert post(client, lat="40.7").status_code == 400
    assert post(client, lat="40.7", lon="999").status_code == 400
    assert post(client, lat="40.7", lon="-74.0").status_code == 200


def test_location_filter_falls_back_when_unfiltered_works(monkeypatch):
    calls = []

    class FakeResult:
        def to_structured_array(self):
            import numpy as np
            return np.array([("Genus species_Test Bird", 0.9)], dtype=[("species_name", object), ("confidence", float)])

    class FakeModel:
        def predict(self, wav, **kw):
            calls.append(dict(kw))
            if "custom_species_list" in kw:
                raise ValueError("bad species list")
            return FakeResult()

    monkeypatch.setattr(classifier, "_load_birdnet", lambda: FakeModel())
    monkeypatch.setattr(classifier, "_to_wav", lambda b: __import__("pathlib").Path("/nonexistent/x.wav"))
    monkeypatch.setattr(classifier, "_allowed_species", lambda loc, week=None: ["Genus species_Test Bird"])
    obs = classifier.birdnet_classify(b"x", (40.7, -74.0))
    assert obs.species_name == "Test Bird" and obs.scientific_name == "Genus species"
    assert "custom_species_list" in calls[0] and "custom_species_list" not in calls[1]


def test_missing_files_are_404_but_app_routes_still_load(client):
    assert client.get("/models/nope.tflite").status_code == 404
    assert client.get("/nope.js").status_code == 404
    assert client.get("/some/app/route").status_code == 200  # extensionless: the app shell
    assert client.get("/sw.js").status_code == 200
