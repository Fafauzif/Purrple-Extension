const test = require('node:test');
const assert = require('node:assert/strict');
const ambient = require('../extension/js/ambient.js');

test('ambient clock pauses during interactions and sends one remark at the new cadence', () => {
  const clock = ambient.createClock();
  let at = 0;
  const tick = (seconds, eligible, resting = true, mode = 'chatty') => {
    let count = 0;
    for (let n = 0; n < seconds; n++) if (clock.update(mode, at += 1000, eligible, resting)) count++;
    return count;
  };
  clock.update('chatty', at, true, true);
  assert.equal(tick(22, true), 0);
  assert.equal(tick(82, false), 0);
  assert.equal(tick(7, true), 0);
  assert.equal(tick(1, true, false), 0);
  assert.equal(tick(1, true), 1);
  assert.equal(tick(59, true), 0);
  assert.equal(tick(1, true), 1);
  assert.equal(tick(200, true, true, 'quiet'), 0);
  assert.equal(tick(60, true, true, 'balanced'), 0);
  assert.equal(tick(1, true, true, 'balanced'), 1);
});

test('a suspended tab cannot cause an ambient catch-up remark', () => {
  const clock = ambient.createClock();
  assert.equal(clock.update('balanced', 0, true, true), false);
  assert.equal(clock.update('balanced', 5 * 60_000, true, true), false);
  clock.pause();
  assert.equal(clock.update('balanced', 8 * 60_000, true, true), false);
  assert.equal(new Set(ambient.lines).size, ambient.lines.length);
});

test('site greetings use bounded hostname categories and wait before repeating', () => {
  assert.equal(ambient.siteContext('WWW.YOUTUBE.COM.'), 'video');
  assert.equal(ambient.siteContext('music.youtube.com'), 'audio');
  assert.equal(ambient.siteContext('en.wikipedia.org'), 'reading');
  assert.equal(ambient.siteContext('youtube.com.evil.test'), null);
  assert.equal(ambient.siteContext('dyoutube.com'), null);
  assert.equal(ambient.siteContext('https://www.youtube.com/'), null);
  const first = ambient.contextRemark('vimeo.com', null, 100);
  assert.match(first.text, /watching/);
  assert.equal(ambient.contextRemark('youtube.com', first, 100 + 60_000), null);
  assert.notEqual(ambient.contextRemark('youtube.com', first, 100 + 75 * 60_000).text, first.text);
});
