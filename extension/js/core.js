/* Purrple's local, deterministic domain model. No browser or network dependency. */
(function (root, factory) {
  const talk = root.PurrpleTalk || (typeof module === 'object' && module.exports ? require('./talk.js') : null);
  const dependency = (name, path) => root[name] || (typeof module === 'object' && module.exports ? require(path) : null);
  const value = factory(talk, dependency('PurrpleCalendarDomain', './planner-calendar.js'),
    dependency('PurrpleCompanionDomain', './companion-domain.js'), dependency('PurrpleWardrobeV2', './wardrobe-v2.js'));
  if (typeof module === 'object' && module.exports) module.exports = value;
  root.PurrpleCore = value;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Talk, Calendar, Companion, Wardrobe) {
  'use strict';
  const DAY = 86400000;
  const VERSION = 2;
  const STORY_OUTFIT = {scene:'lantern-afterglow',item:'starglow-pencil'};
  const EFFORT = Object.freeze({ small: 1, medium: 2, large: 3 });
  const LEGACY_EFFORT = Object.freeze({ small: 10, medium: 20, large: 30 });
  const SLOTS = Object.freeze(['head', 'neck', ...(Wardrobe?.slots || [])]);
  const LEGACY_ITEMS = [
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
  ];
  const oldPrices = Object.fromEntries(LEGACY_ITEMS.map(([id,,,price]) => [id,price]));
  const prices = [6,12,14,7,13,16,10,8,15,6,7,12,8,10,14];
  const CATALOG = Object.freeze([
    ...LEGACY_ITEMS.map(([id,name,slot,,description],index) => ({id,name,slot,price:prices[index],description})),
    ...(Wardrobe?.items || [])
  ].map(Object.freeze));
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
  function defaultSettings() {return {name:'',petEnabled:true,size:128,fps:30,reducedMotion:false,quietHours:{enabled:false,start:'22:00',end:'07:00'},chattiness:'balanced',siteRemarks:false,theme:'light',sound:false,notifications:false,hiddenHosts:[],focusPreset:25,welcomeDismissed:false};}
  const emptyOutfit = () => Object.fromEntries(SLOTS.map(slot => [slot,null]));
  const focusReward = (durationMs,rule=VERSION) => rule===1?5:durationMs>=1800000?2:durationMs>=900000?1:0;
  function localDate(at) {
    const d=new Date(at),pad=value=>String(value).padStart(2,'0');
    return String(d.getFullYear()).padStart(4,'0')+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  }
  function validateDate(value) {
    if(value===null||value===undefined||value==='')return null;
    if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Choose a valid due date.');
    const day=new Date(value+'T12:00:00Z');
    if(!Number.isFinite(+day)||day.toISOString().slice(0,10)!==value)throw Error('Choose a valid due date.');
    return value;
  }
  function defaultState(now=Date.now()) {
    validNow(now);
    return {version:VERSION,createdAt:now,updatedAt:now,tasks:[],wallet:{balance:0,totalEarned:0},ledger:[],owned:[],equipped:emptyOutfit(),focus:null,focusHistory:[],settings:defaultSettings(),stats:{completedTasks:0,focusMinutes:0},talk:Talk?Talk.empty():{counts:{},recent:[],history:[],favorites:[],last:null,total:0},drafts:{quickTask:'',quickEffort:'small'},
      priorities:[],calendar:Calendar?.empty(),companion:Companion?.empty(now),wrapSeen:null};
  }
  function normalizeSettings(patch,previous=defaultSettings()) {
    if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Settings must be an object.');
    const next=clone(previous),keys=new Set(Object.keys(defaultSettings()));
    for(const key of Object.keys(patch))if(!keys.has(key))throw Error(`Unknown setting: ${key}.`);
    if(own(patch,'name'))next.name=text(patch.name,'Name',60,true);
    for(const key of ['petEnabled','reducedMotion','siteRemarks','sound','notifications','welcomeDismissed'])if(own(patch,key))next[key]=boolean(patch[key],key);
    if(own(patch,'size'))next.size=number(patch.size,'Purrple size',64,256);
    if(own(patch,'fps'))next.fps=choose(Number(patch.fps),[24,30],'playback rate');
    if(own(patch,'focusPreset'))next.focusPreset=number(Number(patch.focusPreset),'Default focus length',1,240);
    if(own(patch,'theme'))next.theme=choose(patch.theme,['light','night'],'appearance');
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
    const base=existing?clone(existing):{id:input.id?text(input.id,'Task identifier',100):id('task'),title:'',dueAt:null,dueDate:null,project:'',estimate:null,effort:'small',priority:'normal',recurrence:'none',subtasks:[],done:false,completedAt:null,archived:false,createdAt:now,updatedAt:now,parentId:null,reminder:{snoozeUntil:null,notifiedAt:null}};
    if(own(input,'title'))base.title=text(input.title,'Task title',200);
    if(!base.title)throw Error('Give the task a title.');
    if(own(input,'dueAt'))base.dueAt=timestamp(input.dueAt,'Due date');
    if(own(input,'dueDate'))base.dueDate=validateDate(input.dueDate);
    if(own(input,'project'))base.project=text(input.project,'Project',60,true);
    if(own(input,'estimate'))base.estimate=input.estimate==null?null:number(Number(input.estimate),'Estimate',1,1440);
    if(input.sourceUrl){
      let source;try{source=new URL(input.sourceUrl);}catch{throw Error('The Google Calendar event link is invalid.');}
      if(source.origin!=='https://calendar.google.com'||!source.pathname.startsWith('/calendar/')||source.username||source.password)throw Error('The Google Calendar event link is invalid.');
      base.sourceUrl=source.href;
    }
    if(input.sourceEventId)base.sourceEventId=text(input.sourceEventId,'Source event identifier',300);
    if(own(input,'effort'))base.effort=choose(input.effort,Object.keys(EFFORT),'task size');
    if(own(input,'priority'))base.priority=choose(input.priority,['normal','high'],'priority');
    if(own(input,'recurrence'))base.recurrence=choose(input.recurrence,['none','daily','weekly'],'repeat schedule');
    if(own(input,'subtasks'))base.subtasks=normalizeSubtasks(input.subtasks,now);
    if(existing&&base.dueAt!==existing.dueAt)base.reminder={snoozeUntil:null,notifiedAt:null};
    base.updatedAt=now;
    return base;
  }
  function grant(state,key,type,amount,ref,now,rule=VERSION,details={}) {
    if(state.ledger.some(entry=>entry.id===key))return false;
    state.ledger.push({id:key,type,amount,ref,at:now,rule,...details});
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
    const rule=f.rule??1, completedAt=f.endsAt||now;
    const coins=f.kind==='focus'?focusReward(f.durationMs,rule):0;
    if(f.kind==='focus'){
      if(grant(state,'focus:'+f.id,'focus',coins,f.id,completedAt,rule,{durationMs:f.durationMs})){
        state.stats.focusMinutes+=f.durationMs/60000;
        if(f.durationMs>=900000)Companion?.award(state,'focus',f.id,completedAt);
      }
    }
    if(!state.focusHistory.some(h=>h.id===f.id))state.focusHistory.push({id:f.id,kind:f.kind,durationMs:f.durationMs,taskId:f.taskId,blockId:f.blockId??null,intention:f.intention||'',notes:f.notes||[],coins,rule,completedAt,notifiedAt:null});
    // Timer history is a bounded recent log; totals and earned balance are retained.
    if(state.focusHistory.length>365)state.focusHistory=state.focusHistory.slice(-365);
    state.focus=null;
  }
  function reconcile(input,now=Date.now()) {
    validNow(now);const state=clone(input);
    const legacy=state.version===1;
    if(legacy){
      state.version=VERSION;
      state.settings={...state.settings,welcomeDismissed:true};
      state.ledger=state.ledger.map(receipt=>({...receipt,rule:1}));
      state.focusHistory=state.focusHistory.map(session=>({...session,rule:1,coins:session.kind==='focus'?5:0,notes:[],intention:'',blockId:null}));
      if(state.focus)state.focus.rule=1;
      state.wrapSeen=state.focusHistory.at(-1)?.id??null;
    }
    state.settings={...defaultSettings(),...state.settings};
    state.equipped={...emptyOutfit(),...state.equipped};
    state.priorities??=[];
    if(!state.calendar&&Calendar)state.calendar=Calendar.empty();
    if(!state.companion&&Companion)state.companion=Companion.empty(state.createdAt??now);
    state.wrapSeen??=null;
    state.talk=Talk?Talk.normalize(state.talk):(state.talk||defaultState(now).talk);
    state.drafts={quickTask:state.drafts?.quickTask===undefined?'':text(state.drafts.quickTask,'Quick task draft',200,true),quickEffort:state.drafts?.quickEffort===undefined?(legacy?'medium':'small'):choose(state.drafts.quickEffort,Object.keys(EFFORT),'quick-task size')};
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
    if(['FOCUS_PAUSE','FOCUS_RESUME','FOCUS_CANCEL','FOCUS_PARK'].includes(action.type)&&action.sessionId!=null&&state.focus?.id!==action.sessionId)throw Error('That timer has changed. Check the current session.');
    if(action.type.startsWith('BLOCK_')&&Calendar){state.calendar=Calendar.reduce(state,action,now);state.updatedAt=now;return state;}
    if(action.type.startsWith('COMPANION_')&&Companion){
      state.companion=Companion.reduce(state,action,now);
      if(action.type==='COMPANION_SCENE_OPEN'&&action.id===STORY_OUTFIT.scene&&items[STORY_OUTFIT.item]&&!state.owned.includes(STORY_OUTFIT.item)&&
        state.companion.discoveries.some(entry=>entry.id===STORY_OUTFIT.scene)){
        if(grant(state,'wardrobe-gift:'+STORY_OUTFIT.item,'wardrobe-gift',0,STORY_OUTFIT.item,now,VERSION))state.owned.push(STORY_OUTFIT.item);
      }
      state.updatedAt=now;return state;
    }
    switch(action.type){
      case 'TASK_ADD':{const input=action.fromDraft===true&&!own(action,'effort')?{...action,effort:state.drafts.quickEffort}:action;const fresh=normalizeTask(input,now);if(state.tasks.some(t=>t.id===fresh.id))throw Error('That task identifier already exists.');state.tasks.push(fresh);if(action.fromDraft===true&&state.drafts.quickTask.trim()===fresh.title&&state.drafts.quickEffort===fresh.effort)state.drafts.quickTask='';break;}
      case 'QUICK_TASK_DRAFT':state.drafts.quickTask=text(action.text,'Quick task draft',200,true);if(own(action,'effort'))state.drafts.quickEffort=choose(action.effort,Object.keys(EFFORT),'quick-task size');break;
      case 'TALK_REPLY':if(!Talk)throw Error('Purrple’s local conversation library could not be loaded.');else {const first=!state.talk.counts[action.promptId];state.talk=Talk.reply(action.promptId,state.talk,now);if(first)Companion?.award(state,'talk',action.promptId,now);}break;
      case 'TALK_FAVORITE':if(!Talk)throw Error('Purrple’s local conversation library could not be loaded.');else state.talk=Talk.favorite(action.promptId,state.talk,action.favorite);break;
      case 'TASK_UPDATE':{
        const found=task(action.id);if(!action.patch||typeof action.patch!=='object')throw Error('The task update is missing.');
        const allowed=['title','dueAt','dueDate','project','estimate','effort','priority','recurrence','subtasks'];
        if(Object.keys(action.patch).some(key=>!allowed.includes(key)))throw Error('That task field cannot be changed here.');
        state.tasks=state.tasks.map(t=>t.id===found.id?normalizeTask(action.patch,now,found):t);break;
      }
      case 'TASK_SUBTASK':{
        const found=task(action.id),sub=found.subtasks.find(s=>s.id===action.subtaskId);
        if(!sub)throw Error('That subtask could not be found.');
        sub.done=own(action,'done')?boolean(action.done,'Subtask completion'):!sub.done;found.updatedAt=now;break;
      }
      case 'TASK_TOGGLE':case 'TASK_SET_DONE':{
        const found=task(action.id);if(found.archived)throw Error('Restore this task before changing it.');
        if(own(action,'expectedUpdatedAt')&&action.expectedUpdatedAt!==found.updatedAt)throw Error('This task changed after completion. Check the current task.');
        if(action.type==='TASK_SET_DONE'&&!own(action,'done'))throw Error('Choose whether the task is complete.');
        const done=own(action,'done')?boolean(action.done,'Task completion'):!found.done;
        if(done===found.done)break;
        found.done=done;found.updatedAt=now;
        if(found.done){
          found.completedAt=now;
          if(grant(state,'task:'+found.id,'task',EFFORT[found.effort],found.id,now,VERSION,{effort:found.effort}))state.stats.completedTasks++;
          if(found.recurrence!=='none'&&!state.tasks.some(t=>t.parentId===found.id)){
            const nextDue=nextRecurringDate({...found,dueAt:found.dueDate?new Date(found.dueDate+'T12:00:00').getTime():found.dueAt},now);
            const next=normalizeTask({title:found.title,dueAt:found.dueDate?null:nextDue,dueDate:found.dueDate?localDate(nextDue):null,project:found.project||'',estimate:found.estimate??null,effort:found.effort,priority:found.priority,recurrence:found.recurrence,subtasks:found.subtasks.map(s=>({title:s.title,done:false}))},now);
            next.parentId=found.id;state.tasks.push(next);
          }
        }else found.completedAt=null;
        break;
      }
      case 'TASK_ARCHIVE':{
        const found=task(action.id);
        if(own(action,'expectedUpdatedAt')&&action.expectedUpdatedAt!==found.updatedAt)throw Error('This task changed after archiving. Check the current task.');
        found.archived=action.archived!==false;found.updatedAt=now;
        if(found.archived)state.priorities=state.priorities.filter(key=>key!==found.id);
        else if(!found.done&&Number.isInteger(action.restorePriorityIndex)&&action.restorePriorityIndex>=0&&action.restorePriorityIndex<3&&
          state.priorities.length<3&&!state.priorities.includes(found.id))state.priorities.splice(action.restorePriorityIndex,0,found.id);
        break;
      }
      case 'TASK_PLAN_PRIORITY':{
        const found=task(action.id),enabled=boolean(action.enabled,'Priority');
        if(enabled&&(found.archived||found.done))throw Error('Choose an open task for Today.');
        if(enabled&&!state.priorities.includes(found.id)){
          if(state.priorities.length>=3)throw Error('Today holds up to three priorities. Remove one first.');
          state.priorities.push(found.id);
        }
        if(!enabled)state.priorities=state.priorities.filter(key=>key!==found.id);
        break;
      }
      case 'SHOP_BUY':{
        const item=items[action.id];if(!item)throw Error('That accessory is not in the shop.');
        if(state.owned.includes(item.id))break;
        if(state.wallet.balance<item.price)throw Error(`You need ${item.price-state.wallet.balance} more coins for ${item.name}.`);
        grant(state,'purchase:'+item.id,'purchase',-item.price,item.id,now);state.owned.push(item.id);break;
      }
      case 'EQUIP':{
        const slot=choose(action.slot,SLOTS,'accessory slot');
        if(action.id===null||action.id==='none'||action.id===''){state.equipped[slot]=null;break;}
        const item=items[action.id];if(!item||item.slot!==slot)throw Error('That accessory does not fit this slot.');
        if(!state.owned.includes(item.id))throw Error('Unlock this accessory in the shop first.');state.equipped[slot]=item.id;break;
      }
      case 'SETTINGS':state.settings=normalizeSettings(action.patch,state.settings);break;
      case 'FOCUS_START':case 'BREAK_START':{
        if(state.focus)throw Error('Finish or cancel the current timer first.');
        const minutes=number(Number(action.minutes),'Timer length',1,240);
        const blockId=action.blockId==null?null:text(action.blockId,'Block identifier',100);
        const block=blockId?state.calendar?.blocks.find(entry=>entry.id===blockId):null;
        if(blockId&&!block)throw Error('That time block could not be found.');
        const taskId=action.taskId==null?null:task(action.taskId).id;
        if(block){
          const linked=state.tasks.find(entry=>entry.id===block.taskId);
          if(linked&&!linked.done&&!linked.archived&&linked.id!==taskId||(!linked||linked.done||linked.archived)&&taskId!==null)throw Error('Refresh the calendar and choose that time block again.');
        }
        const durationMs=Math.round(minutes*60000);
        state.focus={id:id('session'),kind:action.type==='BREAK_START'?'break':'focus',status:'running',durationMs,remainingMs:durationMs,startedAt:now,endsAt:now+durationMs,taskId,blockId,
          intention:text(action.intention??'','Intention',160,true),notes:[],rule:VERSION};break;
      }
      case 'FOCUS_PAUSE':if(state.focus?.status==='running'){state.focus.remainingMs=Math.max(0,Math.min(state.focus.durationMs,state.focus.endsAt-now));state.focus.status='paused';state.focus.endsAt=null;}break;
      case 'FOCUS_RESUME':if(state.focus?.status==='paused'){state.focus.status='running';state.focus.endsAt=now+state.focus.remainingMs;}break;
      case 'FOCUS_CANCEL':state.focus=null;break;
      case 'FOCUS_FINISH':if(state.focus)throw Error('This session is still running. You can pause or cancel it.');break;
      case 'FOCUS_PARK':{
        if(!state.focus||state.focus.kind!=='focus')throw Error('Start a focus session to park a thought.');
        state.focus.notes??=[];
        if(state.focus.notes.length>=50)throw Error('This session already has 50 parked notes.');
        state.focus.notes.push({id:id('note'),text:text(action.text,'Parked thought',200),captured:false});break;
      }
      case 'FOCUS_NOTE_TASK':{
        const note=state.focusHistory.find(session=>session.id===action.id)?.notes?.find(entry=>entry.id===action.noteId);
        if(!note)throw Error('That parked thought could not be found.');
        if(!note.captured){state.tasks.push(normalizeTask({title:note.text},now));note.captured=true;}break;
      }
      case 'FOCUS_WRAP_DISMISS':{
        const last=state.focusHistory.at(-1);
        if(last?.id===action.id)state.wrapSeen=last.id;
        break;
      }
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
  function sessionDetails(session){
    const rule=choose(session.rule??1,[1,VERSION],'timer rule version');
    const blockId=session.blockId==null?null:text(session.blockId,'Block identifier',100);
    const intention=text(session.intention??'','Intention',160,true);
    const notes=session.notes??[];
    if(!Array.isArray(notes)||notes.length>50)throw Error('The backup contains invalid parked notes.');
    const seen=new Set();
    return {rule,blockId,intention,notes:notes.map(note=>{
      const key=text(note?.id,'Parked note identifier',100);
      if(seen.has(key))throw Error('The backup contains duplicate parked notes.');seen.add(key);
      return {id:key,text:text(note.text,'Parked thought',200),captured:boolean(note.captured,'Task capture')};
    })};
  }
  function validateBackup(value,now=Date.now()) {
    if(typeof value==='string'){try{value=JSON.parse(value);}catch{throw Error('This is not a valid JSON backup.');}}
    if(value?.format==='purrple-backup'&&value.version!==undefined&&![1,VERSION].includes(value.version))throw Error('This backup needs a compatible version of Purrple.');
    const input=value?.state||value;
    if(!input||typeof input!=='object'||![1,VERSION].includes(input.version))throw Error('Choose a Purrple version 1 or 2 backup.');
    const legacy=input.version===1;
    if(!Array.isArray(input.tasks)||!Array.isArray(input.ledger)||!Array.isArray(input.owned)||!Array.isArray(input.focusHistory))throw Error('The backup is missing its task or progress lists.');
    const state=defaultState(timestamp(input.createdAt,'Creation time')||now),taskIds=new Set(),ledgerIds=new Set();
    state.settings=normalizeSettings(input.settings);
    if(legacy)state.settings.welcomeDismissed=true;
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
      const record={id:text(entry.id,'Ledger identifier',180),type:choose(entry.type,['task','focus','purchase','wardrobe-gift'],'ledger entry'),amount:number(entry.amount,'Coin amount',-150,30),ref:text(entry.ref,'Ledger reference',100),at:timestamp(entry.at,'Ledger time')||now};
      if(ledgerIds.has(record.id))throw Error('The backup contains a duplicate reward.');ledgerIds.add(record.id);
      if(record.id!==record.type+':'+record.ref)throw Error('A backup reward identifier is inconsistent.');
      record.rule=legacy?1:choose(entry.rule,[1,VERSION],'reward rule version');
      if(record.type==='task'){
        if(!taskIds.has(record.ref))throw Error('A backup task receipt has no matching task.');
        if(record.rule===1){
          if(!Object.values(LEGACY_EFFORT).includes(record.amount))throw Error('A backup reward amount is invalid.');
        }else{
          record.effort=choose(entry.effort,Object.keys(EFFORT),'reward effort');
          if(record.amount!==EFFORT[record.effort])throw Error('A backup reward amount is invalid.');
        }
      }else if(record.type==='focus'){
        if(record.rule===VERSION||entry.durationMs!==undefined)record.durationMs=number(entry.durationMs,'Receipt duration',60000,14400000);
        if(record.amount!==focusReward(record.durationMs,record.rule))throw Error('A backup reward amount is invalid.');
      }else if(record.type==='purchase'){
        const price=record.rule===1?oldPrices[record.ref]:items[record.ref]?.price;
        if(!price||record.amount!==-price)throw Error('A backup reward amount is invalid.');
      }else if(record.rule!==VERSION||record.ref!==STORY_OUTFIT.item||record.amount!==0){
        throw Error('A backup wardrobe reward is invalid.');
      }
      return record;
    });
    const balance=state.ledger.reduce((sum,e)=>sum+e.amount,0),totalEarned=state.ledger.reduce((sum,e)=>sum+Math.max(0,e.amount),0);
    if(balance<0||!Number.isSafeInteger(balance)||balance!==input.wallet?.balance||totalEarned!==input.wallet?.totalEarned)throw Error('The backup coin balance does not match its ledger.');
    state.wallet={balance,totalEarned};
    state.owned=[...new Set(input.owned.map(v=>{
      if(!items[v])throw Error('The backup contains an unknown accessory.');
      if(ledgerIds.has('purchase:'+v)===ledgerIds.has('wardrobe-gift:'+v))throw Error('The backup must contain one ownership receipt for each accessory.');
      return v;
    }))];
    if(state.ledger.some(entry=>['purchase','wardrobe-gift'].includes(entry.type)&&!state.owned.includes(entry.ref)))throw Error('The backup is missing an owned accessory.');
    state.equipped=emptyOutfit();
    for(const slot of SLOTS){
      const key=input.equipped?.[slot]??null;
      if(key!==null&&(!state.owned.includes(key)||items[key].slot!==slot))throw Error('The backup contains an invalid outfit.');state.equipped[slot]=key;
    }
    const sessionIds=new Set();
    state.focusHistory=input.focusHistory.slice(-365).map(h=>{
      const sessionId=text(h.id,'Session identifier',100);if(sessionIds.has(sessionId))throw Error('The backup contains duplicate sessions.');sessionIds.add(sessionId);
      const details=sessionDetails(legacy?{...h,rule:1,notes:[]}:h);
      const kind=choose(h.kind,['focus','break'],'session type'),durationMs=number(h.durationMs,'Session duration',60000,14400000);
      const receipt=state.ledger.find(e=>e.id==='focus:'+sessionId),coins=kind==='focus'?focusReward(durationMs,details.rule):0;
      if(kind==='focus'&&(!receipt||receipt.amount!==coins||receipt.rule!==details.rule||receipt.durationMs!==undefined&&receipt.durationMs!==durationMs)||kind==='break'&&receipt||!legacy&&h.coins!==coins)throw Error('A session history and reward receipt do not match.');
      return{id:sessionId,kind,durationMs,taskId:h.taskId===null?null:text(h.taskId,'Task identifier',100),completedAt:timestamp(h.completedAt,'Session completion time')||now,notifiedAt:timestamp(h.notifiedAt,'Session notification time'),coins,...details};
    });
    if(input.focus){const f=input.focus;state.focus={id:text(f.id,'Session identifier',100),kind:choose(f.kind,['focus','break'],'session type'),status:choose(f.status,['running','paused'],'timer status'),durationMs:number(f.durationMs,'Session duration',60000,14400000),remainingMs:number(f.remainingMs,'Remaining time',0,f.durationMs),startedAt:timestamp(f.startedAt,'Session start')||now,endsAt:f.status==='running'?timestamp(f.endsAt,'Session end'):null,taskId:f.taskId===null?null:text(f.taskId,'Task identifier',100),...sessionDetails(legacy?{...f,rule:1,notes:[]}:f)};if(state.focus.status==='running'&&state.focus.endsAt===null)throw Error('The backup timer has no end time.');if(sessionIds.has(state.focus.id)||ledgerIds.has('focus:'+state.focus.id))throw Error('The backup timer is already completed.');}
    state.stats={completedTasks:number(input.stats?.completedTasks,'Completed-task count',0,Number.MAX_SAFE_INTEGER),focusMinutes:number(input.stats?.focusMinutes,'Focus total',0,Number.MAX_SAFE_INTEGER)};
    const taskReceipts=state.ledger.filter(entry=>entry.type==='task').length;
    const focusReceipts=state.ledger.filter(entry=>entry.type==='focus');
    const knownFocus=focusReceipts.reduce((sum,entry)=>sum+(entry.durationMs??state.focusHistory.find(session=>session.id===entry.ref)?.durationMs??60000)/60000,0);
    if(state.stats.completedTasks!==taskReceipts||state.stats.focusMinutes+1e-7<knownFocus)throw Error('The backup statistics do not match recorded progress.');
    if(focusReceipts.every(entry=>entry.durationMs!==undefined)&&Math.abs(state.stats.focusMinutes-knownFocus)>1e-7)throw Error('The backup focus total does not match the recorded sessions.');
    state.updatedAt=timestamp(input.updatedAt,'Update time')||now;
    state.talk=Talk?Talk.normalize(input.talk):(input.talk||defaultState(now).talk);
    state.drafts={quickTask:input.drafts?.quickTask===undefined?'':text(input.drafts.quickTask,'Quick task draft',200,true),quickEffort:input.drafts?.quickEffort===undefined?(legacy?'medium':'small'):choose(input.drafts.quickEffort,Object.keys(EFFORT),'quick-task size')};
    if(!legacy){
      const priorities=input.priorities;
      if(!Array.isArray(priorities)||priorities.length>3||new Set(priorities).size!==priorities.length||priorities.some(key=>!taskIds.has(key)))throw Error('The backup contains invalid priorities.');
      state.priorities=[...priorities];
      if(Calendar)state.calendar=Calendar.validate(input.calendar,state.tasks);
      if(Companion)state.companion=Companion.validate(input.companion,now);
      if(ledgerIds.has('wardrobe-gift:'+STORY_OUTFIT.item)&&!state.companion?.discoveries.some(entry=>entry.id===STORY_OUTFIT.scene))throw Error('The backup is missing the wardrobe gift’s story.');
      state.wrapSeen=input.wrapSeen==null?null:text(input.wrapSeen,'Last reviewed session',100);
    }else state.wrapSeen=state.focusHistory.at(-1)?.id??null;
    return reconcile(state,now);
  }
  function publicState(state,includeReply=false) {
    const last=includeReply&&state.talk?.last;
    const {petEnabled,size,fps,reducedMotion,quietHours,chattiness,siteRemarks=false,theme='light',hiddenHosts}=state.settings;
    return {version:state.version,settings:clone({petEnabled,size,fps,reducedMotion,quietHours,chattiness,siteRemarks,theme,hiddenHosts}),equipped:clone(state.equipped),
      focus:state.focus?{kind:state.focus.kind,status:state.focus.status,endsAt:state.focus.endsAt,remainingMs:state.focus.remainingMs}:null,
      companion:{unlockedGames:state.companion&&Companion?.unlockedGames(state.companion)||['paw-pairs'],resumableGame:state.companion&&Companion?.resumableGame?.(state.companion)||null,hasTalk:!!state.talk?.total},
      talk:{last:last?{id:last.id,text:last.text,reaction:last.reaction,at:last.at}:null}};
  }
  return Object.freeze({VERSION,CATALOG,EFFORT,SLOTS,focusReward,localDate,defaultState,createState:defaultState,normalizeSettings,normalizeTask,reduce,reducer:reduce,reconcile,validateBackup,reminders,quietNow,publicState});
});
