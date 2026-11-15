/* One local data client for the dashboard, sidebar and popup. */
(() => {
  'use strict';
  const api=globalThis.browser;
  const native=!!api?.runtime?.id;
  const listeners=new Set();
  const key='purrple-local-preview-v1';
  let queue=Promise.resolve(),refreshing=false,refreshAgain=false;
  const emit=state=>listeners.forEach(fn=>fn(state));
  function readLocal(){
    const raw=localStorage.getItem(key);let state;
    try{state=raw?JSON.parse(raw):PurrpleCore.defaultState();}catch{state=PurrpleCore.defaultState();}
    state=PurrpleCore.reconcile(state,Date.now());localStorage.setItem(key,JSON.stringify(state));return state;
  }
  async function request(message){
    if(native){const result=await api.runtime.sendMessage(message);if(!result?.ok)throw Error(result?.error||'Purrple could not save that change. Please try again.');return result.state;}
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
  const action=action=>request({type:'ACTION',action,requestId:globalThis.crypto?.randomUUID?.()||('request_'+Date.now()+'_'+Math.random().toString(36).slice(2))});
  globalThis.PurrpleClient={native,get:()=>request({type:'GET_STATE'}),compact:()=>request({type:'GET_STATE'}),action,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},
    talk:promptId=>action({type:'TALK_REPLY',promptId}),favorite:(promptId,favorite)=>action({type:'TALK_FAVORITE',promptId,...(favorite===undefined?{}:{favorite})}),saveQuickDraft:(text,effort)=>action({type:'QUICK_TASK_DRAFT',text,...(effort===undefined?{}:{effort})}),
    openApp:async view=>{if(native){const result=await api.runtime.sendMessage({type:'OPEN_APP',...(view?{view}:{})});if(!result?.ok)throw Error(result?.error||'Purrple could not open that page.');return result;}return open('app.html'+(view?'#'+encodeURIComponent(view):''),'_blank');},
    openSidebar:()=>native&&api.sidebarAction?api.sidebarAction.open():Promise.resolve(open('app.html?sidebar=1','_blank')),
    websitePermission:()=>native&&api.permissions?api.permissions.contains({origins:['http://*/*','https://*/*']}):Promise.resolve(true),
    requestWebsitePermission:()=>native&&api.permissions?api.permissions.request({origins:['http://*/*','https://*/*']}):Promise.resolve(false)};
})();
