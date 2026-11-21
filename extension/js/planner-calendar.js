/* Civil dates, planned blocks and the normalized read-only calendar projection. */
(function (root, factory) {
  const domain = factory();
  if (typeof module === 'object' && module.exports) module.exports = domain;
  root.PurrpleCalendarDomain = domain;
})(globalThis, function () {
  'use strict';

  const MINUTE = 60000;
  const DAY = 86400000;
  const MAX_BLOCKS = 20000;
  const clock = /^([01]\d|2[0-3]):[0-5]\d$/;
  const formatters = new Map();
  const empty = () => ({ blocks: [], undo: null });
  const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  function civil(value) {
    if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) throw Error('Choose a valid calendar date.');
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw Error('Choose a valid calendar date.');
    return value;
  }

  function addDays(date, days) {
    const instant = Date.parse(`${civil(date)}T00:00:00Z`) + days * DAY;
    return civil(new Date(instant).toISOString().slice(0, 10));
  }

  function weekStart(date) {
    const weekday = new Date(`${civil(date)}T00:00:00Z`).getUTCDay();
    return addDays(date, -(weekday + 6) % 7);
  }

  function formatter(timeZone) {
    if (typeof timeZone !== 'string' || timeZone.length > 100) throw Error('Choose a valid time zone.');
    if (!formatters.has(timeZone)) {
      try {
        const next = new Intl.DateTimeFormat('en-CA', {
          timeZone, calendar: 'iso8601', numberingSystem: 'latn', year: 'numeric',
          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
        });
        if (formatters.size >= 40) formatters.delete(formatters.keys().next().value);
        formatters.set(timeZone, next);
      } catch { throw Error('Choose a valid time zone.'); }
    }
    return formatters.get(timeZone);
  }

  function wallAt(instant, timeZone = zone()) {
    const parts = Object.fromEntries(formatter(timeZone).formatToParts(instant).map(part => [part.type, part.value]));
    return { date: `${parts.year.padStart(4, '0')}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}`, second: parts.second };
  }

  function instantOptions(date, time, timeZone = zone()) {
    civil(date);
    if (typeof time !== 'string' || !clock.test(time)) throw Error('Choose a valid start time.');
    const nominal = Date.parse(`${date}T${time}:00Z`);
    const offsets = new Set([-24, -12, 0, 12, 24].map(hours => {
      const probe = nominal + hours * 60 * MINUTE;
      const wall = wallAt(probe, timeZone);
      return Date.parse(`${wall.date}T${wall.time}:${wall.second}Z`) - probe;
    }));
    return [...offsets].map(offset => nominal - offset).filter(candidate => {
      const wall = wallAt(candidate, timeZone);
      return wall.date === date && wall.time === time;
    }).sort((a, b) => a - b);
  }

  function id(value, label = 'block identifier') {
    if (typeof value !== 'string' || !/^[A-Za-z0-9:_-]{1,160}$/.test(value)) throw Error(`Invalid ${label}.`);
    return value;
  }

  function taskLink(value, tasks) {
    if (value == null || value === '') return null;
    if (typeof value !== 'string' || !tasks.some(task => task.id === value)) throw Error('The linked task could not be found.');
    return value;
  }

  function normalize(input, tasks) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('A calendar block is missing.');
    const key = id(input.id);
    const taskId = taskLink(input.taskId, tasks);
    if (typeof input.title !== 'string' || !input.title.trim() || input.title.length > 200 || /[\u0000-\u001f\u007f]/.test(input.title)) throw Error('Give this block a title of up to 200 characters.');
    const date = civil(input.date);
    const allDay = input.allDay === true;
    const timeZone = input.zone || zone();
    formatter(timeZone);
    const seriesId = input.seriesId == null ? null : id(input.seriesId, 'series identifier');
    const occurrence = seriesId ? civil(input.occurrence) : null;
    if (seriesId && key !== `${seriesId}:${occurrence}`) throw Error('A recurring occurrence identifier is inconsistent.');
    if (!seriesId && input.occurrence != null) throw Error('A recurring occurrence is missing its series.');
    const shared = { id: key, title: input.title.trim(), taskId, allDay, date, zone: timeZone, seriesId, occurrence };
    if (allDay) return { ...shared, time: null, duration: null, fold: 0, startsAt: null, endsAt: null };
    const duration = input.duration;
    if (!Number.isInteger(duration) || duration < 1 || duration > 1440) throw Error('Enter a duration between 1 and 1,440 minutes.');
    const options = instantOptions(date, input.time, timeZone);
    if (!options.length) throw Error('That local time is skipped by a clock change. Choose a different start.');
    if (input.fold !== undefined && ![0, 1].includes(input.fold)) throw Error('Choose the first or second occurrence of the start time.');
    const fold = options.length > 1 && input.fold === 1 ? 1 : 0;
    const startsAt = options[fold];
    return { ...shared, time: input.time, duration, fold, startsAt, endsAt: startsAt + duration * MINUTE };
  }

  function exactData(blocks, tasks) {
    if (!Array.isArray(blocks) || blocks.length > MAX_BLOCKS) throw Error('The calendar block list is invalid.');
    const keys = new Set();
    return blocks.map(raw => {
      const block = normalize(raw, tasks);
      if (keys.has(block.id)) throw Error('The calendar contains duplicate block identifiers.');
      keys.add(block.id);
      if (raw.startsAt !== block.startsAt || raw.endsAt !== block.endsAt || raw.fold !== block.fold || raw.zone !== block.zone || raw.allDay !== block.allDay) {
        throw Error('A calendar block does not match its saved date, time, or time zone.');
      }
      return block;
    });
  }

  function validate(input, tasks) {
    if (input === undefined) return empty();
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('The calendar backup is invalid.');
    const blocks = exactData(input.blocks, tasks);
    if (input.undo == null) return { blocks, undo: null };
    const undoId = id(input.undo.id, 'calendar undo identifier');
    const before = exactData(input.undo.before, tasks);
    const refs = new Set(blocks.map(block => block.id));
    if (!Array.isArray(input.undo.after) || input.undo.after.length > 52 || before.length > 52) throw Error('The calendar undo record is invalid.');
    const after = input.undo.after.map(value => id(value));
    if (new Set(after).size !== after.length || after.some(key => !refs.has(key)) || (!before.length && !after.length)) throw Error('The calendar undo record refers to missing blocks.');
    if (before.some(block => refs.has(block.id) && !after.includes(block.id)) || blocks.length - after.length + before.length > MAX_BLOCKS) throw Error('The calendar undo record conflicts with saved blocks.');
    return { blocks, undo: { id: undoId, before, after } };
  }

  function sameSlot(a, b) {
    const sameWork = a.taskId !== null ? a.taskId === b.taskId : b.taskId === null && a.title === b.title;
    return sameWork && a.allDay === b.allDay && (a.allDay ? a.date === b.date : a.startsAt === b.startsAt && a.endsAt === b.endsAt);
  }

  function reduce(state, action, now) {
    const current = state.calendar || empty();
    const key = id(action.id);
    const blocks = current.blocks;
    if (action.type === 'BLOCK_UNDO') {
      const undo = current.undo;
      if (!undo || undo.id !== key) throw Error('That change can no longer be undone.');
      return { blocks: [...blocks.filter(b => !undo.after.includes(b.id)), ...undo.before], undo: null };
    }
    const transaction = id(action.operationId || `${action.type}:${now}:${key}`.slice(0, 160), 'calendar operation identifier');
    let before = [];
    let after = [];
    if (action.type === 'BLOCK_ADD') {
      const { repeat = 'none', count = 1 } = action.block || {};
      if (!['none', 'daily', 'weekly'].includes(repeat) || !Number.isInteger(count) || count < (repeat === 'none' ? 1 : 2) || count > 52 || (repeat === 'none' && count !== 1)) throw Error('Choose a valid repeat schedule.');
      if (blocks.length + count > MAX_BLOCKS) throw Error('The calendar is full. Remove an old block before you add another.');
      const seriesId = repeat === 'none' ? null : key;
      after = Array.from({ length: count }, (_, index) => {
        const date = addDays(action.block.date, index * (repeat === 'weekly' ? 7 : 1));
        return normalize({ ...action.block, id: seriesId ? `${key}:${date}` : key, seriesId, occurrence: seriesId ? date : null, date }, state.tasks);
      });
      const ids = new Set(after.map(b => b.id));
      if (blocks.some(b => ids.has(b.id) || b.id === key || b.seriesId === key)) throw Error('This calendar block was already saved.');
    } else if (action.type === 'BLOCK_UPDATE' || action.type === 'BLOCK_REMOVE') {
      const existing = blocks.find(block => block.id === key);
      if (!existing) throw Error('This calendar block could not be found.');
      if (action.expected && JSON.stringify(action.expected) !== JSON.stringify(existing)) throw Error('This block changed in another view. Reopen it before editing.');
      before = [existing];
      if (action.type === 'BLOCK_UPDATE') after = [normalize({ ...existing, ...action.block, id: key, seriesId: existing.seriesId, occurrence: existing.occurrence }, state.tasks)];
    } else throw Error('That calendar action is not supported.');
    const existingBlocks = blocks.filter(block => !before.includes(block));
    if (after.some(candidate => existingBlocks.some(existing => sameSlot(candidate, existing)))) throw Error('That work is already scheduled at this time.');
    return {
      blocks: [...existingBlocks, ...after],
      undo: { id: transaction, before, after: after.map(block => block.id) }
    };
  }

  function overlaps(first, second) {
    return first.startsAt != null && second.startsAt != null && first.startsAt < second.endsAt && second.startsAt < first.endsAt;
  }

  function span(entry, timeZone = zone()) {
    if (entry.allDay) return [entry.date, entry.endDate ? addDays(entry.endDate, -1) : entry.date];
    return [wallAt(entry.startsAt, timeZone).date, wallAt(entry.endsAt - 1, timeZone).date];
  }

  function includesDay(entry, date, timeZone = zone()) {
    const [first, last] = span(entry, timeZone);
    return date >= first && date <= last;
  }

  function safeGoogleLink(value) {
    try {
      const url = new URL(value);
      return url.origin === 'https://calendar.google.com' && url.pathname.startsWith('/calendar/') && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }

  function externalEvents(rows) {
    if (!Array.isArray(rows)) return [];
    const events = new Map();
    for (const [index, row] of rows.entries()) {
      if (!row || typeof row !== 'object') continue;
      const link = safeGoogleLink(row.link || row.htmlLink);
      const original = row.originalStartTime?.date || row.originalStartTime?.dateTime;
      // The installed native helper exposes a Google link and interval, not API identifiers.
      const legacyId = link ? new URL(link).searchParams.get('eid') : '';
      const legacyStart = row.start?.date || row.start?.dateTime || '';
      const key = row.recurringEventId && original ? `${row.recurringEventId}:${original}` : typeof row.id === 'string' && row.id || legacyId || `native:${legacyStart}:${index}`;
      if (row.status === 'cancelled') { events.set(key, null); continue; }
      if (events.has(key) && events.get(key) === null) continue;
      const name = row.title || row.summary;
      const base = { id: key, title: typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 250) || 'Busy' : 'Busy', link, type: 'external' };
      if (row.start?.date && row.end?.date) {
        try {
          const date = civil(row.start.date), endDate = civil(row.end.date);
          if (date < endDate) events.set(key, { ...base, allDay: true, date, endDate });
        } catch { /* A malformed remote event cannot block the local calendar. */ }
      } else {
        const startsAt = Date.parse(row.start?.dateTime), endsAt = Date.parse(row.end?.dateTime);
        if (Number.isFinite(startsAt) && Number.isFinite(endsAt) && startsAt < endsAt) events.set(key, { ...base, allDay: false, startsAt, endsAt });
      }
    }
    return [...events.values()].filter(Boolean);
  }

  function providerSnapshot(previous, next) {
    const status = next.status;
    if (!['loading', 'connected', 'stale', 'revoked', 'limited', 'disconnected', 'unavailable'].includes(status)) throw Error('Invalid calendar source status.');
    const same = !!next.account && previous?.account === next.account;
    const readable = ['connected', 'limited', 'stale'].includes(status);
    const data = readable && Array.isArray(next.events) ? externalEvents(next.events) :
      status === 'stale' && same ? previous.events : [];
    return { status, account: readable ? next.account || '' : '', events: data, fetchedAt: next.fetchedAt || (same && data.length ? previous.fetchedAt : null), message: next.message || '' };
  }

  return Object.freeze({ empty, reduce, validate, civil, addDays, weekStart, wallAt, zone, instantOptions, normalize, overlaps, span, includesDay, externalEvents, providerSnapshot });
});
