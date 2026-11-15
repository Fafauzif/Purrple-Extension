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
  const root=host.attachShadow({mode:'open'});
  const style=document.createElement('style');
  style.textContent=`
    :host{color-scheme:light}*{box-sizing:border-box} [hidden]{display:none!important}
    .scene{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
    button{font:13px/1.35 system-ui,sans-serif;color:#50365e;cursor:pointer;border:1px solid #cdb6dd;border-radius:12px;background:#fffafd;padding:8px 11px;box-shadow:none;letter-spacing:normal;text-transform:none}
    button:hover{background:#eee0f8}button:focus-visible{outline:3px solid #9662b3;outline-offset:3px}button:disabled{opacity:.55;cursor:default}
    .actor{position:absolute;background:transparent!important;border:0;padding:0;pointer-events:auto;touch-action:none;user-select:none;cursor:grab;border-radius:44%;-webkit-tap-highlight-color:transparent}
    .actor.held{cursor:grabbing}.actor:focus-visible{outline:2px dashed #9b70b4;outline-offset:1px}
    .paw{position:absolute;pointer-events:auto;width:29px;height:29px;padding:0;border-radius:50%;font-size:16px;background:#fff8fd;box-shadow:0 3px 14px #65457620}
    .house{position:absolute;right:13px;bottom:8px;pointer-events:auto;width:55px;height:54px;border:0;background:transparent!important;padding:0;color:#78538c;font-size:11px}
    .house svg{display:block;width:55px;height:48px}.house .zz{position:absolute;right:1px;top:-12px;font-weight:700}
    .menu,.speech{position:absolute;pointer-events:auto;font:13px/1.5 system-ui,sans-serif;color:#50365e;background:#fffafd;border:1px solid #decbe8;border-radius:17px;box-shadow:0 7px 26px #49305225;max-width:calc(100vw - 24px)}
    .menu{width:258px;padding:12px;max-height:calc(100vh - 24px);overflow:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#bca0ce #f8effb}
    .menu header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-weight:700}.menu header button{padding:1px 7px;border:0;background:transparent;font-size:20px}
    .actions{display:grid;grid-template-columns:1fr 1fr;gap:6px}.actions .wide{grid-column:1/-1}.menu footer{font-size:11px;color:#8a7196;margin-top:10px;line-height:1.4}
    .speech{width:246px;padding:13px 30px 13px 14px}.speech p{margin:0}.speech .dismiss{position:absolute;right:5px;top:4px;padding:1px 6px;font-size:18px;background:transparent;border:0}.speech .open{margin-top:8px;padding:5px 9px;font-size:12px}
    @media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
  `;
  const canvas=document.createElement('canvas');canvas.className='scene';canvas.setAttribute('aria-hidden','true');
  const ctx=canvas.getContext('2d');
  const actor=document.createElement('button');actor.type='button';actor.className='actor';actor.setAttribute('aria-label','Purrple. Drag to pick her up, or open her play menu.');actor.title='Purrple · drag to pick up, click to play';
  const paw=document.createElement('button');paw.type='button';paw.className='paw';paw.textContent='✧';paw.setAttribute('aria-label','Open Purrple play menu');paw.title='Play with Purrple';
  const house=document.createElement('button');house.type='button';house.className='house';house.setAttribute('aria-label','Send Purrple home');house.title='Purrple’s little home';
  house.innerHTML='<svg viewBox="0 0 60 54" aria-hidden="true"><path d="M5 25 30 3l25 22" fill="#c1a4d6" stroke="#79598b" stroke-width="2" stroke-linejoin="round"/><path d="M11 24h38v28H11z" fill="#f2dfef" stroke="#9576a5" stroke-width="2"/><path d="M21 52V37a9 9 0 0 1 18 0v15" fill="#8a689f"/><circle cx="30" cy="18" r="4" fill="#fff1dc"/></svg><span class="zz" hidden>z z</span>';
  const menu=document.createElement('div');menu.className='menu';menu.hidden=true;menu.setAttribute('role','group');menu.setAttribute('aria-label','Play with Purrple');
  menu.innerHTML='<header><span>A little company</span><button type="button" data-action="close" aria-label="Close play menu">×</button></header><div class="actions"><button type="button" data-action="pat">♡ Pet</button><button type="button" data-action="brush">Brush</button><button type="button" data-action="toy">Yarn toy</button><button type="button" data-action="jump">Little jump</button><button type="button" data-action="home">Go home</button><button type="button" data-action="nap">Take a nap</button><button type="button" data-action="open" class="wide">Open Purrple</button><button type="button" data-action="hide" class="wide">Hide on this website</button></div><footer>Pick her up with a drag. The buttons work with a keyboard too.</footer>';
  const speech=document.createElement('div');speech.className='speech';speech.hidden=true;speech.setAttribute('role','status');speech.setAttribute('aria-live','polite');
  speech.innerHTML='<button type="button" class="dismiss" aria-label="Dismiss Purrple message">×</button><p></p><button type="button" class="open" hidden>Open Purrple</button>';
  root.append(style,canvas,actor,paw,house,menu,speech);document.documentElement.append(host);

  let state={settings:{petEnabled:true,size:128,fps:30,reducedMotion:false,hiddenHosts:[],chattiness:'balanced'},equipped:{head:null,neck:null},focus:null};
  let ready=false,loadPromise=null,lease='',claimPromise=null,claimVersion=0,raf=0,last=0,lastPaint=0,lastSaved=0,bubbleUntil=0,dpr=1,width=1,height=1,input=null,ignoreClickUntil=0;
  let mediaReduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const model={x:100,y:100,vx:0,vy:0,clip:'idle',state:'rest',time:0,remaining:0,rotation:0,facing:1,nap:false,atHome:false,target:null,toy:null,ambient:0,idle:0,bounces:0};
  const durations={idle:3.6,blink:1.8,look:3.2,ear:2.2,tail:2.4,tilt:3,walk:1,run:.72,jump:1.65,land:1.25,sit:1.8,wake:2.8,held:2.4,wiggle:1.6,tumble:1.6,impact:1.35,shake:1.6,toy:1.8,sleep:4.2,stretch:3.2,yawn:2.8,groom:3,pat:3,study:3.6,think:3,read:4.2,reminder:2.8,heart:3.4,celebrate:1.8,brush:3};
  const reduced=()=>mediaReduced||!!state.settings.reducedMotion;
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
  function releasePresence(){claimVersion++;const old=lease;lease='';if(old)send({type:'PET_RELEASE',leaseId:old,position:normalized()});cancelDrag();menu.hidden=true;speech.hidden=true;stop();renderer.clearCache?.();canvas.width=canvas.height=1;host.dataset.active='false';host.style.setProperty('display','none','important');}
  async function claim(){
    if(claimPromise||lease||!enabled()||document.hidden||!document.hasFocus())return claimPromise;
    if(!ready&&!await ensureReady())return;
    if(claimPromise||lease||!enabled()||document.hidden||!document.hasFocus())return claimPromise;
    const version=claimVersion;
    claimPromise=(async()=>{const result=await send({type:'PET_CLAIM'});if(!result?.ok||!result.leaseId)return;
      if(version!==claimVersion||document.hidden||!document.hasFocus()||!enabled()){send({type:'PET_RELEASE',leaseId:result.leaseId,position:normalized()});return;}
      lease=result.leaseId;if(result.position)place(result.position);show();
    })().finally(()=>{claimPromise=null;if(version!==claimVersion&&!lease&&enabled()&&ready&&!document.hidden&&document.hasFocus())setTimeout(claim,120);});return claimPromise;
  }
  function settle(){model.vx=model.vy=model.rotation=0;model.facing=1;model.target=null;model.remaining=0;model.idle=0;model.time=0;model.state=model.nap?'nap':'rest';model.clip=model.nap?'sleep':focusWorking()?'study':'idle';model.y=limits().floor;save(true);}
  function focusWorking(){return state.focus?.kind==='focus'&&state.focus.status==='running'&&(state.focus.endsAt==null||state.focus.endsAt>Date.now());}
  function action(clip,seconds=durations[clip]||2){model.atHome=false;model.target=null;model.vx=model.vy=model.rotation=0;model.facing=1;model.time=0;model.idle=0;model.clip=clip;model.state='action';model.remaining=seconds;model.y=limits().floor;}
  function say(text,open=false){if(!active())return;speech.querySelector('p').textContent=text;speech.querySelector('.open').hidden=!open;speech.hidden=false;bubbleUntil=Date.now()+8000;positionUI();}
  async function openApp(){const result=await send({type:'OPEN_APP'});if(result?.ok===false)say('Open Purrple using her toolbar button.');}
  function play(name){
    if(name==='open'){menu.hidden=true;openApp();return;}
    if(name==='hide'){menu.hidden=true;send({type:'PET_HIDE_HOST',hidden:true}).then(r=>{if(r?.ok)releasePresence();else say('Open Settings to hide Purrple on this website.');});return;}
    if(name==='close'){menu.hidden=true;draw();return;}
    menu.hidden=true;speech.hidden=true;model.nap=false;model.atHome=false;model.toy=null;
    if(name==='pat'){action('pat');say('Prrr. A very good little head pat.');}
    else if(name==='brush'){action('brush');say('A little fluff maintenance.');}
    else if(name==='toy'){
      const b=limits(),target=model.x>width/2?b.left+(b.right-b.left)*.24:b.left+(b.right-b.left)*.76;
      if(reduced()){model.toy={x:model.x+size()*.17,y:b.floor-6,caught:true,until:Date.now()+2400};action('toy');}
      else{model.target={x:target,toy:true};model.toy={x:target,y:b.floor-6,caught:false};model.state='walk';model.clip='run';model.time=0;model.idle=0;}
    }else if(name==='jump'){
      if(reduced()){action('celebrate');return;}
      model.state='air';model.clip='jump';model.time=0;model.vx=0;model.vy=-Math.min(540,height*1.25);model.bounces=0;model.rotation=0;
    }else if(name==='home'){
      const b=limits(),target=clamp(width-41,b.left,b.right);
      if(reduced()){model.x=target;model.nap=true;model.atHome=true;settle();}
      else{model.target={x:target,home:true};model.state='walk';model.clip='walk';model.time=0;model.idle=0;}
    }else if(name==='nap'){model.nap=true;model.atHome=false;settle();say('Just resting the tiny paws.');}
    else if(name==='wake'){model.nap=false;model.atHome=false;action('wake');}
    draw();
  }
  function advance(dt){
    model.time+=dt;
    if(model.state==='held'){if(model.time>1.4)model.clip='wiggle';return;}
    if(model.state==='air'){
      if(reduced()){settle();return;}
      let remaining=dt;
      while(remaining>0){const h=Math.min(remaining,1/120);remaining-=h;const b=limits();
        model.vy+=1300*h;model.x+=model.vx*h;model.y+=model.vy*h;model.vx*=Math.exp(-.4*h);model.rotation+=model.vx*.006*h;
        if(model.x<b.left||model.x>b.right){model.x=clamp(model.x,b.left,b.right);model.vx*=-.32;}
        if(model.y<b.top){model.y=b.top;model.vy=Math.max(25,Math.abs(model.vy)*.18);}
        if(model.y>=b.floor&&model.vy>=0){model.y=b.floor;
          if(model.vy>270&&model.bounces<1){model.vy*=-.24;model.vx*=.48;model.bounces++;model.clip='tumble';}
          else{action('impact',1.35);save(true);break;}
        }
      }
    }else if(model.state==='walk'&&model.target){
      const dx=model.target.x-model.x,v=model.target.toy?170:95;model.facing=dx<0?-1:1;
      if(reduced()||Math.abs(dx)<v*dt){
        const target=model.target;model.x=target.x;model.target=null;model.facing=1;
        if(target.home){model.nap=true;model.atHome=true;settle();}
        else if(target.wander){settle();}
        else{action('toy');model.toy={x:model.x+size()*.12,y:limits().floor-6,caught:true,until:Date.now()+2400};}
      }else model.x+=Math.sign(dx)*v*dt;
    }else if(model.state==='action'){
      model.remaining-=dt;if(model.remaining<=0)settle();
    }else if(model.state==='nap')model.clip='sleep';
    else{
      model.clip=focusWorking()?'study':'idle';model.idle+=dt;
      if(!reduced()&&!focusWorking()&&menu.hidden&&model.idle>18){
        const choices=['wander','blink','ear','tail','look','tilt','groom','think'];const next=choices[model.ambient++%choices.length];
        if(next==='wander'){
          const b=limits();model.target={x:clamp(model.x+(model.x>width/2?-80:80),b.left,b.right),wander:true};model.state='walk';model.clip='walk';model.time=0;model.idle=0;
        }else action(next);
      }
    }
    if(model.toy?.until&&Date.now()>model.toy.until)model.toy=null;
    constrain();
  }
  function positionUI(){
    host.dataset.state=model.state;host.dataset.clip=model.clip;host.dataset.atHome=String(model.atHome);host.dataset.x=model.x.toFixed(2);host.dataset.y=model.y.toFixed(2);
    const s=size();actor.style.left=(model.x-s*.43)+'px';actor.style.top=(model.y-s*.91)+'px';actor.style.width=(s*.86)+'px';actor.style.height=(s*.91)+'px';actor.hidden=model.atHome;
    paw.style.left=clamp(model.x+s*.30,7,width-35)+'px';paw.style.top=clamp(model.y-s*.30,7,height-35)+'px';paw.hidden=model.atHome||!menu.hidden||model.state==='held';
    house.querySelector('.zz').hidden=!model.atHome;house.setAttribute('aria-label',model.atHome?'Wake Purrple from her house':'Send Purrple home');
    menu.querySelector('[data-action="nap"]').textContent=model.nap?'Wake up':'Take a nap';
    const mwidth=Math.min(258,width-24),mheight=menu.offsetHeight||297;
    menu.style.left=clamp(model.x-mwidth/2,12,Math.max(12,width-mwidth-12))+'px';
    menu.style.top=clamp(model.y-s*.9-mheight-8,12,Math.max(12,height-mheight-12))+'px';
    speech.style.left=clamp(model.x-123,12,Math.max(12,width-258))+'px';speech.style.top=clamp(model.y-s*.93-(speech.offsetHeight||90)-8,12,Math.max(12,height-(speech.offsetHeight||90)-12))+'px';
  }
  function drawYarn(toy){ctx.save();ctx.translate(toy.x,toy.y);ctx.fillStyle='#d8bee9';ctx.strokeStyle='#9e7bb6';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(0,0,9,8,0,0,Math.PI*2);ctx.fill();ctx.stroke();for(let x=-4;x<=4;x+=4){ctx.beginPath();ctx.ellipse(x,0,3,7,.45,0,Math.PI*2);ctx.stroke();}ctx.beginPath();ctx.moveTo(8,5);ctx.bezierCurveTo(20,14,20,-1,28,5);ctx.stroke();ctx.restore();}
  function draw(){
    if(!ready||!active())return;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    if(!model.atHome){
      const shadow=clamp(1-(limits().floor-model.y)/400,.15,1);ctx.save();ctx.globalAlpha=.10*shadow;ctx.fillStyle='#60416f';ctx.beginPath();ctx.ellipse(model.x,limits().floor+2,size()*.22*shadow,4,0,0,Math.PI*2);ctx.fill();ctx.restore();
      ctx.save();ctx.translate(model.x,model.y-size()*.42);ctx.rotate(model.rotation);
      renderer.draw(ctx,{clip:model.clip,time:reduced()?0:model.time,size:size(),x:0,y:size()*.42,facing:model.facing,equipped:state.equipped||{head:null,neck:null},rootMotion:false,reducedMotion:reduced()});ctx.restore();
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
    const dt=last?Math.min(.05,(now-last)/1000):0;last=now;advance(dt);
    const fps=reduced()?8:clamp(finite(Number(state.settings.fps),30),24,60),interval=1000/fps;
    if(now-lastPaint>=interval-.25){draw();lastPaint=now-((now-lastPaint)%interval);}
    raf=requestAnimationFrame(tick);
  }
  function resize(){const p=normalized();width=Math.max(1,innerWidth);height=Math.max(1,innerHeight);dpr=Math.min(devicePixelRatio||1,2);if(active())ensureCanvas();else canvas.width=canvas.height=1;place(p);if(active())draw();}
  function pointerPoint(e){return{x:e.clientX,y:e.clientY};}
  actor.addEventListener('pointerdown',e=>{
    if(e.button!==0||!active())return;const p=pointerPoint(e);input={id:e.pointerId,start:p,last:p,stamp:e.timeStamp,dx:model.x-p.x,dy:model.y-p.y,vx:0,vy:0,moved:0};
    actor.setPointerCapture(e.pointerId);model.state='held';model.clip='held';model.time=0;model.rotation=0;model.facing=1;model.vx=model.vy=0;model.atHome=false;model.target=null;model.toy=null;actor.classList.add('held');menu.hidden=true;speech.hidden=true;e.preventDefault();
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
    else{const fresh=e.timeStamp-held.stamp<100;model.vx=clamp(fresh?held.vx*.55:0,-1250,1250);model.vy=clamp(fresh?held.vy*.55:0,-950,950);model.state='air';model.clip='tumble';model.time=0;model.rotation=0;model.bounces=0;}
    draw();e.preventDefault();
  });
  actor.addEventListener('pointercancel',cancelDrag);actor.addEventListener('lostpointercapture',()=>{if(input)cancelDrag();});
  actor.addEventListener('click',e=>{if(Date.now()<ignoreClickUntil||e.detail>0)return;toggleMenu();});
  function toggleMenu(){speech.hidden=true;menu.hidden=!menu.hidden;positionUI();if(!menu.hidden)menu.querySelector('[data-action="pat"]').focus();}
  paw.addEventListener('click',toggleMenu);house.addEventListener('click',()=>play(model.atHome?'wake':'home'));
  menu.addEventListener('click',e=>{const b=e.target.closest('button[data-action]');if(!b)return;let name=b.dataset.action;if(name==='nap'&&model.nap)name='wake';play(name);if(name==='close')actor.focus();});
  speech.querySelector('.dismiss').addEventListener('click',()=>speech.hidden=true);speech.querySelector('.open').addEventListener('click',openApp);
  root.addEventListener('keydown',e=>{if(e.key==='Escape'){menu.hidden=true;speech.hidden=true;actor.focus();e.stopPropagation();}});
  document.addEventListener('pointerdown',e=>{if(!e.composedPath().includes(host))menu.hidden=true;},{passive:true});
  window.addEventListener('resize',resize,{passive:true});
  window.addEventListener('focus',()=>claim());window.addEventListener('blur',releasePresence);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)releasePresence();else claim();});
  window.addEventListener('pagehide',releasePresence);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{mediaReduced=e.matches;if(reduced()&&model.state==='air')settle();draw();});
  api.runtime.onMessage.addListener((message,sender)=>{
    if(message?.type==='PET_STATUS'){
      if(sender?.id&&sender.id!==api.runtime.id)return undefined;
      return Promise.resolve({active:active(),clip:model.clip,state:model.state,x:model.x,y:model.y,atHome:model.atHome});
    }
    if(message?.type==='STATE_CHANGED'&&message.state){state=message.state;constrain();if(!enabled())releasePresence();else{if(focusWorking()&&model.target?.wander)settle();if(model.state==='rest')model.clip=focusWorking()?'study':'idle';claim();show();}draw();}
    else if(message?.type==='PET_REVOKED'&&(!message.leaseId||message.leaseId===lease)){lease='';cancelDrag();renderer.clearCache?.();canvas.width=canvas.height=1;show();if(!document.hidden&&document.hasFocus())setTimeout(claim,160);}
    else if(message?.type==='REMINDER_NOTICE'){action('reminder');say('A little reminder is waiting. Open your plans when you are ready.',true);}
    else if(message?.type==='FOCUS_NOTICE'){action('celebrate');say('A little progress, together. Your timer is ready.',true);}
  });
  // This page-level diagnostic exposes no personal records. It is useful for
  // native extension smoke tests without reading host-page content.
  globalThis.PurrpleCompanionDebug=Object.freeze({snapshot:()=>({mounted:true,ready,active:active(),lease:!!lease,state:model.state,clip:model.clip,x:model.x,y:model.y,atHome:model.atHome,size:size()}),play});
  (async()=>{
    const response=await send({type:'GET_STATE'});if(response?.ok&&response.state)state=response.state;
    width=Math.max(1,innerWidth);height=Math.max(1,innerHeight);place();resize();await claim();
  })().catch(()=>{ready=false;releasePresence();});
  setInterval(()=>{if(!lease)claim();else if(active())save();},8000);
})();
