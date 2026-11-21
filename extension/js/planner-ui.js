/* Local Week, Day and Agenda in trusted extension surfaces. */
(() => {
  'use strict';
  const calendar = globalThis.PurrpleCalendarDomain;
  const fullDate = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const shortDate = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const weekday = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' });
  const monthDay = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const wallDate = date => new Date(`${date}T12:00:00Z`);
  const dateLabel = (date, formatter = shortDate) => formatter.format(wallDate(date));
  const today = () => calendar.wallAt(Date.now()).date;
  const newId = () => crypto.randomUUID();
  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };
  const button = (text, handler, style = 'button subtle') => {
    const node = create('button', style, text);
    node.type = 'button';
    node.addEventListener('click', handler);
    return node;
  };
  const moveControl = (target, id) => { target.dataset.calendarFocus = id; return target; };
  const clockFormat = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' });
  const displayClock = value => clockFormat.format(value);
  const storeZone = value => value.replaceAll('_', ' ');

  function mount({ root, todayRoot, state, dispatch, notify, showView, refreshProvider, editTask }) {
    if (!root || !calendar) return null;
    let cursor = today(), selected = 'week', draft = null, dragId = null, focusReturn = null;
    let pending = false, signature = '', todaySignature = '';
    let provider = { status: 'disconnected', account: '', events: [], fetchedAt: null, message: '' };
    const narrow = matchMedia('(max-width: 740px)');
    const mode = () => selected === 'week' && narrow.matches ? 'agenda' : selected;
    const current = () => state()?.calendar || calendar.empty();
    const taskList = () => state()?.tasks || [];
    const openTasks = () => taskList().filter(task => !task.done && !task.archived);
    const viewDates = () => {
      const currentMode = mode();
      const start = currentMode === 'week' ? calendar.weekStart(cursor) : cursor;
      return Array.from({ length: currentMode === 'day' ? 1 : 7 }, (_, index) => calendar.addDays(start, index));
    };

    root.innerHTML = `<div class="page-heading planner-heading">
      <div><h1 id="planner-heading" tabindex="-1">Calendar</h1><p id="planner-zone" class="planner-zone"></p></div>
      <button class="button primary" type="button" id="planner-add">New block</button>
    </div>
    <div class="planner-toolbar">
      <div class="planner-period-nav" aria-label="Calendar navigation">
        <button class="button subtle planner-arrow" type="button" id="planner-prev" aria-label="Previous period">←</button>
        <button class="button subtle" type="button" id="planner-today">Today</button>
        <button class="button subtle planner-arrow" type="button" id="planner-next" aria-label="Next period">→</button>
      </div>
      <div class="segmented planner-view-switch" aria-label="Calendar view">
        <button type="button" data-calendar-view="week">Week</button>
        <button type="button" data-calendar-view="day">Day</button>
        <button type="button" data-calendar-view="agenda">Agenda</button>
      </div>
      <label class="planner-date-label" for="planner-jump">Jump to date <input type="date" id="planner-jump" min="1900-01-01" max="9998-12-31"></label>
    </div>
    <div class="planner-period-head"><h2 id="planner-period" aria-live="polite"></h2><div id="planner-history"></div></div>
    <div id="planner-provider" class="planner-provider" hidden></div>
    <div class="planner-layout"><div id="planner-period-content" aria-labelledby="planner-period"></div>
      <section class="planner-inbox" aria-labelledby="planner-inbox-heading"><h3 id="planner-inbox-heading">Unscheduled</h3><div id="planner-inbox-content"></div></section>
    </div>
    <dialog id="planner-dialog" aria-labelledby="planner-dialog-title">
      <form id="planner-form" class="dialog-form" novalidate>
        <div class="dialog-heading"><h2 id="planner-dialog-title">Schedule block</h2><button class="icon-button" type="button" id="planner-close" aria-label="Close schedule form">×</button></div>
        <div class="field"><label for="planner-block-task">Task <span class="muted">(optional)</span></label><select id="planner-block-task"></select></div>
        <div class="field"><label for="planner-block-title">Title</label><input id="planner-block-title" maxlength="200" required autocomplete="off"></div>
        <div class="two-fields"><div class="field"><label for="planner-block-date">Date</label><input type="date" id="planner-block-date" required min="1900-01-01" max="9998-12-31"></div>
        <div class="field" id="planner-time-field"><label for="planner-block-time">Start time</label><input type="time" id="planner-block-time" required></div></div>
        <label class="planner-check"><input type="checkbox" id="planner-block-all-day"> All day</label>
        <div class="two-fields" id="planner-duration-fields"><div class="field"><label for="planner-block-duration">Duration in minutes</label><input type="number" id="planner-block-duration" min="1" max="1440" step="1" required></div>
        <div class="field" id="planner-fold-field" hidden><label for="planner-block-fold">Repeated clock time</label><select id="planner-block-fold"><option value="0">First occurrence</option><option value="1">Second occurrence</option></select></div></div>
        <div class="two-fields" id="planner-repeat-fields"><div class="field"><label for="planner-repeat">Repeat</label><select id="planner-repeat"><option value="none">No repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></div>
        <div class="field" id="planner-repeat-count-field" hidden><label for="planner-repeat-count">Total occurrences</label><input type="number" id="planner-repeat-count" min="2" max="52" value="4" step="1"></div></div>
        <p id="planner-preview" class="planner-preview" role="status"></p>
        <p id="planner-form-error" class="inline-error" hidden role="alert"></p>
        <div class="planner-dialog-actions"><button class="button subtle" id="planner-remove" type="button" hidden>Remove block</button>
        <button class="button subtle" id="planner-start-focus" type="button" hidden>Start focus</button>
        <button class="button subtle" id="planner-cancel" type="button">Cancel</button><button class="button primary" id="planner-save" type="submit">Save block</button></div>
      </form>
    </dialog>`;
    if (todayRoot) todayRoot.setAttribute('aria-label', 'Today’s calendar');
    const get = id => root.querySelector(`#planner-${id}`);
    const dialog = get('dialog');
    const range = get('period-content');

    function setCursor(date) {
      try { cursor = calendar.civil(date); render(); } catch (error) { notify(error.message, true); }
    }
    function stepPeriod(direction) {
      setCursor(calendar.addDays(cursor, direction * (mode() === 'day' ? 1 : 7)));
    }
    function changeView(view) { selected = view; render(); }
    get('today').onclick = () => setCursor(today());
    get('prev').onclick = () => stepPeriod(-1);
    get('next').onclick = () => stepPeriod(1);
    get('jump').onchange = event => { if (event.target.value) setCursor(event.target.value); };
    get('add').onclick = event => openDraft({ date: cursor }, event.currentTarget);
    root.querySelectorAll('[data-calendar-view]').forEach(node => { node.onclick = () => changeView(node.dataset.calendarView); });
    narrow.addEventListener('change', render);

    function blockEntry(block) { return { ...block, type: 'block' }; }
    function dueEntry(task) {
      const date = task.dueDate || (task.dueAt == null ? '' : calendar.wallAt(task.dueAt).date);
      return date ? { id: task.id, type: 'due', date, title: task.title, allDay: true } : null;
    }
    function entriesByDate(dates) {
      const deadlines = openTasks().map(dueEntry).filter(Boolean);
      const taskById = new Map(taskList().map(task => [task.id, task]));
      const completed = (state()?.focusHistory || []).map(session => ({
        id: session.id, type: 'actual', kind: session.kind, durationMs: session.durationMs,
        title: taskById.get(session.taskId)?.title || (session.kind === 'break' ? 'Break' : 'Focus session'),
        startsAt: session.completedAt, endsAt: session.completedAt + 1
      }));
      const list = [...current().blocks.map(blockEntry), ...deadlines, ...provider.events, ...completed];
      const days = new Map(dates.map(date => [date, []]));
      const zone = calendar.zone();
      list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || (a.startsAt || 0) - (b.startsAt || 0) || a.title.localeCompare(b.title));
      for (const entry of list) {
        const [first, last] = calendar.span(entry, zone);
        for (const date of dates) if (date >= first && date <= last) days.get(date).push(entry);
      }
      return days;
    }
    function timeLabel(entry, date) {
      if (entry.allDay) return entry.type === 'due' ? 'Deadline' : 'All day';
      if (entry.type === 'actual') {
        const seconds = Math.floor(entry.durationMs / 1000);
        const remainder = seconds % 60;
        const elapsed = `${Math.floor(seconds / 60)} min${remainder ? ` ${remainder} sec` : ''}`;
        return `${elapsed} · ended ${displayClock(entry.startsAt)}`;
      }
      const startsHere = calendar.wallAt(entry.startsAt).date === date;
      const endsHere = calendar.wallAt(entry.endsAt - 1).date === date;
      if (startsHere && endsHere && calendar.wallAt(entry.endsAt).date === date) return clockFormat.formatRange(entry.startsAt, entry.endsAt);
      const start = startsHere ? displayClock(entry.startsAt) : 'From prior day';
      const end = endsHere ? displayClock(entry.endsAt) : 'Continues';
      return `${start} – ${end}`;
    }
    function eventCard(entry, day) {
      const card = create('li', `planner-entry planner-entry-${entry.type}`);
      const label = create('span', 'planner-entry-type', { block: 'Planned', due: 'Due', external: 'Google', actual: entry.kind === 'break' ? 'Break logged' : 'Focus logged' }[entry.type]);
      const times = create('span', 'planner-entry-clock', timeLabel(entry, day));
      const meta = create('div', 'planner-entry-meta');
      meta.append(label);
      if (entry.type !== 'due') meta.append(times);
      let title;
      if (entry.type === 'block') {
        title = moveControl(button(entry.title, event => openDraft({ block: entry }, event.currentTarget), 'planner-entry-title'), `block-${entry.id}-${day}`);
        title.setAttribute('aria-label', `Schedule ${entry.title}, ${timeLabel(entry, day)}`);
        card.draggable = true;
        card.dataset.block = entry.id;
      } else if (entry.type === 'due' && editTask) {
        title = moveControl(button(entry.title, () => editTask(entry.id), 'planner-entry-title'), `due-${entry.id}-${day}`);
      } else title = create('strong', 'planner-entry-title', entry.title);
      card.append(meta, title);
      if (entry.type === 'external') {
        const actions = create('div', 'planner-external-actions');
        if (entry.link) {
          const link = create('a', 'text-button', 'Open in Google'); link.href = entry.link; link.target = '_blank'; link.rel = 'noopener noreferrer';
          link.setAttribute('aria-label', `Open ${entry.title} in Google Calendar`);
          actions.append(link);
        }
        const add = button('Copy to task', async () => {
          add.disabled = true;
          try {
            await dispatch({ type: 'TASK_ADD', title: entry.title.slice(0, 200), dueDate: entry.allDay ? entry.date : calendar.wallAt(entry.startsAt).date, sourceUrl: entry.link || undefined, sourceEventId: entry.id.slice(0, 300) }, 'Task added to your inbox.');
          } catch (error) { notify(error.message, true); }
          finally { add.disabled = false; }
        }, 'text-button');
        actions.append(add);
        card.append(actions);
      }
      return card;
    }
    function lane(entries, date, type, showEmpty = false) {
      const list = create('ul', `planner-lane planner-${type}-lane`);
      list.setAttribute('aria-label', type === 'all' ? 'All-day items and deadlines' : 'Timed blocks and commitments');
      entries.forEach(entry => list.append(eventCard(entry, date)));
      if (!entries.length && showEmpty) list.append(create('li', 'planner-empty', type === 'all' ? 'No all-day items' : 'No timed blocks'));
      return list;
    }
    function daySection(date, layout, entries) {
      const day = create('section', 'planner-day');
      day.dataset.plannerDate = date;
      if (today() === date) day.classList.add('planner-date-today');
      const head = create('div', 'planner-day-heading');
      const heading = create('h3');
      if (layout === 'week') {
        const dayButton = moveControl(button(`${dateLabel(date, weekday)} ${Number(date.slice(-2))}`, () => { cursor = date; changeView('day'); get('period').focus({ preventScroll: true }); }, 'planner-day-label'), `day-${date}`);
        dayButton.setAttribute('aria-label', `Show ${dateLabel(date, fullDate)}`);
        heading.append(dayButton);
      } else heading.textContent = dateLabel(date);
      if (today() === date) heading.setAttribute('aria-current', 'date');
      const plus = moveControl(button('+', event => openDraft({ date }, event.currentTarget), 'planner-small-button'), `add-${date}`);
      plus.setAttribute('aria-label', `Schedule a block on ${dateLabel(date, fullDate)}`);
      head.append(heading, plus); day.append(head);
      const all = entries.filter(item => item.allDay);
      const timed = entries.filter(item => !item.allDay);
      if (layout !== 'week' && (all.length || layout === 'day')) day.append(create('p', 'planner-lane-heading', 'All day & deadlines'));
      if (all.length || layout !== 'agenda') day.append(lane(all, date, 'all', layout === 'day'));
      if (layout !== 'week' && timed.length) day.append(create('p', 'planner-lane-heading', 'Timed'));
      if (timed.length || layout === 'day') day.append(lane(timed, date, 'timed', layout === 'day'));
      return day;
    }
    function providerBanner() {
      const container = get('provider');
      container.replaceChildren();
      container.hidden = !['loading', 'connected', 'stale', 'limited', 'revoked'].includes(provider.status);
      if (container.hidden) return;
      const message = create('p');
      const last = provider.fetchedAt ? ` Last refreshed ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(provider.fetchedAt)}.` : '';
      message.textContent = ({
        loading: 'Checking the primary Google calendar…',
        connected: 'Google · primary calendar, upcoming seven days.', limited: 'Google · only the first 100 upcoming items are available.',
        stale: `Google refresh failed.${provider.events.length ? ' Showing the last successful refresh.' : ''}`,
        revoked: 'Google access expired or was removed. Reconnect in Settings.'
      })[provider.status] + last;
      if (provider.message && ['stale', 'limited'].includes(provider.status)) message.textContent += ` ${provider.message}`;
      container.append(message);
      if (provider.status === 'revoked') container.append(button('Settings', () => showView('settings'), 'text-button'));
      else if (refreshProvider && provider.status !== 'loading') container.append(button(provider.status === 'stale' ? 'Retry' : 'Refresh', refreshProvider, 'text-button'));
    }
    function renderInbox() {
      const container = get('inbox-content'); container.replaceChildren();
      const scheduled = new Set(current().blocks.filter(block => block.allDay ? block.date >= today() : block.endsAt > Date.now()).map(block => block.taskId));
      const unscheduled = openTasks().filter(task => !scheduled.has(task.id));
      if (!unscheduled.length) {
        container.append(create('p', 'planner-empty', 'Unscheduled tasks will appear here.'));
        return;
      }
      const list = create('ul', 'planner-inbox-list');
      unscheduled.forEach(task => {
        const item = create('li');
        item.append(create('span', 'planner-inbox-title', task.title));
        item.append(moveControl(button('Schedule…', event => openDraft({ task, date: cursor }, event.currentTarget), 'text-button'), `schedule-${task.id}`));
        list.append(item);
      });
      container.append(list);
    }
    function renderToday() {
      if (!todayRoot || !state()) return;
      const now = Date.now(), currentDate = today();
      const next = current().blocks.filter(block => calendar.includesDay(block, currentDate) && (block.allDay || block.endsAt > now));
      next.sort((a, b) => (a.startsAt || 0) - (b.startsAt || 0));
      const fingerprint = JSON.stringify([currentDate, next]);
      if (todaySignature === fingerprint) return;
      todaySignature = fingerprint;
      todayRoot.replaceChildren();
      const title = create('h2', '', 'On your calendar');
      const openCalendar = button('Open Calendar', () => { cursor = currentDate; showView('calendar'); get('heading').focus({ preventScroll: true }); }, 'text-button');
      const head = create('div', 'planner-today-heading'); head.append(title, openCalendar); todayRoot.append(head);
      if (!next.length) {
        const empty = create('p', 'planner-empty', 'No local blocks left for today.');
        const schedule = button('Schedule something', event => { cursor = currentDate; showView('calendar'); openDraft({ date: cursor }, event.currentTarget); }, 'text-button');
        todayRoot.append(empty, schedule);
        return;
      }
      const list = create('ul', 'planner-today-list');
      for (const block of next.slice(0, 4)) {
        const row = create('li'); row.append(create('span', 'planner-entry-clock', timeLabel(block, currentDate)));
        row.append(button(block.title, event => { cursor = currentDate; showView('calendar'); openDraft({ block }, event.currentTarget); }, 'text-button'));
        list.append(row);
      }
      todayRoot.append(list);
    }
    function restoreLogicalFocus(previous) {
      if (!previous) return;
      const nodes = [...root.querySelectorAll('[data-calendar-focus]')];
      const replacement = nodes.find(node => node.dataset.calendarFocus === previous);
      (replacement || get('add')).focus({ preventScroll: true });
    }
    function render() {
      renderToday();
      if (!state() || root.hidden) return;
      const dates = viewDates(), layout = mode();
      const nextSignature = JSON.stringify([cursor, layout, current(), openTasks(), provider, state()?.focus?.id, state()?.focusHistory]);
      if (nextSignature === signature) return;
      signature = nextSignature;
      const focusNode = document.activeElement;
      const active = root.contains(focusNode) && focusNode.dataset.calendarFocus;
      get('zone').textContent = storeZone(calendar.zone());
      get('jump').value = cursor;
      get('period').tabIndex = -1;
      get('period').textContent = layout === 'day' ? dateLabel(cursor, fullDate) : `${dateLabel(dates[0], monthDay)} – ${dateLabel(dates.at(-1), monthDay)}, ${dates.at(-1).slice(0, 4)}`;
      root.querySelectorAll('[data-calendar-view]').forEach(node => node.setAttribute('aria-pressed', String(node.dataset.calendarView === layout)));
      get('prev').setAttribute('aria-label', layout === 'day' ? 'Previous day' : 'Previous seven days');
      get('next').setAttribute('aria-label', layout === 'day' ? 'Next day' : 'Next seven days');
      get('history').replaceChildren();
      if (current().undo) get('history').append(moveControl(button('Undo last change', async () => {
        try { await dispatch({ type: 'BLOCK_UNDO', id: current().undo.id }, 'Calendar change undone.'); }
        catch (error) { notify(error.message, true); }
      }, 'text-button'), 'undo'));
      providerBanner();
      range.className = layout === 'day' ? 'planner-day-view' : `planner-${layout}`;
      range.replaceChildren();
      if (layout === 'week') range.append(create('p', 'planner-week-key', 'All day & deadlines'));
      const entries = entriesByDate(dates);
      for (const date of dates) { if (layout !== 'agenda' || entries.get(date).length || date === cursor) range.append(daySection(date, layout, entries.get(date))); }
      if (layout === 'agenda' && range.children.length === 1 && !entries.get(cursor).length) range.append(create('p', 'planner-empty planner-no-agenda', 'No items in these seven days.'));
      renderInbox();
      if (!focusNode.isConnected) restoreLogicalFocus(active);
    }

    function proposed() {
      const repeating = !draft.block && get('repeat').value !== 'none';
      return {
        id: draft.id,
        title: get('block-title').value.trim(),
        taskId: get('block-task').value || null,
        date: get('block-date').value,
        time: get('block-time').value,
        duration: Number(get('block-duration').value),
        allDay: get('block-all-day').checked,
        fold: Number(get('block-fold').value),
        zone: draft.zone,
        repeat: repeating ? get('repeat').value : 'none',
        count: repeating ? Number(get('repeat-count').value) : 1
      };
    }
    function displayPreview() {
      if (!draft) return;
      const input = proposed();
      get('time-field').hidden = input.allDay;
      get('duration-fields').hidden = input.allDay;
      get('repeat-count-field').hidden = input.repeat === 'none';
      const preview = get('preview');
      preview.classList.remove('planner-warning');
      get('fold-field').hidden = true;
      try {
        if (!input.allDay) get('fold-field').hidden = calendar.instantOptions(input.date, input.time, input.zone).length < 2;
        const block = calendar.normalize({ ...input, title: input.title || 'Untitled block', ...(draft.block?.seriesId ? { seriesId: draft.block.seriesId, occurrence: draft.block.occurrence } : {}) }, taskList());
        const notes = [];
        if (!block.allDay) {
          const last = calendar.wallAt(block.endsAt, block.zone);
          const weekday = wallDate(block.date).getUTCDay();
          if (block.time < '08:00' || last.time > '18:00' || last.date !== block.date || !weekday || weekday === 6) notes.push('Outside typical weekday work hours.');
          const conflicts = [...current().blocks, ...provider.events].filter(other => other.id !== draft.block?.id && calendar.overlaps(block, other));
          if (conflicts.length) notes.push(conflicts.length === 1 ? `Overlaps “${conflicts[0].title}”.` : `Overlaps ${conflicts.length} other commitments.`);
          const clock = instant => new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit', timeZone: block.zone }).format(instant);
          const end = last.date === block.date ? clock(block.endsAt) : `${dateLabel(last.date)}, ${clock(block.endsAt)}`;
          preview.textContent = `${dateLabel(block.date)} · ${clock(block.startsAt)} – ${end} · ${storeZone(block.zone)}.`;
        } else preview.textContent = `${dateLabel(block.date)} · All day.`;
        if (notes.length) {
          preview.classList.add('planner-warning');
          preview.textContent += ` ${notes.join(' ')} You can still save.`;
        }
        if (input.repeat !== 'none' && input.count > 0) preview.textContent += ` ${input.count} ${input.repeat === 'daily' ? 'daily' : 'weekly'} occurrences.`;
        if (draft.block?.seriesId) preview.textContent += ' This changes only the selected occurrence.';
      } catch (error) {
        preview.textContent = error.message;
        preview.classList.add('planner-warning');
      }
    }
    function openDraft({ block, task, date, moved = false }, trigger) {
      if (dialog.open || !state()) return;
      const activeBlock = block && current().blocks.find(candidate => candidate.id === block.id);
      if (block && !activeBlock) return;
      const blockZone = moved ? calendar.zone() : activeBlock?.zone || calendar.zone();
      draft = { id: activeBlock?.id || newId(), operationId: newId(), block: activeBlock, zone: blockZone };
      focusReturn = trigger;
      get('dialog-title').textContent = activeBlock ? moved ? 'Review block move' : 'Schedule block' : 'New block';
      const taskSelect = get('block-task');
      taskSelect.replaceChildren(new Option('No linked task', ''));
      for (const item of openTasks()) taskSelect.add(new Option(item.title, item.id));
      const linked = activeBlock && taskList().find(item => item.id === activeBlock.taskId);
      if (linked && !openTasks().some(item => item.id === linked.id)) taskSelect.add(new Option(`${linked.title} (${linked.archived ? 'archived' : 'complete'})`, linked.id));
      if (activeBlock?.taskId || task?.id) taskSelect.value = activeBlock?.taskId || task.id;
      get('block-title').value = activeBlock?.title || task?.title || '';
      get('block-date').value = date || activeBlock?.date || cursor;
      get('block-time').value = moved && !activeBlock.allDay ? calendar.wallAt(activeBlock.startsAt, blockZone).time : activeBlock?.time || '09:00';
      get('block-all-day').checked = !!activeBlock?.allDay;
      get('block-duration').value = activeBlock?.duration || task?.estimate || 25;
      get('block-fold').value = activeBlock?.fold || 0;
      get('repeat').value = 'none';
      get('repeat-count').value = 4;
      get('repeat-fields').hidden = !!activeBlock;
      get('form-error').hidden = true;
      get('remove').hidden = !activeBlock || moved;
      get('start-focus').hidden = !activeBlock || moved;
      get('start-focus').textContent = state()?.focus ? 'View active timer' : 'Start focus';
      get('save').textContent = moved ? 'Move block' : 'Save block';
      displayPreview();
      dialog.showModal();
      get(moved ? activeBlock.allDay ? 'block-date' : 'block-time' : 'block-title').focus();
    }
    function setBusy(busy) {
      pending = busy;
      for (const id of ['save', 'cancel', 'remove', 'start-focus', 'close']) get(id).disabled = busy;
    }
    async function commit(action, copy) {
      if (pending || !draft) return;
      const error = get('form-error');
      error.hidden = true;
      setBusy(true);
      try {
        const next = await dispatch(action);
        dialog.close();
        const undo = next.calendar?.undo;
        notify(copy, false, undo?.id === action.operationId
          ? () => dispatch({ type: 'BLOCK_UNDO', id: undo.id }, 'Calendar change undone.')
          : null);
      } catch (failure) { error.textContent = failure.message; error.hidden = false; }
      finally { setBusy(false); }
    }
    get('form').oninput = () => { get('form-error').hidden = true; displayPreview(); };
    get('block-task').onchange = event => {
      if (!get('block-title').value.trim()) get('block-title').value = taskList().find(item => item.id === event.target.value)?.title || '';
      displayPreview();
    };
    get('form').onsubmit = async event => {
      event.preventDefault();
      if (pending || !draft) return;
      const block = proposed();
      const existing = draft.block;
      await commit({ type: existing ? 'BLOCK_UPDATE' : 'BLOCK_ADD', id: draft.id, operationId: draft.operationId, expected: existing || undefined, block }, existing ? 'Block updated.' : 'Block scheduled.');
    };
    get('remove').onclick = () => commit({ type: 'BLOCK_REMOVE', id: draft.id, operationId: draft.operationId, expected: draft.block }, 'Block removed.');
    get('start-focus').onclick = async () => {
      if (pending || !draft?.block) return;
      if (state()?.focus) { dialog.close(); showView('focus'); return; }
      const block = draft.block;
      const taskId = openTasks().some(task => task.id === block.taskId) ? block.taskId : null;
      setBusy(true);
      try {
        await dispatch({ type: 'FOCUS_START', minutes: Math.min(block.duration || 25, 240), taskId, blockId: block.id }, 'Focus started.');
        dialog.close();
        showView('focus');
      } catch (error) {
        get('form-error').textContent = error.message;
        get('form-error').hidden = false;
      } finally { setBusy(false); }
    };
    get('close').onclick = get('cancel').onclick = () => dialog.close();
    dialog.addEventListener('cancel', event => { if (pending) event.preventDefault(); });
    dialog.addEventListener('close', () => {
      const previous = focusReturn;
      draft = focusReturn = null;
      if (previous?.isConnected && !previous.closest('[hidden]')) previous.focus({ preventScroll: true });
      else if (!root.hidden) restoreLogicalFocus(previous?.dataset.calendarFocus || 'add');
    });

    range.addEventListener('dragstart', event => {
      const card = event.target.closest('[data-block]');
      if (!card || !event.dataTransfer) return;
      dragId = card.dataset.block;
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('application/x-purrple-block', dragId);
    });
    function clearDrop() {
      for (const day of range.querySelectorAll('.planner-drop-target')) day.classList.remove('planner-drop-target');
    }
    range.addEventListener('dragover', event => {
      const day = event.target.closest('[data-planner-date]');
      if (!dragId || !day) return;
      event.preventDefault();
      clearDrop();
      day.classList.add('planner-drop-target');
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    });
    range.addEventListener('dragleave', event => {
      const day = event.target.closest('[data-planner-date]');
      if (day && !day.contains(event.relatedTarget)) day.classList.remove('planner-drop-target');
    });
    range.addEventListener('dragend', () => { dragId = null; clearDrop(); });
    range.addEventListener('drop', event => {
      const target = event.target.closest('[data-planner-date]');
      const id = dragId;
      dragId = null;
      clearDrop();
      if (!target || !id) return;
      event.preventDefault();
      const block = current().blocks.find(item => item.id === id);
      if (block) {
        const trigger = [...range.querySelectorAll('[data-block]')].find(card => card.dataset.block === id)?.querySelector('button');
        openDraft({ block, date: target.dataset.plannerDate, moved: true }, trigger);
      }
    });
    function setProvider(snapshot) {
      provider = calendar.providerSnapshot(provider, snapshot);
      render();
    }
    function scheduleTask(id, trigger) {
      const task = openTasks().find(item => item.id === id);
      if (task) { cursor = today(); showView('calendar'); openDraft({ task, date: cursor }, trigger); }
    }
    return Object.freeze({ render, setProvider, scheduleTask });
  }
  globalThis.PurrplePlanner = Object.freeze({ mount });
})();
