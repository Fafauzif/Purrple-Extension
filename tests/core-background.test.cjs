const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../extension/js/core.js');
const script=fs.readFileSync(require('node:path').join(__dirname,'../extension/js/background.js'),'utf8');
const NOW=Date.parse('2026-11-15T09:00:00Z');
const clone=o=>structuredClone(o);
function event(){const listeners=[];return{addListener:fn=>listeners.push(fn),fire:(...args)=>Promise.all(listeners.map(fn=>fn(...args))),listeners};}
function setup(initial){
 let clock=NOW,failSave=false,failNotification=false,saveCount=0,alarmWrites=0;
 const storage={purrpleState:clone(initial||C.defaultState(NOW))},alarms=new Map(),notices=[],notifications=[],runtimeMessages=[],tabOperations=[];
 const tabs=[{id:1,active:true,windowId:1,url:'https://example.com/'},{id:2,active:false,windowId:1,url:'https://other.test/'}];
 const browser={
  storage:{local:{get:async key=>({[key]:clone(storage[key])}),set:async value=>{if(failSave){failSave=false;throw Error('Storage unavailable');}saveCount++;for(const[k,v]of Object.entries(value))storage[k]=clone(v);}}},
  runtime:{getURL:p=>'moz-extension://purrple/'+p,onMessage:event(),onStartup:event(),onInstalled:event(),sendMessage:async message=>{runtimeMessages.push(clone(message));}},
  tabs:{query:async query=>query.active?tabs.filter(t=>t.active):tabs,get:async id=>tabs.find(t=>t.id===id),sendMessage:async(id,msg)=>{notices.push({id,msg:clone(msg)});},create:async options=>{tabOperations.push({kind:'create',options});return{id:3};},update:async(id,options)=>{tabOperations.push({kind:'update',id,options});},onActivated:event(),onRemoved:event()},
  windows:{get:async()=>({focused:true}),update:async()=>{},onFocusChanged:event()},
  alarms:{create:(name,config)=>{alarmWrites++;alarms.set(name,clone(config));},clear:async name=>alarms.delete(name),onAlarm:event()},
  notifications:{create:async(id,config)=>{notifications.push({id,config});if(failNotification)throw Error('OS notifications denied');return id;},onClicked:event()}
 };
 const injected={...C,defaultState:()=>C.defaultState(clock),reduce:(s,a,n=clock)=>C.reduce(s,a,n),reconcile:(s,n=clock)=>C.reconcile(s,n)};
 class MockDate extends Date{static now(){return clock;}}
 const context={browser,PurrpleCore:injected,Date:MockDate,URL,crypto:require('node:crypto').webcrypto,console:{warn:()=>{},error:()=>{}}};
 vm.runInNewContext(script,context);
 const ui={url:'moz-extension://purrple/app.html',tab:{id:3},frameId:0};
 const content={url:'https://example.com/',tab:{id:1},frameId:0};
 const request=(message,sender=ui)=>browser.runtime.onMessage.listeners[0](message,sender);
 return{browser,storage,alarms,notices,notifications,runtimeMessages,tabOperations,tabs,request,ui,content,counts:()=>({saveCount,alarmWrites}),setClock:n=>clock=n,failNextSave:()=>failSave=true,failNotifications:()=>failNotification=true};
}
test('disabled notifications never schedule an overdue task alarm',async()=>{
 let s=C.reduce(C.defaultState(NOW),{type:'TASK_ADD',title:'Overdue',dueAt:NOW-1000},NOW);
 s=C.reduce(s,{type:'SETTINGS',patch:{notifications:false}},NOW);
 const h=setup(s);const result=await h.request({type:'GET_STATE'});
 assert.equal(result.ok,true);assert.equal(h.alarms.has('purrple-next'),false);assert.equal(h.notifications.length,0);
});
test('quiet hours do not spin task alarms but retain focus completion scheduling',async()=>{
 let s=C.reduce(C.defaultState(NOW),{type:'TASK_ADD',title:'Overdue',dueAt:NOW-1000},NOW);
 s=C.reduce(s,{type:'SETTINGS',patch:{quietHours:{enabled:true,start:'00:00',end:'00:00'}}},NOW);
 s=C.reduce(s,{type:'FOCUS_START',minutes:25},NOW);
 const h=setup(s);await h.request({type:'GET_STATE'});
 assert.equal(h.alarms.get('purrple-next').when,NOW+25*60000);assert.equal(h.notifications.length,0);
});
test('failed OS delivery backs off for at least one minute despite repeated state reads',async()=>{
 const s=C.reduce(C.defaultState(NOW),{type:'TASK_ADD',title:'Overdue',dueAt:NOW-1000},NOW),h=setup(s);
 h.failNotifications();
 for(let i=0;i<8;i++)await h.request({type:'GET_STATE'});
 assert.equal(h.notifications.length,1);assert.equal(h.notices.filter(n=>n.msg.type==='REMINDER_NOTICE').length,1);
 assert.ok(h.alarms.get('purrple-next').when>=NOW+60000);
 h.setClock(NOW+61000);await h.request({type:'GET_STATE'});assert.equal(h.notifications.length,2);
});
test('concurrent actions are serialized and one purchase debits once',async()=>{
 const h=setup();let r=await h.request({type:'ACTION',action:{type:'TASK_ADD',title:'Large task',effort:'large'}}),id=r.state.tasks[0].id;
 await h.request({type:'ACTION',action:{type:'TASK_TOGGLE',id}});
 const responses=await Promise.all(Array.from({length:8},()=>h.request({type:'ACTION',action:{type:'SHOP_BUY',id:'moon-bow'}})));
 assert.ok(responses.every(r=>r.ok));assert.equal(h.storage.purrpleState.wallet.balance,10);assert.deepEqual(h.storage.purrpleState.owned,['moon-bow']);
});
test('different clients completing one stale open task cannot undo each other',async()=>{
 const h=setup();const r=await h.request({type:'ACTION',action:{type:'TASK_ADD',title:'Shared completion'}}),id=r.state.tasks[0].id;
 await Promise.all(['surface-a','surface-b'].map(requestId=>h.request({type:'ACTION',requestId,action:{type:'TASK_SET_DONE',id,done:true}})));
 assert.equal(h.storage.purrpleState.tasks[0].done,true);assert.equal(h.storage.purrpleState.wallet.balance,10);
});
test('a repeated request token cannot repeat a task toggle',async()=>{
 const h=setup();let r=await h.request({type:'ACTION',action:{type:'TASK_ADD',title:'Small task'}}),id=r.state.tasks[0].id;
 await Promise.all(Array.from({length:5},()=>h.request({type:'ACTION',requestId:'same-toggle',action:{type:'TASK_TOGGLE',id}})));
 assert.equal(h.storage.purrpleState.tasks[0].done,true);assert.equal(h.storage.purrpleState.wallet.balance,10);
});
test('content surfaces receive public state and cannot mutate tasks or export backups',async()=>{
 let s=C.reduce(C.defaultState(NOW),{type:'TASK_ADD',title:'Private title'},NOW),h=setup(s);
 const p=await h.request({type:'GET_STATE'},h.content);assert.equal(p.state.tasks,undefined);assert.equal(p.state.ledger,undefined);
 const action=await h.request({type:'ACTION',action:{type:'TASK_ADD',title:'Injected'}},h.content);assert.equal(action.ok,false);
 const backup=await h.request({type:'BACKUP_EXPORT'},h.content);assert.equal(backup.ok,false);assert.equal(h.storage.purrpleState.tasks.length,1);
 const messages=h.notices.filter(n=>n.msg.type==='STATE_CHANGED');assert.ok(messages.every(n=>!n.msg.state.tasks));
});
test('lease ownership rejects stale saves and normalizes active-tab positions',async()=>{
 const h=setup();await h.request({type:'GET_STATE'});
 let lease=await h.request({type:'PET_CLAIM'},h.content);assert.equal(lease.active,true);
 await h.request({type:'PET_SAVE',leaseId:lease.leaseId,position:{x:2,y:-1}},h.content);
 assert.deepEqual(h.storage.purrplePosition,{x:1,y:0});
 h.tabs[0].active=false;h.tabs[1].active=true;
 const second={url:'https://other.test/',tab:{id:2},frameId:0};const next=await h.request({type:'PET_CLAIM'},second);assert.equal(next.active,true);
 const stale=await h.request({type:'PET_SAVE',leaseId:lease.leaseId,position:{x:.2,y:.2}},h.content);assert.equal(stale.saved,false);
 assert.deepEqual(h.storage.purrplePosition,{x:1,y:0});assert.ok(h.notices.some(n=>n.id===1&&n.msg.type==='PET_REVOKED'));
});
test('a storage failure cannot claim a committed task or corrupt progress',async()=>{
 const h=setup();await h.request({type:'GET_STATE'});h.failNextSave();
 const r=await h.request({type:'ACTION',action:{type:'TASK_ADD',title:'Unsaved'}});
 assert.equal(r.ok,false);assert.equal(h.storage.purrpleState.tasks.length,0);assert.match(r.error,/Storage/);
});
test('countdown polling returns current time without rewriting history or recreating an unchanged alarm',async()=>{
 const s=C.reduce(C.defaultState(NOW),{type:'FOCUS_START',minutes:25},NOW),h=setup(s);
 await h.request({type:'GET_STATE'});const initial=h.counts();
 for(let i=1;i<=10;i++){
  h.setClock(NOW+i*1000);const r=await h.request({type:'GET_STATE'});assert.equal(r.state.focus.remainingMs,1500000-i*1000);
 }
 assert.deepEqual(h.counts(),initial);
 h.setClock(NOW+1500001);const result=await h.request({type:'GET_STATE'});assert.equal(result.state.wallet.balance,5);assert.ok(h.counts().saveCount>initial.saveCount);
});
test('floating private panel needs a tab-bound token and pins its first authenticated frame',async()=>{
 const s=C.reduce(C.defaultState(NOW),{type:'TASK_ADD',title:'Private task'},NOW),h=setup(s);
 await h.request({type:'GET_STATE'});
 const lease=await h.request({type:'PET_CLAIM'},h.content),panel=await h.request({type:'PET_PANEL_OPEN',leaseId:lease.leaseId},h.content);
 assert.equal(panel.ok,true);assert.match(panel.url,/popup.html\?panel=1&token=/);
 const noToken={url:'moz-extension://purrple/popup.html?panel=1',tab:{id:1},frameId:5};
 assert.equal((await h.request({type:'GET_STATE'},noToken)).ok,false);
 const allowed={...noToken,url:panel.url};let response=await h.request({type:'GET_STATE'},allowed);assert.equal(response.ok,true);assert.equal(response.state.tasks[0].title,'Private task');
 assert.equal((await h.request({type:'GET_STATE'},{...allowed,frameId:6})).ok,false);
 assert.equal((await h.request({type:'GET_STATE'},{...allowed,tab:{id:2}})).ok,false);
 await h.request({type:'PET_PANEL_CLOSE',token:panel.token},h.content);assert.equal((await h.request({type:'GET_STATE'},allowed)).ok,false);
});
test('runtime broadcasts carry no private data and content talk uses only canned prompt IDs',async()=>{
 const h=setup();await h.request({type:'GET_STATE'});
 const r=await h.request({type:'PET_TALK',promptId:'love-you'},h.content);assert.equal(r.ok,true);assert.ok(r.state.talk.last.text);assert.equal(r.state.tasks,undefined);
 assert.ok(h.runtimeMessages.filter(m=>m.type==='STATE_CHANGED').every(m=>m.state===undefined));
 assert.equal((await h.request({type:'PET_TALK',promptId:'not-a-prompt'},h.content)).ok,false);
 assert.equal((await h.request({type:'ACTION',action:{type:'TALK_FAVORITE',promptId:'love-you'}},h.content)).ok,false);
});
test('request journal records only bounded digests and rejects reusing a token for a different action',async()=>{
 const h=setup();const token='one-request-token';
 await h.request({type:'ACTION',requestId:token,action:{type:'TASK_ADD',title:'First'}});
 let conflict=await h.request({type:'ACTION',requestId:token,action:{type:'TASK_ADD',title:'Different'}});assert.equal(conflict.ok,false);assert.equal(h.storage.purrpleState.tasks.length,1);
 for(let i=0;i<205;i++)await h.request({type:'ACTION',requestId:'draft_'+i,action:{type:'QUICK_TASK_DRAFT',text:'Draft '+i}});
 const journal=h.storage.purrpleRequestJournal;assert.equal(journal.length,200);assert.ok(journal.every(r=>Object.keys(r).sort().join()===['at','fingerprint','id'].sort().join()));assert.ok(JSON.stringify(journal).length<50000);
});
test('request receipts commit with state and are absent if storage rejects the write',async()=>{
 const h=setup();await h.request({type:'GET_STATE'});h.failNextSave();
 const action={type:'ACTION',requestId:'retry-storage',action:{type:'TASK_ADD',title:'Retry safely'}};
 assert.equal((await h.request(action)).ok,false);assert.equal(h.storage.purrpleRequestJournal,undefined);assert.equal(h.storage.purrpleState.tasks.length,0);
 assert.equal((await h.request(action)).ok,true);assert.equal(h.storage.purrpleState.tasks.length,1);assert.equal(h.storage.purrpleRequestJournal.length,1);
});
test('durable replay returns current state after reload without repeating a toggle',async()=>{
 const h=setup();let added=await h.request({type:'ACTION',action:{type:'TASK_ADD',title:'One task'}}),id=added.state.tasks[0].id;
 const toggle={type:'ACTION',requestId:'survives-reload',action:{type:'TASK_TOGGLE',id}};
 await h.request(toggle);await h.request({type:'ACTION',action:{type:'TASK_ADD',title:'Newer task'}});
 const context={browser:h.browser,PurrpleCore:C,URL,crypto:require('node:crypto').webcrypto,console:{warn:()=>{},error:()=>{}}};
 vm.runInNewContext(script,context);
 const reloaded=h.browser.runtime.onMessage.listeners.at(-1);
 const replay=await reloaded({type:'ACTION',requestId:'survives-reload',action:{id,type:'TASK_TOGGLE'}},h.ui);
 assert.equal(replay.ok,true);assert.equal(replay.state.tasks.length,2);assert.equal(replay.state.tasks[0].done,true);assert.equal(replay.state.wallet.balance,10);
});
test('Open app routes only to known internal sections and updates an already-open tab',async()=>{
 const h=setup();await h.request({type:'GET_STATE'});
 assert.equal((await h.request({type:'OPEN_APP',view:'settings'},h.content)).ok,true);assert.equal(h.tabOperations.at(-1).options.url,'moz-extension://purrple/app.html#settings');
 h.tabs.push({id:3,active:false,windowId:1,url:'moz-extension://purrple/app.html#today'});
 assert.equal((await h.request({type:'OPEN_APP',view:'settings'},h.content)).ok,true);assert.equal(h.tabOperations.at(-1).kind,'update');assert.equal(h.tabOperations.at(-1).options.url,'moz-extension://purrple/app.html#settings');
 assert.equal((await h.request({type:'OPEN_APP',view:'https://outside.test'},h.content)).ok,false);assert.equal((await h.request({type:'OPEN_APP',view:['settings']},h.content)).ok,false);
});

