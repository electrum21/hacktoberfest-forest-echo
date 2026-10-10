const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const vm = require('node:vm');

// Run sw.js against minimal fakes of the service worker globals.
function load({ cacheEntries = {}, fetchImpl }) {
  const handlers = {};
  const store = new Map(Object.entries(cacheEntries));
  const cache = {
    match: async (k) => store.get(k),
    put: async (k, v) => { store.set(k, v); },
    addAll: async () => {},
  };
  const ctx = {
    self: { location: { origin: 'http://x' }, addEventListener: (t, f) => { handlers[t] = f; }, skipWaiting: () => {}, clients: { claim: () => {} } },
    caches: { open: async () => cache, keys: async () => [], delete: async () => true },
    fetch: fetchImpl,
    URL,
  };
  vm.runInNewContext(fs.readFileSync(__dirname + '/../web/sw.js', 'utf8'), ctx);
  return { handlers, store };
}
const ev = (path, method = 'GET', origin = 'http://x') => {
  const e = { request: { method, url: origin + path }, responded: undefined };
  e.respondWith = (p) => { e.responded = p; };
  return e;
};

test('API calls and non-shell paths are never intercepted', () => {
  const { handlers } = load({ fetchImpl: async () => ({ ok: true }) });
  for (const path of ['/api/v1/analyze', '/health', '/something-else']) {
    const e = ev(path); handlers.fetch(e); assert.strictEqual(e.responded, undefined, path);
  }
  const post = ev('/app.js', 'POST'); handlers.fetch(post); assert.strictEqual(post.responded, undefined);
  const other = ev('/app.js', 'GET', 'http://evil'); handlers.fetch(other); assert.strictEqual(other.responded, undefined);
});

test('shell file is served from cache when the network is down', async () => {
  const { handlers } = load({ cacheEntries: { '/app.js': 'CACHED' }, fetchImpl: async () => { throw new TypeError('offline'); } });
  const e = ev('/app.js'); handlers.fetch(e);
  assert.strictEqual(await e.responded, 'CACHED');
});

test('uncached shell file with no network fails instead of faking it', async () => {
  const { handlers } = load({ fetchImpl: async () => { throw new TypeError('offline'); } });
  const e = ev('/app.js'); handlers.fetch(e);
  await assert.rejects(e.responded, TypeError);
});

test('online fetch refreshes the cache in the background', async () => {
  const fresh = { ok: true, clone() { return 'FRESH'; } };
  const { handlers, store } = load({ cacheEntries: { '/': 'OLD' }, fetchImpl: async () => fresh });
  const e = ev('/'); handlers.fetch(e);
  assert.strictEqual(await e.responded, 'OLD');       // instant answer from cache
  await new Promise((r) => setTimeout(r, 10));
  assert.strictEqual(store.get('/'), 'FRESH');          // refreshed for next time
});

test('offline pack files come from the pack cache and are never cached automatically', async () => {
  const bytes = { x: 1 };
  let fetched = 0;
  const { handlers, store } = load({ cacheEntries: { '/models/m.tflite': bytes }, fetchImpl: async () => { fetched++; return { ok: true, clone() { return 'NET'; } }; } });
  const hit = ev('/models/m.tflite'); handlers.fetch(hit);
  assert.strictEqual(await hit.responded, bytes);
  assert.strictEqual(fetched, 0);
  const miss = ev('/vendor/litert/litert_wasm_internal.wasm'); handlers.fetch(miss);
  assert.strictEqual((await miss.responded).ok, true);          // not downloaded yet: falls through to the network
  assert.strictEqual(fetched, 1);
  assert.strictEqual(store.has('/vendor/litert/litert_wasm_internal.wasm'), false);
});

test('shell includes the on-device scripts, and the models cache survives shell updates', () => {
  const src = fs.readFileSync(__dirname + '/../web/sw.js', 'utf8');
  for (const f of ['/ondevice/client.js', '/ondevice/worker.js', '/vendor/litert/litert.iife.js', '/data/species_facts.json']) assert.ok(src.includes(`'${f}'`), f);
  assert.match(src, /k !== CACHE && k !== MODELS_CACHE/);
});
