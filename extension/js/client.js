/* One local data client for the dashboard, sidebar and popup. */
(() => {
  'use strict';
  const api=globalThis.browser||globalThis.chrome;
  const native=!!api?.runtime?.id;
  const listeners=new Set();
  const key='purrple-local-preview-v1';
  let queue=Promise.resolve(),refreshing=false,refreshAgain=false;
  let panelWindowId;
  if(native&&api.sidePanel&&api.windows?.getCurrent)api.windows.getCurrent().then(window=>{panelWindowId=window.id;}).catch(()=>{});
  const emit=state=>listeners.forEach(fn=>fn(state));
  function readLocal(){
    const raw=localStorage.getItem(key);let previous;
    try{previous=raw?JSON.parse(raw):PurrpleCore.defaultState();}catch{previous=PurrpleCore.defaultState();}
    const state=PurrpleCore.reconcile(previous,Date.now());
    // The absolute end time owns a running timer. A display refresh should
    // not send storage events back and forth between preview tabs.
    const saved=state.focus?.status==='running'&&previous.focus?.id===state.focus.id
      ? {...state,focus:{...state.focus,remainingMs:previous.focus.remainingMs}} : state;
    const serialized=JSON.stringify(saved);
    if(serialized!==raw)localStorage.setItem(key,serialized);
    return state;
  }
  async function sendRequest(message){
    try{
      const result=await api.runtime.sendMessage(message);
      if(result!=null||message.type!=='ACTION')return result;
    }catch(error){
      if(message.type!=='ACTION')throw error;
    }
    // The first response can disappear after the action was saved. Reuse its
    // request ID so the serialized background journal can return current state.
    await new Promise(resolve=>setTimeout(resolve,75));
    return api.runtime.sendMessage(message);
  }
  async function request(message){
    if(native){const result=await sendRequest(message);if(!result?.ok)throw Error(result?.error||'Purrple could not save that change. Please try again.');return result.state;}
    return queue=queue.catch(()=>{}).then(()=>{
      let state=readLocal();
      if(message.type==='ACTION'){state=PurrpleCore.reduce(state,message.action,Date.now());localStorage.setItem(key,JSON.stringify(state));emit(state);}
      return state;
    });
  }
  async function refresh(){
    if(refreshing){refreshAgain=true;return;}refreshing=true;
    try{emit(await request({type:'GET_STATE'}));}catch(error){console.warn('Purrple refresh unavailable:',String(error?.message||error));}
    finally{refreshing=false;if(refreshAgain){refreshAgain=false;refresh();}}
  }
  if(native)api.runtime.onMessage.addListener(message=>{if(message?.type==='STATE_CHANGED')refresh();});
  else addEventListener('storage',event=>{if(event.key===key)emit(readLocal());});
  addEventListener('pageshow',event=>{if(event.persisted)refresh();});
  const action=action=>request({type:'ACTION',action:native?structuredClone(action):action,requestId:globalThis.crypto?.randomUUID?.()||('request_'+Date.now()+'_'+Math.random().toString(36).slice(2))});
  async function call(message) {
    const result=await api.runtime.sendMessage(message);
    if(!result?.ok)throw Error(result?.error||'Purrple could not complete that action. Try again.');
    return result;
  }
  async function openSidebar(){
    if(native){
      try{
        if(api.sidebarAction?.open){await api.sidebarAction.open();return;}
        if(api.sidePanel?.open&&Number.isInteger(panelWindowId)){
          await api.sidePanel.open({windowId:panelWindowId});return;
        }
      }catch{}
      return api.tabs.create({url:api.runtime.getURL('app.html?sidebar=1')});
    }
    return open('app.html?sidebar=1','_blank');
  }
  globalThis.PurrpleClient={native,get:()=>request({type:'GET_STATE'}),compact:()=>request({type:'GET_STATE'}),action,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},
    talk:promptId=>action({type:'TALK_REPLY',promptId}),favorite:(promptId,favorite)=>action({type:'TALK_FAVORITE',promptId,...(favorite===undefined?{}:{favorite})}),saveQuickDraft:(text,effort)=>action({type:'QUICK_TASK_DRAFT',text,...(effort===undefined?{}:{effort})}),
    openApp:async view=>{if(native){const result=await api.runtime.sendMessage({type:'OPEN_APP',...(view?{view}:{})});if(!result?.ok)throw Error(result?.error||'Purrple could not open that page.');return result;}return open('app.html'+(view?'#'+encodeURIComponent(view):''),'_blank');},
    openGame:async game=>{
      if(native&&parent!==window&&new URLSearchParams(location.search).get('panel')==='1'){
        parent.postMessage({source:'purrple-panel',type:'GAME',game:game||null},'*');
        return;
      }
      if(native)return call({type:'OPEN_GAME',...(game?{game}:{})});
      return open('game.html'+(game?'?game='+encodeURIComponent(game):''),'purrple-game','popup,width=550,height=620');
    },
    closeGame:()=>native?call({type:'CLOSE_GAME'}):Promise.resolve(window.close()),
    openSidebar,
    petReshow:()=>native?call({type:'PET_RESHOW_ACTIVE'}):Promise.reject(Error('Open Purrple from the toolbar.')),
    resetPosition:part=>call({type:'PET_LAYOUT',part,reset:true}),
    exportBackup:async()=>native?(await call({type:'BACKUP_EXPORT'})).backup:{format:'purrple-backup',version:PurrpleCore.VERSION,exportedAt:Date.now(),state:readLocal()},
    previewBackup:async backup=>{
      if(native)return (await call({type:'BACKUP_PREVIEW',backup})).summary;
      const state=PurrpleCore.validateBackup(backup);
      return {tasks:state.tasks.length,coins:state.wallet.balance,sessions:state.focusHistory.length,blocks:state.calendar?.blocks.length||0};
    },
    websitePermission:()=>native&&api.permissions?api.permissions.contains({origins:['http://*/*','https://*/*']}):Promise.resolve(true),
    requestWebsitePermission:()=>native&&api.permissions?api.permissions.request({origins:['http://*/*','https://*/*']}):Promise.resolve(false)};
})();
