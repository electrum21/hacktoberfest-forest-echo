// Runs the REAL BirdNET models through the same LiteRT.js build the phone uses, and compares the results
// with a reference computed by TensorFlow Lite in Python (tests-web/fixtures/soundscape_ref.json).
//
// Skipped unless the model files and BirdNET's example soundscape are available:
//   FOREST_ECHO_MODELS=<dir with the 3 model files>  (default: web/models)
//   FOREST_ECHO_SOUNDSCAPE=<soundscape.wav>          (BirdNET-Analyzer's example/soundscape.wav)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadLiteRt, readWav, WASM_DIR } = require('./helpers/litert-node.cjs');
const D = require('../web/ondevice/dsp.js');
const { createEngine } = require('../web/ondevice/engine.js');

const models = process.env.FOREST_ECHO_MODELS || path.join(__dirname, '..', 'web', 'models');
const wav = process.env.FOREST_ECHO_SOUNDSCAPE || '';
const files = {
  acoustic: path.join(models, 'BirdNET_GLOBAL_6K_V2.4_Model_FP32.tflite'),
  geo: path.join(models, 'BirdNET_GLOBAL_6K_V2.4_MData_Model_V2_FP16.tflite'),
  labels: path.join(models, 'BirdNET_GLOBAL_6K_V2.4_Labels.txt'),
};
const have = Object.values(files).every((f) => fs.existsSync(f)) && wav && fs.existsSync(wav);
const ref = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'soundscape_ref.json'), 'utf8'));

let engine;
async function getEngine() {
  if (engine) return engine;
  engine = createEngine(loadLiteRt(), D);
  await engine.load({
    wasmPath: WASM_DIR + path.sep,
    acousticBytes: new Uint8Array(fs.readFileSync(files.acoustic)),
    geoBytes: new Uint8Array(fs.readFileSync(files.geo)),
    labelsText: fs.readFileSync(files.labels, 'utf8'),
  });
  return engine;
}
const opts = { skip: have ? false : 'model files or soundscape not available (see header)' };

test('real model: each 3 s window of a real soundscape gives the same species as the Python reference', opts, async () => {
  const e = await getEngine();
  const { samples, rate } = readWav(wav);
  assert.strictEqual(rate, 48000);
  let confident = 0;
  for (const w of ref.windows) {
    const clip = samples.subarray(w.start_s * rate, w.start_s * rate + D.WINDOW);
    const det = await e.identify({ samples: clip, minConf: 0.25 });
    if (w.p >= 0.25) {
      confident++;
      assert.ok(det, `window ${w.start_s}s: expected ${w.label}`);
      assert.strictEqual(`${det.scientific_name}_${det.species_name}`, w.label, `window ${w.start_s}s`);
      assert.ok(Math.abs(det.confidence - w.p) < 1e-3, `confidence ${det.confidence} vs ${w.p}`);
    } else {
      assert.strictEqual(det, null, `window ${w.start_s}s: reference was below threshold (${w.p})`);
    }
  }
  assert.ok(confident >= 5, 'the reference should contain several confident windows');
});

test('real model: silence is not identified as a bird', opts, async () => {
  const e = await getEngine();
  assert.strictEqual(await e.identify({ samples: new Float32Array(D.WINDOW) }), null);
});

test('real model: a 5 s clip (two windows) still works', opts, async () => {
  const e = await getEngine();
  const { samples, rate } = readWav(wav);
  const det = await e.identify({ samples: samples.subarray(0, 5 * rate) });
  assert.strictEqual(det.species_name, 'Black-capped Chickadee');
});

test('real geo model: Singapore and London lists match the reference and are region-appropriate', opts, async () => {
  const e = await getEngine();
  for (const [name, p] of Object.entries(ref.geo)) {
    const probs = await e.geoProbabilities(p.lat, p.lon, p.week);
    for (const t of p.top) assert.ok(Math.abs(probs[t.idx] - t.p) < 2e-3, `${name} ${t.label}: ${probs[t.idx]} vs ${t.p}`);
    const list = await e.nearby({ lat: p.lat, lon: p.lon, week: p.week, limit: 500 });
    assert.strictEqual(list.length, p.n_ge_010, `${name} species count`);
    assert.strictEqual(list[0].species_name, p.top[0].label.split('_')[1]);
  }
  const sg = new Set((await e.nearby({ lat: 1.35, lon: 103.82, week: 37, limit: 500 })).map((s) => s.species_name));
  const ldn = new Set((await e.nearby({ lat: 51.51, lon: -0.12, week: 37, limit: 500 })).map((s) => s.species_name));
  for (const bird of ['Yellow-vented Bulbul', 'Oriental Magpie-Robin', 'Collared Kingfisher']) assert.ok(sg.has(bird), bird);
  assert.ok(!ldn.has('Yellow-vented Bulbul'));
});

test('real geo filter changes the answer: a Singapore bird is rejected in London', opts, async () => {
  const e = await getEngine();
  const { samples, rate } = readWav(wav);
  const clip = samples.subarray(0, D.WINDOW); // Black-capped Chickadee (North American)
  assert.ok(await e.identify({ samples: clip }));
  const sg = await e.identify({ samples: clip, lat: 1.35, lon: 103.82, week: 37 });
  assert.strictEqual(sg, null, 'a North American chickadee should not be offered in Singapore');
});
