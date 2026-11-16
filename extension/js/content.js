/* Purrple's isolated webpage companion. No page text is inspected or stored. */
(() => {
  'use strict';
  if (window.top !== window || globalThis.__purrpleCompanion) return;
  const api = globalThis.browser?.runtime ? globalThis.browser : globalThis.chrome;
  const renderer = globalThis.PurrpleRenderer;
  if (!api?.runtime?.id || !renderer) return;
  globalThis.__purrpleCompanion = true;

  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const finite=(n,f)=>Number.isFinite(n)?n:f;
  const host=document.createElement('purrple-companion');
  host.setAttribute('data-purrple','companion');
  for(const [key,value] of Object.entries({all:'initial',position:'fixed',inset:'0',width:'100%',height:'100%',display:'none',overflow:'hidden','pointer-events':'none','z-index':'2147483646',contain:'strict',direction:'ltr'}))host.style.setProperty(key,value,'important');
  const root=host.attachShadow({mode:'closed'});
  const style=document.createElement('style');
  style.textContent=`
    :host{color-scheme:light}*{box-sizing:border-box} [hidden]{display:none!important}
    .scene{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
    button{font:13px/1.35 system-ui,sans-serif;color:#50365e;cursor:pointer;border:1px solid #cdb6dd;border-radius:12px;background:#fffafd;padding:8px 11px;box-shadow:none;letter-spacing:normal;text-transform:none}
    button:hover{background:#eee0f8}button:focus-visible{outline:3px solid #9662b3;outline-offset:3px}button:disabled{opacity:.55;cursor:default}
    .actor{position:absolute;background:transparent!important;border:0;padding:0;pointer-events:auto;touch-action:none;user-select:none;cursor:grab;border-radius:44%;-webkit-tap-highlight-color:transparent}
    .actor.held{cursor:grabbing}.actor:focus-visible{outline:2px dashed #9b70b4;outline-offset:1px}
    .paw{position:absolute;pointer-events:auto;width:29px;height:29px;padding:0;border-radius:50%;font-size:16px;background:#fff8fd;box-shadow:0 3px 14px #65457620}
    .house{position:absolute;right:13px;bottom:8px;pointer-events:auto;width:55px;height:54px;touch-action:none;user-select:none;cursor:grab;border:0;background:transparent!important;padding:0;color:#78538c;font-size:11px}
    .house.moving{cursor:grabbing}.house::after{content:"⋯";position:absolute;right:0;bottom:2px;background:#fffafd;border:1px solid #cdb6dd;border-radius:8px;line-height:12px;padding:0 4px}
    .house svg{display:block;width:55px;height:48px}.house .zz{position:absolute;right:1px;top:-12px;font-weight:700}
    .menu,.speech{position:absolute;pointer-events:auto;font:13px/1.5 system-ui,sans-serif;color:#50365e;background:#fffafd;border:1px solid #decbe8;border-radius:17px;box-shadow:0 7px 26px #49305225;max-width:calc(100vw - 24px)}
    .menu{width:240px;padding:10px;max-height:calc(100vh - 24px);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#bca0ce #f8effb}
    .menu header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-weight:700}.menu header button{padding:1px 7px;border:0;background:transparent;font-size:20px}
    .actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}.actions .wide{grid-column:1/-1}.menu .more-toggle{width:100%;margin-top:6px;padding:5px;background:transparent;border-color:transparent;font-size:11px}.more-actions,.play-actions{display:grid;grid-template-columns:1fr 1fr;gap:6px;border-top:1px solid #ebdff1;padding-top:7px;margin-top:5px}.more-actions .wide{grid-column:1/-1}.menu footer{font-size:11px;color:#75607f;margin-top:7px;line-height:1.4}
    .speech{width:246px;padding:13px 30px 13px 14px}.speech p{margin:0}.speech .dismiss{position:absolute;right:5px;top:4px;padding:1px 6px;font-size:18px;background:transparent;border:0}.speech .open{margin-top:8px;padding:5px 9px;font-size:12px}
    .panel{position:absolute;pointer-events:auto;width:350px;height:520px;max-width:calc(100vw - 24px);max-height:calc(100vh - 24px);background:#fffafd;border:1px solid #d4bfe0;border-radius:18px;box-shadow:0 12px 42px #49305235;overflow:hidden;display:flex;flex-direction:column;color:#50365e;font:13px/1.4 system-ui,sans-serif}
    .panel-bar{display:flex;align-items:center;gap:5px;padding:7px 8px;background:#f0e5f7;flex:none;user-select:none;touch-action:none;cursor:move}.panel-bar strong{flex:1;padding-left:5px;font-size:12px}.panel-bar button{padding:2px 8px;font-size:14px;background:#fffafd}.panel-bar button[aria-pressed=true]{background:#dcc6ee}
    .panel iframe{display:block;width:100%;min-height:0;flex:1;border:0;background:#fffafd}.panel-status{padding:8px 10px;font-size:11px;background:#fff5e7;flex:none}.panel-status button{font-size:11px;padding:3px 8px;margin-left:5px}
    @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  `;
  const canvas=document.createElement('canvas');canvas.className='scene';canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d');
  const actor=document.createElement('button');actor.type='button';actor.className='actor';actor.setAttribute('aria-label','Purrple. Drag to pick her up, or open her play menu.');actor.title='Purrple · drag to pick up, click to play';
  const paw=document.createElement('button');paw.type='button';paw.className='paw';paw.textContent='✧';paw.setAttribute('aria-label','Open Purrple play menu');paw.title='Play with Purrple';
  const house=document.createElement('button');house.type='button';house.className='house';house.setAttribute('aria-label','Send Purrple home');house.title='Click to send Purrple home or wake her. Drag or use the arrow keys to move the house.';house.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight ArrowUp ArrowDown Home');
  house.innerHTML='<svg viewBox="0 0 60 54" aria-hidden="true"><path d="M5 25 30 3l25 22" fill="#c1a4d6" stroke="#79598b" stroke-width="2" stroke-linejoin="round"/><path d="M11 24h38v28H11z" fill="#f2dfef" stroke="#9576a5" stroke-width="2"/><path d="M21 52V37a9 9 0 0 1 18 0v15" fill="#8a689f"/><circle cx="30" cy="18" r="4" fill="#fff1dc"/></svg><span class="zz" hidden>z z</span>';
  const menu=document.createElement('div');menu.className='menu';menu.hidden=true;menu.setAttribute('role','group');menu.setAttribute('aria-label','Play with Purrple');
  menu.innerHTML='<header><span>A little company</span><button type="button" data-action="close" aria-label="Close play menu">×</button></header><div class="actions"><button type="button" data-action="pat">♡ Pet</button><button type="button" data-action="talk">Talk</button><button type="button" data-action="play" aria-expanded="false">Play</button><button type="button" data-action="dashboard">Dashboard</button></div><div class="play-actions" hidden><button type="button" data-action="toy">Yarn</button><button type="button" data-action="jump">Little hop</button><button type="button" data-action="roll">Roll</button><button type="button" data-action="knead">Knead</button><button type="button" data-action="wave">Wave</button><button type="button" data-action="nuzzle">Nuzzle</button><button type="button" data-action="stretch">Stretch</button><button type="button" data-action="loaf">Loaf</button></div><button type="button" class="more-toggle" data-action="more" aria-expanded="false">More ▾</button><div class="more-actions" hidden><button type="button" data-action="brush">Brush</button><button type="button" data-action="nap">Take a nap</button><button type="button" data-action="home">Go home</button><button type="button" data-action="jump">Little jump</button><button type="button" data-action="settings">Settings</button><button type="button" data-action="hide">Hide here</button><button type="button" data-action="move-house">Move house</button><button type="button" data-action="reset-house">Reset house</button></div><footer>Drag the house to move it. Use arrow keys when focused.</footer>';
  const speech=document.createElement('div');speech.className='speech';speech.hidden=true;speech.setAttribute('role','status');speech.setAttribute('aria-live','polite');
  speech.innerHTML='<button type="button" class="dismiss" aria-label="Dismiss Purrple message">×</button><p></p><button type="button" class="open" hidden>Open Purrple</button>';
  const panel=document.createElement('section');panel.className='panel';panel.hidden=true;panel.setAttribute('aria-label','Purrple dashboard');
  panel.innerHTML='<div class="panel-bar" tabindex="0" aria-label="Move dashboard with the arrow keys; press Home to reset"><strong>Purrple</strong><button type="button" class="pin" aria-label="Pin dashboard" aria-pressed="false" title="Keep open when clicking the page">⌖</button><button type="button" class="panel-close" aria-label="Close dashboard">×</button></div><div class="panel-status" hidden><span></span><button type="button">Open full Purrple</button></div>';
  root.append(style,canvas,actor,paw,house,menu,speech,panel);document.documentElement.append(host);

  let state={settings:{petEnabled:true,size:128,fps:30,reducedMotion:false,hiddenHosts:[],chattiness:'balanced'},equipped:{head:null,neck:null},focus:null};
  let ready=false,loadPromise=null,lease='',claimPromise=null,claimVersion=0,raf=0,last=0,lastPaint=0,lastSaved=0,bubbleUntil=0,dpr=1,width=1,height=1,input=null,ignoreClickUntil=0;
  let mediaReduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let panelFrame=null,panelToken=null,panelPinned=false,panelDrag=null,panelX=20,panelY=20,panelOpened=0,panelReady=false,lastTalkId=null,pendingNotice=null,returnFocus=actor;
  const ambientClock=globalThis.PurrpleAmbient?.createClock();
  let layout={version:1,dock:null,panel:null},dockDrag=null,dockClickUntil=0,layoutWrite=0,askingAmbient=false;
  const model={x:100,y:100,vx:0,vy:0,clip:'idle',state:'rest',time:0,remaining:0,rotation:0,facing:1,pendingFacing:1,nap:false,atHome:false,target:null,toy:null,ambient:0,ambientPlaying:false,idle:0,bounces:0,strongThrow:false,recovery:null};
  const durations={idle:3.6,blink:1.8,look:3.2,ear:2.2,tail:2.4,tilt:3,walk:1,run:.72,jump:1.65,land:1.25,sit:1.8,wake:2.8,held:2.4,wiggle:1.6,tumble:1.6,impact:1.35,shake:1.6,toy:1.8,sleep:4.2,stretch:3.2,yawn:2.8,groom:3,pat:3,study:3.6,think:3,read:4.2,reminder:2.8,heart:3.4,celebrate:1.8,brush:3};
  const reduced=()=>mediaReduced||!!state.settings.reducedMotion;
  const duration=id=>renderer.clips?.find(c=>c.id===id)?.duration||({cry:1.25,'paw-wipe':.75,released:.12,turn:.6,soothe:1.2}[id])||durations[id]||2;
  const size=()=>clamp(finite(Number(state.settings.size),128),64,240);
  function limits(){const s=size();return{left:Math.min(width/2,s*.46+5),right:Math.max(width/2,width-s*.46-5),top:Math.min(height/2,s*.95+5),floor:Math.max(height/2,height-12)};}
  function constrain(){const b=limits();model.x=clamp(finite(model.x,width*.82),b.left,b.right);model.y=clamp(finite(model.y,b.floor),b.top,b.floor);}
  function normalized(){const b=limits();return{x:b.right===b.left?.5:clamp((model.x-b.left)/(b.right-b.left),0,1),y:b.floor===b.top?1:clamp((model.y-b.top)/(b.floor-b.top),0,1)};}
  function place(p={x:.82,y:1}){const b=limits();model.x=b.left+clamp(finite(p.x,.82),0,1)*(b.right-b.left);model.y=b.top+clamp(finite(p.y,1),0,1)*(b.floor-b.top);constrain();}
  function enabled(){return state.settings.petEnabled!==false&&!state.settings.hiddenHosts?.includes(location.hostname);}
  function active(){return enabled()&&ready&&!!lease&&!document.hidden&&document.hasFocus();}
  async function ensureReady(){
    if(ready)return true;
    if(!enabled()||document.hidden||!document.hasFocus())return false;
    if(!loadPromise)loadPromise=renderer.preload().then(()=>{ready=true;host.dataset.ready='true';return true;}).catch(()=>{ready=false;return false;}).finally(()=>{loadPromise=null;});
    return loadPromise;
  }
  async function send(message){try{return await api.runtime.sendMessage(message);}catch{return null;}}
  function save(force=false){const now=Date.now();if(!lease||(!force&&now-lastSaved<1500))return;lastSaved=now;send({type:'PET_SAVE',leaseId:lease,position:normalized()});}
  function stop(){cancelAnimationFrame(raf);raf=0;last=0;lastPaint=0;}
  function ensureCanvas(){const w=Math.ceil(width*dpr),h=Math.ceil(height*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}}
  function show(){const visible=active();host.dataset.active=String(visible);host.style.setProperty('display',visible?'block':'none','important');if(visible){ensureCanvas();draw();if(!raf)raf=requestAnimationFrame(tick);}else stop();}
  function releasePresence(){ambientClock?.pause();cancelDockDrag();claimVersion++;const old=lease,position=normalized();if(['held','air'].includes(model.state))position.y=1;lease='';if(old)send({type:'PET_RELEASE',leaseId:old,position});cancelDrag();closePanel(false);menu.hidden=true;speech.hidden=true;stop();renderer.releaseAssets?.();renderer.clearCache?.();canvas.width=canvas.height=1;host.dataset.active='false';host.style.setProperty('display','none','important');}
  async function claim(){
    if(claimPromise||lease||!enabled()||document.hidden||!document.hasFocus())return claimPromise;
    if(!ready&&!await ensureReady())return;
    if(claimPromise||lease||!enabled()||document.hidden||!document.hasFocus())return claimPromise;
    const version=claimVersion;
    claimPromise=(async()=>{const result=await send({type:'PET_CLAIM'});if(!result?.ok||!result.leaseId)return;
      if(version!==claimVersion||document.hidden||!document.hasFocus()||!enabled()){send({type:'PET_RELEASE',leaseId:result.leaseId,position:normalized()});return;}
      lease=result.leaseId;if(result.layout)layout=result.layout;if(result.position)place(result.position);if(!['air','held'].includes(model.state))model.y=limits().floor;show();flushNotice();
    })().finally(()=>{claimPromise=null;if(version!==claimVersion&&!lease&&enabled()&&ready&&!document.hidden&&document.hasFocus())setTimeout(claim,120);});return claimPromise;
  }
  function settle(){model.vx=model.vy=model.rotation=0;model.facing=1;model.ambientPlaying=false;model.target=null;model.remaining=0;model.recovery=null;model.strongThrow=false;model.idle=0;model.time=0;model.state=model.nap?'nap':'rest';model.clip=model.nap?'sleep':focusWorking()?'study':'idle';model.y=limits().floor;save(true);flushNotice();}
  function focusWorking(){return state.focus?.kind==='focus'&&state.focus.status==='running'&&(state.focus.endsAt==null||state.focus.endsAt>Date.now());}
  function action(clip,seconds=duration(clip),internal=false){model.atHome=false;model.ambientPlaying=false;model.target=null;model.vx=model.vy=model.rotation=0;model.facing=1;model.time=0;model.idle=0;model.clip=clip;model.state='action';model.remaining=seconds;model.y=limits().floor;if(!internal){model.recovery=null;model.strongThrow=false;}}
  function travel(target){model.target=target;model.pendingFacing=target.x<model.x?-1:1;model.state=model.pendingFacing===model.facing?'walk':'turn';model.clip=model.state==='turn'?'turn':target.toy?'run':'walk';model.time=0;model.idle=0;model.remaining=duration('turn');}
  function safeForNotice(){return !['held','air'].includes(model.state)&&!model.recovery&&!['cry','paw-wipe'].includes(model.clip);}
  function notice(text,clip='reminder',open=false){pendingNotice={text,clip,open,expiresAt:Date.now()+60000};flushNotice();}
  function flushNotice(){if(!pendingNotice)return;if(pendingNotice.expiresAt<Date.now()){pendingNotice=null;return;}if(!safeForNotice()||!active())return;const next=pendingNotice;pendingNotice=null;action(next.clip);say(next.text,next.open);}
  function say(text,open=false){if(!active())return;speech.querySelector('p').textContent=text;speech.querySelector('.open').hidden=!open;speech.hidden=false;bubbleUntil=Date.now()+8000;positionUI();}
  function quietHoursNow(){const q=state.settings.quietHours;if(!q?.enabled)return false;const parse=value=>{const [h,m]=String(value||'00:00').split(':').map(Number);return h*60+m;},a=parse(q.start),b=parse(q.end),now=new Date(),n=now.getHours()*60+now.getMinutes();return a===b||(a<b?n>=a&&n<b:n>=a||n<b);}
  function ambientEligible(){
    return active()&&!quietHoursNow()&&!focusWorking()&&!model.nap&&!model.atHome&&
      !['held','air'].includes(model.state)&&!model.recovery&&!dockDrag&&!pendingNotice&&
      menu.hidden&&panel.hidden&&speech.hidden;
  }
  function ambientRemark(now){
    if(!ambientClock?.update(state.settings.chattiness,now,ambientEligible(),model.state==='rest')||askingAmbient)return;
    const current=lease;askingAmbient=true;
    send({type:'PET_AMBIENT',leaseId:current}).then(result=>{
      if(result?.text&&lease===current&&ambientEligible())say(result.text);
    }).finally(()=>{askingAmbient=false;});
  }
  async function openApp(){const result=await send({type:'OPEN_APP'});if(result?.ok===false)say('Open Purrple using her toolbar button.');}
  function closePanel(restore=true){panel.hidden=true;panelDrag=null;if(panelToken)send({type:'PET_PANEL_CLOSE',token:panelToken});panelToken=null;panelFrame?.remove();panelFrame=null;panelReady=false;if(restore&&active())returnFocus?.focus({preventScroll:true});}
  async function openPanel(view='dashboard'){
    menu.hidden=true;speech.hidden=true;returnFocus=actor;const attempt=++panelOpened;
    if(panelFrame)closePanel(false);
    panel.hidden=false;panelReady=false;panel.querySelector('.panel-status').hidden=false;panel.querySelector('.panel-status span').textContent='Opening Purrple…';
    restorePanel();
    const result=await send({type:'PET_PANEL_OPEN',leaseId:lease});
    if(attempt!==panelOpened||panel.hidden){if(result?.token)send({type:'PET_PANEL_CLOSE',token:result.token});return;}
    if(!result?.ok||!result.url){panel.querySelector('.panel-status span').textContent='This page cannot open the floating dashboard. Use the full view.';return;}
    const url=new URL(result.url);url.searchParams.set('view',view);panelToken=result.token;
    panelFrame=document.createElement('iframe');panelFrame.title=view==='talk'?'Talk with Purrple':'Purrple dashboard';panelFrame.src=url.href;panelFrame.referrerPolicy='no-referrer';panel.append(panelFrame);
    setTimeout(()=>{if(attempt===panelOpened&&!panel.hidden&&!panelReady)panel.querySelector('.panel-status span').textContent='Still opening? This website may restrict embedded panels.';},4500);
  }
  function bounds(part){
    if(part==='dock')return{left:Math.min(13,Math.max(0,width-55)),top:Math.min(14,Math.max(0,height-54)),right:Math.max(0,width-68),bottom:Math.max(0,height-62)};
    return{left:12,top:12,right:Math.max(12,width-(panel.offsetWidth||Math.min(350,width-24))-12),bottom:Math.max(12,height-(panel.offsetHeight||Math.min(520,height-24))-12)};
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
    const p=layout.panel?point('panel',layout.panel):{x:model.x-175,y:model.y-size()*.85-520};
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
  function play(name){
    if(name==='talk'||name==='dashboard'){openPanel(name==='talk'?'talk':'dashboard');return;}
    if(name==='play'){const box=menu.querySelector('.play-actions');box.hidden=!box.hidden;menu.querySelector('[data-action="play"]').setAttribute('aria-expanded',String(!box.hidden));menu.querySelector('.more-actions').hidden=true;menu.querySelector('.more-toggle').setAttribute('aria-expanded','false');positionUI();return;}
    if(name==='more'){const box=menu.querySelector('.more-actions');box.hidden=!box.hidden;menu.querySelector('.more-toggle').setAttribute('aria-expanded',String(!box.hidden));menu.querySelector('.play-actions').hidden=true;menu.querySelector('[data-action="play"]').setAttribute('aria-expanded','false');positionUI();return;}
    if(name==='move-house'){menu.hidden=true;house.focus({preventScroll:true});return;}
    if(name==='reset-house'){menu.hidden=true;commitLayout('dock',null,true);house.focus({preventScroll:true});return;}
    if(name==='settings'){menu.hidden=true;send({type:'OPEN_APP',view:'settings'});return;}
    if(name==='open'){menu.hidden=true;openApp();return;}
    if(name==='hide'){menu.hidden=true;send({type:'PET_HIDE_HOST',hidden:true}).then(r=>{if(r?.ok)releasePresence();else say('Open Settings to hide Purrple on this website.');});return;}
    if(name==='close'){menu.hidden=true;draw();return;}
    menu.hidden=true;speech.hidden=true;const wasNap=model.nap,wasAtHome=model.atHome;model.nap=['pat','brush','nuzzle'].includes(name)?wasNap:false;model.atHome=false;model.toy=null;model.recovery=null;model.strongThrow=false;model.ambientPlaying=false;
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
    if(model.state==='held'){if(model.time>1.4)model.clip='wiggle';return;}
    if(model.state==='air'){
      if(reduced()){settle();return;}
      if(model.strongThrow&&model.time>.12)model.clip='tumble';
      let remaining=dt;
      while(remaining>0){const h=Math.min(remaining,1/120);remaining-=h;const b=limits();
        model.vy+=1300*h;model.x+=model.vx*h;model.y+=model.vy*h;model.vx*=Math.exp(-.4*h);model.rotation+=model.vx*.006*h;
        if(model.x<b.left||model.x>b.right){model.x=clamp(model.x,b.left,b.right);model.vx*=-.32;}
        if(model.y<b.top){model.y=b.top;model.vy=Math.max(25,Math.abs(model.vy)*.18);}
        if(model.y>=b.floor&&model.vy>=0){model.y=b.floor;
          if(model.vy>270&&model.bounces<1){model.vy*=-.24;model.vx*=.48;model.bounces++;model.clip='tumble';}
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
      model.clip=focusWorking()?'study':'idle';model.idle+=dt;
      if(!reduced()&&!focusWorking()&&menu.hidden&&model.idle>18){
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
    const pawX=model.x+s*.30>width-82?model.x-s*.45-31:model.x+s*.30;
    paw.style.left=clamp(pawX,7,width-35)+'px';paw.style.top=clamp(model.y-s*.30,7,height-35)+'px';paw.hidden=model.atHome||!menu.hidden||model.state==='held';
    const dock=dockPoint();house.style.right='auto';house.style.bottom='auto';house.style.left=dock.x+'px';house.style.top=dock.y+'px';
    house.querySelector('.zz').hidden=!model.atHome;house.setAttribute('aria-label',model.atHome?'Wake Purrple from her house':'Send Purrple home');
    menu.querySelector('[data-action="nap"]').textContent=model.nap?'Wake up':'Take a nap';
    const mwidth=Math.min(240,width-24),mheight=menu.offsetHeight||178;
    menu.style.left=clamp(model.x-mwidth/2,12,Math.max(12,width-mwidth-12))+'px';
    menu.style.top=clamp(model.y-s*.9-mheight-8,12,Math.max(12,height-mheight-12))+'px';
    speech.style.left=clamp(model.x-123,12,Math.max(12,width-258))+'px';speech.style.top=clamp(model.y-s*.93-(speech.offsetHeight||90)-8,12,Math.max(12,height-(speech.offsetHeight||90)-12))+'px';
    positionPanel();
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
      if(model.clip==='brush'){
        const x=model.x+size()*.30,y=model.y-size()*.58+Math.sin(model.time*2)*4;ctx.save();ctx.translate(x,y);ctx.rotate(-.4);ctx.fillStyle='#a97ebf';ctx.fillRect(-6,-4,12,8);ctx.fillStyle='#d7b7e5';ctx.fillRect(5,-2,12,4);ctx.restore();
      }
    }
    if(model.toy)drawYarn(model.toy);
    if(!speech.hidden&&bubbleUntil<Date.now()&&!speech.matches(':focus-within'))speech.hidden=true;
    positionUI();
  }
  function tick(now){
    raf=0;if(!active()){show();return;}
    const dt=last?Math.min(.05,(now-last)/1000):0;last=now;advance(dt);ambientRemark(now);
    const fps=reduced()?8:clamp(finite(Number(state.settings.fps),30),24,60),interval=1000/fps;
    if(now-lastPaint>=interval-.25){draw();lastPaint=now-((now-lastPaint)%interval);}
    raf=requestAnimationFrame(tick);
  }
  function resize(){const p=normalized();width=Math.max(1,innerWidth);height=Math.max(1,innerHeight);dpr=Math.min(devicePixelRatio||1,2);if(active())ensureCanvas();else canvas.width=canvas.height=1;place(p);if(layout.panel&&!panelDrag)restorePanel();if(model.atHome||model.target?.home)placedDock();if(active())draw();}
  function pointerPoint(e){return{x:e.clientX,y:e.clientY};}
  actor.addEventListener('pointerdown',e=>{
    if(e.button!==0||!active())return;const p=pointerPoint(e);input={id:e.pointerId,start:p,last:p,stamp:e.timeStamp,dx:model.x-p.x,dy:model.y-p.y,vx:0,vy:0,moved:0};
    actor.setPointerCapture(e.pointerId);model.state='held';model.clip='held';model.time=0;model.rotation=0;model.facing=1;model.vx=model.vy=0;model.atHome=false;model.target=null;model.toy=null;model.recovery=null;model.strongThrow=false;actor.classList.add('held');menu.hidden=true;speech.hidden=true;e.preventDefault();
  });
  actor.addEventListener('pointermove',e=>{
    if(!input||e.pointerId!==input.id)return;const p=pointerPoint(e),dt=Math.max(.008,(e.timeStamp-input.stamp)/1000);
    input.vx=.3*input.vx+.7*(p.x-input.last.x)/dt;input.vy=.3*input.vy+.7*(p.y-input.last.y)/dt;
    input.moved=Math.max(input.moved,Math.hypot(p.x-input.start.x,p.y-input.start.y));input.last=p;input.stamp=e.timeStamp;
    model.x=p.x+input.dx;model.y=p.y+input.dy;constrain();draw();e.preventDefault();
  });
  function cancelDrag(){if(!input)return;const id=input.id;input=null;actor.classList.remove('held');model.vx=model.vy=model.rotation=0;model.y=limits().floor;settle();if(actor.hasPointerCapture(id))actor.releasePointerCapture(id);}
  actor.addEventListener('pointerup',e=>{
    if(!input||input.id!==e.pointerId)return;const held=input;input=null;actor.classList.remove('held');ignoreClickUntil=Date.now()+350;
    if(actor.hasPointerCapture(e.pointerId))actor.releasePointerCapture(e.pointerId);
    if(held.moved<5){settle();toggleMenu();}
    else if(reduced()){settle();}
    else{const fresh=e.timeStamp-held.stamp<100;model.vx=clamp(fresh?held.vx*.55:0,-1250,1250);model.vy=clamp(fresh?held.vy*.55:0,-950,950);model.strongThrow=Math.hypot(model.vx,model.vy)>=420;model.state='air';model.clip=model.strongThrow?'released':'jump';model.time=0;model.rotation=0;model.bounces=0;model.recovery=null;}
    draw();e.preventDefault();
  });
  actor.addEventListener('pointercancel',cancelDrag);actor.addEventListener('lostpointercapture',()=>{if(input)cancelDrag();});
  actor.addEventListener('click',e=>{if(Date.now()<ignoreClickUntil||e.detail>0)return;toggleMenu();});
  function toggleMenu(){speech.hidden=true;menu.hidden=!menu.hidden;menu.querySelector('.more-actions').hidden=true;menu.querySelector('.play-actions').hidden=true;menu.querySelector('[data-action="play"]').setAttribute('aria-expanded','false');menu.querySelector('.more-toggle').setAttribute('aria-expanded','false');positionUI();if(!menu.hidden){returnFocus=actor;menu.querySelector('[data-action="pat"]').focus();}else actor.focus({preventScroll:true});}
  paw.addEventListener('click',toggleMenu);
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
  menu.addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(!b)return;let name=b.dataset.action;if(name==='nap'&&model.nap)name='wake';play(name);if(name==='close')actor.focus();});
  speech.querySelector('.dismiss').addEventListener('click',()=>speech.hidden=true);speech.querySelector('.open').addEventListener('click',openApp);
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){if(dockDrag){cancelDockDrag();dockClickUntil=Date.now()+350;return;}menu.hidden=true;speech.hidden=true;if(!panel.hidden)closePanel();else actor.focus({preventScroll:true});e.stopPropagation();}});
  document.addEventListener('pointerdown',e=>{if(!e.composedPath().includes(host)){menu.hidden=true;if(!panelPinned)closePanel(false);}},{passive:true});
  panel.querySelector('.panel-close').addEventListener('click',()=>closePanel());
  panel.querySelector('.pin').addEventListener('click',e=>{panelPinned=!panelPinned;e.currentTarget.setAttribute('aria-pressed',String(panelPinned));});
  panel.querySelector('.panel-status button').addEventListener('click',openApp);
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
  window.addEventListener('message',e=>{
    if(!panelFrame||e.source!==panelFrame.contentWindow||e.origin!==new URL(api.runtime.getURL('')).origin||!e.isTrusted||e.data?.source!=='purrple-panel')return;
    const type=e.data.type;
    if(type==='CLOSE'){closePanel();return;}
    if(type==='READY'){panelReady=true;panel.querySelector('.panel-status').hidden=true;return;}
    if(type==='DRAG_START'){panelDrag={remote:true,x:Number(e.data.screenX)||0,y:Number(e.data.screenY)||0,left:panelX,top:panelY};}
    if(type==='DRAG_MOVE'&&panelDrag?.remote){panelX=panelDrag.left+(Number(e.data.screenX)||0)-panelDrag.x;panelY=panelDrag.top+(Number(e.data.screenY)||0)-panelDrag.y;positionPanel();}
    if(type==='DRAG_END'&&panelDrag?.remote)endPanelDrag(true);
  });
  window.addEventListener('resize',resize,{passive:true});
  window.addEventListener('focus',()=>claim());window.addEventListener('blur',()=>setTimeout(()=>{if(!document.hasFocus())releasePresence();},0));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)releasePresence();else claim();});
  window.addEventListener('pagehide',releasePresence);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{mediaReduced=e.matches;if(reduced()&&model.state==='air')settle();draw();});
  api.runtime.onMessage.addListener((message,sender)=>{
    if(message?.type==='PET_LAYOUT_CHANGED'&&message.layout){
      layoutWrite++;layout=message.layout;placedDock();if(!panel.hidden)restorePanel();return undefined;
    }
    if(message?.type==='PET_STATUS'){
      if(sender?.id&&sender.id!==api.runtime.id)return undefined;
      return Promise.resolve({active:active(),clip:model.clip,state:model.state,x:model.x,y:model.y,atHome:model.atHome});
    }
    if(message?.type==='STATE_CHANGED'&&message.state){state=message.state;constrain();if(!enabled())releasePresence();else{if(focusWorking()&&(model.target?.wander||model.ambientPlaying))settle();if(model.state==='rest')model.clip=focusWorking()?'study':'idle';claim();show();}const reply=state.talk?.last;if(reply?.id&&reply.id!==lastTalkId){lastTalkId=reply.id;if(Date.now()-reply.at<30000)notice(String(reply.text||'').slice(0,500),reply.reaction||'heart');}draw();}
    else if(message?.type==='PET_REVOKED'&&(!message.leaseId||message.leaseId===lease)){lease='';ambientClock?.pause();cancelDockDrag();cancelDrag();closePanel(false);menu.hidden=true;speech.hidden=true;renderer.releaseAssets?.();renderer.clearCache?.();canvas.width=canvas.height=1;show();if(!document.hidden&&document.hasFocus())setTimeout(claim,160);}
    else if(message?.type==='REMINDER_NOTICE')notice('A little reminder is waiting. Open your plans when you are ready.','reminder',true);
    else if(message?.type==='FOCUS_NOTICE')notice('A little progress, together. Your timer is ready.','celebrate',true);
  });
  // This page-level diagnostic exposes no personal records. It is useful for
  // native extension smoke tests without reading host-page content.
  globalThis.PurrpleCompanionDebug=Object.freeze({snapshot:()=>({mounted:true,ready,active:active(),lease:!!lease,state:model.state,clip:model.clip,x:model.x,y:model.y,atHome:model.atHome,size:size()}),play});
  (async()=>{
    const response=await send({type:'GET_STATE'});if(response?.ok&&response.state)state=response.state;lastTalkId=state.talk?.last?.id||null;
    width=Math.max(1,innerWidth);height=Math.max(1,innerHeight);place();resize();await claim();
  })().catch(()=>{ready=false;releasePresence();});
  setInterval(()=>{if(!lease)claim();else if(active())save();},8000);
})();
