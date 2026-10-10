"""Fetch the BirdNET models for on-device mode and prepare them for the browser. Run once, while online.

  pip install ai-edge-litert flatbuffers          (setup-time only: used to check and patch the location model)
  cd api && python scripts/fetch_ondevice_assets.py [--out ../web/models]

What it does
  1. Downloads birdnetlib 0.18.1 from PyPI, which bundles the BirdNET V2.4 models, and extracts three files.
  2. Checks their SHA-256 against the values pinned below.
  3. Patches the small location (geo) model so its batch size is fixed at 1: the original marks it variable,
     which the in-browser runtime (LiteRT.js) rejects. The patch changes only that shape metadata; the script
     proves the patched model gives identical outputs before keeping it.
  4. Writes manifest.json, which the app uses for the offline-pack download.

Licence: the BirdNET models are CC BY-NC-SA 4.0 (non-commercial, share-alike, attribution to the BirdNET team,
K. Lisa Yang Center for Conservation Bioacoustics at the Cornell Lab of Ornithology, and Chemnitz University of
Technology). The licence text is copied next to the models. Do not use them in a commercial product.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

PACKAGE = "birdnetlib==0.18.1"
INNER = "birdnetlib/models/analyzer/"
PINNED = {  # original files inside the wheel
    "BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite": "55f3e4055b1a13bfa9a2452731d0d34f6a02d6b775a334362665892794165e4c",
    "BirdNET_GLOBAL_6K_V2.4_MData_Model_V2_FP16.tflite": "1226f23fc20362617deb09178f366111b70cf085c2c82893f2814e5acedce6c2",
    "BirdNET_GLOBAL_6K_V2.4_Labels.txt": "b50b77b7c3dfe40cd637e8cccdca0173a0a4ddee8867b830ff3c1a566f477f16",
}
GEO = "BirdNET_GLOBAL_6K_V2.4_MData_Model_V2_FP16.tflite"
LICENSE_SHA = "04d5c28567bb68b3c647742455c90091e2ea2b6708da27679889e1f80dd838ed"
_here = Path(__file__).resolve()
DEFAULT_OUT = (_here.parents[2] if len(_here.parents) > 2 else Path.cwd()) / "web" / "models"


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build_manifest(files: dict[str, bytes]) -> dict:
    return {
        "version": 1,
        "source": PACKAGE,
        "license": "CC BY-NC-SA 4.0 (non-commercial); see LICENSE-BirdNET-models.txt",
        "files": [{"name": n, "size": len(b), "sha256": sha256(b)} for n, b in sorted(files.items())],
    }


def patch_static_batch(model_bytes: bytes) -> bytes:
    """Make every variable (-1) dimension in tensor shape signatures static, keeping the declared shapes."""
    import flatbuffers
    from ai_edge_litert import schema_py_generated as S

    buf = bytearray(model_bytes)
    model = S.ModelT.InitFromObj(S.Model.GetRootAsModel(buf, 0))
    for sg in model.subgraphs:
        for t in sg.tensors:
            if t.shapeSignature is not None and any(int(d) < 0 for d in t.shapeSignature):
                t.shapeSignature = None
    b = flatbuffers.Builder(1024)
    b.Finish(model.Pack(b), b"TFL3")
    return bytes(b.Output())


def run_geo(model_bytes: bytes, lat: float, lon: float, week: int):
    import numpy as np
    from ai_edge_litert.interpreter import Interpreter

    it = Interpreter(model_content=model_bytes)
    it.allocate_tensors()
    it.set_tensor(it.get_input_details()[0]["index"], np.array([[lat, lon, week]], dtype="float32"))
    it.invoke()
    return it.get_tensor(it.get_output_details()[0]["index"])[0]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--wheel", help="use an already-downloaded birdnetlib wheel instead of downloading")
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)

    try:
        import numpy as np  # noqa: F401
        from ai_edge_litert import schema_py_generated  # noqa: F401
        import flatbuffers  # noqa: F401
    except ImportError:
        print("Setup needs: pip install ai-edge-litert flatbuffers numpy")
        return 2

    with tempfile.TemporaryDirectory() as tmp:
        wheel = Path(a.wheel) if a.wheel else None
        if wheel is None:
            print(f"Downloading {PACKAGE} (about 60 MB)...")
            subprocess.run([sys.executable, "-m", "pip", "download", PACKAGE, "--no-deps", "-d", tmp, "-q"], check=True)
            wheel = next(Path(tmp).glob("birdnetlib-*.whl"))
        with zipfile.ZipFile(wheel) as z:
            files = {n: z.read(INNER + n) for n in PINNED}
            licence = z.read(INNER + "LICENSE")

    for name, want in PINNED.items():
        got = sha256(files[name])
        if got != want:
            print(f"Checksum mismatch for {name}: expected {want}, got {got}")
            return 3
    if sha256(licence) != LICENSE_SHA:
        print("Licence text differs from the pinned one; check it before continuing.")
        return 3

    print("Patching the location model to a fixed batch size...")
    patched = patch_static_batch(files[GEO])
    for lat, lon, week in [(1.35, 103.82, 37), (51.51, -0.12, 12), (40.78, -73.97, 1)]:
        diff = float(abs(run_geo(files[GEO], lat, lon, week) - run_geo(patched, lat, lon, week)).max())
        if diff > 1e-6:
            print(f"Patched model differs from the original (max diff {diff}); refusing to keep it.")
            return 4
    files[GEO] = patched

    for name, data in files.items():
        (out / name).write_bytes(data)
    (out / "LICENSE-BirdNET-models.txt").write_bytes(licence)
    (out / "manifest.json").write_text(json.dumps(build_manifest(files), indent=1) + "\n")
    total = sum(len(b) for b in files.values()) / 1e6
    print(f"Done: {len(files)} files, {total:.1f} MB written to {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
