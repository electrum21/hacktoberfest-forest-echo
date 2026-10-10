# Forest Echo 🌿

Forest Echo is a silence-first, voice-first outdoor nature companion for hikes, walks and trail runs.

**The AI is not the destination. Nature is.**

Forest Echo does not get you out of the house. It's for the walk you were already taking, and it keeps the screen out of it: one hold, one spoken line, then silence.

When something catches your attention, hold one button for a few seconds. Forest Echo identifies the acoustic observation, generates one short naturalist explanation, speaks it through your headphones, and then returns to silence.

## Try it

- **Live demo:** [forest-echo.onrender.com](https://forest-echo.onrender.com/). The hosted server runs in explicit demo mode (results are labelled `demo`), and the free plan can take up to a minute to wake on the first visit. On-device mode runs the real BirdNET model in your browser from this URL.
- **Demo video:**


https://github.com/user-attachments/assets/c59e43e7-4bc1-47ec-87f0-7e16588f4304

To test identification, play a clear recording of one bird close to the phone and hold the button for 4–5 seconds. If **Use my location** is on, only birds plausible where you are this week are accepted, so a bird from another continent is ignored. Turn location off to identify any bird in BirdNET's list of about 6,000 species.

## Product loop

```text
hear something interesting
        ↓
  hold to listen
        ↓
  1–5 second sample
        ↓
  acoustic inference
        ↓
 short field note
        ↓
  hear explanation
        ↓
     silence
        ↓
   keep exploring
```

There is no continuous microphone loop, no automatic wildlife podcast, and no spoken badge spam.

## Architecture

```text
Mobile PWA
  │ hold-to-listen audio/webm (max 5 seconds)
  ▼
FastAPI /api/v1/analyze
  │
  ├── BirdNET (real mode) / explicit Demo adapter
  │
  └── observation JSON
          ▼
     Mastra workflow
     quiet badge → Gemma 3n → verify note
          │
          ▼
     ElevenLabs TTS stream
          │
          ▼
       headphones
          │
          ▼
       silence again
```

## Quick start

```bash
python run.py                  # API + Mastra, settings from api/.env
python run.py --offline        # BirdNET + OFFLINE_MODE: no cloud voice, no outbound internet
python run.py --https CERT KEY # serve HTTPS so a phone's microphone works over Wi-Fi
python run.py --no-mastra      # API only (notes use the built-in fallback)
```

`run.py` starts Mastra and the API together, checks that Ollama is running (it doesn't start it), and prints the address to open on this computer and on your phone. Ctrl+C stops everything. It needs the one-time setup below first. Without any setup, `python run.py --no-mastra` after `pip install -r api/requirements.txt` gives you demo mode.

## Full local AI mode

Prerequisites: Python 3.11+, Node.js 22+, Ollama, ffmpeg. Set `OLLAMA_KEEP_ALIVE=30m` so Gemma stays loaded between walks (otherwise Ollama unloads it after 5 minutes and the next hold is slow).

**Windows:** the Ollama tray app already runs a server in the background, so `ollama serve` fails with "Only one usage of each socket address". Set the variable permanently instead, then quit and relaunch Ollama from the Start menu:

```powershell
setx OLLAMA_KEEP_ALIVE "30m"
taskkill /F /IM "ollama app.exe"
taskkill /F /IM ollama.exe
```

Check it with `curl http://127.0.0.1:11434` (it prints "Ollama is running") and, after a hold, `ollama ps`.

```bash
ollama pull gemma3n:e2b
ollama serve

cd mastra
npm install
npm run dev
```

Then in another terminal:

```bash
cd api
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-birdnet.txt   # birdnet 1.x
```

Copy `.env.example` to `.env`, set `CLASSIFIER=birdnet`, add your ElevenLabs key, then:

```bash
uvicorn app.main:app --reload --port 8000
```

Open `http://localhost:8000`.

**First run:** with `CLASSIFIER=birdnet`, the API downloads the BirdNET acoustic model (about 77 MB) while the server starts, so `Waiting for application startup` can sit on a progress bar for a couple of minutes. It is cached afterwards. Wait for `Application startup complete` before opening the page, and avoid editing files under `api/` meanwhile, since `--reload` would restart the download. The first hold after a cold start is also slower while Gemma loads.

## Demo mode

For the hosted Render demo or a machine without BirdNET installed:

```env
CLASSIFIER=demo
```

The observation is explicitly marked `source=demo`. It is never presented as genuine acoustic identification.

## Where it works best

Forest Echo is tuned for the **United States** first. BirdNET's training data and the eBird-based geo model that powers the location filter are densest in North America, with Europe close behind. Elsewhere it still works, but expect more misses and a thinner "likely near you" list, especially in parts of the tropics, Africa and Central Asia.

- It identifies **birds only**. Frogs, insects and mammals are not recognised, so a night walk in warm regions will often return silence.
- The demo species (American Robin, Northern Cardinal, Blue Jay) are common US birds and are always labelled `source=demo`.
- Use `CLASSIFIER=birdnet` with **Use my location** for the real thing; the location filter is the main accuracy gain. The same filter also means a bird that doesn't occur where you are is ignored, so turn location off when testing with a recording from elsewhere.
- Phones only allow the microphone and location over HTTPS (or `localhost`). To use the full local pipeline on a trail, reach your laptop through an HTTPS tunnel, and expect a failed hold wherever there is no mobile signal.

## Look and feel

The hold button is a small bird that reacts to what is happening: it breathes while idle, leans in and sends out ripples while you hold (a ring fills over the 5-second limit), tilts its head while identifying, sings while the note plays, and closes its eyes when silence returns. The sky is a pastel dawn by day and an indigo dusk when your device is in dark mode. Motion is switched off when the system asks for reduced motion.

The font is Fredoka (SIL Open Font License, `web/fonts/OFL.txt`), served from the app itself so the page makes no third-party requests.

## Voice and offline behaviour

With `ELEVENLABS_API_KEY` set, the note is spoken by ElevenLabs. Without it, the PWA speaks the note with the device's own on-device voice. The phone still needs to reach the server running BirdNET and Gemma, so this is not a standalone phone app.

## Fully offline (no internet)

Run `python api/scripts/prefetch_models.py` once while online (from `api/`, with `PYTHONPATH=.`), then start with `python run.py --offline`, which sets `OFFLINE_MODE=true` for you. The API then turns ElevenLabs off, blocks every outbound connection to a non-local address, and refuses to start if the models were not cached. BirdNET, the geo model and Gemma all run on your own computer, and your phone reaches it over a local network. See **[docs/OFFLINE.md](docs/OFFLINE.md)** for setup, how to prove it works with the network disconnected, and how to get the microphone working from a phone without internet. The start-up banner prints your phone's address, and `--https` serves the HTTPS a phone needs for the microphone. The app shell is cached by a service worker, so the page opens even when the server is out of reach.

## On-device mode (no server)

On-device mode runs the real BirdNET V2.4 model and its location model **inside the phone's browser** (LiteRT.js, TensorFlow Lite compiled to WebAssembly). After a one-time 75 MB "offline pack" download, a hold needs no server, no Wi-Fi and no signal. Notes use the curated species facts instead of Gemma, and the voice is the phone's own. In the page, open **On-device mode**, download the pack, and switch **Identify on this phone** on.

Prepare the models once with `python api/scripts/fetch_ondevice_assets.py`, then serve the `web/` folder over HTTPS. Setup, what is verified (the real models, against a Python reference, on a real recording) and its limits are in **[docs/ON_DEVICE.md](docs/ON_DEVICE.md)**. The BirdNET models are licensed CC BY-NC-SA 4.0 (non-commercial).

## Hands-free

Turn on **Hands-free** in the app, then press your headphones' play/pause button to capture about 4 seconds. A soft tick marks start and end. It works by keeping a silent audio session open so the OS routes media buttons to the page; support varies by phone and browser, and iOS may stop it when the screen locks, so the on-screen button is always available. The microphone is still only opened for the capture itself.

## Likely near you this week (opt-in location)

Tap **Use my location** to see which species BirdNET's open geo model predicts around you this week, with a ✓ on the ones you've already identified. It gives you a reason to go and listen for a particular bird, and it is only ever shown on screen, never pushed or spoken.

- Location is requested only when you tap, rounded to about 1 km, sent by POST (so it stays out of access logs) to the server you run, and not stored.
- While enabled, identifications are narrowed to species plausible at your location and week, which reduces false positives but can hide a genuinely rare visitor. Set `USE_LOCATION_FILTER=false` to turn that off.
- In demo mode the list is a labelled placeholder, not a prediction.

## Pocket mode and "where to look"

- **Pocket mode** (on by default, toggle under the bird). About 2.5 seconds after a note ends, the screen fades to black so you look up instead of down; tap anywhere to wake it. A web page cannot switch the display off, so this is an honest black overlay: it removes glare and saves power on OLED phones, and headphone-button capture keeps working underneath. It never covers a capture in progress.
- **Curated species facts** (`api/app/data/species_facts.json`). BirdNET returns only a label, so instead of letting a small model recall facts from memory, the app attaches a short vetted fact and a "where to look" cue for 33 common US birds. Each note carries exactly one of them (chosen deterministically from the recording, so it varies between holds), and species not in the file get no extra detail rather than an invented one. To add a bird, append an entry; `pytest` checks the file stays short, speakable and free of filler. The more surprising claims were checked against published sources; corrections are welcome.

## Quiet invitations (reasons to step out)

A card on the home screen, shown only when you open the app, gives a gentle reason to go outside. It never speaks, buzzes or notifies.

- **Best listening window.** From 30 minutes before sunrise to 2 hours after, computed on the device from your rounded location (about +/- 5 minutes). Without location it says early morning is usually best.
- **One bird to listen for this week.** Chosen from BirdNET's predicted species for your area, favouring birds that are catchable but not guaranteed (likelihood 0.2 to 0.7). It stays the same all week and gets a tick when you identify it. In demo mode it is labelled as a demo list.
- **Days outdoors.** Seven dots for the last seven days; a day counts if you ended a walk or identified a real sound. No streak-loss messaging.
- **Weekly calendar event.** One tap downloads a repeating "Step out and listen" event at the start of the best window. It is your calendar app, not Forest Echo, that decides whether to alert you, and you can edit or delete it there.

Privacy: only your opt-in choice is remembered so location can be restored quietly next time (when the browser has already granted permission). Coordinates are never stored. See `docs/PRODUCT_PHILOSOPHY.md` for the guardrails.

## Walk stats

Tap **Start walk** before you pocket the phone and **End walk** after. The summary shows the walk length, holds, identifications, and **screen-on time** as a share of the walk.

Screen-on time is measured with the browser's Page Visibility API: it counts while this page is visible and the pocket-mode black overlay is not showing, so it includes everything you do on the page (holding, reading, browsing the lists) and stops when the phone locks or you switch apps. It cannot see what you do in other apps, so it is a lower bound on total phone use, not the whole picture. If you reload the page mid-walk, the time it was closed is not counted.

## Life list

A lifetime list of every real species you have identified, kept on the device and shown on screen only. The first time a species is identified, the result card says **New to your life list**. It is never spoken (see rule 6 in `docs/PRODUCT_PHILOSOPHY.md`), and demo-mode birds are never counted. "Heard this week" below is the same idea limited to the last seven days.

When nothing is identified, the card adds one practical tip (closer, hold while it sings, get out of the wind), rotating each time. Also on screen only.

## Heard this week

The app keeps a local, on-screen list of species you've identified in the last 7 days (real identifications only, never demo results). It is never spoken.

## Environment

`api/.env.example`:

- `CLASSIFIER=demo|birdnet`
- `MASTRA_URL=http://localhost:4112`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `ELEVENLABS_MODEL_ID` (default `eleven_flash_v2_5`, tuned for low latency)
- `USE_LOCATION_FILTER` (default `true`), `LOCATION_FILTER_MIN_CONFIDENCE` (`0.03`), `NEARBY_MIN_CONFIDENCE` (`0.10`)
- `WIND_CUT_HZ` (default `200`; high-pass edge for BirdNET to ignore wind rumble)
- `MIN_CONFIDENCE` (default `0.25`; below this Forest Echo stays silent instead of guessing)
- `RATE_LIMIT_PER_MIN` (default `12`, per IP, protects a public demo's ElevenLabs quota)

`mastra/.env.example`:

- `OLLAMA_BASE_URL=http://127.0.0.1:11434/api`
- `GEMMA_MODEL=gemma3n:e2b`

## Automated evaluation (no manual listening)

`api/scripts/eval_location.py` downloads labelled Xeno-canto recordings (species, coordinates and date are in the metadata), trims each to a 5-second clip, and compares identification with and without the location filter. It needs a free Xeno-canto API key. It also has a `geo-sanity` command that checks the geo model returns region-appropriate species (New York vs London) with no audio at all. See the file's docstring for the three commands. Keep downloaded recordings out of the repo; each has its own licence.

## Testing

```bash
cd api
pip install -r requirements-dev.txt
pytest -q   # includes the offline guard, API, evaluation helpers and run.py launcher
```

```bash
cd mastra
npm install
npm test
```

The front-end helpers (sunrise window, weekly target, calendar file, screen-on clock, life list, on-device notes and audio helpers) have no dependencies. Five more tests run the real BirdNET models in WebAssembly when you point `FOREST_ECHO_MODELS` and `FOREST_ECHO_SOUNDSCAPE` at them (see `docs/ON_DEVICE.md`); otherwise those are skipped:

```bash
node --test "tests-web/*.test.js"
```

## Render

The included `render.yaml` deploys the FastAPI/PWA container in explicit demo mode. This avoids pretending a small hosted instance is running the full acoustic model.

The Docker build also fetches the BirdNET models (`FETCH_MODELS`, default `true`) so the hosted URL can serve on-device mode; the hosted *server* still runs the demo classifier. See [docs/ON_DEVICE.md](docs/ON_DEVICE.md).

**The Render service does not run Mastra or Gemma**, so the hosted demo uses the labelled local fallback narration. The full pipeline (BirdNET → Mastra → Gemma 3n) runs locally.

## Built with

Forest Echo's design goal is to make the AI interaction intentionally small: **notice → hold → hear → silence → keep walking**. A strong session is not the one with the most AI commentary. It is the one where the user spends the most time hearing the actual outdoors.

- **BirdNET** identifies the species from a short acoustic sample, on the server or on the phone.
- **Gemma 3n** (via Ollama) is the constrained naturalist writing layer and runs locally.
- **Mastra** orchestrates the observation-to-field-note flow as a typed workflow with a verification step, one retry and a safe fallback.
- **ElevenLabs** renders the short field note as spoken audio, then playback ends.
- **Render** hosts the public FastAPI/PWA surface, reproducibly deployed from `render.yaml`.

## Lessons learned

A personal write-up of what building this taught me is in **[docs/LESSONS_LEARNED.md](docs/LESSONS_LEARNED.md)**.

## Credits and licences

The application code is MIT licensed. BirdNET is a third-party dependency from the K. Lisa Yang Center for Conservation Bioacoustics at the Cornell Lab of Ornithology and Chemnitz University of Technology; its models are licensed CC BY-NC-SA 4.0 (non-commercial), so review its terms before any commercial deployment. LiteRT.js is Apache 2.0 (see `web/vendor/litert/NOTICE.txt`) and Fredoka is SIL OFL (see `web/fonts/OFL.txt`).
