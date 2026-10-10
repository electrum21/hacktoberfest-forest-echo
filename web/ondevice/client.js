/* Main-thread side of on-device mode: downloads the offline pack, decodes recorded audio, talks to the worker. */
(function (root) {
  'use strict';

  const MODELS_CACHE = 'forest-echo-models-v1'; // never cleared by shell updates (see sw.js)
  const PACK_KEY = 'forestEchoPack';
  const GLUE_BYTES_GUESS = 9.7e6; // size of the WebAssembly build, for the progress bar

  let worker = null;
  let nextId = 1;
  const pending = new Map();
  let loaded = null;       // Promise resolving once the engine is loaded in the worker
  let factsIndex;          // undefined = not tried yet, null = unavailable

  function supported() {
    return typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined' && 'caches' in root
      && typeof OfflineAudioContext !== 'undefined';
  }

  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker('/ondevice/worker.js');
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data); else p.reject(new Error(e.data.error));
    };
    worker.onerror = (e) => {
      for (const p of pending.values()) p.reject(new Error(e.message || 'on-device worker failed'));
      pending.clear();
      worker = null;
      loaded = null;
    };
    return worker;
  }

  function call(type, payload = {}, transfer = []) {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ensureWorker().postMessage({ id, type, ...payload }, transfer);
    });
  }

  // 'unsupported' | 'missing' (pack not downloaded) | 'downloaded'
  async function status() {
    if (!supported()) return 'unsupported';
    let saved;
    try { saved = JSON.parse(localStorage.getItem(PACK_KEY)); } catch (_) { saved = null; }
    if (!saved || !Array.isArray(saved.urls)) return 'missing';
    const cache = await caches.open(MODELS_CACHE);
    for (const u of saved.urls) if (!(await cache.match(u))) return 'missing';
    return 'downloaded';
  }

  async function fetchToCache(cache, url, onBytes) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Could not download ${url} (${res.status})`);
    const reader = res.body.getReader();
    const chunks = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      onBytes(value.length);
    }
    const type = res.headers.get('content-type') || 'application/octet-stream';
    await cache.put(url, new Response(new Blob(chunks, { type }), { headers: { 'content-type': type } }));
  }

  // Downloads the models and the right WebAssembly build into the browser's cache so identification works with no signal.
  async function downloadPack(onProgress = () => {}) {
    if (!supported()) throw new Error('This browser cannot run on-device mode.');
    const mres = await fetch('/models/manifest.json', { cache: 'no-store' });
    if (!mres.ok || !(mres.headers.get('content-type') || '').includes('json')) {
      throw new Error('This server has no on-device models yet.');
    }
    const manifest = await mres.json();
    const { relaxedSimd } = await call('probe');
    const glue = relaxedSimd ? 'litert_wasm_internal' : 'litert_wasm_compat_internal';
    const urls = [
      ...manifest.files.map((f) => `/models/${f.name}`),
      `/vendor/litert/${glue}.js`,
      `/vendor/litert/${glue}.wasm`,
    ];
    const total = manifest.files.reduce((s, f) => s + f.size, 0) + GLUE_BYTES_GUESS;
    let got = 0;
    const cache = await caches.open(MODELS_CACHE);
    for (const url of urls) {
      await fetchToCache(cache, url, (n) => { got += n; onProgress(Math.min(1, got / total)); });
    }
    localStorage.setItem(PACK_KEY, JSON.stringify({ urls, version: manifest.version || 1, savedAt: Date.now() }));
    try { await navigator.storage?.persist?.(); } catch (_) { /* best effort: asks the browser not to evict the pack */ }
    onProgress(1);
  }

  async function removePack() {
    localStorage.removeItem(PACK_KEY);
    loaded = null;
    if (worker) { worker.terminate(); worker = null; }
    await caches.delete(MODELS_CACHE);
  }

  function init() {
    if (!loaded) loaded = call('init').catch((e) => { loaded = null; throw e; });
    return loaded;
  }

  async function loadFacts() {
    if (factsIndex !== undefined) return factsIndex;
    try {
      const res = await fetch('/data/species_facts.json');
      factsIndex = res.ok ? root.ForestDsp.indexFacts(await res.json()) : null;
    } catch (_) {
      factsIndex = null; // notes still work, just without curated details
    }
    return factsIndex;
  }

  // Recorded audio (webm/mp4/ogg) -> mono Float32Array at 48 kHz, entirely in the browser.
  async function decode(blob) {
    const ctx = new OfflineAudioContext(1, 48000, 48000);
    const ab = await ctx.decodeAudioData(await blob.arrayBuffer());
    const channels = [];
    for (let c = 0; c < ab.numberOfChannels; c++) channels.push(ab.getChannelData(c));
    const mono = root.ForestDsp.monoMix(channels);
    return ab.sampleRate === 48000 ? mono : root.ForestDsp.resampleLinear(mono, ab.sampleRate, 48000);
  }

  // Same result shape the server returns, so the app handles both identically.
  async function analyze(blob, { lat = null, lon = null, week = null, streak = 1, localHour = 12 } = {}) {
    await init();
    const samples = await decode(blob);
    const seed = root.ForestDsp.seedFrom(samples); // before the buffer is transferred away
    const { detection } = await call('identify', { samples, lat, lon, week }, [samples.buffer]);
    if (!detection) return { detected: false, audio: false, message: "Couldn't pin that one down." };
    return root.ForestDsp.buildResult(detection, await loadFacts(), { seed, streakDays: streak, localHour });
  }

  async function nearby(lat, lon, week) {
    await init();
    const { species } = await call('nearby', { lat, lon, week });
    return species;
  }

  root.ForestOnDevice = { supported, status, downloadPack, removePack, init, analyze, nearby, decode };
})(typeof window !== 'undefined' ? window : globalThis);
