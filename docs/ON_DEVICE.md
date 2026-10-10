# On-device mode: BirdNET running on the phone

On-device mode runs the real **BirdNET V2.4** model, and BirdNET's **location (geo) model**, inside the phone's browser using
[LiteRT.js](https://ai.google.dev/edge/litert/web) (TensorFlow Lite compiled to WebAssembly). Once the offline pack is downloaded,
a hold needs **no server, no Wi-Fi and no signal**: the sound is decoded, identified, turned into a note and spoken on the phone.

```
hold -> MediaRecorder -> decodeAudioData (48 kHz mono) -> Web Worker: BirdNET + geo model (WebAssembly)
     -> curated note (species_facts.json) -> the phone's own voice -> silence
```

## How it differs from server mode

| | Server mode | On-device mode |
|---|---|---|
| Identification | BirdNET on your computer | BirdNET in the browser (same V2.4 model) |
| Location filter, "near you" list | Server geo model | Geo model in the browser; location never leaves the phone |
| Note | Gemma through Mastra, or the built-in fallback | Curated facts only (no language model on the phone) |
| Voice | ElevenLabs, or the phone's voice | The phone's voice |
| Needs | A computer within reach | A one-time 75 MB download |

On-device notes use the same curated file as the server's fallback, and a test checks they match word for word. Birds outside the
33 curated species get just "That's a ...".

## 1. Prepare the files (once, on a computer, online)

```powershell
pip install ai-edge-litert flatbuffers numpy          # setup only: checks and patches the location model
cd api
python scripts\fetch_ondevice_assets.py                # fills web\models\ (about 67 MB)
```

The script downloads `birdnetlib 0.18.1` from PyPI (it bundles the BirdNET models), verifies pinned checksums, patches the
location model's batch size so the browser runtime accepts it (and proves the outputs are identical), and writes `manifest.json`.

## 2. Serve the `web/` folder

- **From your own computer:** `python run.py`, then open the address it prints. Fine for testing. A phone needs HTTPS for the
  microphone (see `docs/OFFLINE.md`).
- **On Render (the included `render.yaml`):** the Docker build fetches the models in a separate build stage (`FETCH_MODELS=true`, the default), so the live URL serves the app and the offline pack over HTTPS. The build downloads about 60 MB and needs the `ai-edge-litert` package at build time only; set `FETCH_MODELS` to `false` to skip it. The free plan sleeps after inactivity, which only matters before the pack is downloaded.
- **From any static host with HTTPS** (Render static site, Netlify, Cloudflare Pages, GitHub Pages): publish the `web/` folder
  after running the script above. This is the setup that needs no computer at all once the phone has downloaded the pack. The
  models are 52 MB and 15 MB files, so check your host's file size limits.

## 3. On the phone

1. Open the page over HTTPS **once, with a connection**. Reload once so the service worker is active.
2. On iPhone use **Add to Home Screen**; Safari clears the storage of ordinary sites it hasn't seen for a week, but not of installed apps.
3. Open **On-device mode**, tap **Download offline pack**, wait for it to finish, and leave **Identify on this phone** on.
4. Turn on airplane mode and hold the button near a bird. If it still identifies, it's working offline.

## Verification

Automated tests (`node --test "tests-web/*.test.js"`, with `FOREST_ECHO_MODELS` and `FOREST_ECHO_SOUNDSCAPE` set; see "For developers") run the real models:

- The real BirdNET acoustic model runs in the same LiteRT.js build the phone uses. For ten consecutive 3-second windows of BirdNET's example soundscape it gives the same species and the same confidence (within 0.001) as TensorFlow Lite in Python. Silence is not identified as a bird.
- The geo model matches the Python reference, gives Singapore and London very different lists (469 and 102 species at 0.10 or above, for week 37), and the location filter rejects a North American chickadee in Singapore.
- On-device notes match the server's curated notes word for word.
- The offline-pack cache logic and the page's on-device flow are covered, with the browser-only parts stubbed.

On a server CPU one 3-second window takes about 240 ms; expect longer on a phone.

## Device support

On-device mode depends on the phone's browser:

- `decodeAudioData` must accept what the phone's `MediaRecorder` produces (WebM on Android and recent iOS, MP4 on older iOS).
- The 52 MB model plus the WebAssembly runtime is heavy for older phones. The runtime picks a "relaxed SIMD" build when the phone supports it and a compatibility build otherwise.
- Browsers without Web Workers or WebAssembly are told so in the page, and server mode remains available by leaving **Identify on this phone** off.

## Limits

- Birds only, and BirdNET's usual accuracy limits apply. A 3-second window is scored on the first 3 seconds plus, for longer holds, the last 3 seconds.
- Geo and acoustic models are BirdNET **V2.4** versions bundled in `birdnetlib 0.18.1`. Your server mode uses the `birdnet` package's own copy, which may differ slightly.
- The location list is island-wide in a place like Singapore. The model has coarse resolution.
- Licence: the models are **CC BY-NC-SA 4.0, non-commercial**. Credit the BirdNET team (Cornell Lab of Ornithology and Chemnitz University of Technology). The licence text is in `web/models/` after the fetch script runs.

## Troubleshooting

- **"This server has no on-device models yet":** run `fetch_ondevice_assets.py` and make sure `web/models/manifest.json` is being served.
- **"Reload the page once so offline caching is active":** the service worker isn't controlling the page yet. Reload, then retry.
- **Download stalls or fails:** the host may be limiting large files, or the connection dropped. Tap Download again; finished files are re-fetched.
- **Identifies on Wi-Fi but not offline:** the pack didn't finish caching, or the browser cleared it. Remove the pack and download again.

## For developers

- Run the real-model tests:
  ```powershell
  $env:FOREST_ECHO_MODELS="web\models"
  # BirdNET's example recording (11 MB): https://raw.githubusercontent.com/birdnet-team/BirdNET-Analyzer/main/birdnet_analyzer/example/soundscape.wav
  $env:FOREST_ECHO_SOUNDSCAPE="C:\path\to\soundscape.wav"
  node --test "tests-web/*.test.js"
  ```
  Without those variables the five real-model tests are skipped and everything else runs.
- Regenerate the reference fixtures: `cd api; python scripts/make_ondevice_fixtures.py --models <dir> --soundscape <wav>`.
- Rebuild the LiteRT.js bundle: see `web/vendor/litert/NOTICE.txt`.
