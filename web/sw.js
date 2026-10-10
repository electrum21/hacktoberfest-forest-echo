/* Forest Echo service worker: caches the app shell so the page opens with no connection.
 *
 * The static shell is cached automatically. The offline pack for on-device mode is cached only when asked.
 * Every /api call goes straight to the network: in server mode identification runs on your own server, and
 * if it is out of reach the app says so; it does not pretend to identify anything.
 *
 * Bump CACHE whenever you change a shell file, so phones pick up the new version.
 */
const CACHE = 'forest-echo-shell-v4';
// The offline pack (BirdNET models + WebAssembly runtime) lives in its own cache, filled only when the
// user taps "Download offline pack", and it is NOT cleared when the shell version changes.
const MODELS_CACHE = 'forest-echo-models-v1';
const SHELL = [
  '/',
  '/app.js',
  '/invite.js',
  '/trail.js',
  '/ui.js',
  '/manifest.webmanifest',
  '/fonts/fredoka-latin-wght.woff2',
  '/ondevice/dsp.js',
  '/ondevice/engine.js',
  '/ondevice/worker.js',
  '/ondevice/client.js',
  '/vendor/litert/litert.iife.js',
  '/data/species_facts.json',
];

const isPackPath = (p) => p.startsWith('/models/') || p.startsWith('/vendor/litert/litert_wasm');

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== MODELS_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Stale-while-revalidate for shell files: instant (and offline-safe), refreshed in the background.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Offline pack: serve from its cache when downloaded, otherwise go to the network (never auto-cached).
  if (isPackPath(url.pathname)) {
    event.respondWith(
      caches.open(MODELS_CACHE).then((c) => c.match(url.pathname)).then((hit) => hit || fetch(req)),
    );
    return;
  }
  if (!SHELL.includes(url.pathname)) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(url.pathname);
      const refresh = fetch(req).then((res) => {
        if (res.ok) cache.put(url.pathname, res.clone());
        return res;
      });
      if (cached) { refresh.catch(() => {}); return cached; }
      return refresh;
    }),
  );
});
