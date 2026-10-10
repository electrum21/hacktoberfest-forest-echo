from app.models import AcousticObservation
from app.services.mastra import local_fallback

OBS = AcousticObservation(
    species_name="Test bird",
    confidence=.9,
    habitat="suburban park",
    fun_fact="It sings at sunrise.",
)


def test_badges_are_metadata_not_spoken():
    result = local_fallback(OBS, 1, 7)
    assert result.badge_title == "Trail Tracker"
    assert "Trail Tracker" not in result.spoken_text
    assert "Keep" not in result.spoken_text


def test_dawn_badge():
    assert local_fallback(OBS, 1, 6).badge_title == "Dawn Chorus Pioneer"


def test_night_badge():
    assert local_fallback(OBS, 1, 21).badge_title == "Nocturnal Tracker"


def test_streak_badge():
    assert local_fallback(OBS, 5, 12).badge_title == "Eyes on the Trail"
