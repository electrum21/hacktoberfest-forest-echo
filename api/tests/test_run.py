import importlib.util
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location("forest_run", Path(__file__).parents[2] / "run.py")
run = importlib.util.module_from_spec(spec)
spec.loader.exec_module(run)


def test_lan_filter():
    assert run.is_lan_ipv4("192.168.43.12") and run.is_lan_ipv4("10.0.0.5") and run.is_lan_ipv4("172.16.0.9")
    for bad in ("127.0.0.1", "169.254.1.1", "8.8.8.8", "::1", "fe80::1", "not-an-ip", ""):
        assert not run.is_lan_ipv4(bad), bad


def test_api_command_http_and_https():
    cmd = run.api_command(8000, None)
    assert cmd[:3] == [sys.executable, "-m", "uvicorn"] and "--ssl-keyfile" not in cmd
    assert cmd[cmd.index("--host") + 1] == "0.0.0.0" and cmd[cmd.index("--port") + 1] == "8000"
    cmd = run.api_command(8443, ("c.pem", "k.pem"))
    assert cmd[cmd.index("--ssl-certfile") + 1] == "c.pem" and cmd[cmd.index("--ssl-keyfile") + 1] == "k.pem"


def test_banner_shows_phone_address_and_mic_warning_only_on_http():
    http = "\n".join(run.banner_lines(["192.168.1.20"], 8000, False, False))
    assert "http://192.168.1.20:8000" in http and "microphone" in http
    https = "\n".join(run.banner_lines(["192.168.1.20"], 8000, True, True))
    assert "https://192.168.1.20:8000" in https and "microphone" not in https and "Offline mode" in https


def test_banner_without_network():
    text = "\n".join(run.banner_lines([], 8000, False, False))
    assert "no local network address" in text
