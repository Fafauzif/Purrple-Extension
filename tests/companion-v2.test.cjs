'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Companion = require('../extension/js/companion-domain.js');
const Core = require('../extension/js/core.js');

const time = (year, month, day) => new Date(year, month - 1, day, 12).getTime();
const day = time(2026, 11, 20);
const fixture = (now=day) => ({createdAt:now, companion:Companion.empty(now)});
const action = (state,type,details={},at=day) => Companion.reduce(state,{type:'COMPANION_'+type,...details},at);
const log = (state,reason,count,at=day) => {
  for(let i=0;i<count;i++)Companion.award(state,reason,`${reason}-${at}-${i}`,at);
};
function open(state,id,at=day){return action(state,'SCENE_OPEN',{id},at);}
function unlockClues(state){
  log(state,'talk',2);
  open(state,'quiet-shelf');
  open(state,'clue-notebook');
}
function unlockPaths(state){
  unlockClues(state);
  open(state,'clue-notebook');
  log(state,'focus',2);
  open(state,'scrapbook-drawer');
  Companion.award(state,'focus','extra-focus',day);
  Companion.award(state,'focus','last-focus',day);
  assert.equal(Companion.level(state.companion),5);
  open(state,'lantern-window');
}
const authorRound = (game,mode,seed='fixture')=>({id:seed,game,mode,practice:false,startedAt:day,finishedAt:null,moves:[]});
function playRound(state, game, pick, at=day){
  const round=state.companion.rounds[game];
  for(let n=0;n<100;n++){
    const model=Companion.game(round);
    if(model.outcome)return model;
    action(state,'GAME_MOVE',{game,id:round.id,revision:round.moves.length,move:pick(model)},at);
  }
  assert.fail('The round did not finish.');
}
function choosePairs(model,match) {
  const first=model.deck.findIndex((_,index)=>!model.matched.includes(index));
  const second=model.deck.findIndex((picture,index)=>!model.matched.includes(index)&&index!==model.pending&&((picture===model.deck[model.pending])===match));
  return {cell:model.pending===null?first:second>=0?second:first===model.pending?first+1:first};
}

