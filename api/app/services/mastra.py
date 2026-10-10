from __future__ import annotations

import httpx

from app.config import settings
from app.models import AcousticObservation, NarrationResult


def _quiet_badge(streak_days: int, local_hour: int) -> tuple[str, str]:
    """Badges are metadata, never spoken automatically."""
    if local_hour < 7:
        return "BADGE_DAWN_CHORUS", "Dawn Chorus Pioneer"
    if local_hour >= 20:
        return "BADGE_NIGHT_OWL", "Nocturnal Tracker"
    if streak_days >= 5:
        return "BADGE_SCREEN_MINIMAL", "Eyes on the Trail"
    return "BADGE_NATURE_STEP", "Trail Tracker"


def article(name: str) -> str:
    """'a' or 'an' for a species name: 'an American Robin', but 'a European Starling'."""
    n = name.strip().lower()
    if n.startswith(("eu", "uni", "use")):
        return "a"
    return "an" if n[:1] in "aeiou" else "a"


def local_fallback(observation: AcousticObservation, streak_days: int, local_hour: int) -> NarrationResult:
    badge_id, badge_title = _quiet_badge(streak_days, local_hour)
    # Same silence-first contract as Gemma: one idea, no filler.
    text = f"That’s {article(observation.species_name)} {observation.species_name}."
    detail = observation.look_tip or observation.fun_fact
    if detail:
        text += f" {detail}"
    return NarrationResult(
        spoken_text=text[:280],
        badge_id=badge_id,
        badge_title=badge_title,
        source="fallback",
    )


async def generate_narration(observation: AcousticObservation, streak_days: int, local_hour: int) -> NarrationResult:
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{settings.mastra_url.rstrip('/')}/api/narrate",
                json={
                    "observation": observation.model_dump(),
                    "streak_days": max(1, streak_days),
                    "local_hour": local_hour,
                },
            )
            r.raise_for_status()
            return NarrationResult.model_validate(r.json())
    except Exception:
        return local_fallback(observation, streak_days, local_hour)
