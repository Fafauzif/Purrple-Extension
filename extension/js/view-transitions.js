/* User-initiated navigation within Purrple's own documents. */
(() => {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const portraits = '#companion-canvas,#focus-canvas,#wardrobe-canvas,#compact-canvas,.cp-cat,.cp-gift-cat,.cp-story-cat';
  let transition, actor, revision = 0, committing = false;

  function markActor() {
    actor?.removeAttribute('data-purrple-transition-actor');
    actor = [...document.querySelectorAll(portraits)].find(canvas =>
      canvas.getClientRects().length && getComputedStyle(canvas).visibility === 'visible');
    actor?.setAttribute('data-purrple-transition-actor', '');
  }

  function interrupt() {
    if (committing) return;
    revision++;
    transition?.skipTransition();
    transition = null;
    actor?.removeAttribute('data-purrple-transition-actor');
    actor = null;
  }

  function run(update, reduced = false) {
    interrupt();
    if (reduced || reducedMotion.matches || document.hidden || typeof document.startViewTransition !== 'function') return update();

    const expected = revision;
    let applied = false;
    markActor();
    function apply() {
      if (applied || revision !== expected) return false;
      applied = true;
      committing = true;
      try { update(); } finally { committing = false; }
      return true;
    }
    let current;
    try {
      current = document.startViewTransition(async () => {
        if (!apply() || revision !== expected) return;
        markActor();
        if (!actor || document.hidden) return;
        // Canvas renderers can paint the incoming portrait on their next frame.
        // The timeout keeps a backgrounded or throttled document from stalling.
        await new Promise(resolve => {
          const frame = requestAnimationFrame(() => { clearTimeout(timeout); resolve(); });
          const timeout = setTimeout(() => { cancelAnimationFrame(frame); resolve(); }, 36);
        });
      });
    } catch (error) {
      actor?.removeAttribute('data-purrple-transition-actor');
      actor = null;
      if (applied) throw error;
      apply();
      return;
    }
    transition = current;
    current.ready.catch(() => {});
    current.updateCallbackDone.catch(() => {});
    current.finished.catch(error => console.error('Purrple navigation failed:', error)).finally(() => {
      if (transition === current) interrupt();
    });
  }

  reducedMotion.addEventListener('change', event => {
    if (event.matches) transition?.skipTransition();
  });
  globalThis.PurrpleViewTransitions = { run, interrupt };
})();