test('chat, play and focus pacing offer the first discoverable scene after two ordinary visits',()=>{
  for(const [reason,n] of [['talk',2],['game',2],['focus',2]]){
    const state=fixture();
    assert.deepEqual(Companion.unlockedGames(state.companion),['paw-pairs']);
    log(state,reason,1);
    log(state,reason,n-1,time(2026,11,21));
    assert.equal(Companion.level(state.companion),2);
    assert.ok(Companion.discoveriesAvailable(state.companion).some(item=>item.id==='quiet-shelf'));
    open(state,'quiet-shelf');
    assert.deepEqual(Companion.unlockedGames(state.companion),['paw-pairs','three-paws']);
    open(state,'clue-notebook');
    assert.ok(Companion.unlockedGames(state.companion).includes('cozy-clues'));
  }
});
test('repeatable bond receipts are capped, idempotent and protected from a backward local-date jump',()=>{
  const state=fixture();
  log(state,'focus',8);
  log(state,'focus',8);
  assert.equal(state.companion.xp,10);
  assert.equal(state.companion.xpReceipts.length,8);
  log(state,'focus',1,time(2026,11,21));
  log(state,'focus',1,time(2026,11,19));
  log(state,'talk',6);
  assert.equal(state.companion.xp,18);
  assert.deepEqual(Companion.validate(state.companion),state.companion);
  const tampered=structuredClone(state.companion);
  tampered.xpReceipts[0].amount++;
  tampered.xp++;
  assert.throws(()=>Companion.validate(tampered),/invalid companion data/);
});
test('Paw Pairs supports a durable loss, rematch win and repeatable outcome accounting',()=>{
  const state=fixture();
  state.companion.rounds['paw-pairs']=authorRound('paw-pairs','sharp','round_loss');
  action(state,'GAME_MOVE',{game:'paw-pairs',id:'round_loss',revision:0,move:{cell:0}});
  assert.equal(Companion.resumableGame(state.companion),'paw-pairs');
  state.companion=Companion.validate(JSON.parse(JSON.stringify(state.companion)));
  const loss=playRound(state,'paw-pairs',model=>choosePairs(model,false));
  assert.equal(loss.outcome,'loss');
  assert.equal(Companion.resumableGame(state.companion),null);
  assert.throws(()=>action(state,'GAME_MOVE',{game:'paw-pairs',id:'round_loss',revision:0,move:{cell:1}}),/already finished/);
  action(state,'GAME_START',{game:'paw-pairs',mode:'gentle'});
  state.companion.rounds['paw-pairs'].id='round_win';
  const win=playRound(state,'paw-pairs',model=>choosePairs(model,true));
  assert.equal(win.outcome,'win');
  assert.equal(state.companion.results.length,2);
  assert.equal(state.companion.xp,6);
  assert.equal(state.companion.discoveries.filter(item=>item.id==='first-pairs').length,1);
  assert.deepEqual(Companion.validate(state.companion),state.companion);
});
test('Cozy Clues accepts aliases, hints, skip, role-swap and explicit restart',()=>{
  const state=fixture();unlockClues(state);
  action(state,'GAME_START',{game:'cozy-clues',mode:'guess'});
  const round=state.companion.rounds['cozy-clues'];
  action(state,'GAME_MOVE',{game:round.game,id:round.id,revision:0,move:{type:'hint'}});
  assert.throws(()=>action(state,'GAME_MOVE',{game:round.game,id:round.id,revision:0,move:{type:'skip'}}),/already changed/);
  assert.throws(()=>action(state,'GAME_START',{game:round.game,mode:'give'}),/Resume/);
  const hints=['People use','near the mugs','carry the light','sit on','your neck','clear glass','sewing kit','seal me'];
  const alternate=[' book mark! ','Teakettle','Lamp','Pillow','Neck scarf','windowpane','thread spool','letter envelope'];
  const result=playRound(state,round.game,model=>({type:'answer',answer:alternate[hints.findIndex(hint=>model.clue.hint.includes(hint))]}));
  assert.equal(result.score,5);
  action(state,'GAME_START',{game:round.game,mode:'give',practice:true});
  const practice=playRound(state,round.game,()=>({type:'skip'}));
  assert.equal(practice.outcome,'loss');
  assert.equal(state.companion.results.length,1);
  assert.deepEqual(Companion.validate(state.companion),state.companion);
});
test('Lantern Paths alternates moves, rejects unlawful placement and grants one placeable first-light keepsake',()=>{
  const state=fixture();unlockPaths(state);
  assert.equal(Companion.level(state.companion),5);
  assert.throws(()=>action(state,'GAME_START',{game:'lantern-paths',mode:'woods'}),/level 7/);
  action(state,'GAME_START',{game:'lantern-paths',mode:'garden'});
  const round=state.companion.rounds['lantern-paths'];
  round.id='garden_test';
  assert.throws(()=>Companion.game({...round,moves:[{cell:24}]}),/highlighted/);
  const winning = [
    {cell:1},
    {cell:3},
    {cell:9},
    {cell:19}
  ];
  let step=0;
  const result=playRound(state,round.game,model=>{
    const direct=winning[step++];
    if(model.legal.includes(direct?.cell))return direct;
    return {cell:model.legal.at(-1)};
  });
  assert.ok(result.path.length>1);
  assert.equal(result.path[1].owner,'You');
  assert.equal(result.path[2].owner,'Purrple');
  assert.equal(result.outcome,'win');
  assert.ok(Companion.decorIds(state.companion).includes('lantern-keepsake'));
  action(state,'ROOM_MOVE',{id:'lantern-keepsake',position:{x:200,y:10}});
  assert.deepEqual(state.companion.room.placements['lantern-keepsake'],{x:85,y:56});
  action(state,'ROOM_UNDO');
  assert.equal(state.companion.room.placements['lantern-keepsake'],undefined);
  assert.deepEqual(Companion.validate(state.companion),state.companion);
});
test('The occasion queue orders priorities, remembers leap dates and prevents duplicate claims',()=>{
  const first=time(2024,11,20),state=fixture(first);
  const c=state.companion;
  action(state,'BIRTHDAY',{month:11,day:20});
  const available=Companion.discoveriesAvailable(c).map(item=>item.id);
  assert.deepEqual(available,['player-2026','anniversary-2026','purrple-2026']);
  open(state,'player-2026');open(state,'player-2026');
  assert.equal(c.discoveries.length,1);
  assert.ok(Companion.decorIds(c).includes('birthday-postcard'));
  action(state,'BIRTHDAY',{month:2,day:29});
  assert.equal(Companion.discoveriesAvailable(c,time(2027,3,3))[0].id,'player-2027');
  assert.equal(Companion.discoveriesAvailable(c,time(2027,3,7)).length,0);
  assert.throws(()=>action(state,'BIRTHDAY',{month:4,day:31}),/valid birthday/);
  assert.deepEqual(Companion.validate(c),c);
});
test('Returning after a gap produces an intentional scene and specific game memory without repeat rewards',()=>{
  const state=fixture();
  action(state,'VISIT');
  action(state,'GAME_START',{game:'paw-pairs',mode:'gentle'});
  playRound(state,'paw-pairs',model=>choosePairs(model,true));
  const later=time(2026,11,25);
  action(state,'VISIT',{},later);
  const scenes=Companion.discoveriesAvailable(state.companion,later);
  const callback=scenes.find(scene=>scene.kind==='callback');
  assert.match(callback.line,/Paw Pairs.*pairs for you and .* for me/);
  assert.ok(scenes.some(scene=>scene.kind==='return'));
  const xp=state.companion.xp;
  open(state,callback.id,later);
  action(state,'SCENE_FAVORITE',{id:callback.id,value:true},later);
  action(state,'SCENE_HIDE',{id:callback.id,value:true},later);
  assert.equal(state.companion.xp,xp);
  assert.deepEqual(Companion.validate(state.companion),state.companion);
});
test('Core preserves full companion progress but sends webpages only unlock capability',()=>{
  const core=Core.defaultState(day);
  const next=Core.reduce(core,{type:'COMPANION_BIRTHDAY',month:10,day:19},day);
  assert.deepEqual(next.companion.birthday,{month:10,day:19});
  assert.deepEqual(Core.validateBackup(next,day).companion,next.companion);
  assert.deepEqual(Core.publicState(next).companion,{unlockedGames:['paw-pairs'],resumableGame:null,hasTalk:false});
});


test('a room undo toast cannot roll back a later layout change',()=>{
  const original=Core.defaultState(day);
  const reset=Core.reduce(original,{type:'COMPANION_ROOM_RESET',confirm:true},day+1);
  const undo={type:'COMPANION_ROOM_UNDO',expectedRoom:reset.companion.room};
  assert.deepEqual(Core.reduce(reset,undo,day+2).companion.room,original.companion.room);
  const moved=Core.reduce(reset,{type:'COMPANION_ROOM_MOVE',id:'plum-cushion',position:{x:45,y:82}},day+3);
  assert.throws(()=>Core.reduce(moved,undo,day+4),/room changed/);
});
