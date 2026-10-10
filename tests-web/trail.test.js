const test = require('node:test');
const assert = require('node:assert');
const T = require('../web/trail.js');

test('screen clock accumulates only while lit', () => {
  let c = { litMs: 0, litSince: null };
  c = T.setLit(c, true, 1000);
  c = T.setLit(c, true, 2000);           // already lit: no change
  assert.strictEqual(T.litTotal(c, 4000), 3000);
  c = T.setLit(c, false, 5000);
  c = T.setLit(c, false, 9000);          // already dark: no change
  assert.strictEqual(T.litTotal(c, 20000), 4000);
  c = T.setLit(c, true, 30000);
  c = T.setLit(c, false, 31000);
  assert.strictEqual(T.litTotal(c, 99999), 5000);
});

test('clock never goes negative if time moves backwards', () => {
  let c = T.setLit({ litMs: 0, litSince: null }, true, 5000);
  c = T.setLit(c, false, 4000);
  assert.strictEqual(T.litTotal(c, 6000), 0);
});

test('duration and share formatting', () => {
  assert.strictEqual(T.fmtDuration(42000), '42 s');
  assert.strictEqual(T.fmtDuration(125000), '2 min 05 s');
  assert.strictEqual(T.share(100000, 20), '<0.1%');
  assert.strictEqual(T.share(100000, 2800), '2.8%');
  assert.strictEqual(T.share(100000, 30000), '30%');
  assert.strictEqual(T.share(100, 500), '100%');
});

test('walk summary uses screen-on time, falls back for older walks', () => {
  const base = { start: 0, end: 2520000, holds: 5, idents: 4 };
  assert.match(T.walkSummary({ ...base, litMs: 72000, interactMs: 31000 }), /42 min 00 s · 5 holds · 4 identified · screen on 1 min 12 s \(2\.9%\)/);
  assert.match(T.walkSummary({ ...base, holds: 1, interactMs: 31000 }), /1 hold · 4 identified · app interaction 31 s/);
});

test('life list flags only the first time', () => {
  let r = T.addToLife({}, 'American Robin', 100);
  assert.strictEqual(r.isNew, true);
  r = T.addToLife(r.list, 'American Robin', 200);
  assert.strictEqual(r.isNew, false);
  assert.deepStrictEqual(r.list['American Robin'], { first: 100, last: 200, n: 2 });
  r = T.addToLife(r.list, 'Blue Jay', 300);
  assert.deepStrictEqual(T.lifeEntries(r.list).map((e) => e.species), ['Blue Jay', 'American Robin']);
});

test('life list does not mutate its input', () => {
  const before = { A: { first: 1, last: 1, n: 1 } };
  T.addToLife(before, 'B', 2);
  assert.deepStrictEqual(Object.keys(before), ['A']);
});

test('miss tips rotate', () => {
  assert.notStrictEqual(T.missTip(0), T.missTip(1));
  assert.strictEqual(T.missTip(0), T.missTip(3));
});
