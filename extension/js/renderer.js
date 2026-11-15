/* Purrple's shared illustrated actor and per-pose wardrobe compositor.
 * No network service, no AI, no DOM animation loop. Call preload, then draw.
 */
(() => {
 'use strict';
 const art=globalThis.PurrpleArt;
 const scriptURL=globalThis.document?.currentScript?.src;
 const fallbackBase=scriptURL?new URL('../',scriptURL).href:'';
 const TAU=Math.PI*2;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
 const durations={idle:3.6,blink:1.8,look:3.2,ear:2.2,tail:2.4,tilt:3,walk:1,run:.72,jump:1.65,
  land:1.25,sit:1.8,wake:2.8,held:2.4,wiggle:1.6,tumble:1.6,impact:1.35,shake:1.6,toy:1.8,
  sleep:4.2,stretch:3.2,yawn:2.8,groom:3,pat:3,study:3.6,think:3,read:4.2,reminder:2.8,
  heart:3.4,celebrate:1.8,brush:3,home:3.8,chase:3.6};
 const oneShot=new Set(['jump','land','sit','wake','tumble','impact','shake','toy','stretch','yawn','celebrate','home','chase']);
 const names={idle:'Keeping company',blink:'Slow blink',look:'Looking around',ear:'Ear twitch',tail:'Tail swish',tilt:'Curious tilt',walk:'Walking',run:'Little run',jump:'Jump and land',land:'Soft landing',sit:'Sitting down',wake:'Waking up',held:'Picked up',wiggle:'Dangling wiggle',tumble:'Airborne tumble',impact:'Squash and recover',shake:'Shake it off',toy:'Toy pounce',sleep:'Curled-up nap',stretch:'Big stretch',yawn:'Sleepy yawn',groom:'Paw and cheek wash',pat:'Head pats',study:'Writing together',think:'Thinking',read:'Reading together',reminder:'A little reminder',heart:'Heart hug',celebrate:'Happy hop',brush:'Brushing',home:'Going home',chase:'Chasing yarn'};
 const clips=Object.entries(durations).map(([id,duration])=>({id,name:names[id],duration,loop:!oneShot.has(id)}));
 const images={};let ready=false,pending=null;
 function url(src){
  const runtime=globalThis.browser?.runtime||globalThis.chrome?.runtime;
  if(runtime?.getURL)return runtime.getURL(src);
  return new URL(src,fallbackBase||location.href).href;
 }
 function preload(){
  if(pending)return pending;
  if(!art)return Promise.reject(new Error('Purrple artwork metadata is missing.'));
  const paths=new Set([...Object.values(art.sprites).map(x=>x.src),...Object.values(art.items).map(x=>x.src)]);
  pending=Promise.all([...paths].map(src=>new Promise((resolve,reject)=>{
   const im=new Image();im.onload=()=>{images[src]=im;resolve();};im.onerror=()=>reject(new Error('Could not load Purrple artwork: '+src));im.src=url(src);
  }))).then(()=>{ready=true;return api;});
  return pending;
 }
 function frameAt(clip='idle',time=0){
  if(!durations[clip])clip='idle';
  const duration=durations[clip],p=clamp(time/duration,0,.999999);
  if(clip==='brush')return{clip:'pat',key:Math.floor(p*6),duration,phase:p};
  if(clip==='idle')return{clip,key:0,duration,phase:p};
  if(clip==='look')return{clip,key:[2,1,0,1,2,3,4,5,2][Math.floor(p*9)],duration,phase:p};
  if(clip==='tail')return{clip,key:[0,1,2,3,5,3,2,1][Math.floor(p*8)],duration,phase:p};
  if(clip==='stretch')return{clip,key:[0,1,2,3,4,5,4,3,2,1,0,0][Math.floor(p*12)],duration,phase:p};
  if(clip==='blink')return{clip,key:p<.34?0:p<.40?1:p<.50?2:p<.59?3:p<.66?4:5,duration,phase:p};
  if(clip==='jump')return{clip:p<.63?'jump':'land',key:p<.63?Math.floor(p/.63*6):Math.min(5,Math.floor((p-.63)/.37*6)),duration,phase:p};
  if(clip==='home')return{clip:'walk',key:Math.floor(p*30)%6,duration,phase:p};
  if(clip==='chase')return{clip:p<.64?'run':'toy',key:p<.64?Math.floor(p*30)%6:Math.min(5,Math.floor((p-.64)/.36*6)),duration,phase:p};
  return{clip,key:Math.min(5,Math.floor(p*6)),duration,phase:p};
 }
 function base(ctx,spec,frame){ctx.drawImage(images[spec.src],frame.x,frame.y,256,256,0,0,256,256);}
 function item(ctx,id,lm,slot){
  const cfg=art.items[id],im=images[cfg?.src];if(!cfg||!im||cfg.slot!==slot)return;
  const width=lm.headWidth,profile=lm.profile?.72:1;
  ctx.save();
  if(slot==='head'){
   const clip=cfg.kind==='clip';
   ctx.translate(lm.eye[0],lm.eye[1]);ctx.rotate(lm.angle);
   const w=width*cfg.w*(clip?profile:(lm.profile?.94:1)),h=width*cfg.h*(lm.profile&&!clip?1.22:1);
   if(clip){ctx.translate(-width*(lm.profile?.11:.33),(lm.crownY-lm.eye[1])-width*.015);ctx.drawImage(im,-w/2,-h/2,w,h);}
   else{ctx.translate(lm.profile?-width*.03:0,(lm.crownY-lm.eye[1])+width*.14);ctx.drawImage(im,-w/2,-h,w,h);}
  }else{
   ctx.translate(lm.neck[0],lm.neck[1]);ctx.rotate(lm.angle);
   const w=width*cfg.w*profile,h=width*cfg.h;
   ctx.drawImage(im,-w/2,-3,w,h);
  }
  ctx.restore();
 }
 function headRestore(ctx,spec,frame,lm){
  ctx.save();ctx.translate(lm.eye[0],lm.eye[1]);ctx.rotate(lm.angle);
  ctx.beginPath();ctx.ellipse(0,-lm.headWidth*.10,lm.headWidth*.54,lm.headWidth*.51,0,0,TAU);ctx.clip();
  ctx.rotate(-lm.angle);ctx.translate(-lm.eye[0],-lm.eye[1]);base(ctx,spec,frame);ctx.restore();
 }
 function earsRestore(ctx,spec,frame,lm){
  if(!lm.earPolygons?.length)return;
  ctx.save();ctx.beginPath();
  for(const points of lm.earPolygons){ctx.moveTo(...points[0]);for(const point of points.slice(1))ctx.lineTo(...point);ctx.closePath();}
  ctx.clip();base(ctx,spec,frame);ctx.restore();
 }
 function drawFrame(ctx,source,key,equipped={}){
  const spec=art.sprites[source]||art.sprites.idle;
  const frame=spec.frames[clamp(key,0,5)];const lm=art.poses[source][clamp(key,0,5)];
  base(ctx,spec,frame);
  if(equipped.neck){
   // Clip neckwear to the real cat silhouette, then restore the foreground head.
   const off=document.createElement('canvas');off.width=off.height=256;const oc=off.getContext('2d');
   item(oc,equipped.neck,lm,'neck');oc.globalCompositeOperation='destination-in';base(oc,spec,frame);
   ctx.drawImage(off,0,0);headRestore(ctx,spec,frame,lm);
   if(lm.restoreProps){ctx.save();ctx.beginPath();ctx.rect(0,lm.propY,256,256-lm.propY);ctx.clip();base(ctx,spec,frame);ctx.restore();}
  }
  if(equipped.head){
   item(ctx,equipped.head,lm,'head');
   if(art.items[equipped.head]?.kind==='hat')earsRestore(ctx,spec,frame,lm);
  }
 }
 // Cache complete equipped actors, not just icons. No per-frame pixel readback.
 const cache=new Map();
 function actor(source,key,equipped){
  const id=source+':'+key+':'+(equipped.head||'')+':'+(equipped.neck||'');
  if(cache.has(id))return cache.get(id);
  const c=document.createElement('canvas');c.width=c.height=320;
  const cc=c.getContext('2d');cc.translate(32,32);cc.imageSmoothingEnabled=false;drawFrame(cc,source,key,equipped);
  cache.set(id,c);if(cache.size>96)cache.delete(cache.keys().next().value);
  return c;
 }
 function draw(ctx,options={}){
  if(!ready)return false;
  const clip=durations[options.clip]?options.clip:'idle';const time=Math.max(0,Number(options.time)||0);
  const duration=durations[clip];const local=oneShot.has(clip)?Math.min(time,duration):time%duration;
  const f=frameAt(clip,local),p=f.phase,s=Math.sin(p*TAU),size=clamp(Number(options.size)||128,32,600);
  let x=Number(options.x)||0,y=Number(options.y)||0,sx=1,sy=1,rotation=0;
  if(options.motion!==false){
   if(['idle','sleep','study','read','think','heart','reminder','pat','brush','groom'].includes(clip)){const n=clip==='sleep'?.014:.006;sx+=n*s;sy-=n*s;}
   if(clip==='held'||clip==='wiggle')rotation=Math.sin(TAU*p)*(clip==='wiggle'?.045:.025);
   if(clip==='shake')x+=Math.sin(TAU*p*3)*size*.012*Math.sin(Math.PI*p);
   if(options.rootMotion){
    if(clip==='jump')y-=Math.sin(Math.PI*clamp((p-.18)/.57,0,1))*size*.60;
    if(clip==='celebrate')y-=Math.sin(Math.PI*clamp((p-.18)/.56,0,1))*size*.27;
    if(clip==='run')y-=Math.max(0,Math.sin(TAU*p*2))*size*.025;
    if(clip==='tumble'){y-=Math.sin(Math.PI*p)*size*.6;rotation=TAU*2*smooth(p);}
   }
  }
  const image=actor(f.clip,f.key,options.equipped||{});
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(x,y);ctx.translate(0,-size*.43);
  ctx.rotate((Number(options.rotation)||0)+rotation);ctx.scale((options.facing===-1?-1:1)*sx,sy);
  const scale=size/256;
  ctx.drawImage(image,-160*scale,(-232+110-32)*scale,320*scale,320*scale);
  ctx.restore();return true;
 }
 const api={preload,draw,drawFrame,frameAt,clips,landmarkFor:(clip,key)=>art.poses[clip]?.[key],
  itemIds:Object.keys(art?.items||{}),get ready(){return ready;},get assetsReady(){return ready;},clearCache:()=>cache.clear()};
 globalThis.PurrpleRenderer=Object.freeze(api);
})();
