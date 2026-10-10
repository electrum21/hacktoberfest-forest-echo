/* Quiet invitations: reasons to step outside, shown on screen only when the app is opened.
 *
 * Pure functions with no DOM access so they can be unit-tested with `node --test tests-web/`.
 * Nothing here speaks, vibrates or notifies. The only "reminder" is a calendar file the user
 * chooses to download, so their calendar app (not this app) does any reminding.
 */
(function (root) {
  'use strict';

  const RAD = Math.PI / 180;
  const DAY = 86400000;
  const MIN = 60000;

  const sin = (deg) => Math.sin(deg * RAD);
  const cos = (deg) => Math.cos(deg * RAD);

  // Same 48-"week" calendar BirdNET uses (four per month); mirrors api/app/services/nearby.py.
  function birdnetWeek(d) {
    return Math.min(48, d.getMonth() * 4 + Math.min(3, Math.floor((d.getDate() - 1) / 7)) + 1);
  }
  function weekKey(d) {
    return `${d.getFullYear()}-${birdnetWeek(d)}`;
  }

  function dayKey(d) {
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  // Shift a timestamp by whole days so it lands on the same local calendar day as dayStart.
  function onDay(ms, dayStart) {
    const start = dayStart.getTime();
    let t = ms;
    while (t < start) t += DAY;
    while (t >= start + DAY) t -= DAY;
    return new Date(t);
  }

  /** Sunrise and sunset for the device's local calendar day at (lat, lon). East longitude is positive.
   *  Uses the standard sunrise equation (about +/- 5 minutes). Assumes the device clock is on local time.
   *  Returns { sunrise, sunset, polar } where polar is 'day', 'night' or null. */
  function sunTimes(date, lat, lon) {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const noon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
    const jd = noon.getTime() / DAY + 2440587.5;
    const n = Math.ceil(jd - 2451545.0 + 0.0008);
    const jStar = n - lon / 360;
    const M = (((357.5291 + 0.98560028 * jStar) % 360) + 360) % 360;
    const C = 1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M);
    const lambda = (M + C + 180 + 102.9372) % 360;
    const jTransit = 2451545.0 + jStar + 0.0053 * sin(M) - 0.0069 * sin(2 * lambda);
    const sinDec = sin(lambda) * sin(23.4397);
    const cosDec = Math.sqrt(1 - sinDec * sinDec);
    const cosH = (sin(-0.833) - sin(lat) * sinDec) / (cos(lat) * cosDec);
    if (cosH > 1) return { sunrise: null, sunset: null, polar: 'night' };
    if (cosH < -1) return { sunrise: null, sunset: null, polar: 'day' };
    const H = Math.acos(cosH) / RAD;
    const toMs = (j) => (j - 2440587.5) * DAY;
    return {
      sunrise: onDay(toMs(jTransit - H / 360), dayStart),
      sunset: onDay(toMs(jTransit + H / 360), dayStart),
      polar: null,
    };
  }

  /** The best listening window of a day: from half an hour before sunrise to two hours after.
   *  Without a usable location it falls back to 6:00-8:30 and says so (approximate: true). */
  function bestWindow(date, lat, lon) {
    const at = (h, m) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
    if (typeof lat === 'number' && typeof lon === 'number') {
      const { sunrise } = sunTimes(date, lat, lon);
      if (sunrise) {
        return { start: new Date(sunrise.getTime() - 30 * MIN), end: new Date(sunrise.getTime() + 120 * MIN), approximate: false };
      }
    }
    return { start: at(6, 0), end: at(8, 30), approximate: true };
  }

  function fmtTime(d) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function roundMinutes(d, step) {
    const ms = step * MIN;
    return new Date(Math.round(d.getTime() / ms) * ms);
  }

  /** One calm sentence about when listening is best. Never urgent, never guilt. */
  function windowLine(now, lat, lon) {
    const w = bestWindow(now, lat, lon);
    const hedge = w.approximate ? ' Early morning is usually best.' : '';
    if (now >= w.start && now <= w.end) return `Good listening right now, until ${fmtTime(w.end)}.${hedge}`;
    if (now < w.start) return `Best listening today: ${fmtTime(w.start)} to ${fmtTime(w.end)}.${hedge}`;
    const next = bestWindow(new Date(now.getTime() + DAY), lat, lon);
    return `Best listening tomorrow: ${fmtTime(next.start)} to ${fmtTime(next.end)}.${hedge}`;
  }

  function hash32(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
  }

  /** One species to listen for this week. Deterministic for a given week and species list, so it
   *  does not change once you hear it (it just gets a tick). Prefers birds that are catchable but
   *  not guaranteed (likelihood 0.2 to 0.7); falls back gracefully, and works with demo lists
   *  where likelihood is null. */
  function pickTarget(species, key) {
    if (!Array.isArray(species) || species.length === 0) return null;
    const sorted = [...species].sort((a, b) => a.species_name.localeCompare(b.species_name));
    const withLikelihood = sorted.filter((s) => typeof s.likelihood === 'number');
    let pool = withLikelihood.filter((s) => s.likelihood >= 0.2 && s.likelihood <= 0.7);
    if (pool.length < 3) pool = withLikelihood.length ? withLikelihood : sorted;
    return pool[hash32(String(key)) % pool.length];
  }

  /** Last seven local days (oldest first, today last): did you step outside? A day counts if you
   *  ended a walk or identified a real sound that day. */
  function outdoorDays(walks, log, now) {
    const seen = new Set();
    for (const w of walks || []) if (w && w.start) seen.add(dayKey(new Date(w.start)));
    for (const e of log || []) if (e && e.t) seen.add(dayKey(new Date(e.t)));
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(seen.has(dayKey(new Date(now.getTime() - i * DAY))));
    return days;
  }

  // ---------- calendar file (user-initiated, so any reminder comes from their calendar) ----------
  const pad = (n) => String(n).padStart(2, '0');
  function icsLocal(d) {
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  }
  function icsUtc(d) {
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
  }
  function icsEscape(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }
  function fold(line) {
    const out = [];
    let rest = line;
    while (rest.length > 70) { out.push(rest.slice(0, 70)); rest = ' ' + rest.slice(70); }
    out.push(rest);
    return out.join('\r\n');
  }

  /** A one-event .ics (floating local time, optional weekly repeat, one alarm at start). */
  function buildIcs({ title, description, start, durationMin = 30, weekly = false, now = new Date() }) {
    const end = new Date(start.getTime() + durationMin * MIN);
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Forest Echo//Quiet reminder//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:forest-echo-${now.getTime()}@forest-echo`,
      `DTSTAMP:${icsUtc(now)}`,
      `DTSTART:${icsLocal(start)}`,
      `DTEND:${icsLocal(end)}`,
      `SUMMARY:${icsEscape(title)}`,
      `DESCRIPTION:${icsEscape(description)}`,
    ];
    if (weekly) lines.push('RRULE:FREQ=WEEKLY');
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(title)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR');
    return lines.map(fold).join('\r\n') + '\r\n';
  }

  const api = { birdnetWeek, weekKey, sunTimes, bestWindow, windowLine, fmtTime, roundMinutes, pickTarget, outdoorDays, buildIcs, dayKey };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ForestInvite = api;
})(typeof window !== 'undefined' ? window : globalThis);
