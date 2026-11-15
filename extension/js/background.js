/* Firefox MV3 event background. Core mutations are serialized before saving. */
(function () {
  'use strict';
  const api=globalThis.browser||globalThis.chrome,Core=globalThis.PurrpleCore;
  if(!api||!Core)return;
  const KEY='purrpleState',POSITION='purrplePosition';
  let queue=Promise.resolve(),lease=null,requestCache=new Map(),notificationRetryAt=0,scheduledAt=null;
  const extensionURL=api.runtime.getURL('');
  const isUI=sender=>typeof sender?.url==='string'&&sender.url.startsWith(extensionURL);
  const isContent=sender=>!!sender?.tab&&sender.frameId===0&&/^https?:\/\//.test(sender.url||'');
  function serial(fn){const next=queue.then(fn,fn);queue=next.catch(()=>{});return next;}
  async function load(){
    const result=await api.storage.local.get(KEY);
    if(!result[KEY]){const fresh=Core.defaultState();await save(fresh);return fresh;}
    // Every persisted mutation originates in this versioned reducer. Do not
    // silently wipe a corrupted or future-version save.
    if(result[KEY].version!==1)throw Error('This Purrple save needs a compatible version. Your data has been kept.');
    return result[KEY];
  }
  async function save(state){await api.storage.local.set({[KEY]:state});}
  async function broadcast(state){
    api.runtime.sendMessage({type:'STATE_CHANGED',state}).catch(()=>{});
    const tabs=await api.tabs.query({}).catch(()=>[]);
    await Promise.all(tabs.filter(t=>/^https?:\/\//.test(t.url||'')).map(t=>api.tabs.sendMessage(t.id,{type:'STATE_CHANGED',state:Core.publicState(state)}).catch(()=>{})));
  }
  async function schedule(state){
    try{
    let next=Infinity;const now=Date.now();
    for(const task of state.tasks)if(state.settings.notifications&&!Core.quietNow(state.settings,now)&&!task.done&&!task.archived&&task.dueAt!==null&&task.reminder.notifiedAt===null){
      const at=task.reminder.snoozeUntil===null?task.dueAt:task.reminder.snoozeUntil;
      next=Math.min(next,at<=now?(notificationRetryAt>now?notificationRetryAt:now+60000):Math.max(notificationRetryAt,at));
    }
    if(state.focus?.status==='running')next=Math.min(next,state.focus.endsAt);
    const target=Number.isFinite(next)?Math.max(now+1000,next):null;
    if(scheduledAt===target)return;
    await api.alarms.clear('purrple-next');scheduledAt=null;
    if(target!==null){await api.alarms.create('purrple-next',{when:target});scheduledAt=target;}
    }catch(error){console.warn('Purrple alarm scheduling unavailable:',String(error?.message||error));}
  }
  async function sendToActive(message){
    const tabs=await api.tabs.query({active:true,lastFocusedWindow:true}).catch(()=>[]);
    for(const tab of tabs)if(/^https?:\/\//.test(tab.url||''))await api.tabs.sendMessage(tab.id,message).catch(()=>{});
  }
  async function notify(id,title,message){
    try{await api.notifications.create(id,{type:'basic',iconUrl:api.runtime.getURL('assets/icon128.png'),title,message});return true;}
    catch(error){console.warn('Purrple notification unavailable:',String(error?.message||error));return false;}
  }
  async function reconcileAndNotify(previous){
    const now=Date.now();let state=Core.reconcile(previous,now);
    if(state.settings.notifications&&!Core.quietNow(state.settings,now)&&now>=notificationRetryAt){
      const due=Core.reminders(state,now);
      if(due.length){
        const text=due.length===1?`“${due[0].title}” is ready for a little attention.`:`${due.length} tasks are ready for a little attention.`;
        const delivered=await notify('purrple-task-reminder','A little nudge from Purrple',text);
        await sendToActive({type:'REMINDER_NOTICE'});
        if(delivered)for(const task of due)state=Core.reduce(state,{type:'REMINDER_NOTIFIED',id:task.id},now);
        else notificationRetryAt=now+60000;
      }
      const completed=state.focusHistory.filter(f=>f.notifiedAt===null);
      // One compact catch-up notification replaces a burst after time away.
      if(completed.length){
        const last=completed[completed.length-1],focus=last.kind==='focus';
        const delivered=await notify('purrple-session','A little moment with Purrple',focus?'Your focus session is complete. Five coins are waiting. Time for a stretch?':'Your break is complete. Ready when you are.');
        await sendToActive({type:'FOCUS_NOTICE',kind:focus?'complete':'break'});
        if(delivered)for(const session of completed)state=Core.reduce(state,{type:'SESSION_NOTIFIED',id:session.id},now);
        else notificationRetryAt=now+60000;
      }
    }
    // endsAt is the durable timer truth. A display countdown must not rewrite
    // the entire saved task history every second while an app page is open.
    const comparable=state.focus?.status==='running'&&previous.focus?.id===state.focus.id?
      {...state,focus:{...state.focus,remainingMs:previous.focus.remainingMs}}:state;
    if(JSON.stringify(previous)!==JSON.stringify(comparable)){await save(state);await broadcast(state);}
    await schedule(state);return state;
  }
  async function activeSender(sender){
    if(!isContent(sender))return false;
    try{const tab=await api.tabs.get(sender.tab.id),window=await api.windows.get(tab.windowId);return tab.active&&window.focused;}catch{return false;}
  }
  function position(input){
    if(!input||!Number.isFinite(input.x)||!Number.isFinite(input.y))throw Error('Invalid companion position.');
    return{x:Math.max(0,Math.min(1,input.x)),y:Math.max(0,Math.min(1,input.y))};
  }
  async function releaseLease(){
    const old=lease;lease=null;
    if(old)await api.tabs.sendMessage(old.tabId,{type:'PET_REVOKED',leaseId:old.id}).catch(()=>{});
  }
  async function handler(request,sender){
    if(!request||typeof request.type!=='string')return undefined;
    if(request.type==='STATE_CHANGED')return undefined;
    if(!isUI(sender)&&!isContent(sender))return {ok:false,error:'This request is not from a Purrple surface.'};
    switch(request.type){
      case 'GET_STATE':{
        const state=await reconcileAndNotify(await load());return {ok:true,state:isUI(sender)?state:Core.publicState(state),catalog:Core.CATALOG};
      }
      case 'ACTION':{
        if(!isUI(sender))throw Error('Open Purrple to change your plans or progress.');
        const token=typeof request.requestId==='string'?request.requestId.slice(0,120):null;
        if(token&&requestCache.has(token))return requestCache.get(token);
        const previous=await load(),state=Core.reduce(previous,request.action);
        await save(state);await schedule(state);await broadcast(state);
        const response={ok:true,state,catalog:Core.CATALOG};
        if(token){requestCache.set(token,response);if(requestCache.size>200)requestCache.delete(requestCache.keys().next().value);}
        return response;
      }
      case 'BACKUP_EXPORT':{
        if(!isUI(sender))throw Error('Open Purrple to export a backup.');
        return{ok:true,backup:{app:'Purrple',exportedAt:Date.now(),state:await reconcileAndNotify(await load())}};
      }
      case 'OPEN_APP':{
        const url=api.runtime.getURL('app.html');
        const tabs=await api.tabs.query({});const existing=tabs.find(t=>t.url?.split('#')[0]===url);
        if(existing){await api.tabs.update(existing.id,{active:true});await api.windows.update(existing.windowId,{focused:true});}
        else await api.tabs.create({url});return{ok:true};
      }
      case 'PET_CLAIM':{
        if(!await activeSender(sender))return{ok:true,active:false,leaseId:null};
        if(lease&&lease.tabId!==sender.tab.id)await releaseLease();
        if(!lease)lease={id:globalThis.crypto.randomUUID(),tabId:sender.tab.id};
        const stored=await api.storage.local.get(POSITION);
        return{ok:true,active:true,leaseId:lease.id,position:stored[POSITION]||{x:.82,y:1}};
      }
      case 'PET_SAVE':{
        if(!isContent(sender)||lease?.id!==request.leaseId||lease.tabId!==sender.tab.id)return{ok:true,saved:false};
        await api.storage.local.set({[POSITION]:position(request.position)});return{ok:true,saved:true};
      }
      case 'PET_RELEASE':{
        if(!isContent(sender)||lease?.id!==request.leaseId||lease.tabId!==sender.tab.id)return{ok:true,released:false};
        if(request.position)await api.storage.local.set({[POSITION]:position(request.position)});lease=null;return{ok:true,released:true};
      }
      case 'PET_HIDE_HOST':{
        if(!isContent(sender))throw Error('This site could not be identified.');
        const host=new URL(sender.url).hostname,state=await load(),hosts=new Set(state.settings.hiddenHosts);
        if(request.hidden!==false)hosts.add(host);else hosts.delete(host);
        const next=Core.reduce(state,{type:'SETTINGS',patch:{hiddenHosts:[...hosts]}});await save(next);await broadcast(next);return{ok:true,state:Core.publicState(next)};
      }
      default:return undefined;
    }
  }
  api.runtime.onMessage.addListener((request,sender)=>{
    if(request?.type==='STATE_CHANGED')return undefined;
    return serial(()=>handler(request,sender)).catch(error=>({ok:false,error:String(error?.message||error)}));
  });
  api.alarms.onAlarm.addListener(alarm=>{if(['purrple-next','purrple-heartbeat'].includes(alarm.name))serial(async()=>reconcileAndNotify(await load())).catch(console.error);});
  // Avoid passing a Promise to the pure reconciliation path.
  const catchup=()=>serial(async()=>reconcileAndNotify(await load())).catch(console.error);
  api.runtime.onStartup.addListener(catchup);
  api.runtime.onInstalled.addListener(async()=>{api.alarms.create('purrple-heartbeat',{periodInMinutes:1});await catchup();});
  api.notifications.onClicked.addListener(id=>{if(id.startsWith('purrple-'))api.tabs.create({url:api.runtime.getURL('app.html')});});
  api.tabs.onActivated.addListener(info=>{if(lease&&lease.tabId!==info.tabId)serial(releaseLease).catch(()=>{});});
  api.windows.onFocusChanged.addListener(()=>serial(releaseLease).catch(()=>{}));
  api.tabs.onRemoved.addListener(tabId=>{if(lease?.tabId===tabId)lease=null;});
  api.alarms.create('purrple-heartbeat',{periodInMinutes:1});
  catchup();
})();
