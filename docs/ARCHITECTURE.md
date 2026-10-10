# Forest Echo architecture

## Product rule: nature is the primary audio

Forest Echo is deliberately **silence-first**. The app does not continuously identify sounds, announce badges, or narrate the walk.

The core loop is:

```text
REAL SOUNDSCAPE
     │
     │ something catches the listener's attention
     ▼
HOLD TO LISTEN (1–5 seconds)
     │
     ▼
BirdNET acoustic inference
     │
     ▼
Mastra workflow
     │
     ├── quiet badge metadata
     │
     ▼
Gemma 3n naturalist note (10–25 words, max 35)
     │
     ▼
ElevenLabs speech
     │
     ▼
SHORT EXPLANATION
     │
     ▼
SILENCE AGAIN
```

The important design constraint is: **do not replay the recording and do not replace the soundscape with an AI podcast. Explain what the listener just heard, then get out of the way.**

## BirdNET owns species identification

Wildlife identification is a specialized acoustic classification task. BirdNET has a dedicated Python library for identifying bird species from sound. Gemma is therefore used for naturalist narration rather than being forced to make a precise species claim.

## Gemma 3n owns the spoken explanation

The original specification named Gemma-2B. This implementation uses Gemma 3n through Ollama. The model receives the structured acoustic observation and is constrained to a short, factual spoken field note. It must not announce badges, add motivational filler, or tell the listener to use the screen.

## Mastra owns orchestration

The workflow is explicit:

`observation → quiet badge metadata → Gemma draft → verify → narration result`

The verify step checks the draft against the silence-first contract (≤35 words, species named exactly once, no questions, badge talk or "keep walking" filler). On failure it retries Gemma once with the specific problem, then falls back to a note built only from supplied data.

Badges are returned as metadata for the UI/session. They are intentionally **not spoken automatically** because spoken gamification would compete with the environment.

## No detection means no speech

If BirdNET finds nothing above `MIN_CONFIDENCE`, the API returns `detected: false` and nothing is narrated or spoken. The screen shows a short "couldn't pin that one down" line.

## Honest fallbacks

`CLASSIFIER=demo` is an explicit mode. It returns `source=demo` and exists so the hosted demo can show the interaction without pretending that a hard-coded observation is real acoustic inference.

If Mastra/Gemma is unavailable, FastAPI uses a small local fallback narration with the same silence-first constraints. That fallback is also labeled in the result source.

## Interaction state machine

The PWA has five practical states:

- `IDLE` — microphone released (tracks are stopped after every hold) and no audio output.
- `LISTENING` — user is deliberately holding the button; capture is capped at five seconds.
- `ANALYZING` — the sample is being classified and turned into a field note.
- `RESPONDING` — one short spoken explanation plays.
- `SILENT` — playback ends and the interface returns to waiting.

There is no background microphone loop and no proactive narration in the MVP.
