// Runs the shipped LiteRT.js bundle in Node by emulating just enough of a Web Worker.
// (In the browser it runs inside a real Worker; see web/ondevice/worker.js.)
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const WASM_DIR = path.join(__dirname, '..', '..', 'web', 'vendor', 'litert');

function loadLiteRt() {
  if (globalThis.LiteRT) return globalThis.LiteRT;
  globalThis.self = globalThis;
  globalThis.require = require;
  globalThis.__filename = path.join(WASM_DIR, 'litert.iife.js');
  globalThis.__dirname = WASM_DIR; // the emscripten glue finds the .wasm next to itself
  globalThis.importScripts = (u) => {
    const p = u.startsWith('file://') ? new URL(u).pathname : u;
    vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p });
  };
  vm.runInThisContext(fs.readFileSync(path.join(WASM_DIR, 'litert.iife.js'), 'utf8'), { filename: 'litert.iife.js' });
  return globalThis.LiteRT;
}

// Minimal 16-bit PCM WAV reader (enough for BirdNET's example soundscape).
function readWav(file) {
  const b = fs.readFileSync(file);
  let o = 12, fmt = null, data = null;
  while (o + 8 <= b.length) {
    const id = b.toString('ascii', o, o + 4), size = b.readUInt32LE(o + 4);
    if (id === 'fmt ') fmt = { ch: b.readUInt16LE(o + 10), rate: b.readUInt32LE(o + 12), bits: b.readUInt16LE(o + 22) };
    if (id === 'data') { data = b.subarray(o + 8, o + 8 + size); break; }
    o += 8 + size + (size % 2);
  }
  if (!fmt || !data || fmt.bits !== 16) throw new Error('expected 16-bit PCM wav');
  const n = data.length / 2 / fmt.ch, out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let c = 0; c < fmt.ch; c++) s += data.readInt16LE((i * fmt.ch + c) * 2); out[i] = s / fmt.ch / 32768; }
  return { samples: out, rate: fmt.rate };
}

module.exports = { WASM_DIR, loadLiteRt, readWav };
