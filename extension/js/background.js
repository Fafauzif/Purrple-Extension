/* Firefox MV3 event background. Core mutations are serialized before saving. */
(function () {
  'use strict';
  const api=globalThis.browser||globalThis.chrome,Core=globalThis.PurrpleCore;
  if(!api||!Core)return;
  const KEY='purrpleState',POSITION='purrplePosition',JOURNAL='purrpleRequestJournal';
  const LAYOUT='purrpleLayout', AMBIENT='purrpleAmbientReceipt';
  const PANEL_KEY='purrplePanelCapabilities',PANEL_TTL=12*60*60*1000;
  const panelStorage=api.storage.session||api.storage.local;
  let queue=Promise.resolve(),calendarQueue=Promise.resolve(),lease=null,notificationRetryAt=0,scheduledAt=null;
  const extensionURL=api.runtime.getURL('');
  async function panelCapabilities(){
    const data=await panelStorage.get(PANEL_KEY),now=Date.now(),records=data[PANEL_KEY]||{};
    for(const key of Object.keys(records))if(!records[key]||records[key].expiresAt<=now)delete records[key];
    return records;
  }
  async function isUI(sender){
    if(typeof sender?.url!=='string'||!sender.url.startsWith(extensionURL))return false;
    let url;try{url=new URL(sender.url);}catch{return false;}
    if(!['/app.html','/popup.html'].includes(url.pathname))return false;
    const embedded=sender.tab&&Number.isInteger(sender.frameId)&&sender.frameId>0;
    if(url.searchParams.get('panel')!=='1')return !embedded;
    if(url.pathname!=='/popup.html'||!embedded)return false;
    const token=url.searchParams.get('token'),records=await panelCapabilities(),record=records[token];
    if(!record||record.tabId!==sender.tab.id||record.frameId!==null&&record.frameId!==sender.frameId)return false;
    const needsSave=record.frameId===null||record.expiresAt-Date.now()<PANEL_TTL/2;
    record.frameId=sender.frameId;
    if(needsSave){record.expiresAt=Date.now()+PANEL_TTL;await panelStorage.set({[PANEL_KEY]:records});}return true;
  }
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
  async function save(state,journal){await api.storage.local.set({[KEY]:state,...(journal?{[JOURNAL]:journal}:{})});}
  async function fingerprint(action){
    if(!action||typeof action!=='object')throw Error('Choose an action.');
    // Canonical JSON makes object-key order irrelevant. Retain a digest, never
    // hundreds of duplicated full task lists or private action bodies.
    const clean=JSON.parse(JSON.stringify(action));
    const stable=value=>value&&typeof value==='object'?(Array.isArray(value)?'['+value.map(stable).join(',')+']':'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stable(value[k])).join(',')+'}'):JSON.stringify(value);
    const encoded=stable(clean),bytes=typeof TextEncoder==='function'?new TextEncoder().encode(encoded):Uint8Array.from(unescape(encodeURIComponent(encoded)),c=>c.charCodeAt(0));
    const hash=await globalThis.crypto.subtle.digest('SHA-256',bytes);
    return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
  }
  async function requestJournal(){
    const data=await api.storage.local.get(JOURNAL),saved=data[JOURNAL];
    if(saved===undefined)return[];
    if(!Array.isArray(saved)||saved.some(r=>!r||typeof r.id!=='string'||typeof r.fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(r.fingerprint)))throw Error('The recent request journal is invalid. Your saved data has been kept.');
    return saved.slice(-200);
  }
  async function broadcast(state){
    // Full state is fetched by each authorized extension surface. A broadcast
    // itself must not disclose task data to an unapproved embedded frame.
    api.runtime.sendMessage({type:'STATE_CHANGED'}).catch(()=>{});
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
  async function getLayout(){
    const stored=(await api.storage.local.get(LAYOUT))[LAYOUT];
    return stored?.version===1?stored:{version:1,dock:null,panel:null};
  }
  async function releaseLease(){
    const old=lease;lease=null;
    if(old)await api.tabs.sendMessage(old.tabId,{type:'PET_REVOKED',leaseId:old.id}).catch(()=>{});
  }
  async function handler(request,sender){
    if(!request||typeof request.type!=='string')return undefined;
    if(request.type==='STATE_CHANGED')return undefined;
    if(request.type==='CALENDAR'){
      // Only the direct full app and sidebar may use the native host.
      const page=typeof sender?.url==='string'&&sender.url.split(/[?#]/,1)[0]===api.runtime.getURL('app.html');
      if(!page||(sender.frameId??0)!==0)return{ok:false,error:'Open the full Purrple app to use Calendar.'};
      if(!['status','connect','list','create','disconnect'].includes(request.operation))return{ok:false,error:'Unknown Calendar operation.'};
      if(['connect','list','create'].includes(request.operation)&&api.permissions){
        const available=await api.permissions.getAll();
        if(Array.isArray(available.data_collection)&&
           !['personalCommunications','personallyIdentifyingInfo'].every(type=>available.data_collection.includes(type))){
          return{ok:false,error:'Allow Calendar data from Settings first.',code:'permission'};
        }
      }
      const reply=await api.runtime.sendNativeMessage('purrple_calendar',{
        operation:request.operation,
        event:request.operation==='create'?request.event:undefined
      }).catch(()=>null);
      if(reply?.ok&&['connect','disconnect'].includes(request.operation)){
        await api.runtime.sendMessage({type:'CALENDAR_CHANGED'}).catch(()=>{});
      }
      return reply||{ok:false,error:'Calendar helper unavailable. Follow the setup guide and allow the helper in Firefox.'};
    }
    const ui=await isUI(sender);
    if(!ui&&!isContent(sender))return {ok:false,error:'This request is not from a Purrple surface.'};
    switch(request.type){
      case 'GET_STATE':{
        const state=await reconcileAndNotify(await load());return {ok:true,state:ui?state:Core.publicState(state),catalog:Core.CATALOG};
      }
      case 'ACTION':{
        if(!ui)throw Error('Open Purrple to change your plans or progress.');
        const token=request.requestId==null?null:request.requestId;
        if(token!==null&&(typeof token!=='string'||!token.length||token.length>120))throw Error('The request identifier is invalid. Please try again.');
        const journal=token?await requestJournal():null,digest=token?await fingerprint(request.action):null;
        const receipt=token?journal.find(r=>r.id===token):null;
        if(receipt){
          if(receipt.fingerprint!==digest)throw Error('This request identifier was already used for a different action. Please try again.');
          return{ok:true,state:await reconcileAndNotify(await load()),catalog:Core.CATALOG};
        }
        const previous=await load(),state=Core.reduce(previous,request.action);
        const nextJournal=token?[...journal,{id:token,fingerprint:digest,at:Date.now()}].slice(-200):null;
        // Commit the state and its compact receipt together. Replay safety must
        // survive an MV3 event-page restart, not only an in-memory cache.
        await save(state,nextJournal);await schedule(state);await broadcast(state);
        const response={ok:true,state,catalog:Core.CATALOG};
        return response;
      }
      case 'BACKUP_EXPORT':{
        if(!ui)throw Error('Open Purrple to export a backup.');
        return{ok:true,backup:{app:'Purrple',exportedAt:Date.now(),state:await reconcileAndNotify(await load())}};
      }
      case 'OPEN_APP':{
        const base=api.runtime.getURL('app.html'),requested=request.view??request.route;
        if(requested!==undefined&&requested!==null&&typeof requested!=='string')throw Error('Choose a Purrple page.');
        const route=typeof requested==='string'?requested.replace(/^#/,''):null;
        if(route!==null&&!['today','focus','wardrobe','talk','settings'].includes(route))throw Error('Choose a Purrple page.');
        const url=base+(route?'#'+route:'');
        const tabs=await api.tabs.query({});const existing=tabs.find(t=>t.url?.split('#')[0]===base);
        if(existing){await api.tabs.update(existing.id,{active:true,...(route?{url}:{})});await api.windows.update(existing.windowId,{focused:true});}
        else await api.tabs.create({url});return{ok:true};
      }
      case 'PET_CLAIM':{
        if(!await activeSender(sender))return{ok:true,active:false,leaseId:null};
        if(lease&&lease.tabId!==sender.tab.id)await releaseLease();
        if(!lease)lease={id:globalThis.crypto.randomUUID(),tabId:sender.tab.id};
        const stored=await api.storage.local.get(POSITION);
        return{ok:true,active:true,leaseId:lease.id,position:stored[POSITION]||{x:.82,y:1},layout:await getLayout()};
      }
      case 'PET_LAYOUT':{
        const ownsLease=isContent(sender)&&lease&&lease.id===request.leaseId&&lease.tabId===sender.tab.id&&await activeSender(sender);
        if((!ui||!request.reset)&&!ownsLease)throw Error('Move the companion from the active tab.');
        if(!['dock','panel'].includes(request.part))throw Error('Choose a companion control to move.');
        const layout=await getLayout();
        layout[request.part]=request.reset?null:position(request.position);
        await api.storage.local.set({[LAYOUT]:layout});
        if(ui&&lease)await api.tabs.sendMessage(lease.tabId,{type:'PET_LAYOUT_CHANGED',layout}).catch(()=>{});
        return{ok:true,layout};
      }
      case 'PET_AMBIENT':{
        if(!isContent(sender)||!lease||lease.id!==request.leaseId||lease.tabId!==sender.tab.id||!await activeSender(sender))return{ok:true};
        const state=await load(), Ambient=globalThis.PurrpleAmbient;
        const timing=Ambient?.timings(state.settings.chattiness);
        const now=Date.now();
        if(!timing||!state.settings.petEnabled||Core.quietNow(state.settings,now)||
           state.focus?.kind==='focus'&&state.focus.status==='running'&&state.focus.endsAt>now)return{ok:true};
        const old=(await panelStorage.get(AMBIENT))[AMBIENT];
        if(old&&now>=old.at&&now-old.at<timing.interval)return{ok:true};
        const index=old?((old.index+5)%Ambient.lines.length):0;
        await panelStorage.set({[AMBIENT]:{at:now,index}});
        return{ok:true,text:Ambient.lines[index]};
      }
      case 'PET_PANEL_OPEN':{
        if(!isContent(sender)||!await activeSender(sender)||lease?.id!==request.leaseId||lease.tabId!==sender.tab.id)throw Error('Open the companion in the active tab first.');
        const records=await panelCapabilities();
        for(const key of Object.keys(records))if(records[key].tabId===sender.tab.id)delete records[key];
        const token=globalThis.crypto.randomUUID();records[token]={tabId:sender.tab.id,frameId:null,expiresAt:Date.now()+PANEL_TTL};
        await panelStorage.set({[PANEL_KEY]:records});
        return{ok:true,token,url:api.runtime.getURL('popup.html')+'?panel=1&token='+encodeURIComponent(token)};
      }
      case 'PET_PANEL_CLOSE':{
        if(!isContent(sender))throw Error('This companion panel could not be identified.');
        const records=await panelCapabilities();if(records[request.token]?.tabId===sender.tab.id){delete records[request.token];await panelStorage.set({[PANEL_KEY]:records});}
        return{ok:true};
      }
      case 'PET_TALK':{
        if(!isContent(sender)||!await activeSender(sender))throw Error('Talk to Purrple from the active tab.');
        const state=Core.reduce(await load(),{type:'TALK_REPLY',promptId:request.promptId});await save(state);await broadcast(state);
        return{ok:true,state:Core.publicState(state)};
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
  function calendarRequest(request,sender){
    const next=calendarQueue.then(()=>handler(request,sender));
    calendarQueue=next.catch(()=>{});
    return next;
  }
  api.runtime.onMessage.addListener((request,sender)=>{
    if(['STATE_CHANGED','CALENDAR_CHANGED'].includes(request?.type))return undefined;
    const work=request?.type==='CALENDAR'?calendarRequest(request,sender):serial(()=>handler(request,sender));
    return work.catch(error=>({ok:false,error:String(error?.message||error)}));
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
