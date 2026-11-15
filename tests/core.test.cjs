const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../extension/js/core.js');
const NOW=Date.parse('2026-11-15T09:00:00Z');
const fresh=()=>C.defaultState(NOW);
const add=(s,patch={})=>C.reduce(s,{type:'TASK_ADD',title:'Read one chapter',...patch},NOW);
test('catalog has fifteen distinct correctly slotted permanent items',()=>{
 assert.equal(C.CATALOG.length,15);assert.equal(new Set(C.CATALOG.map(i=>i.id)).size,15);
 assert.ok(C.CATALOG.every(i=>['head','neck'].includes(i.slot)&&i.price>=20&&i.price<=150));
});
test('task mutation is immutable and validated',()=>{
 const s=fresh(),t=add(s,{subtasks:['Open book','Read']});assert.equal(s.tasks.length,0);assert.equal(t.tasks.length,1);
 assert.equal(t.tasks[0].subtasks.length,2);assert.throws(()=>add(s,{title:' '}));assert.throws(()=>add(s,{effort:'huge'}));
 assert.throws(()=>C.reduce(t,{type:'TASK_ADD',id:t.tasks[0].id,title:'Duplicate'},NOW));
});
test('completion grants10/20/30 and reopening cannot farm coins',()=>{
 for(const effort of ['small','medium','large']){
  let s=add(fresh(),{effort}),id=s.tasks[0].id;
  for(let i=0;i<5;i++){s=C.reduce(s,{type:'TASK_TOGGLE',id},NOW+i*2);s=C.reduce(s,{type:'TASK_TOGGLE',id},NOW+i*2+1);}
  assert.equal(s.wallet.balance,C.EFFORT[effort]);assert.equal(s.stats.completedTasks,1);assert.equal(s.ledger.length,1);
 }
});
test('absolute completion from two stale surfaces remains completed and rewards once',()=>{
 let s=add(fresh()),id=s.tasks[0].id;
 s=C.reduce(s,{type:'TASK_SET_DONE',id,done:true},NOW);
 s=C.reduce(s,{type:'TASK_SET_DONE',id,done:true},NOW+1);
 assert.equal(s.tasks[0].done,true);assert.equal(s.wallet.balance,10);assert.equal(s.ledger.length,1);
 s=C.reduce(s,{type:'TASK_SET_DONE',id,done:false},NOW+2);s=C.reduce(s,{type:'TASK_SET_DONE',id,done:false},NOW+3);
 assert.equal(s.tasks[0].done,false);assert.equal(s.wallet.balance,10);
 assert.throws(()=>C.reduce(s,{type:'TASK_SET_DONE',id},NOW));
});
test('recurring occurrences get unique rewards, reset subtasks and skip stale backlog',()=>{
 let s=add(fresh(),{recurrence:'daily',dueAt:NOW-30*86400000,subtasks:[{title:'Prepare',done:true}]});
 const old=s.tasks[0].id;s=C.reduce(s,{type:'TASK_TOGGLE',id:old},NOW);
 assert.equal(s.tasks.length,2);assert.equal(s.tasks[1].parentId,old);assert.ok(s.tasks[1].dueAt>NOW);assert.equal(s.tasks[1].subtasks[0].done,false);
 s=C.reduce(s,{type:'TASK_TOGGLE',id:old},NOW);s=C.reduce(s,{type:'TASK_TOGGLE',id:old},NOW);assert.equal(s.tasks.length,2);
 s=C.reduce(s,{type:'TASK_TOGGLE',id:s.tasks[1].id},NOW);assert.equal(s.wallet.balance,20);assert.equal(s.tasks.length,3);
});
test('archive can be restored without data loss or an extra reward',()=>{
 let s=add(fresh()),id=s.tasks[0].id;s=C.reduce(s,{type:'TASK_ARCHIVE',id},NOW);
 assert.throws(()=>C.reduce(s,{type:'TASK_TOGGLE',id},NOW));
 s=C.reduce(s,{type:'TASK_ARCHIVE',id,archived:false},NOW);assert.equal(s.tasks[0].archived,false);
});
test('purchase is idempotent, debit is atomic and outfits require ownership',()=>{
 let s=add(fresh(),{effort:'large'});s=C.reduce(s,{type:'TASK_TOGGLE',id:s.tasks[0].id},NOW);
 s=C.reduce(s,{type:'SHOP_BUY',id:'moon-bow'},NOW);assert.equal(s.wallet.balance,10);
 s=C.reduce(s,{type:'SHOP_BUY',id:'moon-bow'},NOW);assert.equal(s.wallet.balance,10);
 s=C.reduce(s,{type:'EQUIP',slot:'head',id:'moon-bow'},NOW);assert.equal(s.equipped.head,'moon-bow');
 assert.throws(()=>C.reduce(s,{type:'SHOP_BUY',id:'cozy-beanie'},NOW));
 assert.throws(()=>C.reduce(s,{type:'EQUIP',slot:'neck',id:'moon-bow'},NOW));
 assert.throws(()=>C.reduce(s,{type:'EQUIP',slot:'head',id:'cozy-beanie'},NOW));
 s=C.reduce(s,{type:'EQUIP',slot:'head',id:null},NOW);assert.equal(s.equipped.head,null);
});
test('prototype property names cannot masquerade as catalog accessories',()=>{
 for(const id of ['__proto__','constructor','toString']){
  const s=fresh();assert.throws(()=>C.reduce(s,{type:'SHOP_BUY',id},NOW));assert.equal(s.wallet.balance,0);
  assert.throws(()=>C.reduce(s,{type:'EQUIP',slot:'head',id},NOW));
 }
});
test('focus completion is clock-based and grants once after restart catchup',()=>{
 let s=C.reduce(fresh(),{type:'FOCUS_START',minutes:1},NOW);
 assert.throws(()=>C.reduce(s,{type:'FOCUS_FINISH'},NOW+30000));
 s=C.reconcile(JSON.parse(JSON.stringify(s)),NOW+61000);
 assert.equal(s.focus,null);assert.equal(s.wallet.balance,5);assert.equal(s.stats.focusMinutes,1);
 s=C.reconcile(s,NOW+90000);s=C.reduce(s,{type:'FOCUS_FINISH'},NOW+90001);assert.equal(s.wallet.balance,5);
});
test('paused timers do not elapse and resume excludes paused time',()=>{
 let s=C.reduce(fresh(),{type:'FOCUS_START',minutes:1},NOW);
 s=C.reduce(s,{type:'FOCUS_PAUSE'},NOW+20000);assert.equal(s.focus.remainingMs,40000);
 s=C.reconcile(s,NOW+200000);assert.equal(s.focus.remainingMs,40000);assert.equal(s.wallet.balance,0);
 s=C.reduce(s,{type:'FOCUS_RESUME'},NOW+200000);assert.equal(s.focus.endsAt,NOW+240000);
 s=C.reconcile(s,NOW+240001);assert.equal(s.wallet.balance,5);
});
test('backward clock movement cannot extend a paused session beyond its configured duration',()=>{
 let s=C.reduce(fresh(),{type:'FOCUS_START',minutes:1},NOW);
 s=C.reduce(s,{type:'FOCUS_PAUSE'},NOW-60000);
 assert.equal(s.focus.remainingMs,60000);
 assert.doesNotThrow(()=>C.validateBackup(s,NOW-60000));
});
test('cancel and breaks do not grant focus rewards',()=>{
 let s=C.reduce(fresh(),{type:'FOCUS_START',minutes:1},NOW);s=C.reduce(s,{type:'FOCUS_CANCEL'},NOW+1000);
 s=C.reconcile(s,NOW+100000);assert.equal(s.wallet.balance,0);
 s=C.reduce(s,{type:'BREAK_START',minutes:1},NOW);s=C.reconcile(s,NOW+61000);assert.equal(s.wallet.balance,0);assert.equal(s.focusHistory[0].kind,'break');
});
test('due reminders respect snooze, acknowledgment, archive and quiet hours',()=>{
 let s=add(fresh(),{dueAt:NOW-1000}),id=s.tasks[0].id;assert.equal(C.reminders(s,NOW).length,1);
 s=C.reduce(s,{type:'REMINDER_SNOOZE',id,minutes:10},NOW);assert.equal(C.reminders(s,NOW+1000).length,0);
 assert.equal(C.reminders(s,NOW+600001).length,1);
 s=C.reduce(s,{type:'REMINDER_NOTIFIED',id},NOW+600002);assert.equal(C.reminders(s,NOW+700000).length,0);
});
test('quiet hours cross midnight correctly and support an all-day quiet setting',()=>{
 let settings=C.defaultState().settings;settings.quietHours={enabled:true,start:'22:00',end:'07:00'};
 const at=h=>{const d=new Date(NOW);d.setHours(h,0,0,0);return d.getTime();};
 assert.equal(C.quietNow(settings,at(23)),true);assert.equal(C.quietNow(settings,at(6)),true);assert.equal(C.quietNow(settings,at(12)),false);
 settings.quietHours.end='22:00';assert.equal(C.quietNow(settings,at(12)),true);
});
test('settings validation protects nested fields and normalizes hidden sites',()=>{
 let s=C.reduce(fresh(),{type:'SETTINGS',patch:{fps:24,hiddenHosts:['EXAMPLE.COM','example.com']}},NOW);
 assert.equal(s.settings.fps,24);assert.deepEqual(s.settings.hiddenHosts,['example.com']);
 assert.throws(()=>C.reduce(s,{type:'SETTINGS',patch:{quietHours:{enabled:true,start:'25:00',end:'07:00'}}},NOW));
 assert.throws(()=>C.reduce(s,{type:'SETTINGS',patch:{unknown:true}},NOW));
});
test('backup roundtrip preserves progress, ownership, subtasks and timer',()=>{
 let s=add(fresh(),{effort:'large',subtasks:['Read']});s=C.reduce(s,{type:'TASK_TOGGLE',id:s.tasks[0].id},NOW);
 s=C.reduce(s,{type:'SHOP_BUY',id:'moon-bow'},NOW);s=C.reduce(s,{type:'EQUIP',slot:'head',id:'moon-bow'},NOW);
 s=C.reduce(s,{type:'FOCUS_START',minutes:25},NOW);
 const restored=C.validateBackup(JSON.stringify({app:'Purrple',state:s}),NOW+1000);
 assert.equal(restored.wallet.balance,10);assert.deepEqual(restored.owned,['moon-bow']);assert.equal(restored.equipped.head,'moon-bow');assert.equal(restored.focus.remainingMs,1499000);
});
test('invalid and inconsistent backups fail without modifying existing data',()=>{
 const s=add(fresh());const bad=structuredClone(s);bad.wallet.balance=100;
 assert.throws(()=>C.validateBackup(bad,NOW));assert.equal(s.wallet.balance,0);
 assert.throws(()=>C.validateBackup('{broken',NOW));
 const newer=structuredClone(s);newer.version=2;assert.throws(()=>C.validateBackup(newer,NOW));
 const duplicates=structuredClone(s);duplicates.tasks.push({...duplicates.tasks[0]});assert.throws(()=>C.validateBackup(duplicates,NOW));
});
test('backup rejects canonical ID collisions after whitespace normalization',()=>{
 let s=add(fresh(),{id:'a'});
 const tasks=structuredClone(s);tasks.tasks.push({...tasks.tasks[0],id:' a '});assert.throws(()=>C.validateBackup(tasks,NOW));
 s=C.reduce(s,{type:'TASK_TOGGLE',id:'a'},NOW);
 const ledger=structuredClone(s);ledger.ledger.push({...ledger.ledger[0],id:' task:a ',ref:' a '});ledger.wallet.balance=20;ledger.wallet.totalEarned=20;
 assert.throws(()=>C.validateBackup(ledger,NOW));
});
test('public state does not expose tasks, ledger, history or full focus task references',()=>{
 let s=add(fresh());s=C.reduce(s,{type:'FOCUS_START',minutes:25,taskId:s.tasks[0].id},NOW);
 const p=C.publicState(s);assert.equal(p.tasks,undefined);assert.equal(p.ledger,undefined);assert.equal(p.focusHistory,undefined);assert.equal(p.focus.taskId,undefined);
});
