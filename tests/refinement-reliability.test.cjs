/* Independent refinement checks. Mocked extension API, real shared storage
 * semantics across event-page reloads; no native-browser claim is made here. */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const C=require('../extension/js/core.js');
const T=require('../extension/js/talk.js');
const D=require('../extension/js/companion-domain.js');
const A=require('../extension/js/ambient.js');
const source=fs.readFileSync(path.join(__dirname,'../extension/js/background.js'),'utf8');
const NOW=Date.parse('2026-11-15T12:00:00Z');
const clone=x=>structuredClone(x);
function event(){const listeners=[];return{listeners,addListener:fn=>listeners.push(fn),fire:(...args)=>Promise.all(listeners.map(fn=>fn(...args)))};}
function storageArea(data,onWrite=()=>{}){return{
  get:async key=>({[key]:clone(data[key])}),
  set:async values=>{onWrite();for(const[k,v]of Object.entries(values))data[k]=clone(v);}
};}
function environment(state=C.defaultState(NOW)){
  return{local:{purrpleState:clone(state)},session:{},now:NOW,notices:[],runtimeMessages:[],notifications:[],alarms:new Map(),failNotification:false,
    removedTabs:[],tabs:[{id:1,active:true,windowId:1,url:'https://ordinary.test/'},{id:2,active:false,windowId:1,url:'https://other.test/'}]};
}
function background(env){
  const browser={storage:{local:storageArea(env.local),session:storageArea(env.session)},
    runtime:{getURL:p=>'moz-extension://purrple/'+p,onMessage:event(),onStartup:event(),onInstalled:event(),sendMessage:async m=>env.runtimeMessages.push(clone(m))},
    tabs:{query:async q=>q.active?env.tabs.filter(t=>t.active):env.tabs,get:async id=>env.tabs.find(t=>t.id===id),sendMessage:async(id,m)=>env.notices.push({id,message:clone(m)}),create:async()=>({id:3}),update:async()=>{},remove:async id=>env.removedTabs.push(id),onActivated:event(),onRemoved:event()},
    windows:{get:async()=>({focused:true}),update:async()=>{},onFocusChanged:event()},
    alarms:{create:async(n,a)=>env.alarms.set(n,clone(a)),clear:async n=>env.alarms.delete(n),onAlarm:event()},
    notifications:{create:async(id,m)=>{env.notifications.push({id,message:clone(m)});if(env.failNotification)throw Error('Notifications blocked');return id;},onClicked:event()}};
  class Clock extends Date{static now(){return env.now;}}
  const core={...C,defaultState:()=>C.defaultState(env.now),reconcile:(s,n=env.now)=>C.reconcile(s,n),reduce:(s,a,n=env.now)=>C.reduce(s,a,n)};
  vm.runInNewContext(source,{browser,PurrpleCore:core,PurrpleCompanionDomain:D,PurrpleAmbient:A,URL,Date:Clock,setTimeout,clearTimeout,crypto:require('node:crypto').webcrypto,console:{warn(){},error(){}}});
  const ui={url:'moz-extension://purrple/app.html',tab:{id:3},frameId:0};
  const content={url:'https://ordinary.test/',tab:{id:1},frameId:0};
  return{browser,ui,content,request:(m,s=ui)=>browser.runtime.onMessage.listeners[0](m,s)};
}

test('legacy v1 native save migrates talk and draft defaults without losing tasks or coins',async()=>{
  let legacy=C.reduce(C.defaultState(NOW),{type:'TASK_ADD',id:'legacy',title:'Existing task'},NOW);
  legacy=C.reduce(legacy,{type:'TASK_TOGGLE',id:'legacy'},NOW+1);
 legacy.version=1;legacy.ledger=[{id:'task:legacy',type:'task',ref:'legacy',amount:10,at:NOW+1}];
 legacy.wallet={balance:10,totalEarned:10};delete legacy.talk;delete legacy.drafts;
  const env=environment(legacy),h=background(env),r=await h.request({type:'GET_STATE'});
  assert.equal(r.ok,true);assert.equal(r.state.tasks[0].title,'Existing task');assert.equal(r.state.wallet.balance,10);
  assert.equal(r.state.talk.total,0);assert.equal(r.state.drafts.quickTask,'');
  assert.ok(env.local.purrpleState.talk);assert.ok(env.local.purrpleState.drafts);
  const restored=C.validateBackup({state:legacy},NOW+2);assert.equal(restored.wallet.balance,10);assert.equal(restored.talk.total,0);
});

