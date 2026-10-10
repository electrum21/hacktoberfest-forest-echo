# What I learned building Forest Echo

I started this project with one idea: an AI that talks less, not more. Most of what I learned came from trying to keep that promise, and from the places where the software surprised me.

## Silence is the hard part

Making an app speak is easy. Making it stop is a design problem. Every feature I wanted to add (spoken badges, a "keep going" line, a streak message) was another way to compete with the birds I was trying to help someone hear. I ended up writing the rules down in `PRODUCT_PHILOSOPHY.md` so I could check each new feature against them. Several good ideas didn't survive that check, and the project is better for it.

Pocket mode taught me a smaller version of the same thing. A web page can't switch a phone's screen off, so I stopped pretending and used an honest black overlay. Being clear about what the technology can't do turned out to be easier than working around it.

## A small model is good at phrasing and bad at remembering

My first instinct was to let Gemma supply the interesting fact about each bird. That was a mistake. BirdNET gives back only a label, and a small model will happily make up natural history that sounds right. So I split the job: the facts come from a short file I can check, and Gemma only words them. Birds that aren't in the file get no extra detail at all, because saying less seemed better than saying something false.

The verification step came from the same lesson. A prompt asking for "one short sentence" is a request, not a guarantee. A checker that counts words, rejects questions and badge talk, retries once and then falls back to a plain note gave me something I could rely on.

## Label what's real

The hosted demo can't run BirdNET and Gemma on a small free server, so it runs a demo classifier. I'd rather say so on the screen than let anyone think a hard-coded bird was a real identification. The same goes for the speech, the offline mode and the on-device mode. I wrote down exactly what each one does and doesn't do, and where something is closed (ElevenLabs), I said that too.

## Tests passing didn't mean it worked in a browser

My automated tests passed, including ones that ran the real BirdNET models in WebAssembly. Then I opened the app in a real browser and on-device mode failed. The runtime was looking for its `.wasm` file next to the worker script, and the file was somewhere else. The server answered with a JSON "not found" instead of a binary, and the error message about a "magic word" was really the first few characters of that JSON.

The tests ran in Node, where that path logic is different. Now I treat "works in the test runner" and "works on a phone" as two separate claims, and I only make the second one after trying it.

## Birds are tied to places

I tested with an Asian koel and it identified correctly. Before that, I had no idea that BirdNET's location filter would reject a bird that doesn't live where I am. Once I understood it, it made sense: it's why the app can cut false positives. But it also means a bird from another continent gets "Nothing identified" when location is on. If I'd shown the app to someone without knowing this, I'd have assumed it was broken. It's now something I explain up front.

## The microphone isn't neutral

Browsers apply echo cancellation, noise suppression and auto-gain to the microphone by default. They're built for phone calls, and they treat a bird call as noise. I switched them off for capture so the app hears the raw signal. I haven't measured how much difference it makes, but it was the right default for an app that is trying to listen to the outdoors.

## Smaller lessons

- **Privacy is easier when the models are open.** Because BirdNET and its location model can run locally, even on the phone, coordinates and audio don't have to leave the device.
- **Offline needs proof, not intent.** The guard that blocks outbound connections exists so that "offline" can't quietly succeed because the Wi-Fi happened to be on.
- **Cache versions matter.** A service worker keeps old files alive. Bumping a version number is boring and easy to forget, and phones will show you stale code until you do.
- **Small console errors count.** A missing favicon doesn't break anything, but it's the first red line a reviewer sees.

## The technologies, and what each one taught me

**BirdNET.** I had to understand what the model actually outputs before I could use it well. It listens in fixed 3-second windows of 48 kHz audio and gives a score for each of about 6,500 labels. Each score is independent (a sigmoid per species, not one softmax across all of them), so several birds can score high at once and "nothing" is a valid answer. That's why a confidence threshold, not a "top result", decides whether the app speaks. A hold shorter than 3 seconds has to be padded, and a longer one is scored on its start and its end. BirdNET also has a separate location model that takes latitude, longitude and the week of the year and returns how likely each species is there. That second model is what makes the "near you this week" list and the false-positive filter possible.

**Ollama and Gemma 3n.** Running a language model locally is mostly a question of keeping it warm. Ollama unloads a model after a few minutes, and the next request then pays for loading it again, so `OLLAMA_KEEP_ALIVE` matters more than I expected. I also learned how much a small model needs from its prompt and its checker, which is why the facts are curated and the output is verified.

**Mastra.** I used it to make the flow explicit: observation, badge, draft, verify, with a retry and a safe fallback. Writing it as a typed workflow forced me to decide what each step receives and returns, and to decide what happens when a step fails. That is more useful than the model call itself.

**FastAPI and ffmpeg.** Browsers record audio in different containers (WebM on most, MP4 on older iPhones), so the server decodes with ffmpeg rather than assuming one format. I also added a per-IP rate limit, because a public demo with a text-to-speech key behind it needs one.

**LiteRT.js and WebAssembly.** This was the biggest new area for me. TensorFlow Lite models can run in the browser when the runtime is compiled to WebAssembly. The runtime ships in more than one build, and the page has to pick one the phone supports (a faster "relaxed SIMD" build, or a compatibility build). It runs in a Web Worker so the page doesn't freeze while the model runs, and where it looks for its files depends on where the worker script lives, as I found out the hard way.

**Service workers and browser storage.** A service worker plus Cache Storage is what lets the page open, and the models load, with no connection. The details matter: separate caches for the app shell and the offline pack, version numbers that decide when old files are replaced, and browsers that can still evict data unless the site is installed to the home screen.

**Web platform APIs.** Several features rest on browser APIs I hadn't used together before: `MediaRecorder` and `decodeAudioData` for capture, the Page Visibility API for the screen-on measurement, the Media Session API for the headphone button, and the Wake Lock API to keep the phone awake during a hold. Each behaves a little differently across phones, so I made each one optional rather than essential.

**ElevenLabs and Render.** I used ElevenLabs' low-latency Flash model, because a few seconds of delay between letting go of the button and hearing the note feels long. I used Render for hosting through a Docker build that fetches the models at build time, so the live URL can serve the offline pack.

## What I'd do next

- Add openly licensed photos for the curated birds, with credit, on the result card.
- Grow the facts file beyond 33 US birds, and get other people to check it.
- Test on more phones and browsers, especially for on-device decoding and memory use.
- Cover frogs, insects and mammals. A night walk in a warm place shouldn't return silence every time.
