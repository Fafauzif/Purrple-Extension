const assert = require('node:assert/strict');
const test = require('node:test');
const { choices } = require('../extension/js/pet-menu.js');

test('first click has a direct Tasks action and stable category order on each surface', () => {
  for (const webpage of [true, false]) {
    assert.deepEqual(choices('home', {}, {webpage}).map(item => item.id), ['today', 'focus', 'play', 'talk', 'care', 'more']);
  }
});

test('authoritative active timer replaces preset start actions', () => {
  const start = choices('focus').filter(item => item.kind === 'focus');
  assert.deepEqual(start.map(item => item.minutes), [25, 50]);
  assert.deepEqual(choices('focus', {focus: {status: 'paused'}}).map(item => item.mode), ['resume']);
  assert.deepEqual(choices('focus', {focus: {status: 'running'}}).map(item => item.kind), ['route']);
});

test('only unlocked game links are exposed and resuming does not duplicate a game', () => {
  const options = {companion: {resumableGame: 'cozy-clues', unlockedGames: ['paw-pairs', 'cozy-clues']}};
  assert.deepEqual(choices('play', {}, options).map(item => item.label), ['Resume Cozy Clues', 'Paw Pairs']);
  assert.deepEqual(choices('play').map(item => item.id), ['companion-play-paw-pairs']);
});

test('private journal remains discoverable independently of the three authored entry points', () => {
  assert.deepEqual(choices('talk').map(item => item.id), ['hello', 'how-are-you', 'joke', 'talk']);
  assert.deepEqual(choices('talk', {talk: {last: {}}}).map(item => item.id), ['hello', 'how-are-you', 'joke', 'little-chat', 'talk']);
  assert.equal(choices('more', {}, {webpage: true})[1].id, 'hide');
  assert.equal(choices('more')[1].id, 'reshow');
});