test('1000 local conversations retain bounded history and counters through backup',()=>{
  let s=C.defaultState(NOW);
  for(let i=0;i<1000;i++)s=C.reduce(s,{type:'TALK_REPLY',promptId:T.CATALOG[i%90].id},NOW+i);
  const restored=C.validateBackup(JSON.stringify({state:s}),NOW+1001);
  assert.equal(restored.talk.total,1000);assert.equal(restored.talk.history.length,80);
  assert.equal(restored.talk.recent.length,12);assert.equal(Object.keys(restored.talk.counts).length,90);
  assert.equal(Object.values(restored.talk.counts).reduce((a,b)=>a+b,0),1000);
  assert.ok(JSON.stringify(restored.talk).length<100000);
  const visible=C.publicState(restored);assert.equal(visible.talk.history,undefined);assert.equal(visible.talk.last,null);
});

test('forged reply text, reaction and inherited prompt IDs are rejected without state mutation',()=>{
  const s=C.reduce(C.defaultState(NOW),{type:'TALK_REPLY',promptId:'hello'},NOW);
  const before=JSON.stringify(s);
  for(const promptId of ['__proto__','constructor','toString','not-a-prompt'])assert.throws(()=>C.reduce(s,{type:'TALK_REPLY',promptId},NOW+1));
  for(const field of ['text','reaction']){const forged=clone(s);forged.talk.last[field]='PRIVATE-TASK-FORGED-REPLY';assert.throws(()=>C.validateBackup(forged,NOW+1));}
  assert.equal(JSON.stringify(s),before);
});

test('same commit token does not duplicate a task before or after event-page reload',async()=>{
  const env=environment(),h=background(env);
  const message={type:'ACTION',requestId:'durable-commit-123',action:{type:'TASK_ADD',title:'One committed task',fromDraft:true}};
  assert.equal((await h.request(message)).ok,true);assert.equal((await h.request(message)).ok,true);
  assert.equal(env.local.purrpleState.tasks.length,1);
  const reloaded=background(env);assert.equal((await reloaded.request(message)).ok,true);
  assert.equal(env.local.purrpleState.tasks.length,1,'A replay after event-page reload must not create a second task.');
});

test('stale task commit preserves a newer shared draft from another surface',()=>{
  let s=C.reduce(C.defaultState(NOW),{type:'QUICK_TASK_DRAFT',text:'First task'},NOW);
  s=C.reduce(s,{type:'QUICK_TASK_DRAFT',text:'Newer task from another panel'},NOW+1);
  s=C.reduce(s,{type:'TASK_ADD',title:'First task',fromDraft:true},NOW+2);
  assert.equal(s.tasks.length,1);assert.equal(s.drafts.quickTask,'Newer task from another panel');
});

test('failed draft-backed commit and unrelated mutations preserve saved draft',async()=>{
  const env=environment(),h=background(env);
  await h.request({type:'ACTION',action:{type:'QUICK_TASK_DRAFT',text:'Keep this draft'}});
  const bad=await h.request({type:'ACTION',action:{type:'TASK_ADD',title:'',fromDraft:true}});
  assert.equal(bad.ok,false);assert.equal(env.local.purrpleState.drafts.quickTask,'Keep this draft');
  await h.request({type:'ACTION',action:{type:'TALK_REPLY',promptId:'hello'}});
  assert.equal(env.local.purrpleState.drafts.quickTask,'Keep this draft');
  const reload=background(env),r=await reload.request({type:'GET_STATE'});assert.equal(r.state.drafts.quickTask,'Keep this draft');
});

