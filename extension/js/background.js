/* Shared MV3 background. Core mutations are serialized before saving. */
(function () {
  'use strict';
  const api=globalThis.browser||globalThis.chrome,Core=globalThis.PurrpleCore;
  if(!api||!Core)return;
  const KEY='purrpleState',POSITION='purrplePosition',JOURNAL='purrpleRequestJournal';
  const LAYOUT='purrpleLayout', AMBIENT='purrpleAmbientReceipt', LEASE='purrpleActiveLease', SCENE='purrplePresence';
  const PANEL_KEY='purrplePanelCapabilities',PANEL_TTL=12*60*60*1000;
  const panelStorage=api.storage.session||api.storage.local;
  let queue=Promise.resolve(),calendarQueue=Promise.resolve(),lease=null,notificationRetryAt=0,scheduledAt=null;
  const extensionURL=api.runtime.getURL('');
  const games=globalThis.PurrpleCompanionDomain?.games || [];
  const appViews=new Set(['today','focus','wardrobe','talk','settings','calendar','companion','companion-room','companion-gifts','companion-play',...games.map(id=>'companion-play-'+id)]);
  const panelViews=new Set(['today','calendar','focus','talk','wardrobe','play','gifts','room']);
  async function panelCapabilities(){
    const data=await panelStorage.get(PANEL_KEY),now=Date.now(),records=data[PANEL_KEY]||{};
    for(const key of Object.keys(records))if(!records[key]||records[key].expiresAt<=now)delete records[key];
    return records;
  }
  async function isUI(sender){
    if(typeof sender?.url!=='string'||!sender.url.startsWith(extensionURL))return false;
    let url;try{url=new URL(sender.url);}catch{return false;}
    if(!['/app.html','/popup.html','/game.html'].includes(url.pathname))return false;
    const embedded=sender.tab&&Number.isInteger(sender.frameId)&&sender.frameId>0;
    if(url.searchParams.get('panel')!=='1')return !embedded;
    if(!embedded)return false;
    const token=url.searchParams.get('token'),records=await panelCapabilities(),record=records[token];
    if(!record||(record.page||'/popup.html')!==url.pathname||record.tabId!==sender.tab.id||record.frameId!==null&&record.frameId!==sender.frameId)return false;
    const needsSave=record.frameId===null||record.expiresAt-Date.now()<PANEL_TTL/2;
    record.frameId=sender.frameId;
    if(needsSave){record.expiresAt=Date.now()+PANEL_TTL;await panelStorage.set({[PANEL_KEY]:records});}return true;
  }
  const gameActions=new Set(['COMPANION_VISIT','COMPANION_GAME_START','COMPANION_GAME_MOVE']);
  function gameState(state){
    const {theme='light',reducedMotion,fps}=state.settings;
    return {companion:state.companion,equipped:state.equipped,settings:{theme,reducedMotion,fps}};
  }
  const isContent=sender=>!!sender?.tab&&sender.frameId===0&&/^https?:\/\//.test(sender.url||'');
  function serial(fn){const next=queue.then(fn,fn);queue=next.catch(()=>{});return next;}
  async function load(){
    const result=await api.storage.local.get(KEY);
    if(!result[KEY]){const fresh=Core.defaultState();await save(fresh);return fresh;}
    // Every persisted mutation originates in this versioned reducer. Do not
    // silently wipe a corrupted or future-version save.
    if(![1,Core.VERSION].includes(result[KEY].version))throw Error('This Purrple save needs a compatible version. Your data has been kept.');
    return result[KEY];
  }
  async function save(state,journal,placement){await api.storage.local.set({[KEY]:state,...(journal?{[JOURNAL]:journal}:{}),...placement});}
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
        const earned=last.coins??0;
        const delivered=await notify('purrple-session','A little moment with Purrple',focus?`Your focus session is complete.${earned?` +${earned} coin${earned===1?'':'s'}.`:''}`:'Your break is complete. Ready when you are.');
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
  async function restoreLease(){
    if(!lease&&api.storage.session)lease=(await api.storage.session.get(LEASE))[LEASE]||null;
    return lease;
  }
  async function setLease(value){
    lease=value;
    if(api.storage.session)await api.storage.session.set({[LEASE]:value});
  }
  async function ownsLease(sender,token){
    const current=await restoreLease();
    return !!current&&current.id===token&&current.tabId===sender?.tab?.id&&await activeSender(sender);
  }
  async function rememberPresence(input,fallback){
    if(!input&&!fallback)return;
    const at=position(input?.position||fallback);
    const pose=['idle','study','sleep','home'].includes(input?.pose)?input.pose:null;
    const time=Number.isFinite(input?.time)?Math.max(0,Math.min(60,input.time)):0;
    await api.storage.local.set({[POSITION]:at});
    if(pose)await panelStorage.set({[SCENE]:{position:at,pose,time}});
    else await panelStorage.set({[SCENE]:null});
  }
  async function handoff(old){
    let timeout;
    try{
      const reply=await Promise.race([
        api.tabs.sendMessage(old.tabId,{type:'PET_CHECKPOINT',leaseId:old.id},{frameId:0}),
        new Promise(resolve=>{timeout=setTimeout(resolve,70);})
      ]);
      if(reply?.presence)await rememberPresence(reply.presence);
    }catch{}finally{clearTimeout(timeout);}
  }
  async function releaseLease(capture=false){
    const old=await restoreLease();
    if(!old)return;
    if(capture)await handoff(old);
    await setLease(null);
    void api.tabs.sendMessage(old.tabId,{type:'PET_REVOKED',leaseId:old.id},{frameId:0}).catch(()=>{});
  }
  async function checkCurrentLease(){
    const current=await restoreLease();
    if(!current)return;
    try{
      const tab=await api.tabs.get(current.tabId),window=await api.windows.get(tab.windowId);
      if(tab.active&&window.focused)return;
    }catch{}
    await releaseLease(true);
  }
  function backupPlacement(backup){
    const placement=backup?.placement;
    if(placement===undefined)return undefined;
    if(!placement||typeof placement!=='object'||Array.isArray(placement))throw Error('The backup contains invalid companion positions.');
    const checked=value=>{
      if(value===null)return null;
      if(!value||!Number.isFinite(value.x)||!Number.isFinite(value.y)||value.x<0||value.x>1||value.y<0||value.y>1)throw Error('The backup contains invalid companion positions.');
      return position(value);
    };
    return {[POSITION]:checked(placement.pet),[LAYOUT]:{version:1,dock:checked(placement.dock),panel:checked(placement.panel)}};
  }
  async function handler(request,sender){
    if(!request||typeof request.type!=='string')return undefined;
    if(request.type==='STATE_CHANGED')return undefined;
    if(request.type==='CALENDAR'){
      // Only the direct full app and sidebar may use the native host.
      const page=typeof sender?.url==='string'&&sender.url.split(/[?#]/,1)[0]===api.runtime.getURL('app.html');
      if(!page||(sender.frameId??0)!==0)return{ok:false,error:'Open the full Purrple app to use Calendar.'};
      if(!globalThis.browser?.runtime?.sendNativeMessage||!extensionURL.startsWith('moz-extension:'))return{ok:false,error:'The optional Google helper is available in Firefox. Local Calendar works here.',code:'unsupported'};
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
    const gameUI=ui&&new URL(sender.url).pathname==='/game.html';
    if(gameUI&&request.type!=='GET_STATE'&&request.type!=='CLOSE_GAME'&&!(request.type==='ACTION'&&gameActions.has(request.action?.type))){
      return {ok:false,error:'Use Purrple’s planner for this action.'};
    }
    const visibleState=state=>gameUI?gameState(state):ui?state:Core.publicState(state);
    switch(request.type){
      case 'GET_STATE':{
        const state=await reconcileAndNotify(await load());return {ok:true,state:visibleState(state),catalog:Core.CATALOG};
      }
      case 'ACTION':{
        if(!ui)throw Error('Open Purrple to change your plans or progress.');
        const token=request.requestId==null?null:request.requestId;
        if(token!==null&&(typeof token!=='string'||!token.length||token.length>120))throw Error('The request identifier is invalid. Please try again.');
        const journal=token?await requestJournal():null,digest=token?await fingerprint(request.action):null;
        const receipt=token?journal.find(r=>r.id===token):null;
        if(receipt){
          if(receipt.fingerprint!==digest)throw Error('This request identifier was already used for a different action. Please try again.');
          return{ok:true,state:visibleState(await reconcileAndNotify(await load())),catalog:Core.CATALOG};
        }
        const placement=request.action?.type==='BACKUP_IMPORT'?backupPlacement(request.action.backup):undefined;
        const previous=await load(),state=Core.reduce(previous,request.action);
        const nextJournal=token?[...journal,{id:token,fingerprint:digest,at:Date.now()}].slice(-200):null;
        // Commit the state and its compact receipt together. Replay safety must
        // survive an MV3 event-page restart, not only an in-memory cache.
        await save(state,nextJournal,placement);await schedule(state);await broadcast(state);
        if(placement){await panelStorage.set({[SCENE]:null});const current=await restoreLease();if(current)await api.tabs.sendMessage(current.tabId,{type:'PET_LAYOUT_CHANGED',layout:placement[LAYOUT],position:placement[POSITION]}).catch(()=>{});}
        const response={ok:true,state:visibleState(state),catalog:Core.CATALOG};
        return response;
      }
      case 'BACKUP_EXPORT':{
        if(!ui)throw Error('Open Purrple to export a backup.');
        const state=await reconcileAndNotify(await load()),stored=await api.storage.local.get(POSITION),layout=await getLayout();
        return{ok:true,backup:{format:'purrple-backup',version:Core.VERSION,exportedAt:Date.now(),state,placement:{pet:stored[POSITION]||null,dock:layout.dock,panel:layout.panel}}};
      }
      case 'BACKUP_PREVIEW':{
        if(!ui)throw Error('Open Purrple to preview a backup.');
        backupPlacement(request.backup);
        const backup=Core.validateBackup(request.backup);
        return{ok:true,summary:{tasks:backup.tasks.length,coins:backup.wallet.balance,sessions:backup.focusHistory.length,blocks:backup.calendar?.blocks.length||0}};
      }
      case 'CLOSE_GAME':{
        if(!gameUI||!Number.isInteger(sender.tab?.id)||(sender.frameId??0)!==0)throw Error('Close the game from its own window.');
        await api.tabs.remove(sender.tab.id);
        return {ok:true};
      }
      case 'OPEN_GAME':{
        if(!ui)throw Error('Choose a game through Purrple.');
        const game=request.game??null;
        if(game!==null&&!games.includes(game))throw Error('Choose a Purrple game.');
        const url=new URL(api.runtime.getURL('game.html'));
        if(game)url.searchParams.set('game',game);
        await api.windows.create({url:url.href,type:'popup',width:550,height:620});
        return {ok:true};
      }
      case 'OPEN_APP':{
        const base=api.runtime.getURL('app.html'),requested=request.view??request.route;
        if(requested!==undefined&&requested!==null&&typeof requested!=='string')throw Error('Choose a Purrple page.');
        const route=typeof requested==='string'?requested.replace(/^#/,''):null;
        if(route!==null&&!appViews.has(route))throw Error('Choose a Purrple page.');
        const url=base+(route?'#'+route:'');
        const tabs=await api.tabs.query({});const existing=tabs.find(t=>t.url?.split('#')[0]===base);
        if(existing){await api.tabs.update(existing.id,{active:true,...(route?{url}:{})});await api.windows.update(existing.windowId,{focused:true});}
        else await api.tabs.create({url});return{ok:true};
      }
      case 'PET_CLAIM':{
        if(!await activeSender(sender))return{ok:true,active:false,leaseId:null};
        await restoreLease();
        const instance=sender.documentId||(typeof request.instance==='string'&&request.instance.length<=100?request.instance:null);
        if(lease&&lease.tabId===sender.tab.id&&(lease.instance??null)!==instance)await releaseLease(true);
        else if(lease&&lease.tabId!==sender.tab.id)await releaseLease(true);
        if(!await activeSender(sender))return{ok:true,active:false,leaseId:null};
        if(!lease)await setLease({id:globalThis.crypto.randomUUID(),tabId:sender.tab.id,instance});
        const [stored,scene,layout]=await Promise.all([api.storage.local.get(POSITION),panelStorage.get(SCENE),getLayout()]);
        return{ok:true,active:true,leaseId:lease.id,position:stored[POSITION]||{x:.82,y:1},presence:scene[SCENE]||null,layout};
      }
      case 'PET_LAYOUT':{
        const canMove=isContent(sender)&&await ownsLease(sender,request.leaseId);
        if((!ui||!request.reset)&&!canMove)throw Error('Move the companion from the active tab.');
        if(!['dock','panel','pet'].includes(request.part))throw Error('Choose a companion control to move.');
        const layout=await getLayout();
        if(request.part==='pet'){
          await api.storage.local.set({[POSITION]:request.reset?null:position(request.position)});
          await panelStorage.set({[SCENE]:null});
        }
        else{layout[request.part]=request.reset?null:position(request.position);await api.storage.local.set({[LAYOUT]:layout});}
        await restoreLease();
        if(ui&&lease)await api.tabs.sendMessage(lease.tabId,{type:'PET_LAYOUT_CHANGED',layout,...(request.part==='pet'?{position:{x:.82,y:1}}:{})}).catch(()=>{});
        return{ok:true,layout};
      }
      case 'PET_AMBIENT':{
        if(!isContent(sender)||!await ownsLease(sender,request.leaseId))return{ok:true};
        const state=await load(), Ambient=globalThis.PurrpleAmbient;
        const timing=Ambient?.timings(state.settings.chattiness);
        const now=Date.now();
        if(!timing||!state.settings.petEnabled||Core.quietNow(state.settings,now)||
           state.focus?.kind==='focus'&&state.focus.status==='running'&&state.focus.endsAt>now)return{ok:true};
        const old=(await panelStorage.get(AMBIENT))[AMBIENT];
        if(old&&now>=old.at&&now-old.at<timing.interval)return{ok:true};
        const hostname=new URL(sender.url).hostname;
        const context=state.settings.siteRemarks&&Ambient.siteContext(hostname);
        if(context){
          const remark=Ambient.contextRemark(hostname,old?.contexts?.[context],now);
          if(!remark)return{ok:true};
          const contexts={...old?.contexts,[context]:{at:now,index:remark.index}};
          await panelStorage.set({[AMBIENT]:{at:now,index:old?.index??-5,contexts}});
          return{ok:true,text:remark.text,context};
        }
        const index=old?((old.index+5)%Ambient.lines.length):0;
        await panelStorage.set({[AMBIENT]:{at:now,index,contexts:old?.contexts}});
        return{ok:true,text:Ambient.lines[index]};
      }
      case 'PET_PANEL_OPEN':{
        if(!isContent(sender)||!await ownsLease(sender,request.leaseId))throw Error('Open the companion in the active tab first.');
        const view=request.view??'today',game=request.game??null;
        if(!panelViews.has(view)||game!==null&&(view!=='play'||!games.includes(game)))throw Error('Choose a Purrple panel.');
        const records=await panelCapabilities();
        for(const key of Object.keys(records))if(records[key].tabId===sender.tab.id)delete records[key];
        const page=view==='play'?'/game.html':'/popup.html';
        const token=globalThis.crypto.randomUUID();
        records[token]={tabId:sender.tab.id,frameId:null,expiresAt:Date.now()+PANEL_TTL,page};
        await panelStorage.set({[PANEL_KEY]:records});
        const url=new URL(api.runtime.getURL(page.slice(1)));
        url.searchParams.set('panel','1');
        url.searchParams.set('token',token);
        if(view!=='play')url.searchParams.set('view',view);
        if(game)url.searchParams.set('game',game);
        return{ok:true,token,url:url.href};
      }
      case 'PET_PANEL_CLOSE':{
        if(!isContent(sender))throw Error('This companion panel could not be identified.');
        const records=await panelCapabilities();if(records[request.token]?.tabId===sender.tab.id){delete records[request.token];await panelStorage.set({[PANEL_KEY]:records});}
        return{ok:true};
      }
      case 'PET_TALK':{
        if(!isContent(sender)||!await ownsLease(sender,request.leaseId))throw Error('Talk to Purrple from the active tab.');
        const state=Core.reduce(await load(),{type:'TALK_REPLY',promptId:request.promptId});await save(state);await broadcast(state);
        const projection=Core.publicState(state,true);
        return{ok:true,reply:projection.talk.last,state:projection};
      }
      case 'PET_FOCUS':{
        if(!isContent(sender)||!await ownsLease(sender,request.leaseId))throw Error('Start focus from Purrple on the active tab.');
        if(!['start','resume'].includes(request.mode))throw Error('Choose how to use your timer.');
        const state=await reconcileAndNotify(await load());
        if(request.mode==='start'&&state.focus)return{ok:false,error:'A timer is already active.',state:Core.publicState(state)};
        if(request.mode==='resume'&&state.focus?.status!=='paused')return{ok:false,error:'There is no paused timer to resume.',state:Core.publicState(state)};
        const next=Core.reduce(state,request.mode==='resume'?{type:'FOCUS_RESUME'}:{type:'FOCUS_START',minutes:request.minutes});
        await save(next);await schedule(next);await broadcast(next);
        return{ok:true,state:Core.publicState(next)};
      }
      case 'PET_SAVE':{
        await restoreLease();
        if(!isContent(sender)||lease?.id!==request.leaseId||lease.tabId!==sender.tab.id)return{ok:true,saved:false};
        await rememberPresence(request.presence,request.position);return{ok:true,saved:true};
      }
      case 'PET_RELEASE':{
        await restoreLease();
        if(!isContent(sender)||lease?.id!==request.leaseId||lease.tabId!==sender.tab.id)return{ok:true,released:false};
        await rememberPresence(request.presence,request.position);await setLease(null);return{ok:true,released:true};
      }
      case 'PET_HIDE_HOST':{
        if(!isContent(sender))throw Error('This site could not be identified.');
        const host=new URL(sender.url).hostname,state=await load(),hosts=new Set(state.settings.hiddenHosts);
        if(request.hidden!==false)hosts.add(host);else hosts.delete(host);
        const next=Core.reduce(state,{type:'SETTINGS',patch:{hiddenHosts:[...hosts]}});await save(next);await broadcast(next);return{ok:true,state:Core.publicState(next)};
      }
      case 'PET_RESHOW_ACTIVE':{
        if(!ui)throw Error('Use the toolbar to show Purrple again.');
        const [tab]=await api.tabs.query({active:true,lastFocusedWindow:true});
        if(!/^https?:\/\//.test(tab?.url||''))throw Error('Open an ordinary webpage to show Purrple there.');
        const state=await load(),hostname=new URL(tab.url).hostname;
        const next=Core.reduce(state,{type:'SETTINGS',patch:{petEnabled:true,hiddenHosts:state.settings.hiddenHosts.filter(host=>host!==hostname)}});
        await save(next);await broadcast(next);return{ok:true,state:next};
      }
      default:return undefined;
    }
  }
  function calendarRequest(request,sender){
    const next=calendarQueue.then(()=>handler(request,sender));
    calendarQueue=next.catch(()=>{});
    return next;
  }
  api.runtime.onMessage.addListener((request,sender,sendResponse)=>{
    if(['STATE_CHANGED','CALENDAR_CHANGED'].includes(request?.type))return undefined;
    const work=request?.type==='CALENDAR'?calendarRequest(request,sender):serial(()=>handler(request,sender));
    const response=work.catch(error=>({ok:false,error:String(error?.message||error)}));
    if(typeof sendResponse!=='function')return response;
    response.then(sendResponse);
    return true;
  });
  api.alarms.onAlarm.addListener(alarm=>{if(['purrple-next','purrple-heartbeat'].includes(alarm.name))serial(async()=>reconcileAndNotify(await load())).catch(console.error);});
  // Avoid passing a Promise to the pure reconciliation path.
  const catchup=()=>serial(async()=>reconcileAndNotify(await load())).catch(console.error);
  api.runtime.onStartup.addListener(catchup);
  api.runtime.onInstalled.addListener(async()=>{api.alarms.create('purrple-heartbeat',{periodInMinutes:1});await catchup();});
  api.notifications.onClicked.addListener(id=>{if(id.startsWith('purrple-'))api.tabs.create({url:api.runtime.getURL('app.html')});});
  api.tabs.onActivated.addListener(()=>serial(checkCurrentLease).catch(()=>{}));
  api.windows.onFocusChanged.addListener(()=>serial(checkCurrentLease).catch(()=>{}));
  api.tabs.onRemoved.addListener(tabId=>serial(async()=>{const current=await restoreLease();if(current?.tabId===tabId)await setLease(null);}).catch(()=>{}));
  api.alarms.create('purrple-heartbeat',{periodInMinutes:1});
  catchup();
})();
