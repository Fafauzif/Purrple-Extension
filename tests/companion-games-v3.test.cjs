'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Domain = require('../extension/js/companion-domain.js');
const Core = require('../extension/js/core.js');

const now = Date.parse('2026-11-21T08:00:00Z');
const starter = () => Core.defaultState(now);
const apply = (state, type, fields = {}) => Core.reduce(state, {type:'COMPANION_' + type, ...fields}, now);
const start = (state, game, mode, details = {}) => apply(state, 'GAME_START', {game, mode, ...details});
const round = (state, game) => state.companion.rounds[game];
const view = (state, game) => Domain.game(round(state, game));
const restore = state => Core.validateBackup(JSON.parse(JSON.stringify(state)), now);

function move(state, game, action, revision = round(state, game).moves.length) {
  return apply(state, 'GAME_MOVE', {game, id:round(state, game).id, revision, move:action});
}
function finish(state, game, choose) {
  for (let steps = 0; steps < 80; steps++) {
    const model = view(state, game);
    if (model.outcome) return state;
    state = move(state, game, choose(model));
  }
  assert.fail('Expected a finite game');
}
function choosePair(model) {
  const cell = model.deck.findIndex((value, index) =>
    !model.matched.includes(index) && model.pending !== index &&
    (model.pending === null || model.deck[model.pending] === value));
  return {cell};
}
function unlockRoom(state) {
  for (const id of ['hello','joke']) Domain.award(state, 'talk', id, now);
  return apply(state, 'SCENE_OPEN', {id:'quiet-shelf'});
}

test('Paw Pairs preserves old deck identities and saves sized rounds through a full backup', () => {
  const legacy = start(starter(), 'paw-pairs', 'gentle');
  const legacyRestored = restore(legacy);
  assert.equal(round(legacyRestored, 'paw-pairs').variant, undefined);
  assert.equal(view(legacyRestored, 'paw-pairs').deck.length, 12);
  assert.deepEqual(view(legacy, 'paw-pairs'), view(legacyRestored, 'paw-pairs'));
  for (const [layout, size] of [['3x4',12], ['4x4',16], ['4x6',24]]) {
    let state = start(starter(), 'paw-pairs', 'sharp', {variant:layout});
    state = move(state, 'paw-pairs', {cell:size - 1});
    state = restore(state);
    assert.equal(view(state, 'paw-pairs').pending, size - 1);
    assert.equal(view(state, 'paw-pairs').deck.length, size);
    assert.equal(round(state, 'paw-pairs').variant, layout);
    state = finish(state, 'paw-pairs', choosePair);
    assert.equal(view(state, 'paw-pairs').score.reduce((a,b)=>a+b), size / 2);
    assert.equal(restore(state).companion.results.length, 1);
    assert.equal(state.companion.xp, 3);
  }
  assert.throws(() => start(starter(), 'paw-pairs', 'sharp', {variant:'__proto__'}),/board size/);
});

test('categorized Cozy Clues retains progress between hints and accepts a saved answer', () => {
  let state = apply(unlockRoom(starter()), 'SCENE_OPEN', {id:'clue-notebook'});
  state = start(state, 'cozy-clues', 'guess', {variant:'kitchen'});
  assert.deepEqual(view(state, 'cozy-clues').clue.choices, []);
  state = move(state, 'cozy-clues', {type:'hint'});
  assert.equal(view(state, 'cozy-clues').clue.hints.length, 1);
  state = move(restore(state), 'cozy-clues', {type:'hint'});
  const clue = view(state, 'cozy-clues').clue;
  assert.equal(clue.hints.length, 2);
  assert.equal(clue.choices.length, 3);
  assert.throws(() => move(state, 'cozy-clues', {type:'hint'}),/All hints/);
  const words = ['Kettle','Colander','Apron','Whisk','Rolling pin','Oven mitt'];
  const chosen = words.find(word => clue.hints[1].includes('“'+word[0]+'”'));
  state = move(state, 'cozy-clues', {type:'answer', answer:chosen});
  assert.equal(view(state, 'cozy-clues').score, 1);
  assert.equal(view(state, 'cozy-clues').hintStage, 0);
  state = finish(state, 'cozy-clues', () => ({type:'skip'}));
  assert.equal(restore(state).companion.results.at(-1).detail[0], 1);
});

test('Pocket Pong persists rallies, rejects stale moves and pays one Bond receipt', () => {
  let state = start(starter(), 'paw-pairs', 'gentle');
  state = finish(state, 'paw-pairs', choosePair);
  assert.ok(Domain.unlockedGames(state.companion).includes('pocket-pong'));
  state = start(state, 'pocket-pong', 'soft');
  const first = view(state, 'pocket-pong');
  const allowed = first.legal.find(lane => !first.guarding.includes(lane));
  const invalid = [0,1,2,3,4].find(lane => !first.legal.includes(lane));
  const before = structuredClone(state);
  assert.throws(() => move(state, 'pocket-pong', {cell:invalid}),/return lane/);
  assert.deepEqual(state, before);
  state = move(state, 'pocket-pong', {cell:allowed});
  assert.throws(() => move(state, 'pocket-pong', {cell:allowed}, 0),/already changed/);
  state = finish(restore(state), 'pocket-pong', model => ({cell:model.legal.find(lane=>!model.guarding.includes(lane))}));
  assert.equal(view(state, 'pocket-pong').outcome,'win');
  assert.deepEqual(restore(state).companion.results.at(-1).detail,[3,0]);
  assert.equal(state.companion.xpReceipts.filter(item=>item.id===round(state, 'pocket-pong').id).length,1);
});

test('Three Paws advances alternating marks, protects active rematches and preserves practice', () => {
  let state = start(unlockRoom(starter()), 'three-paws', 'sharp');
  const initial = round(state, 'three-paws').id;
  state = move(state, 'three-paws', {cell:4});
  const first = view(state, 'three-paws');
  assert.equal(first.board[4],'you');
  assert.equal(first.board[first.last],'purrple');
  assert.throws(() => move(state, 'three-paws', {cell:first.last}), /empty square/);
  assert.throws(() => start(state, 'three-paws', 'gentle', {restart:true,previousId:'older'}), /round changed/);
  state = finish(restore(state), 'three-paws', model => ({cell:model.legal[0]}));
  assert.notEqual(view(state, 'three-paws').outcome, 'win');
  assert.equal(restore(state).companion.results.at(-1).game, 'three-paws');
  state = start(state, 'three-paws', 'gentle', {previousId:initial,practice:true});
  state = finish(state, 'three-paws', model => ({cell:model.legal.at(-1)}));
  assert.equal(restore(state).companion.results.length,1);
});
