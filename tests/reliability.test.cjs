/* Independent reliability scenarios: domain data, history and local privacy. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../extension/js/core.js');
const NOW=1794700800000;
const clone=x=>JSON.parse(JSON.stringify(x));
const add=(s,id='task-a',extra={})=>C.reduce(s,{type:'TASK_ADD',id,title:'A little task',effort:'small',...extra},NOW);

test('more than 5000 completed tasks and rewards survive a JSON backup roundtrip',()=>{
  const s=add(C.defaultState(NOW));
  const prototype=s.tasks[0];
  s.tasks=Array.from({length:6001},(_,i)=>({...clone(prototype),id:'history-'+i,title:'Archived task '+i,done:true,archived:true,completedAt:NOW}));
  s.ledger=s.tasks.map(t=>({id:'task:'+t.id,type:'task',amount:10,ref:t.id,at:NOW}));
  s.version=1;s.wallet={balance:60010,totalEarned:60010};s.stats.completedTasks=6001;
  const restored=C.validateBackup(JSON.stringify({state:s}),NOW);
  assert.equal(restored.tasks.length,6001);assert.equal(restored.ledger.length,6001);
  assert.deepEqual(restored.wallet,s.wallet);
  let next=C.reduce(restored,{type:'TASK_ARCHIVE',id:'history-6000',archived:false},NOW+1);
  next=C.reduce(next,{type:'TASK_TOGGLE',id:'history-6000'},NOW+2);
  next=C.reduce(next,{type:'TASK_TOGGLE',id:'history-6000'},NOW+3);
  assert.deepEqual(next.wallet,s.wallet);assert.equal(next.ledger.length,6001);
});

test('canonical task ID collisions in backups are rejected',()=>{
  const s=add(C.defaultState(NOW),'a');
  s.tasks.push({...clone(s.tasks[0]),id:' a '});
  assert.throws(()=>C.validateBackup(s,NOW),/duplicate|invalid/i);
});

test('canonical ledger ID collisions in backups are rejected',()=>{
  const s=add(C.defaultState(NOW),'a');
  s.ledger=[{id:'task:a',type:'task',amount:10,ref:'a',at:NOW},
    {id:' task:a ',type:'task',amount:10,ref:' a ',at:NOW}];
  s.wallet={balance:20,totalEarned:20};
  assert.throws(()=>C.validateBackup(s,NOW),/ledger|reward|identifier|invalid/i);
});

test('prototype-like shop IDs never mutate or corrupt a funded wallet',()=>{
  let s=add(C.defaultState(NOW),'rich',{effort:'large'});
  s=C.reduce(s,{type:'TASK_TOGGLE',id:'rich'},NOW+1);
  const before=JSON.stringify(s);
  for(const id of ['__proto__','constructor','toString','prototype']){
    assert.throws(()=>C.reduce(s,{type:'SHOP_BUY',id},NOW+2),/accessory|shop/i);
    assert.equal(JSON.stringify(s),before);
  }
});

test('changing effort then reopening a rewarded task cannot farm a larger reward',()=>{
  let s=add(C.defaultState(NOW),'a');
  s=C.reduce(s,{type:'TASK_TOGGLE',id:'a'},NOW+1);
  s=C.reduce(s,{type:'TASK_UPDATE',id:'a',patch:{effort:'large'}},NOW+2);
  s=C.reduce(s,{type:'TASK_TOGGLE',id:'a'},NOW+3);
  s=C.reduce(s,{type:'TASK_TOGGLE',id:'a'},NOW+4);
  assert.equal(s.wallet.balance,1);assert.equal(s.ledger.length,1);
  assert.equal(C.validateBackup(s,NOW+5).wallet.balance,1);
});

test('recurring occurrences earn separately while parent reopening cannot duplicate children',()=>{
  let s=add(C.defaultState(NOW),'daily',{recurrence:'daily',dueAt:NOW+3600000});
  s=C.reduce(s,{type:'TASK_TOGGLE',id:'daily'},NOW+1);
  const child=s.tasks.find(t=>t.parentId==='daily');
  assert.ok(child);assert.ok(child.dueAt>NOW);
  s=C.reduce(s,{type:'TASK_TOGGLE',id:'daily'},NOW+2);
  s=C.reduce(s,{type:'TASK_TOGGLE',id:'daily'},NOW+3);
  assert.equal(s.tasks.filter(t=>t.parentId==='daily').length,1);
  s=C.reduce(s,{type:'TASK_TOGGLE',id:child.id},child.dueAt);
  assert.equal(s.wallet.balance,2);assert.equal(s.ledger.length,2);
  assert.equal(s.tasks.filter(t=>t.parentId===child.id).length,1);
});

test('focus history retention does not drop lifetime bonuses or award twice on reload',()=>{
  let s=C.defaultState(NOW);
  for(let i=0;i<370;i++){
    const t=NOW+i*120000;
    s=C.reduce(s,{type:'FOCUS_START',minutes:1},t);
    s=C.reconcile(s,t+60001);
  }
  assert.equal(s.focusHistory.length,365);assert.equal(s.ledger.length,370);
  assert.equal(s.wallet.balance,0);assert.equal(s.stats.focusMinutes,370);
  s=C.validateBackup({state:s},NOW+370*120000);
  const next=C.reconcile(s,NOW+999*120000);
  assert.equal(next.wallet.balance,0);assert.equal(next.ledger.length,370);
});

test('backward local clocks produce restorable paused timers and only one eventual bonus',()=>{
  let s=C.reduce(C.defaultState(NOW),{type:'FOCUS_START',minutes:1},NOW);
  s=C.reduce(s,{type:'FOCUS_PAUSE'},NOW-3600000);
  assert.equal(s.focus.remainingMs,60000);assert.equal(s.wallet.balance,0);
  s=C.validateBackup(JSON.stringify(s),NOW-3600000);
  s=C.reduce(s,{type:'FOCUS_RESUME'},NOW);
  s=C.reconcile(s,NOW+60001);
  s=C.reconcile(s,NOW+120000);
  assert.equal(s.wallet.balance,0);assert.equal(s.ledger.length,1);
});

test('a failed import leaves the previously saved data and input object unchanged',()=>{
  const s=add(C.defaultState(NOW),'safe');
  const before=JSON.stringify(s),bad=clone(s);bad.wallet.balance=999;
  const badBefore=JSON.stringify(bad);
  assert.throws(()=>C.reduce(s,{type:'BACKUP_IMPORT',backup:bad},NOW+1));
  assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(bad),badBefore);
});

test('public content projection excludes task names, ledger references and private task lists',()=>{
  let s=add(C.defaultState(NOW),'secret-task',{title:'PRIVATE-TASK-TEXT-9472'});
  s=C.reduce(s,{type:'FOCUS_START',minutes:1,taskId:'secret-task'},NOW+1);
  const publicValue=C.publicState(s),serialized=JSON.stringify(publicValue);
  assert.ok(!serialized.includes('PRIVATE-TASK-TEXT-9472'));
  assert.ok(!serialized.includes('secret-task'));
  assert.ok(!Object.hasOwn(publicValue,'tasks'));
  assert.ok(!Object.hasOwn(publicValue,'ledger'));
});

test('runtime source has no remote network client or external inference dependency',()=>{
  const root=path.resolve(__dirname,'../extension');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
  assert.equal(manifest.content_security_policy.extension_pages.includes("connect-src 'self'"),true);
  assert.deepEqual(manifest.browser_specific_settings.gecko.data_collection_permissions.required,['none']);
  const scripts=fs.readdirSync(path.join(root,'js')).filter(n=>n.endsWith('.js'));
  for(const name of scripts){
    const source=fs.readFileSync(path.join(root,'js',name),'utf8');
    assert.ok(!/\b(?:fetch|WebSocket|XMLHttpRequest|EventSource)\s*\(/.test(source),name+' has a network client');
    assert.ok(!/openrouter|api\.openai\.com|huggingface|tensorflow|onnxruntime/i.test(source),name+' has an inference dependency');
  }
  const content=fs.readFileSync(path.join(root,'js/content.js'),'utf8');
  assert.ok(!/document\.body\.(?:innerText|textContent|innerHTML)/.test(content));
});
