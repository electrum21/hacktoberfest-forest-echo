"""Download every model Forest Echo needs, once, while you are online.

  cd api
  PYTHONPATH=. python scripts/prefetch_models.py        (PowerShell: $env:PYTHONPATH="."; python scripts\\prefetch_models.py)

It loads the BirdNET acoustic and geo models (downloading them if missing) and runs a tiny prediction
with each, so you know they work before you lose signal. Gemma is fetched separately: `ollama pull gemma3n:e2b`.
After this, set OFFLINE_MODE=true and the API will refuse any outbound internet connection.
"""
from __future__ import annotations

import sys
import tempfile
import wave
from pathlib import Path


def silent_wav(path: Path, seconds: int = 3, rate: int = 48000) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(b"\x00\x00" * rate * seconds)


def main() -> int:
    from app.services import classifier, nearby

    print("Loading BirdNET acoustic model (downloads on first run, ~80 MB)...")
    acoustic = classifier._load_birdnet()
    with tempfile.TemporaryDirectory() as d:
        wav = Path(d) / "silence.wav"
        silent_wav(wav)
        acoustic.predict(wav, top_k=1, n_workers=1)
    print("  acoustic model OK")

    print("Loading BirdNET geo model...")
    geo = nearby._load_geo()
    geo.predict(1.35, 103.82, week=nearby.birdnet_week(__import__("datetime").date.today()), min_confidence=0.1)
    print("  geo model OK")

    print("\nNow run `ollama pull gemma3n:e2b` if you have not, then set OFFLINE_MODE=true in api/.env.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
