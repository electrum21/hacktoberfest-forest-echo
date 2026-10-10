/* On-device BirdNET engine: runs the real BirdNET V2.4 acoustic model and the BirdNET meta (geo) model
 * with LiteRT.js (TFLite compiled to WebAssembly). No DOM: runs in a Web Worker and in Node tests.
 */
(function (root) {
  'use strict';

  function createEngine(LiteRT, dsp) {
    let acoustic = null;
    let geo = null;
    let labels = null;

    async function run(model, data, shape) {
      const input = new LiteRT.Tensor(data, shape);
      const outputs = await model.run(input);
      const copy = Float32Array.from(outputs[0].toTypedArray()); // copy before freeing the WASM-side buffer
      input.delete?.();
      for (const t of outputs) t.delete?.();
      return copy;
    }

    async function load({ wasmPath, acousticBytes, geoBytes, labelsText }) {
      await LiteRT.loadLiteRt(wasmPath);
      acoustic = await LiteRT.loadAndCompile(acousticBytes, { accelerator: 'wasm' });
      geo = geoBytes ? await LiteRT.loadAndCompile(geoBytes, { accelerator: 'wasm' }) : null;
      labels = labelsText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (labels.length !== 6522) throw new Error(`Unexpected label count ${labels.length} (expected 6522)`);
    }

    async function geoProbabilities(lat, lon, week) {
      if (!geo) return null;
      return run(geo, new Float32Array([lat, lon, week]), [1, 3]);
    }

    // samples: mono Float32Array at 48 kHz.
    async function identify({ samples, lat = null, lon = null, week = null, minConf = 0.25, geoMin = 0.03 }) {
      const logits = [];
      for (const w of dsp.windows(samples)) logits.push(await run(acoustic, w, [1, dsp.WINDOW]));
      const geoProbs = lat != null && lon != null && week != null ? await geoProbabilities(lat, lon, week) : null;
      return dsp.bestDetection(logits, labels, { minConf, geoProbs, geoMin });
    }

    async function nearby({ lat, lon, week, limit = 40, minProb = 0.1 }) {
      const probs = await geoProbabilities(lat, lon, week);
      if (!probs) throw new Error('Geo model is not loaded');
      return dsp.topSpecies(probs, labels, { limit, minProb });
    }

    return { load, identify, nearby, geoProbabilities, hasGeo: () => !!geo };
  }

  const api = { createEngine };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ForestEngine = api;
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);
