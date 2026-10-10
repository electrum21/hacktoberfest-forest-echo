#!/usr/bin/env python3
"""Start Forest Echo with one command and print the address to open on your phone.

  python run.py                    # API + Mastra, uses api/.env
  python run.py --offline          # CLASSIFIER=birdnet, OFFLINE_MODE=true (no ElevenLabs, no outbound internet)
  python run.py --https cert.pem key.pem    # serve HTTPS so a phone's microphone works over the LAN
  python run.py --no-mastra        # API only (notes use the built-in fallback)

Ollama is checked, not started: the Ollama app/service normally runs by itself.
Stop everything with Ctrl+C.
"""
from __future__ import annotations

import argparse
import ipaddress
import os
import shutil
import signal
import socket
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
API_DIR = ROOT / "api"
MASTRA_DIR = ROOT / "mastra"


# ---------- pure helpers (unit-tested) ----------
def is_lan_ipv4(addr: str) -> bool:
    """A private, non-loopback IPv4 address: the kind a phone on the same Wi-Fi can reach."""
    try:
        ip = ipaddress.ip_address(addr)
    except ValueError:
        return False
    return ip.version == 4 and ip.is_private and not ip.is_loopback and not ip.is_link_local


def lan_ips() -> list[str]:
    found: list[str] = []
    # Ask the OS which interface it would use. A UDP "connect" sends nothing, so this works with no internet.
    for probe in ("192.168.255.255", "10.255.255.255", "172.31.255.255"):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect((probe, 1))
                found.append(s.getsockname()[0])
        except OSError:
            pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            found.append(info[4][0])
    except OSError:
        pass
    out: list[str] = []
    for addr in found:
        if is_lan_ipv4(addr) and addr not in out:
            out.append(addr)
    return out


def api_command(port: int, https: tuple[str, str] | None) -> list[str]:
    cmd = [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", str(port)]
    if https:
        cmd += ["--ssl-certfile", https[0], "--ssl-keyfile", https[1]]
    return cmd


def banner_lines(ips: list[str], port: int, https: bool, offline: bool) -> list[str]:
    scheme = "https" if https else "http"
    lines = ["", "Forest Echo", f"  On this computer:  {scheme}://localhost:{port}"]
    if ips:
        for ip in ips:
            lines.append(f"  On your phone:     {scheme}://{ip}:{port}   (same Wi-Fi / hotspot)")
    else:
        lines.append("  On your phone:     no local network address found. Join a Wi-Fi or hotspot first.")
    if ips and not https:
        lines += [
            "",
            "  Phones block the microphone on plain http:// addresses. Either serve HTTPS",
            "  (python run.py --https cert.pem key.pem) or, on Android Chrome, add the phone address at",
            "  chrome://flags/#unsafely-treat-insecure-origin-as-secure. Details: docs/OFFLINE.md",
        ]
    if offline:
        lines += ["", "  Offline mode: cloud voice off, outbound internet connections blocked."]
    lines.append("")
    return lines


# ---------- process handling ----------
def ollama_up() -> bool:
    try:
        with urllib.request.urlopen("http://127.0.0.1:11434", timeout=1.5) as r:
            return r.status == 200
    except Exception:
        return False


def stop(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    if os.name == "nt":  # npm leaves node running unless the whole tree is killed
        subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"], capture_output=True)
    else:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--offline", action="store_true", help="CLASSIFIER=birdnet and OFFLINE_MODE=true")
    p.add_argument("--https", nargs=2, metavar=("CERT", "KEY"), help="serve HTTPS with these files")
    p.add_argument("--no-mastra", action="store_true", help="do not start the Mastra workflow")
    p.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)))
    args = p.parse_args(argv)

    # Treat a plain SIGTERM (e.g. closing the terminal) like Ctrl+C so the children are stopped too.
    def _term(*_):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, _term)

    env = os.environ.copy()
    env["PYTHONPATH"] = str(API_DIR) + os.pathsep + env.get("PYTHONPATH", "")
    if args.offline:
        env["CLASSIFIER"] = "birdnet"
        env["OFFLINE_MODE"] = "true"
    if args.https:
        for f in args.https:
            if not Path(f).is_file():
                print(f"HTTPS file not found: {f}")
                return 2

    # Ollama: check, don't start.
    if ollama_up():
        print("Ollama: running")
    else:
        print("Ollama: not reachable at http://127.0.0.1:11434. Notes will use the built-in fallback.")
        print("        Start the Ollama app (or `ollama serve`), and `ollama pull gemma3n:e2b` once.")

    children: list[subprocess.Popen] = []
    try:
        npm = shutil.which("npm")
        if args.no_mastra:
            print("Mastra: skipped (--no-mastra)")
        elif not npm or not (MASTRA_DIR / "node_modules").is_dir():
            print("Mastra: not started (run `npm install` in mastra/ first). Notes will use the built-in fallback.")
        else:
            print("Mastra: starting on :4112")
            children.append(subprocess.Popen([npm, "run", "dev"], cwd=MASTRA_DIR, env=env))

        for line in banner_lines(lan_ips(), args.port, bool(args.https), args.offline):
            print(line)
        api = subprocess.Popen(api_command(args.port, tuple(args.https) if args.https else None), cwd=API_DIR, env=env)
        children.append(api)
        return api.wait()
    except KeyboardInterrupt:
        print("\nStopping Forest Echo...")
        return 0
    finally:
        for c in reversed(children):
            stop(c)


if __name__ == "__main__":
    sys.exit(main())
