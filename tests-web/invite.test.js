const test = require('node:test');
const assert = require('node:assert');
const inv = require('../web/invite.js');

const minutesOfDay = (d) => d.getHours() * 60 + d.getMinutes();
const near = (actualMin, expectedMin, tol = 12) =>
  assert.ok(Math.abs(actualMin - expectedMin) <= tol, `expected ~${expectedMin} min, got ${actualMin}`);

test('sunrise and sunset: New York, early October', () => {
  process.env.TZ = 'America/New_York';
  const t = inv.sunTimes(new Date(2026, 9, 6, 15), 40.71, -74.01);
  near(minutesOfDay(t.sunrise), 7 * 60 + 0);   // ~7:00 EDT
  near(minutesOfDay(t.sunset), 18 * 60 + 20);  // ~6:20 pm EDT
});

test('sunrise: Sydney, southern summer', () => {
  process.env.TZ = 'Australia/Sydney';
  const t = inv.sunTimes(new Date(2026, 11, 21, 15), -33.87, 151.21);
  near(minutesOfDay(t.sunrise), 5 * 60 + 41);  // ~5:41 AEDT
  near(minutesOfDay(t.sunset), 20 * 60 + 5);   // ~8:05 pm AEDT
});

test('sunrise: London, midsummer', () => {
  process.env.TZ = 'Europe/London';
  const t = inv.sunTimes(new Date(2026, 5, 21, 15), 51.51, -0.12);
  near(minutesOfDay(t.sunrise), 4 * 60 + 43);  // ~4:43 BST
});

test('polar day and night give no sunrise, and the window falls back', () => {
  process.env.TZ = 'UTC';
  assert.strictEqual(inv.sunTimes(new Date(2026, 5, 21, 12), 78, 15).polar, 'day');
  assert.strictEqual(inv.sunTimes(new Date(2026, 11, 21, 12), 78, 15).polar, 'night');
  assert.strictEqual(inv.bestWindow(new Date(2026, 5, 21, 12), 78, 15).approximate, true);
});

test('best window runs from 30 min before to 2 h after sunrise; no location falls back', () => {
  process.env.TZ = 'America/New_York';
  const d = new Date(2026, 9, 6, 15);
  const w = inv.bestWindow(d, 40.71, -74.01);
  const rise = inv.sunTimes(d, 40.71, -74.01).sunrise;
  assert.strictEqual(rise - w.start, 30 * 60000);
  assert.strictEqual(w.end - rise, 120 * 60000);
  assert.strictEqual(w.approximate, false);
  const f = inv.bestWindow(d);
  assert.strictEqual(f.approximate, true);
  assert.strictEqual(minutesOfDay(f.start), 360);
});

test('window line says now / today / tomorrow without urgency', () => {
  process.env.TZ = 'America/New_York';
  const lat = 40.71, lon = -74.01;
  assert.match(inv.windowLine(new Date(2026, 9, 6, 7, 30), lat, lon), /^Good listening right now/);
  assert.match(inv.windowLine(new Date(2026, 9, 6, 3, 0), lat, lon), /^Best listening today/);
  assert.match(inv.windowLine(new Date(2026, 9, 6, 15, 0), lat, lon), /^Best listening tomorrow/);
  assert.match(inv.windowLine(new Date(2026, 9, 6, 15, 0)), /Early morning is usually best/);
});

const SPECIES = [
  { species_name: 'American Robin', likelihood: 0.9 },
  { species_name: 'Northern Cardinal', likelihood: 0.5 },
  { species_name: 'Blue Jay', likelihood: 0.4 },
  { species_name: 'Downy Woodpecker', likelihood: 0.3 },
  { species_name: 'Carolina Wren', likelihood: 0.25 },
  { species_name: 'Rare Visitor', likelihood: 0.12 },
];

test('weekly target is stable, order-independent and prefers catchable birds', () => {
  const a = inv.pickTarget(SPECIES, '2026-37');
  const b = inv.pickTarget([...SPECIES].reverse(), '2026-37');
  assert.strictEqual(a.species_name, b.species_name);
  assert.ok(a.likelihood >= 0.2 && a.likelihood <= 0.7, 'never the near-certain or the very rare');
  const names = new Set(Array.from({ length: 48 }, (_, i) => inv.pickTarget(SPECIES, `2026-${i + 1}`).species_name));
  assert.ok(names.size > 1, 'varies across weeks');
});

test('weekly target works for demo lists (no likelihood) and empty lists', () => {
  const demo = [{ species_name: 'A', likelihood: null }, { species_name: 'B', likelihood: null }];
  assert.ok(['A', 'B'].includes(inv.pickTarget(demo, '2026-37').species_name));
  assert.strictEqual(inv.pickTarget([], '2026-37'), null);
  assert.strictEqual(inv.pickTarget(undefined, 'x'), null);
});

test('week key matches the server calendar', () => {
  assert.strictEqual(inv.birdnetWeek(new Date(2026, 9, 6)), 37);
  assert.strictEqual(inv.birdnetWeek(new Date(2026, 11, 31)), 48);
  assert.strictEqual(inv.birdnetWeek(new Date(2026, 0, 1)), 1);
  assert.strictEqual(inv.birdnetWeek(new Date(2026, 2, 31)), 12);
});

test('outdoor days count walks and real identifications, oldest first', () => {
  process.env.TZ = 'America/New_York';
  const now = new Date(2026, 9, 6, 12);
  const day = (n) => new Date(2026, 9, 6 - n, 9).getTime();
  const days = inv.outdoorDays([{ start: day(0) }, { start: day(3) }], [{ t: day(5), species: 'x' }, { t: day(3) }], now);
  assert.deepStrictEqual(days, [false, true, false, true, false, false, true]);
  assert.deepStrictEqual(inv.outdoorDays([], [], now), Array(7).fill(false));
});

test('calendar file is valid-looking, escaped, CRLF and folded', () => {
  process.env.TZ = 'America/New_York';
  const start = new Date(2026, 9, 7, 6, 30);
  const ics = inv.buildIcs({ title: 'Step out, and listen', description: 'x'.repeat(200) + '; end', start, weekly: true, now: new Date(Date.UTC(2026, 9, 6, 12)) });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.match(ics, /DTSTART:20261007T063000\r\n/);
  assert.match(ics, /DTEND:20261007T070000\r\n/);
  assert.match(ics, /RRULE:FREQ=WEEKLY\r\n/);
  assert.match(ics, /SUMMARY:Step out\\, and listen\r\n/);
  assert.match(ics, /DTSTAMP:20261006T120000Z\r\n/);
  for (const line of ics.split('\r\n')) assert.ok(line.length <= 71, `line too long: ${line.length}`);
  assert.ok(!inv.buildIcs({ title: 't', description: 'd', start }).includes('RRULE'));
});
