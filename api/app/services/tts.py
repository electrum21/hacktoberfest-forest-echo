from __future__ import annotations
from typing import Iterator
from app.config import settings


def stream_tts(text: str) -> Iterator[bytes]:
    if not settings.use_elevenlabs:
        raise RuntimeError("ElevenLabs is not configured, or OFFLINE_MODE is on")

    # Lazy import keeps demo/local text mode usable without the optional SDK import.
    from elevenlabs.client import ElevenLabs

    client = ElevenLabs(api_key=settings.elevenlabs_api_key)
    stream = client.text_to_speech.stream(
        voice_id=settings.elevenlabs_voice_id,
        text=text,
        model_id=settings.elevenlabs_model_id,
        output_format="mp3_44100_128",
    )
    for chunk in stream:
        if chunk:
            yield chunk
