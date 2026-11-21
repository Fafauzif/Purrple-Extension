const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../extension/js/core.js');

const now = Date.parse('2026-11-15T09:00:00Z');
const run = (state, action, at = now) => Core.reduce(state, action, at);

test('exact focus boundaries and zero receipts remain idempotent after restarts', () => {
  for (const [seconds, coins] of [[899, 0], [900, 1], [1799, 1], [1800, 2], [14400, 2]]) {
    const state = run(Core.defaultState(now), {type:'FOCUS_START', minutes:seconds / 60});
    const id = state.focus.id;
    const finished = Core.reconcile(JSON.parse(JSON.stringify(state)), now + seconds * 1000);
    assert.equal(finished.wallet.balance, coins);
    assert.equal(finished.ledger.find(row => row.id === 'focus:' + id).amount, coins);
    assert.equal(finished.focusHistory[0].coins, coins);
    assert.equal(finished.stats.focusMinutes, seconds / 60);
    const replay = Core.reconcile(Core.validateBackup(finished, now + 20_000_000), now + 30_000_000);
    assert.equal(replay.ledger.length, 1);
  }
});

test('a version 1 running timer finishes under its original rule', () => {
  const legacy = run(Core.defaultState(now), {type:'FOCUS_START', minutes:15});
  legacy.version = 1;
  delete legacy.focus.rule;
  const imported = Core.validateBackup(legacy, now + 1000);
  assert.equal(imported.focus.rule, 1);
  const complete = Core.reconcile(imported, now + 900000);
  assert.equal(complete.wallet.balance, 5);
  assert.equal(complete.focusHistory[0].rule, 1);
  assert.equal(Core.validateBackup(complete, now + 900001).wallet.balance, 5);
});

test('parked notes and linked sessions stay private and capture at most one task', () => {
  let state = run(Core.defaultState(now), {type:'FOCUS_START',minutes:1,intention:'Complete private outline'});
  const id = state.focus.id;
  state = run(state,{type:'FOCUS_PAUSE',sessionId:id},now+30000);
  state = run(state,{type:'FOCUS_PARK',sessionId:id,text:'PRIVATE: update scope'},now+55000);
  assert.throws(() => run(state,{type:'FOCUS_CANCEL',sessionId:'different'}), /timer has changed/);
  assert.doesNotMatch(JSON.stringify(Core.publicState(state)), /private outline|PRIVATE:/i);
  state = run(state,{type:'FOCUS_RESUME',sessionId:id},now+90000);
  state = Core.reconcile(state,now+120000);
  const note = state.focusHistory[0].notes[0];
  for (let repeat=0;repeat<2;repeat++) state=run(state,{type:'FOCUS_NOTE_TASK',id,noteId:note.id},now+120000);
  assert.equal(state.tasks.length,1);
  assert.equal(state.wallet.balance,0);
  assert.equal(Core.validateBackup(state,now+120001).focusHistory[0].notes[0].captured,true);
});

test('limited priorities and date-only deadlines remain independent of scheduling', () => {
  let state=Core.defaultState(now);
  for(let index=0;index<4;index++)state=run(state,{type:'TASK_ADD',id:'task-'+index,title:'Task '+index,dueDate:'2026-11-16'});
  for(let index=0;index<3;index++)state=run(state,{type:'TASK_PLAN_PRIORITY',id:'task-'+index,enabled:true});
  assert.throws(()=>run(state,{type:'TASK_PLAN_PRIORITY',id:'task-3',enabled:true}),/three priorities/);
  const block={id:'block-one',title:'Work',taskId:'task-0',date:'2026-11-17',time:'09:00',duration:50,zone:'UTC',allDay:false};
  state=run(state,{type:'BLOCK_ADD',id:block.id,operationId:'new-one',block});
  state=run(state,{type:'BLOCK_UPDATE',id:block.id,operationId:'update-one',block:{...block,date:'2026-11-18'}});
  assert.equal(state.tasks[0].dueDate,'2026-11-16');
  assert.equal(state.calendar.blocks[0].date,'2026-11-18');
  assert.equal(Core.validateBackup(state,now+1).tasks[0].dueDate,'2026-11-16');
  assert.throws(()=>run(state,{type:'TASK_UPDATE',id:'task-0',patch:{dueDate:'2026-02-30'}}),/valid due date/);
});

test('a forged current receipt, balance or historical ownership is rejected atomically', () => {
  let state=run(Core.defaultState(now),{type:'TASK_ADD',id:'current',title:'Quick task'});
  state=run(state,{type:'TASK_SET_DONE',id:'current',done:true});
  const forged=structuredClone(state);
  forged.ledger[0].amount=3;forged.wallet={balance:3,totalEarned:3};
  assert.throws(()=>run(state,{type:'BACKUP_IMPORT',backup:forged}),/reward amount/);
  const missingTask=structuredClone(state);missingTask.tasks=[];
  assert.throws(()=>Core.validateBackup(missingTask,now+1),/matching task/);
  assert.equal(state.wallet.balance,1);
});
