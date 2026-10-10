/* Pure, DOM-free helpers for on-device identification. Unit-tested in Node (`node --test tests-web/`).
 * Used by the main thread, the Web Worker, and the tests, so keep it free of browser APIs.
 */
(function (root) {
  'use strict';

  const RATE = 48000;          // BirdNET input sample rate
  const WINDOW = 144000;       // 3 seconds at 48 kHz: the model's fixed input length

  // ---------- audio ----------
  function monoMix(channels) {
    if (channels.length === 1) return Float32Array.from(channels[0]);
    const n = channels[0].length;
    const out = new Float32Array(n);
    for (const ch of channels) for (let i = 0; i < n; i++) out[i] += ch[i] / channels.length;
    return out;
  }

  function resampleLinear(x, from, to) {
    if (from === to) return Float32Array.from(x);
    const n = Math.max(1, Math.round((x.length * to) / from));
    const out = new Float32Array(n);
    const ratio = from / to;
    for (let i = 0; i < n; i++) {
      const pos = i * ratio;
      const i0 = Math.floor(pos);
      const i1 = Math.min(x.length - 1, i0 + 1);
      const frac = pos - i0;
      out[i] = x[Math.min(i0, x.length - 1)] * (1 - frac) + x[i1] * frac;
    }
    return out;
  }

  // Up to two 3-second windows from a 1-5 s clip: the start, and the end if the clip is longer than 3 s.
  // A clip shorter than 3 s is padded with silence.
  function windows(samples, size = WINDOW, maxWindows = 2) {
    const first = new Float32Array(size);
    first.set(samples.subarray(0, Math.min(size, samples.length)));
    const out = [first];
    if (samples.length > size && maxWindows > 1) out.push(Float32Array.from(samples.subarray(samples.length - size)));
    return out;
  }

  // ---------- model output ----------
  function sigmoid(z) {
    const c = Math.max(-15, Math.min(15, z)); // BirdNET clips logits the same way
    return 1 / (1 + Math.exp(-c));
  }

  function parseLabel(label) {
    const i = label.indexOf('_');
    return i < 0 ? { scientific: '', common: label.trim() } : { scientific: label.slice(0, i).trim(), common: label.slice(i + 1).trim() };
  }

  // Best species across windows (max probability), optionally limited to species plausible at the user's location.
  function bestDetection(windowLogits, labels, opts = {}) {
    const { minConf = 0.25, geoProbs = null, geoMin = 0.03 } = opts;
    let best = null;
    for (let w = 0; w < windowLogits.length; w++) {
      const logits = windowLogits[w];
      for (let i = 0; i < logits.length; i++) {
        if (geoProbs && geoProbs[i] < geoMin) continue;
        const p = sigmoid(logits[i]);
        if (p >= minConf && (!best || p > best.confidence)) best = { idx: i, confidence: p, window: w };
      }
    }
    if (!best) return null;
    const { scientific, common } = parseLabel(labels[best.idx]);
    return { species_name: common, scientific_name: scientific, confidence: best.confidence, window: best.window };
  }

  // Most likely species from the geo model's per-species probabilities.
  function topSpecies(probs, labels, { limit = 40, minProb = 0.1 } = {}) {
    const idx = [];
    for (let i = 0; i < probs.length; i++) if (probs[i] >= minProb) idx.push(i);
    idx.sort((a, b) => probs[b] - probs[a]);
    return idx.slice(0, limit).map((i) => {
      const { scientific, common } = parseLabel(labels[i]);
      return { species_name: common, scientific_name: scientific, likelihood: Math.round(probs[i] * 1000) / 1000 };
    });
  }

  // Small, stable hash of a recording, so the same clip always picks the same one-line detail
  // while different recordings of the same bird vary.
  function seedFrom(samples) {
    let h = 0x811c9dc5;
    const step = Math.max(1, Math.floor(samples.length / 512));
    for (let i = 0; i < samples.length; i += step) {
      h ^= Math.round(samples[i] * 32767) & 0xffff;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  // ---------- notes: mirrors api/app/services/facts.py + mastra.local_fallback ----------
  function normName(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function indexFacts(factsJson) {
    const bySci = new Map();
    const byCommon = new Map();
    for (const s of factsJson.species || []) {
      bySci.set(normName(s.scientific_name), s);
      byCommon.set(normName(s.common_name), s);
    }
    return { bySci, byCommon };
  }

  function lookupFact(index, scientific, common) {
    return index.bySci.get(normName(scientific)) || index.byCommon.get(normName(common)) || null;
  }

  function article(name) {
    const n = String(name).trim().toLowerCase();
    if (/^(eu|uni|use)/.test(n)) return 'a';
    return /^[aeiou]/.test(n) ? 'an' : 'a';
  }

  function quietBadge(streakDays, localHour) {
    if (localHour < 7) return ['BADGE_DAWN_CHORUS', 'Dawn Chorus Pioneer'];
    if (localHour >= 20) return ['BADGE_NIGHT_OWL', 'Nocturnal Tracker'];
    if (streakDays >= 5) return ['BADGE_SCREEN_MINIMAL', 'Eyes on the Trail'];
    return ['BADGE_NATURE_STEP', 'Trail Tracker'];
  }

  // One idea per note: where to look, or a fun fact, never both. With no seed it prefers the look cue.
  function buildResult(det, factsIndex, { seed = 0, streakDays = 1, localHour = 12 } = {}) {
    const entry = factsIndex ? lookupFact(factsIndex, det.scientific_name, det.species_name) : null;
    let habitat = entry ? entry.habitat : '';
    let lookTip = entry ? entry.look_tip : '';
    let funFact = entry ? entry.fun_fact : '';
    if (lookTip && funFact) {
      const useLook = !seed || (seed ^ normName(det.species_name).length) % 2 === 0;
      if (useLook) funFact = ''; else lookTip = '';
    }
    let text = `That’s ${article(det.species_name)} ${det.species_name}.`;
    const detail = lookTip || funFact;
    if (detail) text += ` ${detail}`;
    const [badgeId, badgeTitle] = quietBadge(Math.max(1, streakDays), localHour);
    return {
      detected: true,
      audio: false,
      species: {
        species_name: det.species_name,
        scientific_name: det.scientific_name,
        confidence: det.confidence,
        habitat,
        fun_fact: funFact,
        look_tip: lookTip,
        source: 'on-device',
      },
      narration: { spoken_text: text.slice(0, 280), badge_id: badgeId, badge_title: badgeTitle, source: 'on-device' },
    };
  }

  const api = {
    RATE, WINDOW, monoMix, resampleLinear, windows, sigmoid, parseLabel, bestDetection, topSpecies,
    seedFrom, normName, indexFacts, lookupFact, article, quietBadge, buildResult,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ForestDsp = api;
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);
