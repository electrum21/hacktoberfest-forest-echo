# Running Forest Echo with no internet

## What "offline" means here

| Level | What it means | Status |
|---|---|---|
| **A. No internet needed** | BirdNET, the geo model and Gemma all run on your own computer; nothing is sent to any cloud service. | Built (`OFFLINE_MODE=true`) |
| **B. Phone on a local network** | A phone reaches that computer over Wi-Fi with no internet connection at all (a travel router, a hotspot with mobile data off, or a home router with its uplink unplugged). | Supported, setup below |
| **C. Everything on the phone** | The models run inside the phone's browser. | Built. See [ON_DEVICE.md](ON_DEVICE.md) |

Levels A and B run with no internet, but they are not a standalone phone app: the phone must stay within Wi-Fi range of the computer running the models. Level C removes that requirement.

## 1. One-time setup (online)

```bash
cd api
pip install -r requirements.txt -r requirements-birdnet.txt
PYTHONPATH=. python scripts/prefetch_models.py   # downloads the BirdNET acoustic + geo models, then proves they load

ollama pull gemma3n:e2b                          # the narration model
cd ../mastra && npm install
```

Install ffmpeg as well, since it cannot be fetched later. In `api/.env`:

```env
CLASSIFIER=birdnet
OFFLINE_MODE=true
```

## 2. What OFFLINE_MODE does

- Turns **ElevenLabs off**, even if a key is set. The phone speaks the note with its own on-device voice.
- **Blocks every outbound connection from the API** to a non-local address (anything other than loopback and private LAN ranges). If BirdNET or any library tried to reach the internet, it fails loudly instead of quietly working because the network happened to be on.
- Refuses to start, with a clear message, if the models were never prefetched.
- Reports `"offline": true` at `/health`.

The guard covers the Python API. Ollama and Mastra are separate local processes.

## 3. Verifying it

1. Make sure Ollama is running, then run `python run.py --offline`. It starts Mastra and the API with `CLASSIFIER=birdnet` and `OFFLINE_MODE=true`, and prints the addresses to open.
2. `http://localhost:8000/health` should show `"classifier":"birdnet"` and `"offline":true`.
3. Disconnect the computer from the internet.
4. Open `http://localhost:8000` and hold the button near a bird recording. You should still get an identification and a spoken note.

A note that reads like a sentence of natural history came from Gemma. A bare "That's a [species]." is the built-in fallback, which means Mastra or Ollama was not reachable.

## 4. Using it from a phone with no internet

Browsers only allow the microphone on HTTPS or `localhost`.

**Step 1: put both devices on one network with no uplink.** For example a travel router, a home router with its internet cable unplugged, or an Android hotspot with mobile data off. (iPhone hotspots generally need cellular data enabled.)

**Step 2: start Forest Echo so the phone can reach it.**

```bash
python run.py --offline
```

The start-up banner prints the address to open on the phone, for example `http://192.168.1.20:8000`. Allow Python through the firewall for private networks when asked.

**Step 3: enable the microphone over a local address.** Either:

- **Android Chrome:** open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add the address, enable the flag and relaunch Chrome; or
- **Any phone:** serve HTTPS with a certificate the phone trusts, for example with [mkcert](https://github.com/FiloSottile/mkcert):
  ```bash
  mkcert -install
  mkcert 192.168.1.20
  python run.py --offline --https 192.168.1.20.pem 192.168.1.20-key.pem
  ```
  Install mkcert's root certificate on the phone (`mkcert -CAROOT` shows where it is). On iPhone, also enable trust for it under Settings, General, About, Certificate Trust Settings.

**Step 4: add the page to the home screen.** The app shell is cached by a service worker, so it opens even when the server is out of reach.

This works while the phone stays within Wi-Fi range of the computer, typically tens of metres and less through trees and walls.

## 5. What works with no internet

| Feature | Offline? |
|---|---|
| Identification (BirdNET) | Yes, on your computer |
| "Near you this week" and the location filter | Yes, the geo model is local; GPS needs no internet |
| Gemma field note | Yes, via Ollama |
| Voice | Yes, the phone's on-device voice (quality varies by phone); ElevenLabs is off |
| Sunrise window, life list, walk stats | Yes, computed on the phone |
| Opening the app | Yes after the first visit (cached shell, `web/sw.js`) |
| Identification when the computer is out of range | No. The app says "Can't reach your Forest Echo server" |

## Troubleshooting

- **"OFFLINE_MODE is on but the BirdNET models are not cached yet":** run `scripts/prefetch_models.py` while online.
- **`run.py` says Mastra was not started:** run `npm install` in `mastra/`, or pass `--no-mastra` and notes use the built-in fallback.
- **`run.py` says Ollama is not reachable:** start the Ollama app (or `ollama serve`) and run `ollama pull gemma3n:e2b` once.
- **The note is always "That's a [species].":** Mastra or Ollama is not running or not loaded.
- **"Can't reach your Forest Echo server":** wrong address, firewall, different network, or out of range.
- **The microphone prompt never appears on the phone:** the page is not served over HTTPS or flagged as secure (Step 3).
- **A changed web file does not show on the phone:** bump `CACHE` in `web/sw.js`, then reload twice.
