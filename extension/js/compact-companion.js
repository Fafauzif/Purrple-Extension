/* Mount the same games and care tools in the toolbar and authorized page window. */
(() => {
  'use strict';
  const compact = globalThis.PurrpleCompact;
  const root = document.getElementById('compact-companion-content');
  if (!compact || !root || !globalThis.PurrpleCompanion) return;
  const routes = { play: 'play', gifts: 'gifts', room: 'room' };
  const companion = PurrpleCompanion.mount({
    root,
    state: compact.getState,
    dispatch: compact.dispatch,
    notify: compact.notify,
    compact: true,
    showView(view) {
      if (view.startsWith('companion-play')) {
        PurrpleClient.openGame(view.slice('companion-play'.length + 1) || null).catch(error => compact.notify(error.message, true));
      } else {
        compact.showView(view.replace(/^companion-/, ''));
      }
    }
  });
  let previousView, previousGame;
  function render(state, view, game) {
    if (!state || !Object.hasOwn(routes, view)) {
      previousView = undefined;
      previousGame = undefined;
      return;
    }
    if (view !== previousView || game !== previousGame) {
      previousView = view;
      previousGame = game;
      companion.open(routes[view], game);
    } else companion.render();
  }
  const detach = compact.onRender(render);
  addEventListener('pagehide', event => {
    if (event.persisted) return;
    detach?.();
    companion.destroy?.();
  });
})();
