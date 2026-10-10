// Presentation-only helpers. All app behaviour lives in app.js; nothing here touches audio, location or storage.
(() => {
  const body = document.body;
  const bird = document.querySelector('.bird');
  const result = document.getElementById('result');
  const species = document.getElementById('species');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The result bubble stays hidden until there is something to say, then pops in each time it changes.
  new MutationObserver(() => {
    const has = species.textContent.trim().length > 0;
    result.hidden = !has;
    if (!has) return;
    result.classList.remove('pop');
    void result.offsetWidth; // restart the animation
    result.classList.add('pop');
  }).observe(species, { childList: true, characterData: true, subtree: true });

  // One orchestrated moment on load: the sun rises while the bird sleeps, then wakes with a hop.
  if (!reduceMotion) {
    body.classList.add('asleep');
    setTimeout(() => {
      body.classList.remove('asleep');
      bird.classList.add('bump');
      setTimeout(() => bird.classList.remove('bump'), 700);
    }, 2100);
  }
})();