test('private iframe capabilities bind tab and first frame, survive event reload and revoke cleanly',async()=>{
  const s=C.reduce(C.defaultState(NOW),{type:'TASK_ADD',title:'Private popup task'},NOW),env=environment(s),h=background(env);
  const lease=await h.request({type:'PET_CLAIM'},h.content);
  assert.equal((await h.request({type:'PET_PANEL_OPEN',leaseId:lease.leaseId,view:'settings'},h.content)).ok,false);
  assert.equal((await h.request({type:'PET_PANEL_OPEN',leaseId:lease.leaseId,view:'calendar',game:'paw-pairs'},h.content)).ok,false);
  const panel=await h.request({type:'PET_PANEL_OPEN',leaseId:lease.leaseId,view:'calendar'},h.content);
  const url=new URL(panel.url);
  assert.equal(url.searchParams.get('view'),'calendar');
  const allowed={url:panel.url,tab:{id:1},frameId:5};
  assert.equal((await h.request({type:'GET_STATE'},allowed)).state.tasks[0].title,'Private popup task');
  assert.equal((await h.request({type:'GET_STATE'},{...allowed,frameId:6})).ok,false);
  assert.equal((await h.request({type:'GET_STATE'},{...allowed,tab:{id:2}})).ok,false);
  const reload=background(env);assert.equal((await reload.request({type:'GET_STATE'},allowed)).ok,true);
  await reload.request({type:'PET_PANEL_CLOSE',token:panel.token},h.content);
  assert.equal((await reload.request({type:'GET_STATE'},allowed)).ok,false);
});

test('unauthorized embedded app/popup cannot read, mutate, export or learn from broadcasts',async()=>{
  const s=C.reduce(C.defaultState(NOW),{type:'TASK_ADD',title:'PRIVATE-FRAME-TEXT'},NOW),env=environment(s),h=background(env);
  for(const pathname of ['app.html','popup.html','popup.html?panel=1','popup.html?panel=1&token=constructor']){
    const sender={url:'moz-extension://purrple/'+pathname,tab:{id:1},frameId:8};
    for(const request of [{type:'GET_STATE'},{type:'BACKUP_EXPORT'},{type:'ACTION',action:{type:'TASK_ADD',title:'forged'}}])assert.equal((await h.request(request,sender)).ok,false);
  }
  await h.request({type:'ACTION',action:{type:'TALK_REPLY',promptId:'hello'}});
  assert.ok(env.runtimeMessages.filter(m=>m.type==='STATE_CHANGED').every(m=>Object.keys(m).join()==='type'));
  assert.ok(!JSON.stringify(env.notices).includes('PRIVATE-FRAME-TEXT'));
});

test('expired capability cannot regain private access after event reload',async()=>{
  const env=environment(),h=background(env),lease=await h.request({type:'PET_CLAIM'},h.content);
  const panel=await h.request({type:'PET_PANEL_OPEN',leaseId:lease.leaseId},h.content);
  const allowed={url:panel.url,tab:{id:1},frameId:5};await h.request({type:'GET_STATE'},allowed);
  env.now+=13*3600000;const reload=background(env);
  assert.equal((await reload.request({type:'GET_STATE'},allowed)).ok,false);
});

test('all-day quiet mode suppresses overdue retries while retaining durable focus alarm',async()=>{
  let s=C.reduce(C.defaultState(NOW),{type:'TASK_ADD',title:'Due task',dueAt:NOW-1},NOW);
  s=C.reduce(s,{type:'SETTINGS',patch:{quietHours:{enabled:true,start:'00:00',end:'00:00'}}},NOW);
  s=C.reduce(s,{type:'FOCUS_START',minutes:5},NOW);
  const env=environment(s),h=background(env);
  for(let i=0;i<30;i++){env.now=NOW+i*1000;await h.request({type:'GET_STATE'});}
  assert.equal(env.notifications.length,0);assert.equal(env.alarms.get('purrple-next').when,NOW+300000);
});

