/* Keep the ordinary Today layout in place during a slow initial state read. */
(() => {
  'use strict';
  const compact = !!document.getElementById('compact-main');
  const loading = document.getElementById(compact ? 'compact-loading' : 'loading');
  const main = document.getElementById(compact ? 'compact-main' : 'main');
  const list = document.getElementById(compact ? 'compact-task-list' : 'task-list');
  if (!loading || !main || !list) return;
  const route = compact ? new URLSearchParams(location.search).get('view') : location.hash.slice(1);
  if (route && route !== 'today') return;

  let shown = false;
  const timer = setTimeout(() => {
    if (loading.hidden) return;
    shown = true;
    main.inert = true;
    main.setAttribute('aria-busy', 'true');
    main.dataset.skeleton = '';
    loading.classList.add('loading-announcement');
    loading.setAttribute('role', 'status');
    for (let index = 0; index < 3; index++) {
      const row = document.createElement('article');
      row.className = (compact ? 'compact-task-row' : 'task-card') + ' skeleton-row';
      row.setAttribute('aria-hidden', 'true');
      row.append(document.createElement('span'), document.createElement('span'));
      list.append(row);
    }
    main.hidden = false;
  }, 300);

  const observer = new MutationObserver(() => {
    if (!loading.hidden) return;
    clearTimeout(timer);
    observer.disconnect();
    if (!shown) return;
    main.inert = false;
    main.removeAttribute('aria-busy');
    delete main.dataset.skeleton;
    list.querySelectorAll('.skeleton-row').forEach(row => row.remove());
    const error = document.getElementById(compact ? 'compact-error' : 'load-error');
    if (error && !error.hidden && !list.childElementCount) main.hidden = true;
  });
  observer.observe(loading, { attributes: true, attributeFilter: ['hidden'] });
})();
