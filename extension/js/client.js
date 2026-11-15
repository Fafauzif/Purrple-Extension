/* One local data client for the dashboard, sidebar and popup. */
(() => {
  'use strict';
  const api=globalThis.browser;
  const native=!!api?.runtime?.id;
  const listeners=new Set();
  const key='purrple-local-preview-v1';
  let queue=Promise.resolve();
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
  if(native)api.runtime.onMessage.addListener(message=>{if(message?.type==='STATE_CHANGED'&&message.state)emit(message.state);});
  else addEventListener('storage',event=>{if(event.key===key)emit(readLocal());});
  globalThis.PurrpleClient={native,get:()=>request({type:'GET_STATE'}),action:action=>request({type:'ACTION',action}),subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},
    openApp:()=>native?api.tabs.create({url:api.runtime.getURL('app.html')}):Promise.resolve(open('app.html','_blank')),
    openSidebar:()=>native&&api.sidebarAction?api.sidebarAction.open():Promise.resolve(open('app.html?sidebar=1','_blank')),
    websitePermission:()=>native&&api.permissions?api.permissions.contains({origins:['http://*/*','https://*/*']}):Promise.resolve(true),
    requestWebsitePermission:()=>native&&api.permissions?api.permissions.request({origins:['http://*/*','https://*/*']}):Promise.resolve(false)};
})();