test('familiar site remarks respect opt-in, suppress repeated contexts, and keep browsing labels out of saved state',async()=>{
  const env=environment(),h=background(env);
  const content={...h.content,url:'https://www.youtube.com/watch?v=private'};
  const lease=await h.request({type:'PET_CLAIM'},content);
  const ask=()=>h.request({type:'PET_AMBIENT',leaseId:lease.leaseId},content);
  const previous=await ask();
  assert.ok(previous.text);
  assert.equal(previous.context,undefined);
  await h.request({type:'ACTION',action:{type:'SETTINGS',patch:{siteRemarks:true}}});
  env.now+=121_000;
  assert.equal((await ask()).context,'video');
  env.now+=121_000;
  assert.equal((await ask()).text,undefined);
  const other={...content,url:'https://docs.google.com/document/d/private'};
  assert.equal((await h.request({type:'PET_AMBIENT',leaseId:lease.leaseId},other)).context,'writing');
  assert.equal(JSON.stringify(env.session).includes('youtube.com'),false);
  assert.equal(JSON.stringify(env.session).includes('private'),false);
  await h.request({type:'ACTION',action:{type:'FOCUS_START',minutes:25}});
  env.now+=121_000;
  assert.equal((await h.request({type:'PET_AMBIENT',leaseId:lease.leaseId},{...content,url:'https://github.com/'})).text,undefined);
});

test('game windows bind capabilities to their own path and cannot read or mutate the planner',async()=>{
  const initial=C.reduce(C.defaultState(NOW),{type:'TASK_ADD',title:'Private task'},NOW);
  const env=environment(initial),h=background(env),lease=await h.request({type:'PET_CLAIM'},h.content);
  const panel=await h.request({type:'PET_PANEL_OPEN',leaseId:lease.leaseId,view:'play',game:'paw-pairs'},h.content);
  assert.match(panel.url,/game\.html/);
  assert.equal(new URL(panel.url).searchParams.get('game'),'paw-pairs');
  const frame={url:panel.url,tab:{id:1},frameId:4};
  const wrongPath={...frame,url:frame.url.replace('game.html','popup.html')};
  assert.equal((await h.request({type:'GET_STATE'},wrongPath)).ok,false);
  const result=await h.request({type:'GET_STATE'},frame);
  assert.deepEqual(Object.keys(result.state).sort(),['companion','equipped','settings']);
  assert.equal((await h.request({type:'BACKUP_EXPORT'},frame)).ok,false);
  assert.equal((await h.request({type:'CLOSE_GAME'},frame)).ok,false);
  assert.equal((await h.request({type:'CLOSE_GAME'})).ok,false);
  const gameTab={url:'moz-extension://purrple/game.html',tab:{id:11},frameId:0};
  assert.equal((await h.request({type:'CLOSE_GAME'},gameTab)).ok,true);
  assert.deepEqual(env.removedTabs,[11]);
  assert.equal((await h.request({type:'ACTION',action:{type:'TASK_ADD',title:'Unauthorized task'}},frame)).ok,false);
  const played=await h.request({type:'ACTION',action:{type:'COMPANION_GAME_START',game:'paw-pairs',mode:'gentle'}},frame);
  assert.equal(played.ok,true);
  assert.ok(played.state.companion.rounds['paw-pairs']);
  assert.equal(env.local.purrpleState.tasks.length,1);
});

test('lighting preference roundtrips while older saves retain light defaults',()=>{
  const old=C.defaultState(NOW);
  delete old.settings.theme;
  assert.equal(C.validateBackup({state:old},NOW).settings.theme,'light');
  const changed=C.reduce(old,{type:'SETTINGS',patch:{theme:'night'}},NOW+1);
  assert.equal(C.validateBackup({state:changed},NOW+2).settings.theme,'night');
  assert.equal(C.publicState(changed).settings.theme,'night');
  assert.throws(()=>C.reduce(changed,{type:'SETTINGS',patch:{theme:'pink'}},NOW+3));
});
