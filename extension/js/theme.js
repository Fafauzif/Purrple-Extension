/* The appearance preference is shared by all Purrple surfaces. */
(() => {
  'use strict';
  const client = globalThis.PurrpleClient;
  const toggle = document.getElementById('theme-toggle');
  function apply(state) {
    const night = state?.settings?.theme === 'night';
    document.documentElement.dataset.theme = night ? 'night' : 'light';
    document.documentElement.dataset.motion = state?.settings?.reducedMotion ? 'reduce' : 'full';
    if (!toggle) return;
    toggle.setAttribute('aria-pressed', String(night));
    toggle.title = night ? 'Switch to light mode' : 'Switch to night mode';
    const short = toggle.classList.contains('compact-theme');
    toggle.textContent = night ? (short ? 'Light' : 'Light mode') : (short ? 'Night' : 'Night mode');
    toggle.setAttribute('aria-label', toggle.title);
  }
  if (!client) return;
  client.get().then(apply).catch(() => {});
  client.subscribe(apply);
  toggle?.addEventListener('click', async () => {
    toggle.disabled = true;
    try {
      apply(await client.action({
        type: 'SETTINGS',
        patch: { theme: document.documentElement.dataset.theme === 'night' ? 'light' : 'night' }
      }));
    } catch (error) {
      toggle.title = error.message;
    } finally {
      toggle.disabled = false;
    }
  });
})();
