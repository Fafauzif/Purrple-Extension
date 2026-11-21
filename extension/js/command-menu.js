/* Keyboard access to Purrple's existing routes and controls. */
(() => {
  'use strict';
  const ui = globalThis.PurrpleUI;
  const client = globalThis.PurrpleClient;
  const compact = document.body.classList.contains('compact-body');
  const host = document.querySelector(compact ? '.compact-brand' : '.main-nav');
  if (!ui || !client || !host) return;

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'purrple-command-trigger';
  trigger.setAttribute('aria-label', 'Open commands');
  trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-controls', 'purrple-command-menu');
  if (compact) trigger.append(...host.childNodes);
  const marker = document.createElement('span');
  marker.className = 'purrple-command-icon';
  marker.setAttribute('aria-hidden', 'true');
  marker.textContent = '⌕';
  trigger.append(marker);
  if (!compact) {
    const label = document.createElement('span');
    label.className = 'purrple-command-label';
    label.textContent = 'Commands';
    trigger.append(label);
  }
  host.append(trigger);

  const dialog = document.createElement('dialog');
  dialog.id = 'purrple-command-menu';
  dialog.className = 'purrple-command-menu';
  dialog.setAttribute('aria-labelledby', 'purrple-command-title');
  dialog.innerHTML = `
    <div class="purrple-command-header">
      <h2 id="purrple-command-title">Commands</h2>
      <button type="button" class="purrple-command-close" aria-label="Close commands">×</button>
    </div>
    <label class="sr-only" for="purrple-command-search">Search commands</label>
    <input id="purrple-command-search" type="search" role="combobox" aria-autocomplete="list"
      aria-controls="purrple-command-options" aria-expanded="false" autocomplete="off"
      placeholder="Find a page or action…" autofocus>
    <ul id="purrple-command-options" role="listbox" aria-label="Commands"></ul>
    <p class="purrple-command-empty" role="status" hidden>No matching commands.</p>
    <p class="purrple-command-help"><kbd>↑</kbd><kbd>↓</kbd> Select <kbd>Enter</kbd> Run <kbd>Esc</kbd> Close</p>`;
  document.body.append(dialog);

  const search = dialog.querySelector('input');
  const options = dialog.querySelector('ul');
  const empty = dialog.querySelector('.purrple-command-empty');
  const close = dialog.querySelector('.purrple-command-close');
  let commands = [];
  let matches = [];
  let selected = 0;
  let returnTo = null;
  let ran = false;

  const isMac = /^mac/i.test(navigator.userAgentData?.platform || navigator.platform);
  const accelerators = {
    commands: { key: 'K' },
    today: { key: '1', alt: true },
    calendar: { key: '2', alt: true },
    focus: { key: '3', alt: true },
    room: { key: '4', alt: true },
    wardrobe: { key: '5', alt: true },
    journal: { key: '6', alt: true },
    settings: { key: '7', alt: true },
    play: { key: '8', alt: true },
    gifts: { key: '9', alt: true },
    'add-task': { key: 'Enter', shift: true },
    'calendar-block': { key: 'B', alt: true }
  };
  function shortcut(id, spoken = false) {
    const binding = accelerators[id];
    if (!binding) return '';
    if (spoken) return [
      isMac ? 'Meta' : 'Control', ...(binding.alt ? ['Alt'] : []),
      ...(binding.shift ? ['Shift'] : []), binding.key
    ].join('+');
    if (isMac) return (binding.alt ? '⌥' : '') + (binding.shift ? '⇧' : '') + '⌘' + (binding.key === 'Enter' ? '⏎' : binding.key);
    return ['Ctrl', ...(binding.alt ? ['Alt'] : []), ...(binding.shift ? ['Shift'] : []), binding.key].join('+');
  }
  function hint(element, id, label) {
    if (!element || !accelerators[id]) return;
    element.title = `${label} (${shortcut(id)})`;
    element.setAttribute('aria-keyshortcuts', shortcut(id, true));
  }
  hint(trigger, 'commands', 'Open commands');
  const triggerHint = document.createElement('kbd');
  triggerHint.className = 'purrple-command-trigger-key';
  triggerHint.setAttribute('aria-hidden', 'true');
  triggerHint.textContent = shortcut('commands');
  if (!compact) trigger.append(triggerHint);
  const nav = document.querySelectorAll(compact ? '[data-compact-view]' : '[data-view]');
  for (const element of nav) {
    const view = element.dataset.compactView || element.dataset.view;
    hint(element, view === 'companion' ? 'room' : view, element.textContent.trim());
  }
  hint(document.querySelector(compact ? '#compact-task-title' : '#quick-title'), 'add-task', 'Add a task');
  hint(document.querySelector('#planner-add'), 'calendar-block', 'New calendar block');
  const hintText = dialog.querySelector('.purrple-command-help');
  hintText.append(document.createTextNode(' · ' + shortcut('commands') + ' Open'));

  const isVisible = element => !!element?.getClientRects().length && !element.closest('[hidden]');
  function visibleHeading() {
    if (compact) return document.querySelector('#compact-greeting');
    return document.querySelector('.view:not([hidden]) h1, .view:not([hidden]) h2');
  }
  function moveFocus(element) {
    if (!isVisible(element)) return;
    if (!element.matches('a[href],button,input,select,textarea,[tabindex]')) element.tabIndex = -1;
    element.focus({ preventScroll: false });
  }
  function navigate(view, control, click = false) {
    ui.showView(view);
    const target = control ? document.querySelector(control) : visibleHeading();
    if (click && isVisible(target) && !target.disabled) target.click();
    else moveFocus(target || visibleHeading());
  }
  function clickControl(element) {
    if (!isVisible(element) || element.disabled) return;
    element.focus({ preventScroll: false });
    element.click();
  }

  function baseCommands() {
    const room = compact ? 'room' : 'companion';
    const today = compact ? '#compact-task-title' : '#quick-title';
    const pause = compact ? '#compact-focus-pause' : '#focus-pause';
    const start = compact ? '#compact-focus-start' : '#focus-start';
    const journal = compact ? () => client.openApp('talk') : () => navigate('talk');
    const play = compact ? () => client.openGame() : () => navigate('companion-play');
    const state = ui.getState();
    const result = [
      { id: 'today', label: 'Today', terms: 'tasks planner inbox', run: () => navigate('today') },
      { id: 'calendar', label: 'Calendar', terms: 'agenda schedule blocks', run: () => navigate('calendar') },
      { id: 'focus', label: 'Focus', terms: 'timer minutes study break', run: () => navigate('focus') },
      { id: 'room', label: 'Room', terms: 'Purrple companion decor', run: () => navigate(room) },
      { id: 'wardrobe', label: 'Wardrobe', terms: 'outfit clothes accessories', run: () => navigate('wardrobe') },
      { id: 'gifts', label: 'Give a gift', terms: 'present décor', run: () => navigate(compact ? 'gifts' : 'companion-gifts') },
      { id: 'scrapbook', label: 'Scrapbook', terms: 'journal memories occasions', run: () => navigate(room, '[data-cp-key="tab-journal"]', true) },
      { id: 'journal', label: 'Conversation journal', terms: 'talk dialogue prompts favorites', run: journal },
      { id: 'settings', label: 'Settings', terms: 'preferences sound motion backups', run: compact ? () => client.openApp('settings') : () => navigate('settings') },
      { id: 'play', label: 'Play', terms: 'games puzzle', run: play },
      { id: 'animations', label: 'Animation studio', terms: 'movements preview poses', run: () => window.open('animations.html', '_blank') },
      { id: 'add-task', label: 'Add a task', terms: 'create new plan quick add', run: () => navigate('today', today) },
      { id: 'calendar-block', label: 'New calendar block', terms: 'schedule agenda time', run: () => navigate('calendar', '#planner-add', true) },
      { id: 'focus-action', label: state.focus ? (state.focus.status === 'paused' ? 'Resume timer' : 'Pause timer') : 'Start focus',
        terms: 'study session timer', run: () => navigate('focus', state.focus ? pause : start, true) },
      { id: 'theme', label: state.settings?.theme === 'night' ? 'Switch to light mode' : 'Switch to night mode', terms: 'theme appearance', run: () => clickControl(document.getElementById('theme-toggle')) }
    ];
    if (compact) {
      result.push({ id: 'dashboard', label: 'Open dashboard', terms: 'full view', run: () => clickControl(document.getElementById('open-app')) },
        { id: 'sidebar', label: 'Open side panel', terms: 'sidebar', run: () => clickControl(document.getElementById('open-sidebar')) });
    } else {
      result.push({ id: 'task-details', label: 'Add a task with details', terms: 'create new task project priority', run: () => navigate('today', '#new-task', true) },
        { id: 'export', label: 'Download backup', terms: 'export data', run: () => navigate('settings', '#backup-export', true) },
        { id: 'import', label: 'Restore a backup', terms: 'import data', run: () => navigate('settings', '#backup-import', true) });
    }
    const unlocked = globalThis.PurrpleCompanionDomain?.unlockedGames(state.companion) || [];
    for (const id of unlocked) {
      const label = globalThis.PurrpleCompanionGames?.catalog[id]?.name;
      if (label) result.push({ id: 'game-' + id, label: 'Play ' + label, terms: 'game resume',
        run: compact ? () => client.openGame(id) : () => navigate('companion-play-' + id) });
    }
    return result;
  }

  function pageCommands() {
    const view = document.querySelector('.view:not([hidden]),.compact-view:not([hidden])');
    if (!view) return [];
    const controls = view.querySelectorAll('button, summary');
    return [...controls].flatMap((element, index) => {
      if (!isVisible(element) || element.disabled || element.type === 'submit' || element.closest('dialog')) return [];
      const task = element.closest('.task-card,.compact-task-row');
      const shop = element.closest('.shop-card,.compact-shop-card');
      const name = element.getAttribute('aria-label') || element.textContent.trim();
      if (!name || !/[a-z]/i.test(name)) return [];
      const caption = task?.querySelector('.task-title,strong')?.textContent || shop?.querySelector('h3')?.textContent;
      const label = caption && !name.includes(caption) ? `${name} · ${caption}` : name;
      return [{ id: 'page-' + index, label, terms: 'this page', run: () => clickControl(element) }];
    });
  }

  function updateSelection(index, scroll = false) {
    selected = index;
    const items = [...options.children];
    for (const [i, item] of items.entries()) item.setAttribute('aria-selected', String(i === selected));
    const current = items[selected];
    if (!current) search.removeAttribute('aria-activedescendant');
    else {
      search.setAttribute('aria-activedescendant', current.id);
      if (scroll) current.scrollIntoView({ block: 'nearest' });
    }
  }
  function renderMatches() {
    const terms = search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    matches = commands.filter(({ label, terms: extra }) => terms.every(term =>
      `${label} ${extra}`.toLocaleLowerCase().includes(term)));
    const rows = matches.map(({ id, label }, i) => {
      const row = document.createElement('li');
      row.role = 'option';
      row.id = 'purrple-command-option-' + i;
      row.dataset.commandIndex = String(i);
      row.append(document.createTextNode(label));
      const keys = shortcut(id);
      if (keys) {
        const key = document.createElement('kbd');
        key.textContent = keys;
        row.append(key);
      }
      return row;
    });
    options.replaceChildren(...rows);
    options.hidden = rows.length === 0;
    empty.hidden = rows.length !== 0;
    search.setAttribute('aria-expanded', String(rows.length !== 0));
    options.scrollTop = 0;
    updateSelection(0);
  }
  function show() {
    if (document.querySelector('dialog[open]') || !ui.getState()) return;
    returnTo = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : trigger;
    const known = new Set();
    commands = [...baseCommands(), ...pageCommands()].filter(command => {
      const name = command.label.toLocaleLowerCase();
      if (known.has(name)) return false;
      known.add(name);
      return true;
    });
    ran = false;
    search.value = '';
    renderMatches();
    dialog.showModal();
    search.focus({ preventScroll: true });
  }
  function execute(command) {
    try {
      Promise.resolve(command.run()).catch(error => globalThis.PurrpleCompact?.notify(error.message, true));
    } catch (error) {
      globalThis.PurrpleCompact?.notify(error.message, true);
    }
  }
  function run(index) {
    const command = matches[index];
    if (!command) return;
    ran = true;
    dialog.close();
    execute(command);
  }
  trigger.addEventListener('click', show);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    // Modal dialogs restore focus themselves. Only step in when focus was lost,
    // so another shortcut used while the close event was queued keeps its focus.
    const active = document.activeElement;
    if (!ran && (active === document.body || dialog.contains(active))) {
      moveFocus(returnTo?.isConnected ? returnTo : trigger);
    }
    search.setAttribute('aria-expanded', 'false');
    search.removeAttribute('aria-activedescendant');
  });
  search.addEventListener('input', renderMatches);
  options.addEventListener('click', event => {
    const row = event.target.closest('[data-command-index]');
    if (row) run(Number(row.dataset.commandIndex));
  });
  dialog.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dialog.close();
      return;
    }
    if (event.target !== search) return;
    if (matches.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      updateSelection((selected + delta + matches.length) % matches.length, true);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(selected);
    }
  });

  function typing(element) {
    return element instanceof HTMLElement && (element.isContentEditable ||
      !!element.closest('input,select,textarea,[role="textbox"]'));
  }
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.repeat || event.isComposing || event.getModifierState('AltGraph') ||
        typing(event.target) || document.querySelector('dialog[open]') || !ui.getState()) return;
    if (!(isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey)) return;
    // Option can turn a letter into a symbol before it reaches keydown on Mac.
    const physical = event.altKey && /^(?:Digit|Key)([1-9A-Z])$/.exec(event.code);
    const key = physical ? physical[1] : event.key.toUpperCase();
    const id = Object.keys(accelerators).find(command => {
      const binding = accelerators[command];
      return key === binding.key.toUpperCase() && event.altKey === !!binding.alt &&
        event.shiftKey === !!binding.shift;
    });
    if (id === 'commands') {
      event.preventDefault();
      show();
    } else if (id) {
      const command = baseCommands().find(item => item.id === id);
      if (!command) return;
      event.preventDefault();
      execute(command);
    }
  });
})();