test('dock placement is lease-checked, persists across claims and can reset separately', async () => {
 const h=setup();
 const claim=await h.request({type:'PET_CLAIM'},h.content);
 const layout=await h.request({type:'PET_LAYOUT',part:'dock',leaseId:claim.leaseId,position:{x:0,y:.45}},h.content);
 assert.equal(layout.ok,true);
 assert.equal(h.storage.purrpleLayout.dock.x,0);
 assert.equal(h.storage.purrpleLayout.dock.y,.45);
 assert.equal((await h.request({type:'PET_LAYOUT',part:'dock',leaseId:'stale',position:{x:1,y:0}},h.content)).ok,false);
 assert.equal((await h.request({type:'PET_LAYOUT',part:'panel',leaseId:claim.leaseId,position:{x:.25,y:.75}},h.content)).ok,true);
 await h.request({type:'PET_RELEASE',leaseId:claim.leaseId},h.content);
 h.tabs[0].active=false;h.tabs[1].active=true;
 const other={url:'https://other.test/',tab:{id:2},frameId:0};
 const next=await h.request({type:'PET_CLAIM'},other);
 assert.equal(next.layout.dock.y,.45);
 assert.equal(next.layout.panel.y,.75);
 assert.equal((await h.request({type:'PET_LAYOUT',part:'dock',reset:true})).ok,true);
 assert.equal(h.storage.purrpleLayout.dock,null);
 assert.equal(h.storage.purrpleLayout.panel.y,.75);
});

test('Calendar is allowed only in full app and does not block the local state queue',async()=>{
 const h=setup();
 let finish,called=0;
 h.browser.runtime.sendNativeMessage=(name,payload)=>{
   assert.equal(name,'purrple_calendar');assert.equal(payload.operation,'status');called++;
   return new Promise(resolve=>{finish=resolve;});
 };
 const request={type:'CALENDAR',operation:'status'};
 assert.equal((await h.request(request,h.content)).ok,false);
 assert.equal((await h.request(request,{...h.ui,frameId:2})).ok,false);
 assert.equal((await h.request(request,{...h.ui,url:'moz-extension://purrple/popup.html'})).ok,false);
 const live=h.request(request);
 const local=await h.request({type:'ACTION',action:{type:'TASK_ADD',title:'Offline while Calendar waits'}});
 assert.equal(local.ok,true);
 assert.equal(called,1);
 finish({ok:true,connected:false});
 assert.equal((await live).connected,false);
});
