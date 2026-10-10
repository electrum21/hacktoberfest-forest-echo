from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    classifier: str = "demo"  # demo | birdnet
    mastra_url: str = "http://localhost:4112"
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = "JBFqnCBsd6RMkjVDRZzb"
    # Flash is built for low-latency streaming; swap to eleven_v3 for more expressive (slower) speech.
    elevenlabs_model_id: str = "eleven_flash_v2_5"
    # Below this BirdNET confidence we stay silent instead of guessing.
    min_confidence: float = 0.25
    # High-pass edge passed to BirdNET to ignore wind rumble (Hz). Lower it for owls/doves.
    wind_cut_hz: int = 200
    # Narrow BirdNET to species plausible at the user's (opt-in) location and week.
    use_location_filter: bool = True
    location_filter_min_confidence: float = 0.03
    nearby_min_confidence: float = 0.10
    # Everything stays on your own network: no ElevenLabs, outbound internet connections are blocked.
    offline_mode: bool = False
    # Public demo protection: max analyze calls per IP per minute (0 disables).
    rate_limit_per_min: int = 12
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def use_elevenlabs(self) -> bool:
        return bool(self.elevenlabs_api_key) and not self.offline_mode


settings = Settings()
