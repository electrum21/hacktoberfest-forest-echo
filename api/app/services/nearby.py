"""Which species are plausible here, this week? Uses BirdNET's open geo model.

Coordinates are rounded to ~1 km, never logged and never stored; they only reach
the server you run yourself.
"""
from __future__ import annotations

from datetime import date
from functools import lru_cache

from app.config import settings
from app.services.classifier import DEMO_OBSERVATIONS, parse_label


def birdnet_week(d: date) -> int:
    """BirdNET's calendar has 48 'weeks': four per month."""
    return min(48, (d.month - 1) * 4 + min(3, (d.day - 1) // 7) + 1)


def _round(lat: float, lon: float) -> tuple[float, float]:
    return round(lat, 2), round(lon, 2)


@lru_cache(maxsize=1)
def _load_geo():
    try:
        import birdnet
    except ImportError as exc:
        raise RuntimeError("BirdNET is not installed; run pip install -r requirements-birdnet.txt") from exc
    return birdnet.load("geo", "2.4", "tf", library="litert")


@lru_cache(maxsize=256)
def _predict(lat: float, lon: float, week: int, min_conf: float) -> tuple[tuple[str, str, str, float], ...]:
    result = _load_geo().predict(lat, lon, week=week, min_confidence=min_conf)
    rows = result.to_structured_array(sort_by="confidences")
    out = []
    for row in rows:
        label = str(row["species_name"])
        scientific, common = parse_label(label)
        out.append((label, scientific, common, float(row["confidence"])))
    return tuple(out)


def species_labels(lat: float, lon: float, week: int | None = None) -> list[str]:
    """Raw BirdNET labels plausible here, used to narrow acoustic predictions."""
    lat, lon = _round(lat, lon)
    week = week or birdnet_week(date.today())
    return [label for label, *_ in _predict(lat, lon, week, settings.location_filter_min_confidence)]


def nearby_species(lat: float, lon: float, week: int | None = None, limit: int = 40) -> dict:
    week = week or birdnet_week(date.today())
    if settings.classifier.lower() != "birdnet":
        return {
            "source": "demo",
            "week": week,
            "species": [
                {"species_name": o.species_name, "scientific_name": o.scientific_name, "likelihood": None}
                for o in DEMO_OBSERVATIONS
            ],
        }
    lat, lon = _round(lat, lon)
    rows = _predict(lat, lon, week, settings.nearby_min_confidence)[:limit]
    return {
        "source": "birdnet-geo",
        "week": week,
        "species": [
            {"species_name": common, "scientific_name": sci, "likelihood": round(conf, 3)}
            for _label, sci, common, conf in rows
        ],
    }
