from __future__ import annotations

import logging
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import quote

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from app import offline
from app.config import settings
from app.services.classifier import classify, warm_up
from app.services.mastra import generate_narration
from app.services.nearby import nearby_species
from app.services.tts import stream_tts

log = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if settings.offline_mode:
        offline.install_guard()
        log.info("OFFLINE_MODE on: outbound connections to non-local addresses are blocked, cloud voice is off")
    if settings.classifier.lower() == "birdnet":
        try:
            await run_in_threadpool(warm_up)
        except Exception as exc:
            if settings.offline_mode:
                raise RuntimeError(
                    "OFFLINE_MODE is on but the BirdNET models are not cached yet. "
                    "Run `python scripts/prefetch_models.py` once while you are online."
                ) from exc
            raise
    yield


app = FastAPI(title="Forest Echo API", version="2.3.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # "*" with credentials is invalid; the PWA is same-origin anyway
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Species", "X-Confidence", "X-Badge", "X-Source"],
)

MAX_AUDIO_BYTES = 8_000_000
_hits: dict[str, deque[float]] = defaultdict(deque)


def _check_rate_limit(request: Request, bucket: str = "analyze") -> None:
    """Tiny in-memory limiter so a public demo can't burn the ElevenLabs quota."""
    limit = settings.rate_limit_per_min
    if limit <= 0:
        return
    ip = f"{bucket}:{request.client.host if request.client else 'unknown'}"
    now = time.monotonic()
    q = _hits[ip]
    while q and now - q[0] > 60:
        q.popleft()
    if len(q) >= limit:
        raise HTTPException(429, "Too many samples — give the trail a minute.")
    q.append(now)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "classifier": settings.classifier,
        "offline": settings.offline_mode,
        "interaction": "silence-first",
    }


@app.post("/api/v1/analyze")
async def analyze(
    request: Request,
    audio: UploadFile = File(...),
    streak: int = Form(default=1),
    local_hour: int | None = Form(default=None),
    lat: float | None = Form(default=None),
    lon: float | None = Form(default=None),
):
    """Analyze one user-requested acoustic sample.

    The endpoint intentionally performs no continuous monitoring or proactive narration.
    """
    _check_rate_limit(request)
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(400, "Empty audio payload received")
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "Audio sample is too large")
    if not 0 <= streak <= 3650:
        raise HTTPException(400, "Invalid streak")
    hour = time.localtime().tm_hour if local_hour is None else local_hour
    if not 0 <= hour <= 23:
        raise HTTPException(400, "local_hour must be between 0 and 23")

    location = None
    if (lat is None) != (lon is None):
        raise HTTPException(400, "Send both lat and lon, or neither")
    if lat is not None and lon is not None:
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            raise HTTPException(400, "Invalid coordinates")
        location = (lat, lon)

    try:
        # Classification is CPU-bound; keep it off the event loop.
        observation = await run_in_threadpool(classify, audio_bytes, settings.classifier, location)
    except Exception as exc:  # decode failure, missing BirdNET, etc.
        raise HTTPException(422, f"Could not analyze audio: {exc}") from exc

    if observation is None:
        # Nothing cleared the confidence threshold: say nothing rather than guess.
        return {"detected": False, "audio": False, "message": "Couldn't pin that one down."}

    narration = await generate_narration(observation, streak, hour)

    if not settings.use_elevenlabs:
        # No cloud voice (no key, or OFFLINE_MODE): the phone speaks the note with its own on-device voice.
        return {
            "detected": True,
            "species": observation.model_dump(),
            "narration": narration.model_dump(),
            "audio": False,
            "message": "Cloud voice is off (offline mode or no ELEVENLABS_API_KEY)",
        }

    return StreamingResponse(
        stream_tts(narration.spoken_text),
        media_type="audio/mpeg",
        headers={
            # Header values must be latin-1 safe; the client decodes them.
            "X-Species": quote(observation.species_name),
            "X-Confidence": f"{observation.confidence:.2f}",
            "X-Badge": quote(narration.badge_title),
            "X-Source": observation.source,
        },
    )


class NearbyRequest(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


@app.post("/api/v1/nearby")
async def nearby(body: NearbyRequest, request: Request):
    """Species plausible near a point this week. POST (not GET) so coordinates stay out of access logs."""
    _check_rate_limit(request, "nearby")
    try:
        return await run_in_threadpool(nearby_species, body.lat, body.lon)
    except Exception as exc:
        raise HTTPException(503, f"Nearby species unavailable: {exc}") from exc


WEB_ROOT = Path(__file__).resolve().parents[2] / "web"


@app.get("/", include_in_schema=False)
async def index():
    return FileResponse(WEB_ROOT / "index.html")


@app.get("/{path:path}", include_in_schema=False)
async def static_fallback(path: str):
    root = WEB_ROOT.resolve()
    candidate = (root / path).resolve()
    # Never serve anything outside web/ (blocks ../ traversal to api/.env etc.).
    if candidate.is_file() and candidate.is_relative_to(root):
        return FileResponse(candidate)
    # A missing file (anything with an extension, e.g. /models/x.tflite) is a real 404. Only extensionless
    # paths fall back to the app, otherwise a missing model would arrive as "200 OK" HTML.
    if Path(path).suffix:
        raise HTTPException(404, "Not found")
    return FileResponse(root / "index.html")
