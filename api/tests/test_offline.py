import socket

import pytest
from fastapi.testclient import TestClient

from app import main, offline
from app.config import settings


@pytest.mark.parametrize("host,expected", [
    ("127.0.0.1", True), ("localhost", True), ("::1", True), ("192.168.1.20", True), ("10.0.0.5", True),
    ("172.16.4.1", True), ("169.254.1.1", True), ("fe80::1%eth0", True),
    ("8.8.8.8", False), ("1.1.1.1", False), ("api.elevenlabs.io", False), ("2606:4700::1111", False),
])
def test_is_local_address(host, expected):
    assert offline.is_local_address(host) is expected


def test_guard_blocks_internet_but_not_lan():
    original = socket.socket.connect
    offline.install_guard()
    try:
        s = socket.socket()
        with pytest.raises(offline.OfflineViolation):
            s.connect(("8.8.8.8", 443))
        with pytest.raises(offline.OfflineViolation):
            s.connect_ex(("1.1.1.1", 80))
        # A LAN address is not blocked by the guard itself (it would just fail to connect, not raise OfflineViolation).
        s.settimeout(0.05)
        try:
            s.connect(("127.0.0.1", 9))
        except OSError as exc:
            assert not isinstance(exc, offline.OfflineViolation)
        s.close()
    finally:
        offline.uninstall_guard()
    assert socket.socket.connect is original  # guard fully removed


def test_offline_mode_turns_cloud_voice_off(monkeypatch):
    monkeypatch.setattr(settings, "elevenlabs_api_key", "sk-test")
    monkeypatch.setattr(settings, "offline_mode", False)
    assert settings.use_elevenlabs is True
    monkeypatch.setattr(settings, "offline_mode", True)
    assert settings.use_elevenlabs is False


def test_offline_analyze_returns_text_for_on_device_voice(monkeypatch):
    monkeypatch.setattr(settings, "classifier", "demo")
    monkeypatch.setattr(settings, "elevenlabs_api_key", "sk-test")
    monkeypatch.setattr(settings, "offline_mode", True)
    monkeypatch.setattr(settings, "mastra_url", "http://127.0.0.1:9")
    monkeypatch.setattr(settings, "rate_limit_per_min", 0)
    c = TestClient(main.app)
    body = c.post("/api/v1/analyze", files={"audio": ("s.webm", b"x", "audio/webm")}).json()
    assert body["detected"] is True and body["audio"] is False and body["narration"]["spoken_text"]
    assert c.get("/health").json()["offline"] is True


def test_service_worker_is_served_from_root():
    r = TestClient(main.app).get("/sw.js")
    assert r.status_code == 200 and "javascript" in r.headers["content-type"]
    assert "forest-echo-shell" in r.text
