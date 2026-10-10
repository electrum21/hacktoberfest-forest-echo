const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const D = require('../web/ondevice/dsp.js');

const facts = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'web', 'data', 'species_facts.json'), 'utf8'));
const index = D.indexFacts(facts);

test('mono mix averages channels', () => {
  const m = D.monoMix([Float32Array.of(1, 0), Float32Array.of(0, 1)]);
  assert.deepStrictEqual(Array.from(m), [0.5, 0.5]);
});

test('resample changes length by the rate ratio and keeps a ramp monotonic', () => {
  const x = Float32Array.from({ length: 4410 }, (_, i) => i / 4410);
  const y = D.resampleLinear(x, 44100, 48000);
  assert.strictEqual(y.length, 4800);
  for (let i = 1; i < y.length; i++) assert.ok(y[i] >= y[i - 1] - 1e-6);
  assert.deepStrictEqual(Array.from(D.resampleLinear(Float32Array.of(1, 2), 48000, 48000)), [1, 2]);
});

test('windows: short clips are padded, 5 s clips give start and end windows', () => {
  const short = D.windows(new Float32Array(48000).fill(0.5));
  assert.strictEqual(short.length, 1);
  assert.strictEqual(short[0].length, D.WINDOW);
  assert.strictEqual(short[0][47999], 0.5); assert.strictEqual(short[0][48000], 0);
  const long = Float32Array.from({ length: 240000 }, (_, i) => i);
  const w = D.windows(long);
  assert.strictEqual(w.length, 2);
  assert.strictEqual(w[0][0], 0); assert.strictEqual(w[1][0], 240000 - D.WINDOW);
  assert.strictEqual(D.windows(new Float32Array(D.WINDOW)).length, 1); // exactly 3 s: one window
});

test('sigmoid clips like BirdNET does', () => {
  assert.ok(Math.abs(D.sigmoid(0) - 0.5) < 1e-9);
  assert.ok(D.sigmoid(100) < 1 && D.sigmoid(100) > 0.999);
  assert.strictEqual(D.sigmoid(100), D.sigmoid(15));
});

test('labels parse as scientific_common', () => {
  assert.deepStrictEqual(D.parseLabel('Pycnonotus goiavier_Yellow-vented Bulbul'), { scientific: 'Pycnonotus goiavier', common: 'Yellow-vented Bulbul' });
  assert.deepStrictEqual(D.parseLabel('Mystery'), { scientific: '', common: 'Mystery' });
});

const labels = ['Aa bb_Alpha Bird', 'Cc dd_Beta Bird', 'Ee ff_Gamma Bird'];

test('best detection: max over windows, threshold, and geo filter', () => {
  const w1 = Float32Array.of(-5, 0.5, -5);   // Beta ~0.62
  const w2 = Float32Array.of(2, -5, -5);     // Alpha ~0.88
  assert.strictEqual(D.bestDetection([w1, w2], labels).species_name, 'Alpha Bird');
  assert.strictEqual(D.bestDetection([w1, w2], labels).window, 1);
  assert.strictEqual(D.bestDetection([Float32Array.of(-3, -3, -3)], labels), null);          // nothing above 0.25
  const geo = Float32Array.of(0.01, 0.9, 0.9);                                              // Alpha not plausible here
  assert.strictEqual(D.bestDetection([w1, w2], labels, { geoProbs: geo }).species_name, 'Beta Bird');
});

test('top species sorted, limited, thresholded', () => {
  const t = D.topSpecies(Float32Array.of(0.5, 0.95, 0.05), labels, { limit: 2, minProb: 0.1 });
  assert.deepStrictEqual(t.map((s) => s.species_name), ['Beta Bird', 'Alpha Bird']);
  assert.strictEqual(t[0].likelihood, 0.95);
});

test('article picks a or an by sound', () => {
  assert.strictEqual(D.article('American Robin'), 'an');
  assert.strictEqual(D.article('European Starling'), 'a');
  assert.strictEqual(D.article('Blue Jay'), 'a');
});

test('on-device notes match the server for every curated species and for an unknown one', () => {
  const rows = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'notes_parity.json'), 'utf8'));
  assert.ok(rows.length > 30);
  for (const r of rows) {
    const out = D.buildResult({ species_name: r.common, scientific_name: r.scientific, confidence: 0.8 }, index, { streakDays: 1, localHour: 12 });
    assert.strictEqual(out.narration.spoken_text, r.text, r.common);
    assert.strictEqual(out.narration.badge_title, r.badge);
    assert.strictEqual(out.species.look_tip, r.look_tip);
    assert.strictEqual(out.species.fun_fact, r.fun_fact);
  }
});

test('result has the same shape the app already handles from the server', () => {
  const out = D.buildResult({ species_name: 'Blue Jay', scientific_name: 'Cyanocitta cristata', confidence: 0.9 }, index, { seed: 7 });
  assert.strictEqual(out.detected, true);
  assert.strictEqual(out.species.source, 'on-device');
  assert.ok(out.narration.spoken_text.startsWith('That’s a Blue Jay.'));
  assert.ok(out.narration.spoken_text.length <= 280);
});

test('seeded choice is stable per recording, varies across recordings, and never says both', () => {
  const det = { species_name: 'American Robin', scientific_name: 'Turdus migratorius', confidence: 0.9 };
  const texts = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const a = D.buildResult(det, index, { seed }), b = D.buildResult(det, index, { seed });
    assert.strictEqual(a.narration.spoken_text, b.narration.spoken_text);
    assert.ok(!(a.species.look_tip && a.species.fun_fact));
    texts.add(a.narration.spoken_text);
  }
  assert.strictEqual(texts.size, 2);
});

test('badge by time of day and streak', () => {
  assert.strictEqual(D.quietBadge(1, 5)[1], 'Dawn Chorus Pioneer');
  assert.strictEqual(D.quietBadge(1, 21)[1], 'Nocturnal Tracker');
  assert.strictEqual(D.quietBadge(6, 12)[1], 'Eyes on the Trail');
  assert.strictEqual(D.quietBadge(1, 12)[1], 'Trail Tracker');
});

test('seedFrom is deterministic and differs between recordings', () => {
  const a = Float32Array.from({ length: 5000 }, (_, i) => Math.sin(i));
  const b = Float32Array.from({ length: 5000 }, (_, i) => Math.cos(i));
  assert.strictEqual(D.seedFrom(a), D.seedFrom(Float32Array.from(a)));
  assert.notStrictEqual(D.seedFrom(a), D.seedFrom(b));
});
