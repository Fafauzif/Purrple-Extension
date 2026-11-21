/* The same character-led action model for the page, popup, and dashboard. */
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.PurrplePetMenu = value;
})(globalThis, function () {
  'use strict';

  const action = (id, label, extra = {}) => ({ id, label, ...extra });
  const route = (id, label, extra = {}) => action(id, label, { kind: 'route', ...extra });
  const talk = (promptId, label) => action(promptId, label, { kind: 'talk', promptId });
  const categories = ['Focus', 'Play', 'Talk', 'Care', 'More'];
  const gameLabels = { 'paw-pairs': 'Paw Pairs', 'cozy-clues': 'Cozy Clues', 'lantern-paths': 'Lantern Paths', 'pocket-pong': 'Pocket Pong', 'three-paws': 'Three Paws' };

  function choices(level, state = {}, { webpage = false, companion } = {}) {
    if (level === 'home') return [route('today', 'Tasks'), ...categories.map(label => action(label.toLowerCase(), label, { kind: 'category' }))];
    if (level === 'talk') {
      const entries = [
        talk('hello', 'Say hello'),
        talk('how-are-you', 'Ask how she is'),
        talk('joke', 'Tell a joke')
      ];
      if (state.talk?.last || companion?.hasTalk) entries.push(talk('little-chat', 'Continue a conversation'));
      entries.push(route('talk', 'Open journal'));
      return entries;
    }
    if (level === 'focus') {
      if (state.focus) return [
        state.focus.status === 'paused'
          ? action('resume', 'Resume timer', { kind: 'focus', mode: 'resume' })
          : route('focus', 'View active timer')
      ];
      return [
        action('start-25', 'Start 25 min', { kind: 'focus', mode: 'start', minutes: 25 }),
        action('start-50', 'Start 50 min', { kind: 'focus', mode: 'start', minutes: 50 }),
        action('custom', 'Custom duration', { kind: 'category' })
      ];
    }
    if (level === 'play') {
      const games = companion?.unlockedGames || ['paw-pairs'];
      const resumed = companion?.resumableGame;
      const entries = resumed && gameLabels[resumed] ? [route('companion-play-' + resumed, 'Resume ' + gameLabels[resumed])] : [];
      for (const game of games) {
        if (gameLabels[game] && game !== resumed) entries.push(route('companion-play-' + game, gameLabels[game]));
      }
      return entries;
    }
    if (level === 'tricks') return [
      action('toy', 'Yarn'), action('jump', 'Little hop'), action('roll', 'Roll'), action('knead', 'Knead'), action('wave', 'Wave'), action('nuzzle', 'Nuzzle'),
      action('stretch', 'Stretch'), action('loaf', 'Loaf')
    ];
    if (level === 'care') return [
      action('pat', 'Pet Purrple', { kind: 'care' }), route('companion-gifts', 'Give a gift'),
      route('companion-room', 'Visit her room'), route('wardrobe', 'Change accessory'),
      ...(webpage ? [action('brush', 'Brush'), action('tricks', 'Tricks', { kind: 'category' }), action('nap', 'Nap or wake'), action('home', 'Go home')] : [])
    ];
    if (level === 'more') return [
      route('app-today', 'Open dashboard'),
      action(webpage ? 'hide' : 'reshow', webpage ? 'Hide on this site' : 'Show on this site'),
      route('settings', 'Companion settings'),
      ...(webpage ? [route('calendar', 'Agenda'), action('move', 'Move Purrple', { kind: 'category' }), action('move-house', 'Move house'), action('reset-house', 'Reset house')] : [])
    ];
    if (level === 'move') return [
      action('move-left', 'Move left'), action('move-right', 'Move right'),
      action('reset-pet', 'Reset position')
    ];
    return [];
  }

  function mount({ menu, speech, actor, state, execute, onChange = () => {}, onReply = () => {}, webpage = false, companion = () => {}, onOpen = () => {} }) {
    const doc = menu.ownerDocument;
    const win = doc.defaultView;
    const motionPreference = win.matchMedia('(prefers-reduced-motion: reduce)');
    let scale = .94, velocity = 0, goal = .94, frame = 0, tickAt = 0;
    let level = 'home', epoch = 0, busy = false, speechTimer = 0, choiceSignature = '';
    const heading = doc.createElement('strong');
    const closeButton = button('×', () => close());
    closeButton.setAttribute('aria-label', 'Close Purrple actions');
    const header = doc.createElement('header');
    header.append(heading, closeButton);
    const buttons = doc.createElement('div');
    buttons.className = 'pet-actions actions';
    menu.replaceChildren(header, buttons);
    menu.hidden = true;
    menu.setAttribute('role', 'group');
    menu.setAttribute('aria-label', 'Purrple actions');
    menu.id ||= 'purrple-actions';
    actor.setAttribute('aria-expanded', 'false');
    actor.setAttribute('aria-controls', menu.id);

    const dismiss = button('×', () => close());
    dismiss.className = 'dismiss';
    dismiss.setAttribute('aria-label', 'Dismiss Purrple reply');
    const line = doc.createElement('p');
    const followups = doc.createElement('div');
    followups.className = 'pet-followups';
    speech.setAttribute('role', 'group');
    speech.setAttribute('aria-label', 'Purrple’s reply');
    speech.replaceChildren(dismiss, line, followups);
    speech.hidden = true;
    const announcement = doc.createElement('div');
    announcement.className = 'pet-announcement';
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    speech.after(announcement);

    function animateMenu(next) {
      goal = next;
      if (motionPreference.matches || state()?.settings?.reducedMotion) {
        win.cancelAnimationFrame(frame); frame = 0; velocity = 0; scale = goal;
        buttons.style.scale = '1';
        return;
      }
      buttons.style.scale = String(scale);
      if (frame) return;
      tickAt = win.performance.now();
      function step(now) {
        const dt = Math.min(.024, Math.max(.001, (now - tickAt) / 1000));
        tickAt = now;
        velocity += (440 * (goal - scale) - 33 * velocity) * dt;
        scale += velocity * dt;
        if (Math.abs(goal - scale) < .001 && Math.abs(velocity) < .01) {
          frame = 0; scale = goal; velocity = 0;
        } else frame = win.requestAnimationFrame(step);
        buttons.style.scale = String(scale);
      }
      frame = win.requestAnimationFrame(step);
    }
    motionPreference.addEventListener('change', () => animateMenu(menu.hidden ? .94 : 1));

    function button(label, handler, id) {
      const node = doc.createElement('button');
      node.type = 'button';
      node.textContent = label;
      if (id) node.dataset.action = id;
      node.addEventListener('click', handler);
      return node;
    }
    function focus(target) {
      if (!target) return;
      target.focus({ preventScroll: true });
      const overlay = [menu, speech].find(element => element.contains(target));
      if (overlay) {
        const container = overlay.getBoundingClientRect(), control = target.getBoundingClientRect();
        if (control.top < Math.max(0, container.top) || control.bottom > Math.min(doc.defaultView.innerHeight, container.bottom)) {
          target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
      }
    }
    function ownsFocus() {
      const active = menu.getRootNode().activeElement;
      return active === actor || menu.contains(active) || speech.contains(active);
    }
    function setBusy(pending) {
      busy = pending;
      menu.setAttribute('aria-busy', String(pending));
      speech.setAttribute('aria-busy', String(pending));
    }
    function hideSpeech() {
      clearTimeout(speechTimer);
      speech.hidden = true;
      announcement.textContent = '';
    }
    function close(restore = true) {
      epoch++;
      setBusy(false);
      const wasOpen = !menu.hidden || !speech.hidden;
      menu.hidden = true;
      animateMenu(.94);
      hideSpeech();
      actor.setAttribute('aria-expanded', 'false');
      onChange();
      if (restore && wasOpen) focus(actor);
    }
    function enter(next, focusControl = true, preferred) {
      epoch++;
      setBusy(false);
      level = next;
      hideSpeech();
      menu.hidden = false;
      animateMenu(1);
      actor.setAttribute('aria-expanded', 'true');
      render();
      onChange();
      if (focusControl) focus((preferred && buttons.querySelector('[data-action="' + preferred + '"]')) || buttons.querySelector('input,button') || closeButton);
    }
    function currentChoices() {
      return choices(level, state() || {}, { webpage, companion: companion() });
    }
    function drawCustom() {
      const form = doc.createElement('form');
      form.className = 'pet-custom-focus';
      const label = doc.createElement('label');
      label.textContent = 'Minutes (1–240)';
      const minutes = doc.createElement('input');
      minutes.type = 'number';
      minutes.min = '1';
      minutes.max = '240';
      minutes.step = '1';
      minutes.value = '25';
      minutes.required = true;
      label.append(minutes);
      const start = doc.createElement('button');
      start.type = 'submit';
      start.textContent = 'Start';
      start.disabled = busy;
      form.append(label, start);
      form.onsubmit = event => {
        event.preventDefault();
        if (form.reportValidity()) run(action('start-custom', 'Start', { kind: 'focus', mode: 'start', minutes: Number(minutes.value) }));
      };
      buttons.append(form);
    }
    function render() {
      const titles = { home: 'Purrple', talk: 'Talk', focus: 'Focus', custom: 'Custom focus', play: 'Play', tricks: 'More play', care: 'Care', more: 'More', move: 'Move Purrple' };
      heading.textContent = titles[level];
      menu.dataset.level = level;
      buttons.replaceChildren();
      const entries = currentChoices();
      choiceSignature = JSON.stringify(entries);
      if (level === 'custom') drawCustom();
      else for (const [index,entry] of entries.entries()) {
        const node = button(entry.label, () => run(entry), entry.id);
        node.disabled = busy;
        if (level === 'home') {
          const angle = index / entries.length * Math.PI * 2;
          node.style.setProperty('--slot-x', (50 + 34 * Math.sin(angle)) + '%');
          node.style.setProperty('--slot-y', (50 - 35 * Math.cos(angle)) + '%');
        }
        buttons.append(node);
      }
      if (level !== 'home') {
        const parentLevel = { custom: 'focus', tricks: 'care', move: 'more' }[level] || 'home';
        const back = button('Back', () => enter(parentLevel, true, level), 'back');
        back.className = 'pet-back';
        buttons.append(back);
      }
      menu.setAttribute('aria-busy', String(busy));
    }
    function refresh() {
      if (menu.hidden || busy || level === 'custom' || JSON.stringify(currentChoices()) === choiceSignature) return;
      const oldTarget = menu.getRootNode().activeElement;
      const recoverFocus = menu.contains(oldTarget);
      render();
      onChange();
      if (recoverFocus) focus([...buttons.querySelectorAll('button')].find(b => b.dataset.action === oldTarget.dataset.action) || buttons.querySelector('button'));
    }
    function present(text, links = [], { keep = false, focusReply = false } = {}) {
      epoch++;
      setBusy(false);
      clearTimeout(speechTimer);
      line.textContent = text;
      followups.replaceChildren(...links.slice(0, 3).map(entry => button(entry.label, () => run(entry), entry.id)));
      followups.hidden = followups.childElementCount === 0;
      // Transition directly from the action box to the reply. Incoming
      // notices also cancel an older action whose reply has yet to arrive.
      menu.hidden = true;
      actor.setAttribute('aria-expanded', 'false');
      speech.hidden = false;
      if (announcement.textContent !== text) announcement.textContent = text;
      else {
        announcement.textContent = '';
        const current = epoch;
        queueMicrotask(() => { if (current === epoch && !speech.hidden) announcement.textContent = text; });
      }
      onChange();
      if (focusReply) focus(followups.querySelector('button') || dismiss);
      if (!keep) speechTimer = setTimeout(() => { if (!speech.matches(':focus-within')) { hideSpeech(); onChange(); } }, 8000);
    }
    async function run(entry) {
      if (entry.kind === 'category') { enter(entry.id); return; }
      if (entry.kind === 'back') { enter(entry.level); return; }
      if (busy) return;
      const current = epoch;
      const fromSpeech = !speech.hidden;
      setBusy(true);
      try {
        const result = await execute(entry);
        if (current !== epoch) return;
        setBusy(false);
        if (result?.stay) {
          if (!fromSpeech) refresh();
          onChange();
          return;
        }
        const links = result?.followups || (entry.kind === 'talk' ? [
          { ...entry, label: entry.promptId === 'joke' ? 'Tell another' : 'Keep talking' },
          action('back', 'Back', { kind: 'back', level: 'talk' })
        ] : []);
        const restoreFocus = result?.restoreFocus !== false && ownsFocus();
        const focusReply = restoreFocus && (fromSpeech || !!links.length);
        if (result?.reaction) onReply(result.reaction);
        if (result?.text) {
          present(result.text, links, { keep: !!links.length, focusReply });
          if (restoreFocus && !focusReply) focus(actor);
        } else close(restoreFocus);
      } catch (error) {
        if (current !== epoch) return;
        const message = error?.message || 'Purrple could not do that. Try again.';
        present(message, [
          { ...entry, label: 'Try again' },
          action('back', 'Back', { kind: 'back', level })
        ], { keep: true, focusReply: ownsFocus() });
      }
    }
    function toggle(focusControl = true) {
      if (!menu.hidden) close();
      else {
        enter('home', focusControl);
        onOpen();
      }
    }
    // Escape belongs to this cluster only while it is the active interaction.
    function escape(event) {
      if (event.key !== 'Escape' || event.isComposing || (menu.hidden && speech.hidden)) return false;
      event.preventDefault();
      event.stopPropagation();
      close();
      return true;
    }
    return { toggle, close, enter, present, escape, refresh, revision: () => epoch, visible: () => !menu.hidden || !speech.hidden, busy: () => busy };
  }

  return Object.freeze({ choices, mount });
});
