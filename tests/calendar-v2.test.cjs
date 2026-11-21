const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../extension/js/planner-calendar.js');

const now = Date.parse('2026-11-20T15:00Z');
const task = { id: 'task-demo', title: 'Read a chapter', dueDate: '2026-11-22' };
const time = { title: 'Read a chapter', taskId: task.id, date: '2026-11-20', time: '14:00', duration: 60, zone: 'UTC' };
const initial = () => ({ tasks: [task], calendar: C.empty() });
const apply = (state, action) => ({ ...state, calendar: C.reduce(state, action, now) });
const add = (state, block = time, id = 'read') => apply(state, { type: 'BLOCK_ADD', id, block });

test('block moves and resizes are independent from task deadlines, and undo is recoverable', () => {
  let state = add(initial());
  const original = state.calendar.blocks[0];
  state = apply(state, { type: 'BLOCK_UPDATE', id: 'read', expected: original, block: { date: '2026-11-24', time: '10:30', duration: 15 } });
  const [moved] = state.calendar.blocks;
  assert.equal(state.tasks[0].dueDate, '2026-11-22');
  assert.equal(new Date(moved.startsAt).toISOString(), '2026-11-24T10:30:00.000Z');
  assert.equal(moved.endsAt - moved.startsAt, 900000);
  assert.throws(() => apply(state, { type: 'BLOCK_UPDATE', id: 'read', expected: original, block: { duration: 100 } }), /changed in another view/);
  state = apply(state, { type: 'BLOCK_UNDO', id: state.calendar.undo.id });
  assert.deepEqual(state.calendar, { blocks: [original], undo: null });
  assert.throws(() => apply(state, { type: 'BLOCK_UNDO', id: 'invalid' }), /no longer be undone/);
});

test('a recurring instance retains its ID after moving and the rest of the series is preserved', () => {
  const planned = add(initial(), { ...time, repeat: 'weekly', count: 3 }, 'weekly-read');
  const [first, second, last] = planned.calendar.blocks;
  assert.equal(last.occurrence, '2026-12-04');
  const moved = apply(planned, { type: 'BLOCK_UPDATE', id: second.id, block: { date: '2026-11-28', time: '16:00' } });
  assert.equal(moved.calendar.blocks.find(b => b.occurrence === '2026-11-27').id, second.id);
  assert.equal(moved.calendar.blocks.find(b => b.id === second.id).date, '2026-11-28');
  assert.deepEqual(moved.calendar.blocks.filter(b => b.id !== second.id), [first, last]);
  const removed = apply(moved, { type: 'BLOCK_REMOVE', id: second.id });
  assert.deepEqual(removed.calendar.blocks, [first, last]);
  assert.deepEqual(apply(removed, { type: 'BLOCK_UNDO', id: removed.calendar.undo.id }).calendar.blocks, moved.calendar.blocks);
});

test('calendar import verifies linked tasks, the time tuple and undo data before replacing anything', () => {
  const planned = add(initial());
  assert.deepEqual(C.validate(undefined, planned.tasks), C.empty());
  assert.deepEqual(C.validate(JSON.parse(JSON.stringify(planned.calendar)), planned.tasks), planned.calendar);
  assert.throws(() => C.validate(planned.calendar, []), /linked task/);
  assert.throws(() => C.validate({ blocks: [{ ...planned.calendar.blocks[0], startsAt: now }], undo: null }, planned.tasks), /does not match/);
  assert.throws(() => C.validate({ ...planned.calendar, undo: { ...planned.calendar.undo, after: ['missing'] } }, planned.tasks), /missing blocks/);
  assert.throws(() => C.validate({ blocks: Array(2).fill(planned.calendar.blocks[0]) }, planned.tasks), /duplicate block/);
  assert.throws(() => C.validate({ blocks: [{ ...planned.calendar.blocks[0], zone: 'Mars/Colony' }] }, planned.tasks), /time zone/);
});

test('double booking the same task and exact interval is rejected without obstructing a real overlap', () => {
  const planned = add(initial());
  assert.throws(() => add(planned, time, 'another-id'), /already scheduled/);
  assert.throws(() => add(planned), /already saved/);
  const two = add(planned, { ...time, time: '14:30' }, 'distinct-slot').calendar.blocks;
  assert.equal(C.overlaps(...two), true);
  assert.equal(C.overlaps(two[0], { ...two[1], startsAt: two[0].endsAt }), false);
});

