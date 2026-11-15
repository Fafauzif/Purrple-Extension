const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../extension/js/core.js'),T=require('../extension/js/talk.js');
const NOW=Date.parse('2026-11-15T12:00:00Z');
test('conversation is a complete fixed local catalog of ninety prompts and 270 distinct variants',()=>{
 assert.equal(T.CATALOG.length,90);assert.equal(T.categories.length,9);assert.equal(new Set(T.CATALOG.map(p=>p.id)).size,90);
 for(const prompt of T.CATALOG){assert.equal(prompt.variants.length,3);assert.equal(new Set(prompt.variants.map(v=>v.text)).size,3);assert.ok(prompt.variants.every(v=>v.text.length>20&&v.text.length<500&&v.reaction));}
 assert.equal(T.CATALOG.find(p=>p.id==='love-you').label,'I love you!');assert.equal(T.CATALOG.find(p=>p.id==='sorry-throw').variants.length,3);
});
test('every prompt rotates through its replies without immediate repeats and does not mutate the input',()=>{
 for(const prompt of T.CATALOG){let s=T.empty(),previous=null;
  for(let i=0;i<8;i++){const old=structuredClone(s),next=T.reply(prompt.id,s,NOW+i);assert.deepEqual(s,old);assert.notEqual(next.last.text,previous);assert.ok(prompt.variants.some(v=>v.text===next.last.text));previous=next.last.text;s=next;}
  assert.equal(s.counts[prompt.id],8);
 }
});
test('serialized core conversation counters are shared and produce safe public reactions',()=>{
 let s=C.defaultState(NOW),balance=s.wallet.balance;
 s=C.reduce(s,{type:'TALK_REPLY',promptId:'love-you'},NOW);const first=s.talk.last;
 s=C.reduce(s,{type:'TALK_REPLY',promptId:'love-you'},NOW+1);assert.notEqual(s.talk.last.text,first.text);assert.equal(s.talk.total,2);assert.equal(s.wallet.balance,balance);
 const p=C.publicState(s);assert.ok(p.talk.last.text);assert.equal(p.talk.history,undefined);assert.equal(p.talk.favorites,undefined);assert.equal(p.talk.last.promptId,undefined);assert.equal(p.drafts,undefined);
});
test('favorites and talk history survive backup while legacy version-one backups remain valid',()=>{
 let s=C.defaultState(NOW);s=C.reduce(s,{type:'TALK_REPLY',promptId:'sorry-throw'},NOW);s=C.reduce(s,{type:'TALK_FAVORITE',promptId:'love-you',favorite:true},NOW);
 let restored=C.validateBackup(s,NOW);assert.deepEqual(restored.talk,s.talk);
 const legacy=C.defaultState(NOW);delete legacy.talk;delete legacy.drafts;restored=C.validateBackup(legacy,NOW);assert.equal(restored.talk.total,0);assert.equal(restored.drafts.quickTask,'');
});
test('quick-task drafts recover and clear only on a successful draft-backed commit',()=>{
 let s=C.reduce(C.defaultState(NOW),{type:'QUICK_TASK_DRAFT',text:'Remember this task'},NOW);
 s=C.validateBackup(s,NOW);assert.equal(s.drafts.quickTask,'Remember this task');
 assert.throws(()=>C.reduce(s,{type:'TASK_ADD',title:'',fromDraft:true},NOW));assert.equal(s.drafts.quickTask,'Remember this task');
 s=C.reduce(s,{type:'TASK_ADD',title:'Remember this task',fromDraft:true},NOW);assert.equal(s.drafts.quickTask,'');assert.equal(s.tasks.length,1);
});
test('quick effort survives reload and backup and is honored when the recovered task is added',()=>{
 let s=C.reduce(C.defaultState(NOW),{type:'QUICK_TASK_DRAFT',text:'A large task',effort:'large'},NOW);
 s=C.reconcile(JSON.parse(JSON.stringify(s)),NOW+1);assert.equal(s.drafts.quickEffort,'large');
 s=C.validateBackup(s,NOW+2);assert.equal(s.drafts.quickEffort,'large');
 s=C.reduce(s,{type:'QUICK_TASK_DRAFT',text:'A large task updated'},NOW+3);assert.equal(s.drafts.quickEffort,'large');
 s=C.reduce(s,{type:'TASK_ADD',title:'A large task updated',fromDraft:true},NOW+4);assert.equal(s.tasks[0].effort,'large');assert.equal(s.drafts.quickTask,'');assert.equal(s.drafts.quickEffort,'large');
 s=C.reduce(s,{type:'TASK_SET_DONE',id:s.tasks[0].id,done:true},NOW+5);assert.equal(s.wallet.balance,30);
});
test('legacy quick drafts default to medium and invalid effort cannot overwrite progress',()=>{
 const old=C.defaultState(NOW);delete old.drafts.quickEffort;old.drafts.quickTask='An old saved draft';
 const restored=C.validateBackup(old,NOW);assert.equal(restored.drafts.quickTask,'An old saved draft');assert.equal(restored.drafts.quickEffort,'medium');
 assert.throws(()=>C.reduce(restored,{type:'QUICK_TASK_DRAFT',text:'Broken',effort:'huge'},NOW));assert.equal(restored.drafts.quickTask,'An old saved draft');
 const invalid=structuredClone(restored);invalid.drafts.quickEffort='huge';assert.throws(()=>C.validateBackup(invalid,NOW));
});
test('a stale same-title commit cannot consume a newer shared effort selection',()=>{
 let s=C.reduce(C.defaultState(NOW),{type:'QUICK_TASK_DRAFT',text:'Same title',effort:'large'},NOW);
 s=C.reduce(s,{type:'TASK_ADD',title:'Same title',effort:'medium',fromDraft:true},NOW+1);
 assert.equal(s.tasks[0].effort,'medium');assert.equal(s.drafts.quickTask,'Same title');assert.equal(s.drafts.quickEffort,'large');
});
test('unknown prompt and forged backup text cannot become a public conversation bubble',()=>{
 assert.throws(()=>T.reply('__proto__',T.empty(),NOW));assert.throws(()=>T.favorite('constructor',T.empty(),true));
 let s=C.reduce(C.defaultState(NOW),{type:'TALK_REPLY',promptId:'hello'},NOW);s.talk.last.text='A private task injected into a reply';
 assert.throws(()=>C.validateBackup(s,NOW));
});
test('malformed favorite IDs and reply-record IDs cannot poison the next state read',()=>{
 const s=C.defaultState(NOW);
 for(const promptId of [['love-you'],{},null,42]){
  assert.throws(()=>C.reduce(s,{type:'TALK_FAVORITE',promptId},NOW));assert.doesNotThrow(()=>C.reconcile(s,NOW));
 }
 const saved=C.reduce(s,{type:'TALK_REPLY',promptId:'love-you'},NOW);saved.talk.last.promptId=['love-you'];assert.throws(()=>C.validateBackup(saved,NOW));
});
test('conversation logs stay bounded over long offline use',()=>{
 let s=T.empty();for(let i=0;i<1000;i++)s=T.reply(T.CATALOG[i%90].id,s,NOW+i);
 assert.equal(s.total,1000);assert.equal(s.history.length,80);assert.equal(s.recent.length,12);assert.ok(Object.keys(s.counts).length<=90);
});
