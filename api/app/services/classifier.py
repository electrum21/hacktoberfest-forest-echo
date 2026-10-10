from __future__ import annotations

import hashlib
import subprocess
import tempfile
import logging
from functools import lru_cache
from pathlib import Path

from app.config import settings
from app.models import AcousticObservation
from app.services.facts import enrich, one_detail

log = logging.getLogger(__name__)

DEMO_OBSERVATIONS = [
    AcousticObservation(species_name="American Robin", scientific_name="Turdus migratorius", confidence=.94, habitat="lawns, parks, woodland edges and suburban yards", fun_fact="It is often among the first birds to sing before dawn.", source="demo"),
    AcousticObservation(species_name="Northern Cardinal", scientific_name="Cardinalis cardinalis", confidence=.91, habitat="thickets, forest edges, gardens and parks", fun_fact="Unusually for songbirds, females sing as well as males.", source="demo"),
    AcousticObservation(species_name="Blue Jay", scientific_name="Cyanocitta cristata", confidence=.88, habitat="oak and mixed woodland, suburbs and city parks", fun_fact="It sometimes imitates the calls of hawks.", source="demo"),
]


def demo_classify(audio_bytes: bytes) -> AcousticObservation:
    return DEMO_OBSERVATIONS[hashlib.sha256(audio_bytes).digest()[0] % len(DEMO_OBSERVATIONS)]


def _to_wav(audio_bytes: bytes) -> Path:
    """Decode whatever the browser recorded (webm/mp4/ogg) to mono 48 kHz WAV."""
    workdir = Path(tempfile.mkdtemp(prefix="forest-echo-"))
    src, dst = workdir / "sample.bin", workdir / "sample.wav"
    src.write_bytes(audio_bytes)
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-ac", "1", "-ar", "48000", str(dst)],
        check=True,
        timeout=20,
    )
    return dst


@lru_cache(maxsize=1)
def _load_birdnet():
    """Load the model once per process (loading takes seconds; a hold should not)."""
    try:
        import birdnet
    except ImportError as exc:
        raise RuntimeError("BirdNET is not installed; run pip install -r requirements-birdnet.txt") from exc
    # 'litert' runs the TFLite model without a full TensorFlow install.
    return birdnet.load("acoustic", "2.4", "tf", library="litert")


def warm_up() -> None:
    """Load the model at startup so the first hold on the trail is not the slow one."""
    _load_birdnet()


def parse_label(label: str) -> tuple[str, str]:
    """BirdNET labels look like 'Scientific name_Common name'. Returns (scientific, common)."""
    if "_" in label:
        scientific, common = label.split("_", 1)
        return scientific.strip(), common.strip()
    return "", label.strip()


def _allowed_species(location: tuple[float, float] | None, week: int | None = None) -> list[str] | None:
    if not location or not settings.use_location_filter:
        return None
    try:
        from app.services.nearby import species_labels

        return species_labels(*location, week=week) or None
    except Exception as exc:  # geo model missing/unavailable: classify without the filter
        log.warning("Location filter unavailable (%s); classifying without it", exc)
        return None


def birdnet_classify(audio_bytes: bytes, location: tuple[float, float] | None = None, week: int | None = None) -> AcousticObservation | None:
    """Return the best detection, or None when nothing clears the confidence threshold.

    With an opt-in location, predictions are narrowed to species plausible there this week,
    which cuts false positives; it can also hide a genuinely rare visitor.
    """
    model = _load_birdnet()
    wav = _to_wav(audio_bytes)
    try:
        kwargs = dict(
            top_k=1,
            default_confidence_threshold=settings.min_confidence,
            n_workers=1,
            bandpass_fmin=settings.wind_cut_hz,
        )
        allowed = _allowed_species(location, week)
        if allowed:
            kwargs["custom_species_list"] = allowed
        try:
            result = model.predict(wav, **kwargs)
        except Exception as exc:
            if "custom_species_list" not in kwargs:
                raise
            log.warning("Location-filtered prediction failed (%s); retrying unfiltered", exc)
            kwargs.pop("custom_species_list")
            result = model.predict(wav, **kwargs)
        rows = result.to_structured_array()  # sorted by confidence, best first
    finally:
        try:
            wav.unlink(missing_ok=True)
            wav.parent.rmdir()
        except OSError:
            pass
    if len(rows) == 0:
        return None
    best = rows[0]
    scientific, common = parse_label(str(best["species_name"]))
    return AcousticObservation(
        species_name=common,
        scientific_name=scientific,
        confidence=min(1.0, max(0.0, float(best["confidence"]))),
        source="birdnet",
    )


def classify(audio_bytes: bytes, mode: str, location: tuple[float, float] | None = None) -> AcousticObservation | None:
    obs = birdnet_classify(audio_bytes, location) if mode.lower() == "birdnet" else demo_classify(audio_bytes)
    return one_detail(enrich(obs), audio_bytes) if obs else None