test('civil deadlines and all-day events keep their explicit date, timed blocks follow the display zone', () => {
  const planned = add(initial(), { ...time, time: '23:45', duration: 30 });
  const [block] = planned.calendar.blocks;
  assert.equal(C.includesDay(block, '2026-11-20', 'UTC'), true);
  assert.equal(C.includesDay(block, '2026-11-21', 'UTC'), true);
  assert.equal(C.includesDay(block, '2026-11-20', 'Asia/Jakarta'), false);
  assert.equal(C.includesDay(block, '2026-11-21', 'Asia/Jakarta'), true);
  const events = C.externalEvents([{ id: 'vacation', summary: 'Vacation', start: { date: '2026-11-20' }, end: { date: '2026-11-22' } }]);
  assert.equal(C.includesDay(events[0], '2026-11-20', 'Pacific/Auckland'), true);
  assert.equal(C.includesDay(events[0], '2026-11-21', 'America/Los_Angeles'), true);
  assert.equal(C.includesDay(events[0], '2026-11-22', 'UTC'), false);
  assert.throws(() => C.civil('2025-02-29'), /valid calendar date/);
  assert.equal(C.addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(C.weekStart('2026-11-22'), '2026-11-16');
});

test('DST gaps are rejected and overlap offers first and second real instants', () => {
  const input = { ...time, zone: 'America/New_York', date: '2026-03-08', time: '02:15' };
  assert.throws(() => add(initial(), input), /skipped by a clock change/);
  const repeat = { ...input, date: '2026-03-01', repeat: 'weekly', count: 2 };
  assert.throws(() => add(initial(), repeat), /skipped by a clock change/);
  const early = add(initial(), { ...input, date: '2026-11-01', time: '01:30' }).calendar.blocks[0];
  const late = add(initial(), { ...input, date: '2026-11-01', time: '01:30', fold: 1 }).calendar.blocks[0];
  assert.equal(new Date(early.startsAt).toISOString(), '2026-11-01T05:30:00.000Z');
  assert.equal(new Date(late.startsAt).toISOString(), '2026-11-01T06:30:00.000Z');
  assert.equal(late.endsAt - late.startsAt, 3600000);
  assert.equal(C.wallAt(late.startsAt, input.zone).time, '01:30');
});

test('provider projection recognizes a moved occurrence by original instant and drops cancellations', () => {
  const originalStartTime = { dateTime: '2026-11-20T09:00:00-05:00' };
  const recurring = { recurringEventId: 'series', originalStartTime, summary: 'Moved practice', start: { dateTime: '2026-11-21T09:00:00-05:00' }, end: { dateTime: '2026-11-21T10:00:00-05:00' }, htmlLink: 'https://calendar.google.com/calendar/event?eid=safe' };
  const next = { ...recurring, id: 'moved', originalStartTime: { dateTime: '2026-11-27T09:00:00-05:00' } };
  const normalized = C.externalEvents([{ ...recurring, id: 'old' }, next, { ...recurring, id: 'canceled', status: 'cancelled' }]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].id, 'series:2026-11-27T09:00:00-05:00');
  assert.equal(normalized[0].startsAt, Date.parse('2026-11-21T14:00Z'));
  assert.match(normalized[0].link, /^https:\/\/calendar.google.com/);
});

test('native helper fixtures cover connection, staleness, account mismatch, limited and revoked access', () => {
  const events = [{ title: 'Science class', start: { date: '2026-11-20' }, end: { date: '2026-11-21' }, link: 'https://calendar.google.com/calendar/event?eid=sample' }];
  const ok = C.providerSnapshot(null, { status: 'connected', account: 'A', events, fetchedAt: now });
  assert.equal(ok.events[0].id, 'sample');
  assert.equal(C.providerSnapshot(ok, { status: 'stale', account: 'A' }).events.length, 1);
  assert.equal(C.providerSnapshot(ok, { status: 'stale', account: 'B' }).events.length, 0);
  assert.equal(C.providerSnapshot(ok, { status: 'limited', account: 'A', events }).status, 'limited');
  for (const status of ['revoked', 'disconnected', 'unavailable']) assert.equal(C.providerSnapshot(ok, { status }).events.length, 0);
  assert.equal(C.externalEvents([{ ...events[0], link: 'https://calendar.google.com.evil.invalid/calendar/' }])[0].link, '');
});
