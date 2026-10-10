/* Walk and life-list helpers: pure functions, no DOM, unit-tested with `node --test tests-web/`.
 *
 * Screen-on time idea (measure when the page is actually visible, not just button holds) was
 * inspired by "Eyes Up" by Kishore P (https://dev.to/kishore_p_e1fbd59e95a81f6). The implementation
 * here is independent.
 */
(function (root) {
  'use strict';

  // ---- Screen clock: accumulates the time the app's screen was lit and showing content. ----
  // Plain object so it can live inside the saved walk: { litMs, litSince }.
  function setLit(clock, lit, now) {
    const c = { litMs: clock.litMs || 0, litSince: clock.litSince ?? null };
    if (c.litSince !== null && !lit) {
      c.litMs += Math.max(0, now - c.litSince);
      c.litSince = null;
    } else if (c.litSince === null && lit) {
      c.litSince = now;
    }
    return c;
  }
  function litTotal(clock, now) {
    return (clock.litMs || 0) + (clock.litSince != null ? Math.max(0, now - clock.litSince) : 0);
  }

  function fmtDuration(ms) {
    const total = Math.round(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return m ? `${m} min ${String(s).padStart(2, '0')} s` : `${s} s`;
  }

  function share(totalMs, partMs) {
    const pct = Math.min(100, (partMs / Math.max(1, totalMs)) * 100);
    return pct < 0.1 ? '<0.1%' : `${pct.toFixed(pct < 10 ? 1 : 0)}%`;
  }

  // One line for a finished walk. Older walks (saved before screen-on tracking) fall back to hold+wait time.
  function walkSummary(w) {
    const total = Math.max(1, w.end - w.start);
    const hasLit = typeof w.litMs === 'number';
    const used = hasLit ? w.litMs : w.interactMs || 0;
    const label = hasLit ? 'screen on' : 'app interaction';
    return `Walk ${fmtDuration(total)} · ${w.holds} hold${w.holds === 1 ? '' : 's'} · ${w.idents} identified · ${label} ${fmtDuration(used)} (${share(total, used)})`;
  }

  // ---- Life list: every real species ever identified, never pruned. ----
  // list: { [species]: { first: ms, last: ms, n: count } }
  function addToLife(list, species, now) {
    const next = { ...list };
    const cur = next[species];
    const isNew = !cur;
    next[species] = isNew ? { first: now, last: now, n: 1 } : { first: cur.first, last: now, n: cur.n + 1 };
    return { list: next, isNew };
  }
  function lifeEntries(list) {
    return Object.entries(list)
      .map(([species, v]) => ({ species, ...v }))
      .sort((a, b) => b.first - a.first || a.species.localeCompare(b.species));
  }

  // ---- Gentle, practical reasons for a miss (shown on screen only, never spoken). ----
  const TIPS = [
    'Try again a little closer, or wait for a quieter moment.',
    'Hold while the bird is singing, not in the gaps between calls.',
    'Wind and traffic hide quiet birds. A spot out of the breeze helps.',
  ];
  function missTip(n) {
    return TIPS[Math.abs(n) % TIPS.length];
  }

  const api = { setLit, litTotal, fmtDuration, share, walkSummary, addToLife, lifeEntries, missTip };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ForestTrail = api;
})(typeof window !== 'undefined' ? window : globalThis);
