/* Web Worker: runs BirdNET with LiteRT.js off the main thread so the page stays responsive.
 * Messages in: probe | init | identify | nearby.  Every reply is { id, ok, ... }.
 */
importScripts('/vendor/litert/litert.iife.js', '/ondevice/dsp.js', '/ondevice/engine.js');

const MODEL = {
  acoustic: '/models/BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite',
  geo: '/models/BirdNET_GLOBAL_6K_V2.4_MData_Model_V2_FP16.tflite',
  labels: '/models/BirdNET_GLOBAL_6K_V2.4_Labels.txt',
};

let engine = null;

async function fetchBytes(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

self.onmessage = async (e) => {
  const { id, type } = e.data;
  const reply = (ok, payload = {}) => self.postMessage({ id, ok, ...payload });
  try {
    if (type === 'probe') {
      // Which WebAssembly build this phone can run: the loader picks "internal" with relaxed SIMD, else "compat".
      reply(true, { relaxedSimd: await LiteRT.supportsFeature('relaxedSimd') });
    } else if (type === 'init') {
      const t0 = Date.now();
      engine = ForestEngine.createEngine(LiteRT, ForestDsp);
      const [acousticBytes, labelsBytes] = await Promise.all([fetchBytes(MODEL.acoustic), fetchBytes(MODEL.labels)]);
      let geoBytes = null;
      try { geoBytes = await fetchBytes(MODEL.geo); } catch (_) { /* location features are optional */ }
      await engine.load({
        wasmPath: '/vendor/litert/',
        acousticBytes,
        geoBytes,
        labelsText: new TextDecoder().decode(labelsBytes),
      });
      reply(true, { hasGeo: engine.hasGeo(), ms: Date.now() - t0 });
    } else if (type === 'identify') {
      const { samples, lat, lon, week } = e.data;
      reply(true, { detection: await engine.identify({ samples, lat, lon, week }) });
    } else if (type === 'nearby') {
      const { lat, lon, week } = e.data;
      reply(true, { species: await engine.nearby({ lat, lon, week }) });
    } else {
      reply(false, { error: `unknown message ${type}` });
    }
  } catch (err) {
    reply(false, { error: String((err && err.message) || err) });
  }
};
