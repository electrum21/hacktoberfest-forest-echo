"""Curated, speakable facts for common birds.

BirdNET returns only a label, so in real mode an observation has no habitat or natural
history. Rather than let a small language model recall facts from memory, we attach a vetted
one-line fact and a "where to look" cue when we have one. Unknown species simply get none.
"""
from __future__ import annotations

import hashlib
import json
import re
from functools import lru_cache
from pathlib import Path

from app.models import AcousticObservation

DATA = Path(__file__).resolve().parents[1] / "data" / "species_facts.json"


def _norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


@lru_cache(maxsize=1)
def _index() -> tuple[dict[str, dict], dict[str, dict]]:
    species = json.loads(DATA.read_text(encoding="utf-8"))["species"]
    by_sci = {_norm(s["scientific_name"]): s for s in species}
    by_common = {_norm(s["common_name"]): s for s in species}
    return by_sci, by_common


def lookup(scientific_name: str = "", common_name: str = "") -> dict | None:
    by_sci, by_common = _index()
    return by_sci.get(_norm(scientific_name)) or by_common.get(_norm(common_name))


def enrich(obs: AcousticObservation) -> AcousticObservation:
    """Fill empty habitat / fun_fact / look_tip from the curated file. Never overwrites."""
    entry = lookup(obs.scientific_name, obs.species_name)
    if not entry:
        return obs
    return obs.model_copy(
        update={
            "habitat": obs.habitat or entry["habitat"],
            "fun_fact": obs.fun_fact or entry["fun_fact"],
            "look_tip": obs.look_tip or entry["look_tip"],
        }
    )


def one_detail(obs: AcousticObservation, seed: bytes = b"") -> AcousticObservation:
    """Keep ONE idea per note: either where to look, or a fun fact, never both.

    The choice is deterministic for a given recording, so tests are stable, but it varies
    between recordings, so hearing the same bird twice does not give the same line twice.
    With no seed it prefers the look cue.
    """
    if not (obs.look_tip and obs.fun_fact):
        return obs
    use_look = not seed or hashlib.sha256(seed + obs.species_name.encode()).digest()[0] % 2 == 0
    return obs.model_copy(update={"fun_fact": ""} if use_look else {"look_tip": ""})

