"""Regenerate the fixtures the on-device JavaScript tests compare against.

  notes_parity.json   what the SERVER would say for each curated species (no-seed path), so the phone says the same
  soundscape_ref.json real BirdNET results (Python/LiteRT reference) for the first 30 s of BirdNET's example soundscape,
                      plus geo-model reference values; only built when the models and the audio are available

  cd api && PYTHONPATH=. python scripts/make_ondevice_fixtures.py [--models DIR] [--soundscape FILE]
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "tests-web" / "fixtures"


def notes_parity() -> list[dict]:
    from app.models import AcousticObservation
    from app.services import facts
    from app.services.mastra import local_fallback

    data = json.loads(facts.DATA.read_text(encoding="utf-8"))["species"]
    cases = [(s["scientific_name"], s["common_name"]) for s in data] + [("Nopeus birdus", "Made-up Warbler")]
    rows = []
    for sci, common in cases:
        obs = facts.one_detail(facts.enrich(AcousticObservation(species_name=common, scientific_name=sci, confidence=0.8)))
        res = local_fallback(obs, 1, 12)
        rows.append({"scientific": sci, "common": common, "text": res.spoken_text, "badge": res.badge_title,
                     "habitat": obs.habitat, "look_tip": obs.look_tip, "fun_fact": obs.fun_fact})
    return rows


def soundscape_ref(models: Path, soundscape: Path) -> dict:
    import numpy as np
    import soundfile as sf
    from ai_edge_litert.interpreter import Interpreter

    labels = [l.strip() for l in (models / "BirdNET_GLOBAL_6K_V2.4_Labels.txt").read_text(encoding="utf-8").splitlines() if l.strip()]
    sig = lambda z: 1 / (1 + np.exp(-np.clip(z, -15, 15)))
    x, sr = sf.read(str(soundscape), dtype="float32")
    assert sr == 48000
    if x.ndim > 1:
        x = x.mean(1)
    ac = Interpreter(model_path=str(models / "BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite")); ac.allocate_tensors()
    windows = []
    for start in range(0, 30 * sr, 3 * sr):
        w = x[start:start + 144000]
        ac.set_tensor(ac.get_input_details()[0]["index"], w[None, :].astype("float32")); ac.invoke()
        p = sig(ac.get_tensor(ac.get_output_details()[0]["index"])[0])
        i = int(p.argmax())
        windows.append({"start_s": start // sr, "idx": i, "label": labels[i], "p": round(float(p[i]), 5)})
    geo = Interpreter(model_path=str(models / "BirdNET_GLOBAL_6K_V2.4_MData_Model_V2_FP16.tflite")); geo.allocate_tensors()
    places = {}
    for name, (lat, lon) in {"singapore": (1.35, 103.82), "london": (51.51, -0.12)}.items():
        geo.set_tensor(geo.get_input_details()[0]["index"], np.array([[lat, lon, 37]], dtype="float32")); geo.invoke()
        p = geo.get_tensor(geo.get_output_details()[0]["index"])[0]
        top = [int(i) for i in np.argsort(p)[::-1][:10]]
        places[name] = {"lat": lat, "lon": lon, "week": 37, "top": [{"idx": i, "label": labels[i], "p": round(float(p[i]), 4)} for i in top],
                        "n_ge_010": int((p >= 0.1).sum())}
    return {"windows": windows, "geo": places}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--models"); ap.add_argument("--soundscape")
    a = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "notes_parity.json").write_text(json.dumps(notes_parity(), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print("wrote notes_parity.json")
    if a.models and a.soundscape:
        (OUT / "soundscape_ref.json").write_text(json.dumps(soundscape_ref(Path(a.models), Path(a.soundscape)), indent=1) + "\n")
        print("wrote soundscape_ref.json")
