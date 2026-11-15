/* Purrple's local, deterministic domain model. No browser or network dependency. */
(function (root, factory) {
  const value = factory();
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.PurrpleCore = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400000;
  const EFFORT = Object.freeze({ small: 10, medium: 20, large: 30 });
  const CATALOG = Object.freeze([
    ['moon-bow','Moon bow','head',20,'A plum ribbon with a little crescent charm.'],
    ['cozy-beanie','Cozy beanie','head',65,'A lavender knit hat, with room for both ears.'],
    ['star-beret','Star beret','head',90,'A soft beret for important little thoughts.'],
    ['flower-clip','Flower clip','head',35,'A small lilac blossom beside her ear.'],
    ['cloud-cap','Cloud cap','head',80,'A little cloud to wear on a quiet day.'],
    ['crescent-crown','Crescent crown','head',150,'A tiny crown for a very small queen.'],
    ['heart-bow','Heart bow','head',55,'A pink-lilac ribbon with a heart at its center.'],
    ['plum-ribbon','Plum ribbon','head',45,'A simple folded ribbon in deep purple.'],
    ['stargazer-hat','Stargazer hat','head',120,'A little pointed hat with a starry detail.'],
    ['star-bandana','Star bandana','neck',20,'A violet neckerchief with an embroidered star.'],
    ['moon-collar','Moon collar','neck',35,'A soft collar with a little moon charm.'],
    ['cozy-scarf','Cozy scarf','neck',65,'A snug scarf for a cozy study session.'],
    ['petal-collar','Petal collar','neck',45,'A small ring of lavender petals.'],
    ['cloud-bib','Cloud bib','neck',55,'A soft cloud-shaped little bib.'],
    ['night-bandana','Night bandana','neck',85,'A dark violet bandana for late-night company.']
  ].map(([id,name,slot,price,description]) => Object.freeze({id,name,slot,price,description})));
  const items = Object.assign(Object.create(null),Object.fromEntries(CATALOG.map(item=>[item.id,item])));
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = prefix => `${prefix}_${globalThis.crypto?.randomUUID?.() || (Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12))}`;
  const validNow = now => { if (!Number.isFinite(now)) throw Error('The local clock is invalid.'); return now; };
  const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
  function text(value,label,max=200,empty=false) {
    if (typeof value !== 'string') throw Error(`${label} must be text.`);
    const result=value.replace(/[\u0000-\u001f\u007f]/g,' ').trim();
    if ((!empty && !result) || result.length>max) throw Error(`${label} must contain ${empty?'0':'1'}–${max} characters.`);
    return result;
  }
  function choose(value,values,label) { if (!values.includes(value)) throw Error(`Choose a valid ${label}.`); return value; }
  function number(value,label,minimum,maximum) { if(!Number.isFinite(value)||value<minimum||value>maximum)throw Error(`${label} must be between ${minimum} and ${maximum}.`);return value; }
  function timestamp(value,label) { if(value===null||value===undefined||value==='')return null;return number(value,label,0,8640000000000000); }
  function boolean(value,label) { if(typeof value!=='boolean')throw Error(`${label} must be on or off.`);return value; }
  function defaultSettings() {return {name:'',petEnabled:true,size:128,fps:30,reducedMotion:false,quietHours:{enabled:false,start:'22:00',end:'07:00'},chattiness:'balanced',sound:false,notifications:true,hiddenHosts:[]};}
  function defaultState(now=Date.now()) {
    validNow(now);
    return {version:1,createdAt:now,updatedAt:now,tasks:[],wallet:{balance:0,totalEarned:0},ledger:[],owned:[],equipped:{head:null,neck:null},focus:null,focusHistory:[],settings:defaultSettings(),stats:{completedTasks:0,focusMinutes:0}};
  }
  function normalizeSettings(patch,previous=defaultSettings()) {
    if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Settings must be an object.');
    const next=clone(previous),keys=new Set(Object.keys(defaultSettings()));
    for(const key of Object.keys(patch))if(!keys.has(key))throw Error(`Unknown setting: ${key}.`);
    if(own(patch,'name'))next.name=text(patch.name,'Name',60,true);
    for(const key of ['petEnabled','reducedMotion','sound','notifications'])if(own(patch,key))next[key]=boolean(patch[key],key);
    if(own(patch,'size'))next.size=number(patch.size,'Purrple size',64,256);
    if(own(patch,'fps'))next.fps=choose(Number(patch.fps),[24,30],'playback rate');
    if(own(patch,'chattiness'))next.chattiness=choose(patch.chattiness,['quiet','balanced','chatty'],'chattiness');
    if(own(patch,'quietHours')){
      const q=patch.quietHours;
      if(!q||typeof q!=='object')throw Error('Quiet hours must have start and end times.');
      const clock=v=>{if(typeof v!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(v))throw Error('Choose a valid quiet-hours time.');return v;};
      next.quietHours={enabled:boolean(q.enabled,'Quiet hours'),start:clock(q.start),end:clock(q.end)};
    }
    if(own(patch,'hiddenHosts')){
      if(!Array.isArray(patch.hiddenHosts))throw Error('Hidden sites must be a list.');
      next.hiddenHosts=[...new Set(patch.hiddenHosts.map(v=>{
        const host=text(v,'Site hostname',253).toLowerCase();
        if(!/^[a-z0-9.-]+$/.test(host)||host.includes('..'))throw Error('Use a hostname without a path.');
        return host;
      }))];
    }
    return next;
  }
  function normalizeSubtasks(values,now) {
    if(!Array.isArray(values)||values.length>100)throw Error('Use a list of up to 100 subtasks.');
    const seen=new Set();
    return values.map(value=>{
      const o=typeof value==='string'?{title:value}:value;
      if(!o||typeof o!=='object')throw Error('A subtask is invalid.');
      const key=o.id?text(o.id,'Subtask identifier',100):id('sub');
      if(seen.has(key))throw Error('Subtask identifiers must be unique.');seen.add(key);
      return {id:key,title:text(o.title,'Subtask',200),done:o.done===true};
    });
  }
  function normalizeTask(input,now,existing) {
    if(!input||typeof input!=='object'||Array.isArray(input))throw Error('A task must be an object.');
    const base=existing?clone(existing):{id:input.id?text(input.id,'Task identifier',100):id('task'),title:'',dueAt:null,effort:'small',priority:'normal',recurrence:'none',subtasks:[],done:false,completedAt:null,archived:false,createdAt:now,updatedAt:now,parentId:null,reminder:{snoozeUntil:null,notifiedAt:null}};
    if(own(input,'title'))base.title=text(input.title,'Task title',200);
    if(!base.title)throw Error('Give the task a title.');
    if(own(input,'dueAt'))base.dueAt=timestamp(input.dueAt,'Due date');
    if(own(input,'effort'))base.effort=choose(input.effort,Object.keys(EFFORT),'task size');
    if(own(input,'priority'))base.priority=choose(input.priority,['normal','high'],'priority');
    if(own(input,'recurrence'))base.recurrence=choose(input.recurrence,['none','daily','weekly'],'repeat schedule');
    if(own(input,'subtasks'))base.subtasks=normalizeSubtasks(input.subtasks,now);
    if(existing&&base.dueAt!==existing.dueAt)base.reminder={snoozeUntil:null,notifiedAt:null};
    base.updatedAt=now;
    return base;
  }
  function grant(state,key,type,amount,ref,now) {
    if(state.ledger.some(entry=>entry.id===key))return false;
    state.ledger.push({id:key,type,amount,ref,at:now});
    state.wallet.balance+=amount;if(amount>0)state.wallet.totalEarned+=amount;
    return true;
  }
  function nextRecurringDate(task,now) {
    const days=task.recurrence==='weekly'?7:1;
    const date=new Date(task.dueAt===null?now:task.dueAt);
    date.setDate(date.getDate()+days);
    // Missed occurrences are not spawned as a backlog. Preserve local clock time.
    while(date.getTime()<=now)date.setDate(date.getDate()+days);
    return date.getTime();
  }
  function completeSession(state,now) {
    const f=state.focus;if(!f)return;
    if(f.kind==='focus'){
      if(grant(state,'focus:'+f.id,'focus',5,f.id,now))state.stats.focusMinutes+=f.durationMs/60000;
    }
    if(!state.focusHistory.some(h=>h.id===f.id))state.focusHistory.push({id:f.id,kind:f.kind,durationMs:f.durationMs,taskId:f.taskId,completedAt:f.endsAt||now,notifiedAt:null});
    // Timer history is a bounded recent log; totals and earned balance are retained.
    if(state.focusHistory.length>365)state.focusHistory=state.focusHistory.slice(-365);
    state.focus=null;
  }
  function reconcile(input,now=Date.now()) {
    validNow(now);const state=clone(input);
    if(state.focus?.status==='running'){
      state.focus.remainingMs=Math.max(0,Math.min(state.focus.durationMs,state.focus.endsAt-now));
      if(state.focus.remainingMs===0)completeSession(state,now);
    }
    return state;
  }
  function reduce(input,action,now=Date.now()) {
    validNow(now);
    if(!action||typeof action.type!=='string')throw Error('Choose an action.');
    if(action.type==='BACKUP_IMPORT')return validateBackup(action.backup,now);
    const state=reconcile(input,now);
    const task=key=>{const found=state.tasks.find(t=>t.id===key);if(!found)throw Error('That task could not be found.');return found;};
    switch(action.type){
      case 'TASK_ADD':{const fresh=normalizeTask(action,now);if(state.tasks.some(t=>t.id===fresh.id))throw Error('That task identifier already exists.');state.tasks.push(fresh);break;}
      case 'TASK_UPDATE':{
        const found=task(action.id);if(!action.patch||typeof action.patch!=='object')throw Error('The task update is missing.');
        const allowed=['title','dueAt','effort','priority','recurrence','subtasks'];
        if(Object.keys(action.patch).some(key=>!allowed.includes(key)))throw Error('That task field cannot be changed here.');
        state.tasks=state.tasks.map(t=>t.id===found.id?normalizeTask(action.patch,now,found):t);break;
      }
      case 'TASK_SUBTASK':{
        const found=task(action.id),sub=found.subtasks.find(s=>s.id===action.subtaskId);
        if(!sub)throw Error('That subtask could not be found.');
        sub.done=own(action,'done')?boolean(action.done,'Subtask completion'):!sub.done;found.updatedAt=now;break;
      }
      case 'TASK_TOGGLE':{
        const found=task(action.id);if(found.archived)throw Error('Restore this task before changing it.');
        found.done=!found.done;found.updatedAt=now;
        if(found.done){
          found.completedAt=now;
          if(grant(state,'task:'+found.id,'task',EFFORT[found.effort],found.id,now))state.stats.completedTasks++;
          if(found.recurrence!=='none'&&!state.tasks.some(t=>t.parentId===found.id)){
            const next=normalizeTask({title:found.title,dueAt:nextRecurringDate(found,now),effort:found.effort,priority:found.priority,recurrence:found.recurrence,subtasks:found.subtasks.map(s=>({title:s.title,done:false}))},now);
            next.parentId=found.id;state.tasks.push(next);
          }
        }else found.completedAt=null;
        break;
      }
      case 'TASK_ARCHIVE':{const found=task(action.id);found.archived=action.archived!==false;found.updatedAt=now;break;}
      case 'SHOP_BUY':{
        const item=items[action.id];if(!item)throw Error('That accessory is not in the shop.');
        if(state.owned.includes(item.id))break;
        if(state.wallet.balance<item.price)throw Error(`You need ${item.price-state.wallet.balance} more coins for ${item.name}.`);
        grant(state,'purchase:'+item.id,'purchase',-item.price,item.id,now);state.owned.push(item.id);break;
      }
      case 'EQUIP':{
        const slot=choose(action.slot,['head','neck'],'accessory slot');
        if(action.id===null||action.id==='none'||action.id===''){state.equipped[slot]=null;break;}
        const item=items[action.id];if(!item||item.slot!==slot)throw Error('That accessory does not fit this slot.');
        if(!state.owned.includes(item.id))throw Error('Unlock this accessory in the shop first.');state.equipped[slot]=item.id;break;
      }
      case 'SETTINGS':state.settings=normalizeSettings(action.patch,state.settings);break;
      case 'FOCUS_START':case 'BREAK_START':{
        if(state.focus)throw Error('Finish or cancel the current timer first.');
        const minutes=number(Number(action.minutes),'Timer length',1,240);
        const taskId=action.taskId==null?null:task(action.taskId).id;
        const durationMs=Math.round(minutes*60000);
        state.focus={id:id('session'),kind:action.type==='BREAK_START'?'break':'focus',status:'running',durationMs,remainingMs:durationMs,startedAt:now,endsAt:now+durationMs,taskId};break;
      }
      case 'FOCUS_PAUSE':if(state.focus?.status==='running'){state.focus.remainingMs=Math.max(0,Math.min(state.focus.durationMs,state.focus.endsAt-now));state.focus.status='paused';state.focus.endsAt=null;}break;
      case 'FOCUS_RESUME':if(state.focus?.status==='paused'){state.focus.status='running';state.focus.endsAt=now+state.focus.remainingMs;}break;
      case 'FOCUS_CANCEL':state.focus=null;break;
      case 'FOCUS_FINISH':if(state.focus)throw Error('This session is still running. You can pause or cancel it.');break;
      case 'REMINDER_SNOOZE':{
        const found=task(action.id);const minutes=number(Number(action.minutes),'Snooze length',1,1440);
        found.reminder={snoozeUntil:now+minutes*60000,notifiedAt:null};found.updatedAt=now;break;
      }
      case 'REMINDER_NOTIFIED':{const found=task(action.id);found.reminder.notifiedAt=now;break;}
      case 'SESSION_NOTIFIED':{const found=state.focusHistory.find(s=>s.id===action.id);if(found)found.notifiedAt=now;break;}
      default:throw Error('That action is not supported.');
    }
    state.updatedAt=now;return state;
  }
  function quietNow(settings,now=Date.now()) {
    const q=settings.quietHours;if(!q?.enabled)return false;
    const time=new Date(now),n=time.getHours()*60+time.getMinutes();
    const parse=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
    const start=parse(q.start),end=parse(q.end);
    if(start===end)return true;
    return start<end?n>=start&&n<end:n>=start||n<end;
  }
  function reminders(state,now=Date.now()) {
    if(!state.settings.notifications||quietNow(state.settings,now))return [];
    return state.tasks.filter(t=>!t.done&&!t.archived&&t.dueAt!==null&&t.reminder.notifiedAt===null&&
      (t.reminder.snoozeUntil===null?t.dueAt:t.reminder.snoozeUntil)<=now);
  }
  function validateBackup(value,now=Date.now()) {
    if(typeof value==='string'){try{value=JSON.parse(value);}catch{throw Error('This is not a valid JSON backup.');}}
    const input=value?.state||value;
    if(!input||typeof input!=='object'||input.version!==1)throw Error('Choose a Purrple version 1 backup.');
    if(!Array.isArray(input.tasks)||!Array.isArray(input.ledger)||!Array.isArray(input.owned)||!Array.isArray(input.focusHistory))throw Error('The backup is missing its task or progress lists.');
    const state=defaultState(timestamp(input.createdAt,'Creation time')||now),taskIds=new Set(),ledgerIds=new Set();
    state.settings=normalizeSettings(input.settings);
    state.tasks=input.tasks.map(t=>{
      if(!t||typeof t.id!=='string')throw Error('The backup contains an invalid task.');
      const taskId=text(t.id,'Task identifier',100);
      if(taskIds.has(taskId))throw Error('The backup contains duplicate tasks.');taskIds.add(taskId);
      const n=normalizeTask({...t,id:taskId},now);
      n.done=boolean(t.done,'Task completion');n.archived=boolean(t.archived,'Task archive');
      n.completedAt=timestamp(t.completedAt,'Task completion time');n.createdAt=timestamp(t.createdAt,'Task creation time')||now;n.updatedAt=timestamp(t.updatedAt,'Task update time')||now;
      n.parentId=t.parentId===null?null:text(t.parentId,'Parent task identifier',100);
      n.reminder={snoozeUntil:timestamp(t.reminder?.snoozeUntil,'Snooze time'),notifiedAt:timestamp(t.reminder?.notifiedAt,'Reminder time')};
      return n;
    });
    state.ledger=input.ledger.map(entry=>{
      if(!entry||typeof entry.id!=='string')throw Error('The backup contains an invalid reward ledger.');
      const record={id:text(entry.id,'Ledger identifier',180),type:choose(entry.type,['task','focus','purchase'],'ledger entry'),amount:number(entry.amount,'Coin amount',-150,30),ref:text(entry.ref,'Ledger reference',100),at:timestamp(entry.at,'Ledger time')||now};
      if(ledgerIds.has(record.id))throw Error('The backup contains a duplicate reward.');ledgerIds.add(record.id);
      if(record.id!==record.type+':'+record.ref)throw Error('A backup reward identifier is inconsistent.');
      if(record.type==='task'&&!Object.values(EFFORT).includes(record.amount)||record.type==='focus'&&record.amount!==5||record.type==='purchase'&&(!items[record.ref]||record.amount!==-items[record.ref].price))throw Error('A backup reward amount is invalid.');
      return record;
    });
    const balance=state.ledger.reduce((sum,e)=>sum+e.amount,0),totalEarned=state.ledger.reduce((sum,e)=>sum+Math.max(0,e.amount),0);
    if(balance<0||!Number.isSafeInteger(balance)||balance!==input.wallet?.balance||totalEarned!==input.wallet?.totalEarned)throw Error('The backup coin balance does not match its ledger.');
    state.wallet={balance,totalEarned};
    state.owned=[...new Set(input.owned.map(v=>{if(!items[v])throw Error('The backup contains an unknown accessory.');if(!state.ledger.some(e=>e.id==='purchase:'+v&&e.amount===-items[v].price))throw Error('The backup is missing an accessory purchase.');return v;}))];
    state.equipped={head:null,neck:null};
    for(const slot of ['head','neck']){
      const key=input.equipped?.[slot]??null;
      if(key!==null&&(!state.owned.includes(key)||items[key].slot!==slot))throw Error('The backup contains an invalid outfit.');state.equipped[slot]=key;
    }
    const sessionIds=new Set();
    state.focusHistory=input.focusHistory.slice(-365).map(h=>{
      const sessionId=text(h.id,'Session identifier',100);if(sessionIds.has(sessionId))throw Error('The backup contains duplicate sessions.');sessionIds.add(sessionId);
      return{id:sessionId,kind:choose(h.kind,['focus','break'],'session type'),durationMs:number(h.durationMs,'Session duration',60000,14400000),taskId:h.taskId===null?null:text(h.taskId,'Task identifier',100),completedAt:timestamp(h.completedAt,'Session completion time')||now,notifiedAt:timestamp(h.notifiedAt,'Session notification time')};
    });
    if(input.focus){const f=input.focus;state.focus={id:text(f.id,'Session identifier',100),kind:choose(f.kind,['focus','break'],'session type'),status:choose(f.status,['running','paused'],'timer status'),durationMs:number(f.durationMs,'Session duration',60000,14400000),remainingMs:number(f.remainingMs,'Remaining time',0,f.durationMs),startedAt:timestamp(f.startedAt,'Session start')||now,endsAt:f.status==='running'?timestamp(f.endsAt,'Session end'):null,taskId:f.taskId===null?null:text(f.taskId,'Task identifier',100)};if(state.focus.status==='running'&&state.focus.endsAt===null)throw Error('The backup timer has no end time.');}
    state.stats={completedTasks:number(input.stats?.completedTasks,'Completed-task count',0,Number.MAX_SAFE_INTEGER),focusMinutes:number(input.stats?.focusMinutes,'Focus total',0,Number.MAX_SAFE_INTEGER)};
    state.updatedAt=timestamp(input.updatedAt,'Update time')||now;
    return reconcile(state,now);
  }
  function publicState(state) {
    return {version:state.version,settings:clone(state.settings),equipped:clone(state.equipped),owned:[...state.owned],wallet:{balance:state.wallet.balance},focus:state.focus?{kind:state.focus.kind,status:state.focus.status,endsAt:state.focus.endsAt,remainingMs:state.focus.remainingMs}:null};
  }
  return Object.freeze({CATALOG,EFFORT,defaultState,createState:defaultState,normalizeSettings,normalizeTask,reduce,reducer:reduce,reconcile,validateBackup,reminders,quietNow,publicState});
});
