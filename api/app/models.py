from pydantic import BaseModel, Field


class AcousticObservation(BaseModel):
    species_name: str
    scientific_name: str = ""
    confidence: float = Field(ge=0, le=1)
    # Empty in real BirdNET mode: BirdNET only returns a label, not natural history.
    habitat: str = ""
    fun_fact: str = ""
    # Where to look in the real surroundings (never a phone instruction). Empty if unknown.
    look_tip: str = ""
    source: str = "birdnet"


class NarrationResult(BaseModel):
    spoken_text: str
    badge_id: str
    badge_title: str
    source: str
