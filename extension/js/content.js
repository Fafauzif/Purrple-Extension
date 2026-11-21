/* Purrple's isolated webpage companion. No page text is inspected or stored. */
(() => {
  'use strict';
  if (window.top !== window || globalThis.__purrpleCompanion) return;
  const api = globalThis.browser?.runtime ? globalThis.browser : globalThis.chrome;
  const renderer = globalThis.PurrpleRenderer;
  const actionMenu = globalThis.PurrplePetMenu;
  if (!api?.runtime?.id || !renderer || !actionMenu) return;
  globalThis.__purrpleCompanion = true;

  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const finite=(n,f)=>Number.isFinite(n)?n:f;
  const host=document.createElement('purrple-companion');
  host.setAttribute('data-purrple','companion');
  for(const [key,value] of Object.entries({all:'initial',position:'fixed',inset:'0',width:'100%',height:'100%',display:'none',opacity:'0',overflow:'hidden','pointer-events':'none','z-index':'2147483646',contain:'strict',direction:'ltr'}))host.style.setProperty(key,value,'important');
  const root=host.attachShadow({mode:'closed'});
  const style=document.createElement('style');
  style.textContent=`
    :host{color-scheme:light;--paper:#f9efd5;--ink:#30212e;--rule:#a18887;--shade:#ecd8d5;--accent:#9a2b5a}
    :host([data-theme=night]){color-scheme:dark;--paper:#302436;--ink:#fff0d6;--rule:#a9869c;--shade:#49354c;--accent:#f193ab}*{box-sizing:border-box} [hidden]{display:none!important}
    .scene{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
    button{font:13px/1.35 system-ui,sans-serif;color:var(--ink);cursor:pointer;border:1px solid var(--rule);border-radius:6px;background:var(--paper);padding:8px 11px;box-shadow:none;letter-spacing:normal;text-transform:none}
    button:hover{background:var(--shade)}button:focus-visible{outline:2px solid var(--accent);outline-offset:3px}button:disabled{opacity:.55;cursor:default}
    .actor{position:absolute;background:transparent!important;border:0;padding:0;pointer-events:auto;touch-action:none;user-select:none;cursor:grab;border-radius:44%;-webkit-tap-highlight-color:transparent}
    .actor.held{cursor:grabbing}.actor:focus-visible{outline:2px dashed #9b70b4;outline-offset:1px}
    .house{position:absolute;right:13px;bottom:8px;pointer-events:auto;width:55px;height:54px;touch-action:none;user-select:none;cursor:grab;border:0;background:transparent!important;padding:0;color:#78538c;font-size:11px}
    .house.moving{cursor:grabbing}.house::after{content:"⋯";position:absolute;right:0;bottom:2px;background:#fffafd;border:1px solid #cdb6dd;border-radius:8px;line-height:12px;padding:0 4px}
    .house svg{display:block;width:55px;height:48px}.house .zz{position:absolute;right:1px;top:-12px;font-weight:700}
    .menu,.speech{position:absolute;pointer-events:auto;font:13px/1.5 system-ui,sans-serif;color:var(--ink);background:var(--paper);border:1px solid var(--rule);border-radius:7px;box-shadow:0 7px 26px #49305225;max-width:calc(100vw - 24px)}
    .menu{z-index:2;width:240px;padding:10px;max-height:calc(100vh - 24px);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#bca0ce #f8effb}
    .menu header{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 1px 8px;color:var(--ink)}.menu header strong{font-size:15px}
    .menu header button,.speech .dismiss{min-width:30px;min-height:30px;padding:0 6px;border:0;background:transparent;font-size:21px;line-height:1}
    .actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
    .actions button{min-width:0;min-height:34px;overflow-wrap:anywhere;text-align:left;font-weight:650;border-radius:10px}
    .actions .pet-back{color:var(--ink);background:var(--shade);border-color:transparent}
    .menu[data-level=home]{width:284px;height:216px;background:none;border:0;box-shadow:none;pointer-events:none;overflow:visible;padding:0}
    .menu[data-level=home] header{position:absolute;inset:0;display:grid;place-items:center;justify-content:stretch;margin:0;pointer-events:none}
    .menu[data-level=home] header strong{position:absolute;width:1px;height:1px;clip-path:inset(50%);overflow:hidden}
    .menu[data-level=home] header button{pointer-events:auto;border:1px solid var(--rule);border-radius:50%;background:var(--paper);color:var(--ink);min-width:36px;min-height:36px}
    .menu[data-level=home] .actions{position:absolute;inset:0;pointer-events:none}
    .menu[data-level=home] .actions button{position:absolute;left:var(--slot-x,50%);top:var(--slot-y,50%);translate:-50% -50%;min-width:82px;min-height:40px;padding:6px 12px;text-align:center;border-radius:22px;pointer-events:auto;background:var(--paper);color:var(--ink);border:1px solid var(--rule);box-shadow:0 2px 0 var(--rule),0 4px 12px #2111222b;transition:scale .15s cubic-bezier(.22,.73,.35,1),background-color .15s ease}
    .menu[data-level=home] .actions button:hover{background:var(--shade)}
    .menu[data-level=home] .actions button:active{scale:.94}
    :host([data-gentle=true]) .menu .actions button{transition:none;scale:1}
    @media (max-height:385px),(max-width:324px) {
      .menu[data-level=home]{width:256px;height:auto;padding:8px;overflow:auto;pointer-events:auto;background:var(--paper);border:1px solid var(--rule);border-radius:6px}
      .menu[data-level=home] header{position:static;display:flex;justify-content:flex-end;margin-bottom:5px}
      .menu[data-level=home] header button{min-height:25px;min-width:25px}
      .menu[data-level=home] .actions{position:static;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}
      .menu[data-level=home] .actions button{position:static;translate:none;min-width:0;min-height:33px;margin:0;box-shadow:none}
    }
    .pet-custom-focus{display:flex;gap:6px;align-items:end}.pet-custom-focus label{flex:1;min-width:0;font-size:12px;font-weight:650}.pet-custom-focus input{display:block;width:100%;min-height:34px;margin-top:4px;padding:4px 7px;border:1px solid #cdb6dd;border-radius:8px;color:#50365e;background:#fff;font:inherit}
    .pet-custom-focus input:focus-visible{outline:3px solid #9662b3;outline-offset:2px}
    .speech{z-index:3;width:250px;padding:13px 33px 13px 14px;max-height:calc(100vh - 24px);overflow:auto;overscroll-behavior:contain;overflow-wrap:anywhere}.speech p{margin:0}.speech .dismiss{position:absolute;right:3px;top:3px}
    .pet-followups{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}.pet-followups button{padding:5px 8px;min-height:29px;font-size:12px}
    .pet-announcement{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
    @media(max-width:265px){.actions{grid-template-columns:1fr}.actions button{min-height:32px}.menu,.speech{max-width:calc(100vw - 16px)}}
    .panel{position:absolute;z-index:1;pointer-events:auto;width:388px;height:540px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);background:var(--paper);border:1px solid var(--rule);border-radius:5px;box-shadow:0 12px 42px #49305235;overflow:hidden;display:flex;flex-direction:column;color:#50365e;font:13px/1.4 system-ui,sans-serif}
    .panel[data-view=gifts],.panel[data-view=room]{width:488px;height:590px}
    .panel[data-view=play]{width:500px;height:var(--game-height,400px);box-shadow:0 8px 35px #28203037}
    .panel[data-ready=true] .panel-bar{display:none}
    .panel[data-ready=true]{overflow:hidden}.panel-bar{display:flex;align-items:center;gap:5px;padding:7px 8px;background:var(--shade);flex:none;user-select:none;touch-action:none;cursor:move}.panel-bar strong{flex:1;padding-left:5px;font-size:12px}.panel-bar button{padding:2px 8px;font-size:14px;background:var(--paper)}.panel-bar button[aria-pressed=true]{background:#dcc6ee}
    .panel iframe{display:block;width:100%;min-height:0;flex:1;border:0;background:var(--paper)}.panel-status{padding:8px 10px;font-size:11px;background:var(--shade);color:var(--ink);flex:none}.panel-status button{font-size:11px;padding:3px 8px;margin-left:5px}
    @media(any-pointer:coarse){.menu .actions button,.menu header button,.speech button,.panel-bar button{min-height:44px;min-width:44px}}
    @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  `;
  const canvas=document.createElement('canvas');canvas.className='scene';canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d');
  const actor=document.createElement('button');actor.type='button';actor.className='actor';actor.setAttribute('aria-label','Purrple. Open actions or drag to pick her up.');actor.title='Purrple · click for actions, drag to pick her up';
  const house=document.createElement('button');house.type='button';house.className='house';house.setAttribute('aria-label','Send Purrple home');house.title='Click to send Purrple home or wake her. Drag or use the arrow keys to move the house.';house.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight ArrowUp ArrowDown Home');
  house.innerHTML='<svg viewBox="0 0 60 54" aria-hidden="true"><path d="M5 25 30 3l25 22" fill="#c1a4d6" stroke="#79598b" stroke-width="2" stroke-linejoin="round"/><path d="M11 24h38v28H11z" fill="#f2dfef" stroke="#9576a5" stroke-width="2"/><path d="M21 52V37a9 9 0 0 1 18 0v15" fill="#8a689f"/><circle cx="30" cy="18" r="4" fill="#fff1dc"/></svg><span class="zz" hidden>z z</span>';
  const menu=document.createElement('div');menu.className='menu';menu.hidden=true;
  const speech=document.createElement('div');speech.className='speech';speech.hidden=true;
  const panel=document.createElement('section');panel.className='panel';panel.hidden=true;panel.setAttribute('aria-label','Purrple dashboard');
  panel.innerHTML='<div class="panel-bar" tabindex="0" aria-label="Move dashboard with the arrow keys; press Home to reset"><strong>Purrple</strong><button type="button" class="panel-close" aria-label="Close dashboard">×</button></div><div class="panel-status" hidden><span role="status"></span><button type="button">Open full Purrple</button></div>';
  root.append(style,canvas,actor,house,menu,speech,panel);document.documentElement.append(host);

  let state={settings:{petEnabled:true,size:128,fps:30,reducedMotion:false,hiddenHosts:[],chattiness:'balanced'},equipped:{head:null,neck:null},focus:null};
  const instance=globalThis.crypto?.randomUUID?.()||('page-'+Date.now()+'-'+Math.random().toString(36).slice(2));
  let initialized=false,pageSuspended=false,assetExpiry=0,retry=0,retryDelay=100,lastCheckpoint='',firstPainted=false;
  let ready=false,loadPromise=null,lease='',claimPromise=null,claimVersion=0,raf=0,last=0,lastPaint=0,lastSaved=0,dpr=1,width=1,height=1,input=null,ignoreClickUntil=0;
  let mediaReduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let panelFrame=null,panelToken=null,panelPinned=false,panelDrag=null,panelX=20,panelY=20,panelOpened=0,panelReady=false,pendingNotice=null,returnFocus=actor,panelRoute='today';
  const ambient=globalThis.PurrpleAmbient;
  const ambientClock=ambient?.createClock();
  const siteContext=ambient?.siteContext(location.hostname);
  let siteGreetingSeen=false;
  let layout={version:1,dock:null,panel:null},dockDrag=null,dockClickUntil=0,layoutWrite=0,askingAmbient=false;
  const model={x:100,y:100,vx:0,vy:0,clip:'idle',state:'rest',time:0,remaining:0,rotation:0,facing:1,pendingFacing:1,nap:false,atHome:false,target:null,toy:null,ambient:0,ambientPlaying:false,idle:0,bounces:0,strongThrow:false,recovery:null};
  const durations={idle:3.6,blink:1.8,look:3.2,ear:2.2,tail:2.4,tilt:3,walk:1,run:.72,jump:1.65,land:1.25,sit:1.8,wake:2.8,held:2.4,wiggle:1.6,tumble:1.6,impact:1.35,shake:1.6,toy:1.8,sleep:4.2,stretch:3.2,yawn:2.8,groom:3,pat:3,study:3.6,think:3,read:4.2,reminder:2.8,heart:3.4,celebrate:1.8,brush:3};
  const petMenu=actionMenu.mount({
    menu,speech,actor,state:()=>state,companion:()=>state.companion,webpage:true,
    execute:petAction,onChange:positionUI,onReply:clip=>{model.nap=false;action(clip);},
    onOpen:()=>{pendingNotice=null;if(model.target?.wander||model.ambientPlaying)settle();}
  });
  const reduced=()=>mediaReduced||!!state.settings.reducedMotion;
  const duration=id=>renderer.clips?.find(c=>c.id===id)?.duration||({cry:1.25,'paw-wipe':.75,released:.12,turn:.6,soothe:1.2}[id])||durations[id]||2;
  const size=()=>renderer.characterSize?.(state.settings.size)??clamp(finite(Number(state.settings.size),128),64,256);
  function limits(){const s=size();return{left:Math.min(width/2,s*.46+5),right:Math.max(width/2,width-s*.46-5),top:Math.min(height/2,s*.95+5),floor:Math.max(height/2,height-12)};}
  function constrain(){const b=limits();model.x=clamp(finite(model.x,width*.82),b.left,b.right);model.y=clamp(finite(model.y,b.floor),b.top,b.floor);}
  function normalized(){const b=limits();return{x:b.right===b.left?.5:clamp((model.x-b.left)/(b.right-b.left),0,1),y:b.floor===b.top?1:clamp((model.y-b.top)/(b.floor-b.top),0,1)};}
  function place(p={x:.82,y:1}){const b=limits();model.x=b.left+clamp(finite(p.x,.82),0,1)*(b.right-b.left);model.y=b.top+clamp(finite(p.y,1),0,1)*(b.floor-b.top);constrain();}
  function enabled(){return state.settings.petEnabled!==false&&!state.settings.hiddenHosts?.includes(location.hostname);}
  function focusedDocument(){return !pageSuspended&&enabled()&&!document.hidden&&document.hasFocus();}
  function canAppear(){return initialized&&focusedDocument();}
  function active(){return canAppear()&&ready&&!!lease;}
  async function ensureReady(){
    if(ready)return true;
    if(!focusedDocument())return false;
    if(!loadPromise)loadPromise=renderer.preload().then(()=>{ready=true;host.dataset.ready='true';return true;}).catch(()=>false).finally(()=>{loadPromise=null;});
    return loadPromise;
  }
  async function send(message){try{return await api.runtime.sendMessage(message);}catch{return null;}}
  function checkpoint(){
    const position=normalized();
    position.y=1; // A new document receives a grounded companion, never a half-finished drag or throw.
    const pose=model.atHome?'home':model.nap?'sleep':focusWorking()?'study':'idle';
    return {position,pose,time:model.clip===pose?model.time%duration(pose):0};
  }
  function save(force=false){
    const now=Date.now();
    if(!lease||(!force&&now-lastSaved<320))return;
    const presence=checkpoint(),key=JSON.stringify([presence.position,presence.pose]);
    lastSaved=now;
    if(!force&&lastCheckpoint===key)return;
    lastCheckpoint=key;
    const current=lease;
    send({type:'PET_SAVE',leaseId:current,position:presence.position,presence}).then(result=>{
      if(lease===current&&result?.saved===false){releasePresence(false);scheduleClaim();}
    });
  }
  function stop(){cancelAnimationFrame(raf);raf=0;last=0;lastPaint=0;}
  function ensureCanvas(){const w=Math.ceil(width*dpr),h=Math.ceil(height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}}
  function show(){
    const visible=active();
    host.dataset.active=String(visible);
    host.style.setProperty('display',visible?'block':'none','important');
    if(visible){
      ensureCanvas();
      draw();
      if(!raf)raf=requestAnimationFrame(tick);
    }else stop();
  }
  function releasePresence(tellBackground=true){
    ambientClock?.pause();cancelDockDrag();claimVersion++;
    clearTimeout(retry);retry=0;
    const old=lease,presence=checkpoint();
    lease='';lastCheckpoint='';firstPainted=false;
    host.style.setProperty('opacity','0','important');
    if(old&&tellBackground)void send({type:'PET_RELEASE',leaseId:old,position:presence.position,presence});
    cancelDrag();closePanel(false);petMenu.close(false);stop();
    host.dataset.active='false';host.style.setProperty('display','none','important');
    // Keep a warm decoded frame for short tab switches, and reclaim inactive tabs later.
    const dropAssets=()=>{
      assetExpiry=0;
      if(lease||canAppear())return;
      renderer.clearCache?.();renderer.releaseAssets?.();ready=false;host.dataset.ready='false';
      canvas.width=canvas.height=1;
    };
    if(!enabled()){clearTimeout(assetExpiry);dropAssets();}
    else if(!assetExpiry)assetExpiry=setTimeout(dropAssets,30_000);
  }
  function scheduleClaim(){
    if(retry||lease||!canAppear())return;
    retry=setTimeout(()=>{retry=0;void claim();},retryDelay);
    retryDelay=Math.min(1200,retryDelay*2);
  }
  async function claim(){
    if(claimPromise||lease||!canAppear())return claimPromise;
    clearTimeout(retry);retry=0;
    clearTimeout(assetExpiry);assetExpiry=0;
    const version=claimVersion;
    claimPromise=(async()=>{
      // Claim and warm the sprite in parallel. A new tab needs both before it can paint.
      const [result,decoded]=await Promise.all([send({type:'PET_CLAIM',instance}),ensureReady()]);
      if(!result?.ok||!result.leaseId)return;
      if(version!==claimVersion||!canAppear()||!decoded){
        void send({type:'PET_RELEASE',leaseId:result.leaseId});return;
      }
      lease=result.leaseId;retryDelay=100;lastSaved=0;lastCheckpoint='';
      if(result.layout)layout=result.layout;
      const presence=result.presence;
      place(presence?.position||result.position);
      model.atHome=presence?.pose==='home';
      model.nap=model.atHome||presence?.pose==='sleep';
      model.vx=model.vy=model.rotation=0;model.target=null;model.toy=null;model.recovery=null;
      model.ambientPlaying=false;model.strongThrow=false;model.facing=1;model.idle=0;
      model.state=model.nap?'nap':'rest';
      model.clip=model.nap?'sleep':focusWorking()?'study':'idle';
      model.time=presence?.pose===model.clip&&Number.isFinite(presence.time)?presence.time%duration(model.clip):0;
      model.y=limits().floor;
      if(model.atHome)model.x=dockTarget();
      show();flushNotice();
    })().finally(()=>{
      claimPromise=null;
      if(!lease&&canAppear())scheduleClaim();
    });
    return claimPromise;
  }
  function settle(){const previous=model.clip;model.vx=model.vy=model.rotation=0;model.facing=1;model.ambientPlaying=false;model.target=null;model.remaining=0;model.recovery=null;model.strongThrow=false;model.idle=0;model.state=model.nap?'nap':'rest';model.clip=model.nap?'sleep':focusWorking()?'study':'idle';if(model.clip!==previous)model.time=0;model.y=limits().floor;save(true);flushNotice();}
  function focusWorking(){return state.focus?.kind==='focus'&&state.focus.status==='running'&&(state.focus.endsAt==null||state.focus.endsAt>Date.now());}
  function action(clip,seconds=duration(clip),internal=false){model.atHome=false;model.ambientPlaying=false;model.target=null;model.vx=model.vy=model.rotation=0;model.facing=1;model.time=0;model.idle=0;model.clip=clip;model.state='action';model.remaining=seconds;model.y=limits().floor;if(!internal){model.recovery=null;model.strongThrow=false;}}
  function travel(target){model.target=target;model.pendingFacing=target.x<model.x?-1:1;model.state=model.pendingFacing===model.facing?'walk':'turn';model.clip=model.state==='turn'?'turn':target.toy?'run':'walk';model.time=0;model.idle=0;model.remaining=duration('turn');}
  function safeForNotice(){return !['held','air'].includes(model.state)&&!model.recovery&&!['cry','paw-wipe'].includes(model.clip);}
  function notice(text,clip='reminder',open=false){pendingNotice={text,clip,open,expiresAt:Date.now()+60000};flushNotice();}
  function flushNotice(){
    if(!pendingNotice)return;
    if(pendingNotice.expiresAt<Date.now()){pendingNotice=null;return;}
    if(!safeForNotice()||!active()||quietHoursNow()||focusWorking()||petMenu.visible()||!panel.hidden)return;
    const next=pendingNotice;pendingNotice=null;action(next.clip);say(next.text,next.open);
  }
  function say(text,open=false){
    if(!active()||!menu.hidden)return;
    petMenu.present(text,open?[{id:'today',label:'Open Purrple',kind:'route'}]:[]);
  }
  function quietHoursNow(){const q=state.settings.quietHours;if(!q?.enabled)return false;const parse=value=>{const [h,m]=String(value||'00:00').split(':').map(Number);return h*60+m;},a=parse(q.start),b=parse(q.end),now=new Date(),n=now.getHours()*60+now.getMinutes();return a===b||(a<b?n>=a&&n<b:n>=a||n<b);}
  function ambientEligible(){
    return !document.fullscreenElement&&active()&&!quietHoursNow()&&!focusWorking()&&!model.nap&&!model.atHome&&
      !['held','air'].includes(model.state)&&!model.recovery&&!dockDrag&&!pendingNotice&&
      menu.hidden&&panel.hidden&&speech.hidden;
  }
  function ambientRemark(now){
    const contextual=state.settings.siteRemarks&&siteContext;
    const mode=contextual&&siteGreetingSeen?'quiet':state.settings.chattiness;
    if(!ambientClock?.update(mode,now,ambientEligible(),model.state==='rest')||askingAmbient)return;
    const current=lease, interaction=petMenu.revision();askingAmbient=true;
    send({type:'PET_AMBIENT',leaseId:current}).then(result=>{
      if(!result?.text||lease!==current||interaction!==petMenu.revision()||!ambientEligible())return;
      if(result.context){
        siteGreetingSeen=true;
        const label=result.context==='video'?'Watch quietly':'Sit quietly';
        petMenu.present(result.text,[{id:'sit-quietly',label,kind:'local'}]);
      }else say(result.text);
    }).finally(()=>{askingAmbient=false;});
  }
  async function openApp(view='today'){
    const result=await send({type:'OPEN_APP',view});
    if(!result?.ok)throw Error(result?.error||'Open Purrple using her toolbar button.');
  }
  function closePanel(restore=true){
    panelOpened++;panel.hidden=true;panelDrag=null;panelPinned=false;
    if(panelToken)send({type:'PET_PANEL_CLOSE',token:panelToken});
    panelToken=null;panelFrame?.remove();panelFrame=null;panelReady=false;
    if(restore&&lease&&!document.hidden){
      positionUI();
      (returnFocus?.hidden?house:returnFocus)?.focus({preventScroll:true});
    }
  }
  const panelTitles={today:'Today',calendar:'Agenda',focus:'Focus',play:'Play with Purrple',gifts:'Give a gift',room:'Purrple’s room',wardrobe:'Wardrobe',talk:'Talk'};
  async function openPanel(view='today',game=null,opener=actor){
    petMenu.close(false);
    if(!panel.hidden)closePanel(false);
    returnFocus=opener;
    const attempt=++panelOpened;
    const title=panelTitles[view]||'Purrple';
    panel.dataset.view=view;
    panel.dataset.ready='false';
    panel.style.removeProperty('--game-height');
    panelRoute=view==='play'?'companion-play'+(game?'-'+game:''):['gifts','room'].includes(view)?'companion-'+view:view;
    panel.setAttribute('aria-label',title);
    panel.querySelector('.panel-bar strong').textContent='Purrple';
    panel.hidden=false;panelReady=false;panel.querySelector('.panel-status').hidden=false;panel.querySelector('.panel-status span').textContent='Opening '+title+'…';
    if(model.state==='rest'||model.ambientPlaying||model.target?.wander)settle();
    restorePanel();
    const result=await send({type:'PET_PANEL_OPEN',leaseId:lease,view,game});
    if(attempt!==panelOpened||panel.hidden){if(result?.token)send({type:'PET_PANEL_CLOSE',token:result.token});return;}
    if(!result?.ok||!result.url){panel.querySelector('.panel-status span').textContent='This panel could not open. You can continue in Purrple.';return;}
    panelToken=result.token;
    panelFrame=document.createElement('iframe');panelFrame.title=title;panelFrame.src=result.url;panelFrame.referrerPolicy='no-referrer';panel.append(panelFrame);
    setTimeout(()=>{if(attempt===panelOpened&&!panel.hidden&&!panelReady)panel.querySelector('.panel-status span').textContent='This website may restrict embedded panels.';},4500);
  }
  function bounds(part){
    if(part==='dock')return{left:Math.min(13,Math.max(0,width-55)),top:Math.min(14,Math.max(0,height-54)),right:Math.max(0,width-68),bottom:Math.max(0,height-62)};
    return{left:12,top:12,right:Math.max(12,width-(panel.offsetWidth||Math.min(388,width-24))-12),bottom:Math.max(12,height-(panel.offsetHeight||Math.min(540,height-24))-12)};
  }
  function point(part,normalized){
    const box=bounds(part);
    return{x:box.left+(Math.max(box.left,box.right)-box.left)*normalized.x,y:box.top+(Math.max(box.top,box.bottom)-box.top)*normalized.y};
  }
  function normalizePart(part,x,y){
    const box=bounds(part);
    return{x:box.right>box.left?clamp((x-box.left)/(box.right-box.left),0,1):1,y:box.bottom>box.top?clamp((y-box.top)/(box.bottom-box.top),0,1):1};
  }
  function dockPoint(){
    return dockDrag?.preview||point('dock',layout.dock||{x:1,y:1});
  }
  function dockTarget(){
    const b=limits();
    return clamp(dockPoint().x+27.5,b.left,b.right);
  }
  function placedDock(){
    if(model.target?.home){model.target.x=dockTarget();model.pendingFacing=model.target.x<model.x?-1:1;}
    if(model.atHome)model.x=dockTarget();
    positionUI();
  }
  function restorePanel(){
    const w=panel.offsetWidth,h=panel.offsetHeight,s=size();
    const p=layout.panel?point('panel',layout.panel):{
      x:model.x>width/2?model.x-s*.46-w-12:model.x+s*.46+12,
      y:model.y-h
    };
    if(!layout.panel&&(p.x<12||p.x+w>width-12))p.x=(width-w)/2;
    panelX=p.x;panelY=p.y;positionPanel();
  }
  function positionPanel(){
    if(panel.hidden)return;
    const b=bounds('panel');
    panelX=clamp(panelX,b.left,b.right);panelY=clamp(panelY,b.top,b.bottom);
    panel.style.left=panelX+'px';panel.style.top=panelY+'px';
  }
  function commitLayout(part,position,reset=false){
    const old=layout,write=++layoutWrite,current=lease;
    layout={...layout,[part]:reset?null:position};
    if(part==='dock')placedDock();else restorePanel();
    send({type:'PET_LAYOUT',leaseId:current,part,position,reset}).then(result=>{
      if(write!==layoutWrite||lease!==current)return;
      if(result?.ok)return;
      layout=old;if(part==='dock')placedDock();else restorePanel();
      say('That position could not be saved. Try moving it again.');
    });
  }
  function snapDock(x,y){
    const b=bounds('dock'),p=normalizePart('dock',x,y);
    const nearest=Math.min(Math.abs(y-b.bottom),Math.abs(x-b.left),Math.abs(x-b.right));
    if(nearest===Math.abs(y-b.bottom))p.y=1;
    else p.x=Math.abs(x-b.left)<=Math.abs(x-b.right)?0:1;
    return p;
  }
  async function petAction(entry){
    if(entry.kind==='route'){
      const id=entry.id;
      if(id==='app-today'||id==='settings'||id==='talk'){await openApp(id==='app-today'?'today':id);return {restoreFocus:false};}
      if(id.startsWith('companion-play'))await openPanel('play',id.slice('companion-play'.length+1)||null);
      else await openPanel(id.replace(/^companion-/,''));
      return {restoreFocus:false};
    }
    if(entry.id==='sit-quietly'){siteGreetingSeen=true;settle();return;}
    if(entry.kind==='talk'){
      const result=await send({type:'PET_TALK',promptId:entry.promptId,leaseId:lease});
      if(!result?.ok)throw Error(result?.error||'Purrple lost her place. Try again.');
      const reply=result.reply||result.state?.talk?.last;
      if(!reply)throw Error('Purrple lost her place. Try again.');
      state.talk={last:reply};
      return {text:reply.text,reaction:reply.reaction};
    }
    if(entry.kind==='focus'){
      const result=await send({type:'PET_FOCUS',leaseId:lease,mode:entry.mode,minutes:entry.minutes});
      if(result?.state)state.focus=result.state.focus;
      if(!result?.ok&&result?.state?.focus)return {
        text:result.error,
        followups:[{id:'focus',label:'View active timer',kind:'route'}]
      };
      if(!result?.ok)throw Error(result?.error||'Open Focus from the toolbar to use the timer.');
      model.nap=false;
      return {text:entry.mode==='resume'?'Back to it. I kept your place.':state.focus?.kind==='break'?'Your break is still running.':'Notebook open. I’ll keep you company.',reaction:'study'};
    }
    if(entry.id==='hide'){
      const result=await send({type:'PET_HIDE_HOST',hidden:true});
      if(!result?.ok)throw Error(result?.error||'Open Settings to hide Purrple on this site.');
      releasePresence();return {restoreFocus:false};
    }
    if(entry.id==='move-house'||entry.id==='reset-house'){
      if(entry.id==='reset-house')commitLayout('dock',null,true);
      house.focus({preventScroll:true});return {restoreFocus:false};
    }
    if(['move-left','move-right','reset-pet'].includes(entry.id)){
      if(entry.id==='reset-pet')place();
      else model.x+=entry.id==='move-left'?-45:45;
      constrain();save(true);draw();return {stay:true};
    }
    if(entry.kind==='care'){
      model.recovery=null;model.strongThrow=false;
      return {text:'Prrr. A very good little head pat.',reaction:'pat'};
    }
    play(entry.id==='nap'&&model.nap?'wake':entry.id);
    return {restoreFocus:false};
  }
  function play(name){
    petMenu.close(false);
    const wasNap=model.nap,wasAtHome=model.atHome;model.nap=['pat','brush','nuzzle'].includes(name)?wasNap:false;model.atHome=false;model.toy=null;model.recovery=null;model.strongThrow=false;model.ambientPlaying=false;
    if(name==='pat'){action('pat');say('Prrr. A very good little head pat.');}
    else if(name==='brush'){action('brush');say('A little fluff maintenance.');}
    else if(name==='toy'){
      const b=limits(),target=model.x>width/2?b.left+(b.right-b.left)*.24:b.left+(b.right-b.left)*.76;
      if(reduced()){model.toy={x:model.x+size()*.17,y:b.floor-6,caught:true,until:Date.now()+2400};action('toy');}
      else{model.toy={x:target,y:b.floor-6,caught:false};travel({x:target,toy:true});}
    }else if(name==='jump'){
      if(reduced()){action('celebrate');return;}
      model.state='air';model.clip='jump';model.time=0;model.vx=0;model.vy=-Math.min(540,height*1.25);model.bounces=0;model.rotation=0;model.strongThrow=false;
    }else if(name==='home'){
      const target=dockTarget();
      if(reduced()){model.x=target;model.nap=true;model.atHome=true;settle();}
      else travel({x:target,home:true});
      house.focus({preventScroll:true});
    }else if(name==='nap'){model.nap=true;model.atHome=false;if(reduced())settle();else action('doze');say('Just resting the tiny paws.');}
    else if(name==='wake'){model.nap=false;model.atHome=false;if(wasAtHome){const b=limits(),x=dockTarget();model.x=clamp(x+(x>width/2?-1:1)*(size()*.55+27),b.left,b.right);}action('wake');if(wasAtHome)actor.focus({preventScroll:true});}
    else if(['roll','knead','wave','nuzzle','stretch','loaf','peek','listen'].includes(name)){action(name);}
    draw();
  }
  function advance(dt){
    model.time+=dt;
    if(model.state==='held'){if(model.clip==='held'&&model.time>1.4){model.clip='wiggle';model.time=0;}return;}
    if(model.state==='air'){
      if(reduced()){settle();return;}
      if(model.strongThrow&&model.clip==='released'&&model.time>.12){model.clip='tumble';model.time=0;}
      let remaining=dt;
      while(remaining>0){const h=Math.min(remaining,1/120);remaining-=h;const b=limits();
        model.vy+=1300*h;model.x+=model.vx*h;model.y+=model.vy*h;model.vx*=Math.exp(-.4*h);model.rotation+=model.vx*.006*h;
        if(model.x<b.left||model.x>b.right){model.x=clamp(model.x,b.left,b.right);model.vx*=-.32;}
        if(model.y<b.top){model.y=b.top;model.vy=Math.max(25,Math.abs(model.vy)*.18);}
        if(model.y>=b.floor&&model.vy>=0){model.y=b.floor;
          if(model.vy>270&&model.bounces<1){model.vy*=-.24;model.vx*=.48;model.bounces++;if(model.clip!=='tumble'){model.clip='tumble';model.time=0;}}
          else{const cry=model.strongThrow;action(cry?'impact':'land',cry?.7:duration('land'),true);model.recovery=cry?'cry':null;save(true);break;}
        }
      }
    }else if(model.state==='turn'&&model.target){
      model.remaining-=dt;if(model.remaining<=0){model.facing=model.pendingFacing;model.state='walk';model.clip=model.target.toy?'run':'walk';model.time=0;}
    }else if(model.state==='walk'&&model.target){
      const dx=model.target.x-model.x,gait=model.target.toy?'run':'walk';
      const stride=renderer.strideFor?.(gait,size()),cadence=renderer.durationFor?.(gait)||duration(gait);
      const v=clamp(Number.isFinite(stride)?stride/cadence:(model.target.toy?170:95)*size()/128,20,500);model.facing=dx<0?-1:1;
      if(reduced()||Math.abs(dx)<v*dt){
        const target=model.target;model.x=target.x;model.target=null;model.facing=1;
        if(target.home){model.nap=true;model.atHome=true;settle();}
        else if(target.wander){settle();}
        else{action('toy');model.toy={x:model.x+size()*.12,y:limits().floor-6,caught:true,until:Date.now()+2400};}
      }else model.x+=Math.sign(dx)*v*dt;
    }else if(model.state==='action'){
      model.remaining-=dt;if(model.remaining<=0){
        if(model.recovery==='cry'){action('cry',duration('cry'),true);model.recovery='wipe';}
        else if(model.recovery==='wipe'){action('paw-wipe',duration('paw-wipe'),true);model.recovery='soothe';}
        else if(model.recovery==='soothe'){action('soothe',duration('soothe'),true);model.recovery='settle';}
        else settle();
      }
    }else if(model.state==='nap')model.clip='sleep';
    else{
      const clip=focusWorking()?'study':'idle';
      if(model.clip!==clip){model.clip=clip;model.time=0;}
      model.idle+=dt;
      if(!reduced()&&!focusWorking()&&menu.hidden&&panel.hidden&&!(state.settings.siteRemarks&&siteContext)&&model.idle>18){
        const choices=['blink','ear','tail','look','listen','knead','loaf','peek','nuzzle','wander','tilt','groom','think'];const next=choices[model.ambient++%choices.length];
        if(next==='wander'){
          const b=limits();travel({x:clamp(model.x+(model.x>width/2?-80:80),b.left,b.right),wander:true});
        }else{action(next);model.ambientPlaying=true;}
      }
    }
    if(model.toy?.until&&Date.now()>model.toy.until)model.toy=null;
    constrain();
  }
  function positionUI(){
    host.dataset.state=model.state;host.dataset.clip=model.clip;host.dataset.atHome=String(model.atHome);host.dataset.x=model.x.toFixed(2);host.dataset.y=model.y.toFixed(2);
    const s=size();actor.style.left=(model.x-s*.43)+'px';actor.style.top=(model.y-s*.91)+'px';actor.style.width=(s*.86)+'px';actor.style.height=(s*.91)+'px';actor.hidden=model.atHome;
    host.dataset.gentle=String(reduced());
    host.dataset.theme=state.settings.theme||'light';
    const dock=dockPoint();house.style.right='auto';house.style.bottom='auto';house.style.left=dock.x+'px';house.style.top=dock.y+'px';
    house.querySelector('.zz').hidden=!model.atHome;house.setAttribute('aria-label',model.atHome?'Wake Purrple from her house':'Send Purrple home');
    positionPanel();
    const margin=width<265?8:12, petTop=model.y-s*.91, petRight=model.x+s*.43, petLeft=model.x-s*.43;
    function positionNear(element){
      if(element.hidden)return;
      const w=element.offsetWidth,h=element.offsetHeight,gap=8;
      const candidates=[[model.x-w/2,petTop-h-gap],[model.x-w/2,model.y+gap],
        [petRight+gap,model.y-h],[petLeft-w-gap,model.y-h]];
      const panelRight=panel.hidden?0:panelX+panel.offsetWidth;
      const panelBottom=panel.hidden?0:panelY+panel.offsetHeight;
      if(!panel.hidden)candidates.push([panelX-w-gap,model.y-h],[panelRight+gap,model.y-h],
        [model.x-w/2,panelY-h-gap],[model.x-w/2,panelBottom+gap]);
      let bestX=margin,bestY=margin,bestOverlap=Infinity;
      for(const [left,top] of candidates){
        const x=clamp(left,margin,Math.max(margin,width-w-margin));
        const y=clamp(top,margin,Math.max(margin,height-h-margin));
        const overlap=(l,t,r,b)=>Math.max(0,Math.min(r,x+w)-Math.max(l,x))*Math.max(0,Math.min(b,y+h)-Math.max(t,y));
        const score=2*overlap(petLeft,petTop,petRight,model.y)+
          (panel.hidden?0:overlap(panelX,panelY,panelRight,panelBottom));
        if(score<bestOverlap){bestX=x;bestY=y;bestOverlap=score;}
        if(score===0)break;
      }
      element.style.left=bestX+'px';
      element.style.top=bestY+'px';
    }
    positionNear(menu);positionNear(speech);
  }
  function drawYarn(toy){ctx.save();ctx.translate(toy.x,toy.y);ctx.fillStyle='#d8bee9';ctx.strokeStyle='#9e7bb6';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(0,0,9,8,0,0,Math.PI*2);ctx.fill();ctx.stroke();for(let x=-4;x<=4;x+=4){ctx.beginPath();ctx.ellipse(x,0,3,7,.45,0,Math.PI*2);ctx.stroke();}ctx.beginPath();ctx.moveTo(8,5);ctx.bezierCurveTo(20,14,20,-1,28,5);ctx.stroke();ctx.restore();}
  function draw(){
    if(!ready||!active())return;
    const pose={clip:model.clip,time:reduced()?0:model.time,size:size(),x:0,y:size()*.42,
      facing:model.facing,equipped:state.equipped||{head:null,neck:null},rootMotion:false,reducedMotion:reduced()};
    if(!model.atHome&&renderer.isDrawReady&&!renderer.isDrawReady(pose)){positionUI();return;}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    if(!model.atHome){
      const shadow=clamp(1-(limits().floor-model.y)/400,.15,1);ctx.save();ctx.globalAlpha=.10*shadow;ctx.fillStyle='#60416f';ctx.beginPath();ctx.ellipse(model.x,limits().floor+2,size()*.22*shadow,4,0,0,Math.PI*2);ctx.fill();ctx.restore();
      ctx.save();ctx.translate(model.x,model.y-size()*.42);ctx.rotate(model.rotation);
      renderer.draw(ctx,pose);ctx.restore();

    }
    if(model.toy)drawYarn(model.toy);
    if(!firstPainted){firstPainted=true;host.style.setProperty('opacity','1','important');}
    positionUI();
  }
  function tick(now){
    raf=0;if(!active()){show();return;}
    const dt=last?Math.min(.05,(now-last)/1000):0;last=now;advance(dt);ambientRemark(now);save();
    const fps=reduced()?8:clamp(finite(Number(state.settings.fps),30),24,60),interval=1000/fps;
    if(now-lastPaint>=interval-.25){draw();lastPaint=now-((now-lastPaint)%interval);}
    raf=requestAnimationFrame(tick);
  }
  function resize(){const p=normalized();width=Math.max(1,innerWidth);height=Math.max(1,innerHeight);dpr=Math.min(devicePixelRatio||1,2);if(active())ensureCanvas();else canvas.width=canvas.height=1;place(p);if(!panel.hidden&&!panelDrag)restorePanel();if(model.atHome||model.target?.home)placedDock();if(active())draw();}
  function pointerPoint(e){return{x:e.clientX,y:e.clientY};}
  actor.addEventListener('pointerdown',e=>{
    if(e.button!==0||!active())return;const p=pointerPoint(e);input={id:e.pointerId,start:p,last:p,stamp:e.timeStamp,dx:model.x-p.x,dy:model.y-p.y,vx:0,vy:0,moved:0,dragging:false};
    actor.setPointerCapture(e.pointerId);e.preventDefault();
  });
  actor.addEventListener('pointermove',e=>{
    if(!input||e.pointerId!==input.id)return;const p=pointerPoint(e),dt=Math.max(.008,(e.timeStamp-input.stamp)/1000);
    input.vx=.3*input.vx+.7*(p.x-input.last.x)/dt;input.vy=.3*input.vy+.7*(p.y-input.last.y)/dt;
    input.moved=Math.max(input.moved,Math.hypot(p.x-input.start.x,p.y-input.start.y));input.last=p;input.stamp=e.timeStamp;
    if(input.moved<6)return;
    if(!input.dragging){
      input.dragging=true;model.state='held';model.clip='held';model.time=0;
      model.rotation=0;model.facing=1;model.vx=model.vy=0;
      model.target=null;model.toy=null;model.recovery=null;model.strongThrow=false;
      actor.classList.add('held');petMenu.close(false);
    }
    model.x=p.x+input.dx;model.y=p.y+input.dy;constrain();draw();e.preventDefault();
  });
  function cancelDrag(){if(!input)return;const {id,dragging}=input;input=null;actor.classList.remove('held');if(dragging)settle();if(actor.hasPointerCapture(id))actor.releasePointerCapture(id);}
  actor.addEventListener('pointerup',e=>{
    if(!input||input.id!==e.pointerId)return;const held=input;input=null;actor.classList.remove('held');ignoreClickUntil=Date.now()+350;
    if(actor.hasPointerCapture(e.pointerId))actor.releasePointerCapture(e.pointerId);
    if(!held.dragging){petMenu.toggle(false);}
    else if(reduced()){settle();}
    else{const fresh=e.timeStamp-held.stamp<100;model.vx=clamp(fresh?held.vx*.55:0,-1250,1250);model.vy=clamp(fresh?held.vy*.55:0,-950,950);model.strongThrow=Math.hypot(model.vx,model.vy)>=420;model.state='air';model.clip=model.strongThrow?'released':'jump';model.time=0;model.rotation=0;model.bounces=0;model.recovery=null;}
    draw();e.preventDefault();
  });
  actor.addEventListener('pointercancel',cancelDrag);actor.addEventListener('lostpointercapture',()=>{if(input)cancelDrag();});
  actor.addEventListener('click',e=>{if(e.detail>0)return;if(Date.now()<ignoreClickUntil&&!e.isTrusted)return;petMenu.toggle();});
  house.addEventListener('click',event=>{if(event.detail&&Date.now()<dockClickUntil)return;play(model.atHome?'wake':'home');});
  house.addEventListener('pointerdown',event=>{
    if(event.button!==0||!active())return;
    const start=dockPoint();
    dockDrag={id:event.pointerId,x:event.clientX,y:event.clientY,start};
    house.setPointerCapture(event.pointerId);
  });
  house.addEventListener('pointermove',event=>{
    if(dockDrag?.id!==event.pointerId)return;
    const dx=event.clientX-dockDrag.x,dy=event.clientY-dockDrag.y;
    if(!dockDrag.preview&&Math.hypot(dx,dy)<6)return;
    house.classList.add('moving');
    dockDrag.preview=point('dock',normalizePart('dock',dockDrag.start.x+dx,dockDrag.start.y+dy));
    positionUI();
  });
  function cancelDockDrag(){
    if(!dockDrag)return;
    const id=dockDrag.id;dockDrag=null;house.classList.remove('moving');
    if(house.hasPointerCapture(id))house.releasePointerCapture(id);
    positionUI();
  }
  house.addEventListener('pointerup',event=>{
    if(dockDrag?.id!==event.pointerId)return;
    const p=dockDrag.preview;cancelDockDrag();
    if(p){dockClickUntil=Date.now()+350;commitLayout('dock',snapDock(p.x,p.y));}
  });
  house.addEventListener('pointercancel',cancelDockDrag);
  house.addEventListener('lostpointercapture',cancelDockDrag);
  house.addEventListener('keydown',event=>{
    const p=dockPoint(),box=bounds('dock'),key=event.key;
    if(key==='Home')commitLayout('dock',null,true);
    else if(key==='ArrowLeft'||key==='ArrowRight'){
      p.x+=key==='ArrowLeft'?-32:32;commitLayout('dock',snapDock(p.x,p.y));
    }else if(key==='ArrowUp'||key==='ArrowDown'){
      p.y+=key==='ArrowUp'?-32:32;
      p.x=p.x<width/2?box.left:box.right;commitLayout('dock',snapDock(p.x,p.y));
    }else return;
    event.preventDefault();
  });
  root.addEventListener('keydown',e=>{
    if(e.key!=='Escape'||e.isComposing)return;
    if(dockDrag){cancelDockDrag();dockClickUntil=Date.now()+350;e.preventDefault();e.stopPropagation();return;}
    if(input){cancelDrag();e.preventDefault();e.stopPropagation();return;}
    if(petMenu.escape(e))return;
    if(!panel.hidden){closePanel();e.preventDefault();e.stopPropagation();}
  });
  document.addEventListener('pointerdown',e=>{if(!e.composedPath().includes(host)){petMenu.close(false);if(!panelPinned&&!panel.hidden)closePanel(false);}},{passive:true});
  panel.querySelector('.panel-close').addEventListener('click',()=>closePanel());
  panel.querySelector('.panel-status button').addEventListener('click',()=>openApp(panelRoute).catch(error=>say(error.message)));
  const panelBar=panel.querySelector('.panel-bar');
  panelBar.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;panelDrag={id:e.pointerId,x:e.clientX,y:e.clientY,left:panelX,top:panelY};panelBar.setPointerCapture(e.pointerId);e.preventDefault();});
  panelBar.addEventListener('pointermove',e=>{if(!panelDrag||e.pointerId!==panelDrag.id)return;panelX=panelDrag.left+e.clientX-panelDrag.x;panelY=panelDrag.top+e.clientY-panelDrag.y;positionPanel();});
  const endPanelDrag=savePosition=>{
    if(!panelDrag)return;
    panelDrag=null;
    if(savePosition)commitLayout('panel',normalizePart('panel',panelX,panelY));
    else restorePanel();
  };
  panelBar.addEventListener('pointerup',()=>endPanelDrag(true));
  panelBar.addEventListener('pointercancel',()=>endPanelDrag(false));
  panelBar.addEventListener('lostpointercapture',()=>endPanelDrag(false));
  panelBar.addEventListener('keydown',event=>{
    if(event.target!==panelBar)return;
    const steps={ArrowLeft:[-24,0],ArrowRight:[24,0],ArrowUp:[0,-24],ArrowDown:[0,24]};
    if(event.key==='Home')commitLayout('panel',null,true);
    else if(Object.hasOwn(steps,event.key)){
      const [x,y]=steps[event.key];
      commitLayout('panel',normalizePart('panel',panelX+x,panelY+y));
    }else return;
    event.preventDefault();
  });
  const extensionOrigin=api.runtime.getURL('').replace(/\/$/,'');
  window.addEventListener('message',e=>{
    if(!panelFrame||e.source!==panelFrame.contentWindow||e.origin!==extensionOrigin||!e.isTrusted||e.data?.source!=='purrple-panel')return;
    const type=e.data.type;
    if(type==='CLOSE'){closePanel();return;}
    if(type==='READY'){panelReady=true;panel.dataset.ready='true';panel.querySelector('.panel-status').hidden=true;if(active()&&!petMenu.visible()&&root.activeElement!==panelFrame)panelFrame.focus({preventScroll:true});return;}
    if(type==='PIN'&&panel.dataset.view!=='play'&&typeof e.data.pinned==='boolean'){panelPinned=e.data.pinned;return;}
    if(type==='GAME'&&panel.dataset.view!=='play'&&(e.data.game===null||['paw-pairs','cozy-clues','lantern-paths','pocket-pong','three-paws'].includes(e.data.game))){
      openPanel('play',e.data.game);return;
    }
    if(type==='SIZE'&&panel.dataset.view==='play'&&Number.isFinite(e.data.height)){
      panel.style.setProperty('--game-height',clamp(Math.ceil(e.data.height),148,670)+'px');
      restorePanel();return;
    }
    if(type==='DRAG_START'){panelDrag={remote:true,x:Number(e.data.screenX)||0,y:Number(e.data.screenY)||0,left:panelX,top:panelY};}
    if(type==='DRAG_MOVE'&&panelDrag?.remote){panelX=panelDrag.left+(Number(e.data.screenX)||0)-panelDrag.x;panelY=panelDrag.top+(Number(e.data.screenY)||0)-panelDrag.y;positionPanel();}
    if(type==='DRAG_END'&&panelDrag?.remote)endPanelDrag(true);
    if(type==='DRAG_CANCEL'&&panelDrag?.remote)endPanelDrag(false);
  });
  window.addEventListener('resize',resize,{passive:true});
  window.addEventListener('focus',()=>claim());window.addEventListener('blur',()=>setTimeout(()=>{if(!document.hasFocus())releasePresence();},0));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)releasePresence();else claim();});
  window.addEventListener('pagehide',()=>{pageSuspended=true;releasePresence();});
  window.addEventListener('pageshow',event=>{if(event.persisted){pageSuspended=false;resize();void claim();}});
  document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement){petMenu.close(false);closePanel(false);}ambientClock?.pause();});
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{mediaReduced=e.matches;if(reduced()&&model.state==='air')settle();draw();});
  api.runtime.onMessage.addListener((message,sender,respond)=>{
    if(message?.type==='PET_LAYOUT_CHANGED'&&message.layout){
      layoutWrite++;layout=message.layout;
      if(Object.hasOwn(message,'position'))place(message.position||undefined);
      placedDock();if(!panel.hidden)restorePanel();return undefined;
    }
    if(message?.type==='PET_CHECKPOINT'){
      if((!sender?.id||sender.id===api.runtime.id)&&lease&&message.leaseId===lease)respond({presence:checkpoint()});
      return false;
    }
    if(message?.type==='PET_STATUS'){
      if(sender?.id&&sender.id!==api.runtime.id)return undefined;
      respond({active:active(),clip:model.clip,state:model.state,x:model.x,y:model.y,atHome:model.atHome});return false;
    }
    if(message?.type==='STATE_CHANGED'&&message.state){
      state=message.state;constrain();
      if(!enabled())releasePresence();
      else{if(focusWorking()&&(model.target?.wander||model.ambientPlaying))settle();claim();show();}
      petMenu.refresh();draw();
    }
    else if(message?.type==='PET_REVOKED'&&lease&&message.leaseId===lease){releasePresence(false);scheduleClaim();}
    else if(message?.type==='REMINDER_NOTICE')notice('A little reminder is waiting. Open your plans when you are ready.','reminder',true);
    else if(message?.type==='FOCUS_NOTICE')notice('A little progress, together. Your timer is ready.','celebrate',true);
  });
  // This page-level diagnostic exposes no personal records. It is useful for
  // native extension smoke tests without reading host-page content.
  globalThis.PurrpleCompanionDebug=Object.freeze({snapshot:()=>({mounted:true,ready,active:active(),lease:!!lease,state:model.state,clip:model.clip,x:model.x,y:model.y,atHome:model.atHome,size:size()}),play});
  (async()=>{
    void ensureReady();
    const response=await send({type:'GET_STATE'});if(response?.ok&&response.state)state=response.state;
    width=Math.max(1,innerWidth);height=Math.max(1,innerHeight);place();resize();initialized=true;await claim();
  })().catch(()=>{ready=false;releasePresence();});
  setInterval(()=>{if(!lease&&canAppear())void claim();},8000);
})();
