/* A dedicated game surface, including when hosted inside a webpage. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  const game = params.get('game');
  const embedded = params.get('panel') === '1' && parent !== window;
  const client = PurrpleClient;
  const sheet = document.querySelector('.game-sheet');
  const message = document.querySelector('#game-message');
  let state;
  let opened = false;
  function notify(text) {
    message.textContent = text;
    message.hidden = !text;
  }
  function close() {
    if (embedded) parent.postMessage({ source: 'purrple-panel', type: 'CLOSE' }, '*');
    else client.closeGame().catch(() => window.close());
  }
  document.querySelector('#game-close').addEventListener('click', close);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
    event.preventDefault();
    close();
  });
  document.querySelector('#game-preview').hidden = client.native;
  const companion = PurrpleCompanion.mount({
    root: document.querySelector('#game-content'),
    compact: true,
    gameOnly: true,
    state: () => state,
    notify,
    async dispatch(action) {
      try {
        state = await client.action(action);
        companion.render();
        return state;
      } catch (error) {
        notify(error.message);
        throw error;
      }
    },
    showView() {}
  });
  const observer = embedded ? new ResizeObserver(() => {
    const height = Math.ceil(sheet.getBoundingClientRect().height);
    if (height > 0) parent.postMessage({ source: 'purrple-panel', type: 'SIZE', height }, '*');
  }) : null;
  observer?.observe(sheet);
  const unsubscribe = client.subscribe(next => {
    state = next;
    if (opened) companion.render();
  });
  client.get().then(next => {
    state = next;
    companion.open('play', game);
    opened = true;
    notify('');
    if (embedded) parent.postMessage({ source: 'purrple-panel', type: 'READY' }, '*');
  }).catch(error => notify(error.message || 'The game could not open.'));
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    observer?.disconnect();
    unsubscribe();
    companion.destroy();
  });
})();
