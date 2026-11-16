/* Shared Purrple actor. Fixed local illustrations + registered 30Hz articulation.
 * Variable source-frame counts, per-frame timing, no image crossfades or AI.
 * Every equipped item is composited before the SAME geometry deformation.
 */
(() => {
 'use strict';
 const art=globalThis.PurrpleArt, TAU=Math.PI*2, CANON=232;
 const scriptURL=globalThis.document?.currentScript?.src;
 const fallbackBase=scriptURL?new URL('../',scriptURL).href:'';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
 const lerp=(a,b,t)=>a+(b-a)*t;
 const baseDefs=[
 ['idle','Keeping company',3.2,1,'Everyday'],['blink','Slow blink',2.4,1,'Everyday'],['look','Looking around',1.5,1,'Everyday'],['ear','Ear twitch',1.4,1,'Everyday'],['tail','Tail swish',1.25,1,'Everyday'],['tilt','Curious tilt',1.4,1,'Everyday'],
 ['walk','Walking',.8,1,'Movement'],['run','Little run',.6,1,'Movement'],['jump','Jump and land',1.1,0,'Movement'],['land','Soft landing',.65,0,'Movement'],['sit','Sitting down',.8,0,'Movement'],['wake','Waking up',1.6,0,'Cozy'],
 ['held','Picked up',1,1,'Play'],['wiggle','Dangling wiggle',.85,1,'Play'],['tumble','Airborne tumble',1.1,0,'Play'],['impact','Squash and recover',.7,0,'Play'],['shake','Shake it off',.65,0,'Play'],['toy','Toy pounce',1.05,0,'Play'],
 ['sleep','Curled-up nap',3.2,1,'Cozy'],['stretch','Big stretch',1.65,0,'Cozy'],['yawn','Sleepy yawn',1.8,0,'Cozy'],['groom','Paw and cheek wash',1.4,1,'Cozy'],['pat','Head pats',1.5,1,'Together'],['study','Writing together',1.4,1,'Study'],['think','Thinking',1.8,1,'Study'],['read','Reading together',2.6,1,'Study'],['reminder','A little reminder',1.5,1,'Together'],['heart','Heart hug',1.8,1,'Together'],['celebrate','Happy hop',1,0,'Together'],['brush','Brushing',1.5,1,'Together'],['home','Going home',2.8,0,'Movement'],['chase','Chasing yarn',2.6,0,'Play'],
 ['cry','A brief little cry',1.25,0,'Reactions'],['paw-wipe','Wipe little tears',.75,0,'Reactions'],['soothe','Feeling better',1.2,0,'Reactions'],['turn','Turning around',.6,0,'Movement'],['knead','Making biscuits',1.2,1,'Cozy'],['loaf','Little loaf',2.8,0,'Cozy'],['wave','Hello paw',1.15,0,'Together'],['nuzzle','A little nuzzle',1.4,0,'Together'],['roll','Playful roll',1.2,0,'Play'],['peek','Curious peek',1.2,1,'Everyday'],['listen','Listening closely',1.6,1,'Everyday'],['doze','Getting sleepy',2.2,0,'Cozy'],['released','Letting go',.12,0,'Play']
 ];
 const aliases={wipe:'paw-wipe',pet:'pat',nap:'sleep'};
 const fallback={cry:'wiggle','paw-wipe':'groom',soothe:'pat',turn:'look',knead:'idle',loaf:'sleep',wave:'reminder',nuzzle:'pat',roll:'tumble',peek:'look',listen:'tilt',doze:'wake',released:'held',brush:'pat'};
 const images={},actorCache=new Map(),motionCache=new Map();let ready=false,pending=null,neckSurface=null,assetEpoch=0;
 const loading=new Map();
 const stats={actorBuilds:0,actorHits:0,geometryBuilds:0,geometryHits:0,draws:0,pixelReads:0};
 function sourceId(id){if(id==='brush'&&!art.sprites.brush?.refined)return 'pat';return art.sprites[id]?id:(fallback[id]||'idle');}
 function nframes(id){return art.sprites[sourceId(id)]?.frames.length||0;}
 function url(src){const runtime=globalThis.browser?.runtime||globalThis.chrome?.runtime;if(runtime?.getURL)return runtime.getURL(src);return new URL(src,fallbackBase||location.href).href;}
 function loadImage(src){
  if(images[src])return Promise.resolve(images[src]);if(loading.has(src))return loading.get(src);
  const epoch=assetEpoch;let job;
  job=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{if(epoch===assetEpoch)images[src]=im;if(loading.get(src)===job)loading.delete(src);resolve(im);};im.onerror=()=>{if(loading.get(src)===job)loading.delete(src);reject(new Error('Could not load Purrple artwork: '+src));};im.src=url(src);});
  loading.set(src,job);return job;
 }
 function preload(options={}){
  if(!art)return Promise.reject(new Error('Purrple artwork metadata is missing.'));
  const ordinary=/^https?:$/.test(globalThis.location?.protocol||'');
  const all=options.all??!ordinary;
  const paths=all?new Set([...Object.values(art.sprites).map(x=>x.src),...Object.values(art.items).map(x=>x.src)]):new Set([art.sprites.idle.src]);
  if(pending&&ready&&[...paths].every(p=>images[p]))return Promise.resolve(api);
  pending=Promise.all([...paths].map(loadImage)).then(()=>{ready=true;return api;});return pending;
 }
 function ensureActor(source,equipped){
  const paths=[art.sprites[source]?.src,...['head','neck'].map(slot=>art.items[equipped[slot]]?.src)].filter(Boolean);
  const missing=paths.filter(src=>!images[src]);for(const src of missing)loadImage(src).catch(()=>{});return !missing.length;
 }
 function releaseAssets(){assetEpoch++;for(const key of Object.keys(images))delete images[key];loading.clear();api.clearCache();pending=null;}
 function resolve(id){id=aliases[id]||id;return defs[id]?id:'idle';}
 const defs=Object.fromEntries(baseDefs.map(([id,name,duration,loop,category])=>[id,{id,name,duration,loop:!!loop,category}]));
 function fitTiming(seq,id){const total=seq.reduce((n,f)=>n+f.ms,0),scale=defs[id].duration*1000/total;return seq.map(f=>({...f,ms:f.ms*scale}));}
 function timeline(id){
  id=resolve(id);const d=defs[id],source=sourceId(id),spec=art.sprites[source],count=spec.frames.length;
  // Dedicated refinement art owns explicit frame durations. Existing six-key
  // sheets retain short movement beats, plus intentional neutral holds.
  if(id==='released')return[{source,key:0,ms:defs[id].duration*1000}];
  if(id==='loaf')return fitTiming(Array.from({length:count},(_,key)=>({source,key,ms:key===count-1?10:1})),id);
  if(id==='doze')return fitTiming(Array.from({length:count},(_,i)=>({source,key:count-1-i,ms:1})),id);
  if(id==='cry'&&spec.refined)return fitTiming([0,1,2,3,4,3,4].map((key,i)=>({source,key,ms:i<2?1:2})),id);
  if(id==='turn'&&spec.refined&&count>=12)return fitTiming([5,4,3,2,1,0,11,10,9,8,7,6].map(key=>({source,key,ms:1})),id);
  if(spec.timing?.length===count)return fitTiming(spec.timing.map((ms,key)=>({source,key,ms})),id);
  if(spec.frames.every(f=>Number(f.durationMs)>0))return fitTiming(spec.frames.map((f,key)=>({source,key,ms:f.durationMs})),id);
  let keys=Array.from({length:count},(_,i)=>i),weights=keys.map(()=>1);
  if(count===6){
   if(id==='idle')keys=[0],weights=[1];
   if(id==='look'||id==='turn'||id==='peek')keys=[2,1,0,1,2,3,4,5,2],weights=[2,1,1.5,1,1,1,1.5,1,2];
   if(id==='tail')keys=[0,1,2,3,5,3,2,1],weights=[1,1,1,1,1,1,1,1];
   if(id==='blink')weights=[17,1.5,1,1,1.5,8];
   if(id==='ear')weights=[6,1,1,1,1,6];
   if(id==='stretch')keys=[0,1,2,3,4,5,4,3,2,1,0],weights=[2,1,1,1,1,2,1,1,1,1,2];
   if(['study','read','think','heart','reminder','pat','brush','nuzzle','listen'].includes(id))weights=[3,1,1.3,1.8,1,3];
   if(id==='doze')weights=[1,2,2,6,2,1];
  }
  const sum=weights.reduce((a,b)=>a+b,0);return keys.map((key,i)=>({source,key,ms:d.duration*1000*weights[i]/sum}));
 }
 function durationFor(id){id=resolve(id);if(['home','chase','jump'].includes(id))return defs[id].duration;return timeline(id).reduce((n,k)=>n+k.ms,0)/1000;}
 function usedFrames(id){if(id==='home')return nframes('walk');if(id==='chase')return nframes('run')+nframes('toy');return new Set(timeline(id).map(f=>f.source+':'+f.key)).size;}
 function availableFrames(id){if(id==='home')return nframes('walk');if(id==='chase')return nframes('run')+nframes('toy');return nframes(id);}
 const clips=baseDefs.map(([id])=>({...defs[id],duration:durationFor(id),sourceFrames:usedFrames(id),availableFrames:availableFrames(id),geometryHz:30,stride:id==='walk'?120:id==='run'?220:0,artwork:['home','chase'].includes(id)?'composed movement sequence':art.sprites[id]?'dedicated illustrated keys':'composed from '+sourceId(id),timing:'per-frame durations'}));
 function localTime(id,t){const d=durationFor(id);return defs[id].loop?((Math.max(0,t)%d)+d)%d:clamp(Math.max(0,t),0,d-.000001);}
 function rawSample(id,time){
  id=resolve(id);const duration=durationFor(id),local=localTime(id,time),phase=clamp(local/duration,0,.999999);
  if(id==='home')return{...rawSample('walk',local),duration,phase,action:id,local};
  if(id==='chase')return{...rawSample(phase<.66?'run':'toy',phase<.66?local:(phase-.66)/.34*durationFor('toy')),duration,phase,action:id,local};
  if(id==='jump'&&!art.sprites.jump?.refined){const split=.64;return{...rawSample(phase<split?'jump-source':'land',phase<split?local:((phase-split)/(1-split))*durationFor('land')),duration,phase,action:id,local};}
  const seq=timeline(id),at=local*1000;let acc=0,index=0;
  for(;index<seq.length-1;index++){if(at<acc+seq[index].ms)break;acc+=seq[index].ms;}
  const f=seq[index],next=seq[index+1]||(defs[id].loop?seq[0]:f);
  return{clip:f.source,key:f.key,nextClip:next.source,nextKey:next.key,mix:clamp((at-acc)/f.ms,0,1),duration,phase,action:id,local,frameDurationMs:f.ms};
 }
 // Internal takeoff source prevents recursive jump composition.
 defs['jump-source']={id:'jump-source',duration:.704,loop:false};fallback['jump-source']='jump';
 function frameAt(id='idle',time=0){return rawSample(resolve(id),Number(time)||0);}
 function canonicalPose(source,key){
  const spec=art.sprites[source]||art.sprites.idle,poses=art.poses[source]||art.poses.idle;
  const raw=poses[clamp(key|0,0,poses.length-1)],offset=CANON-(spec.baseline||CANON);
  const p={...raw};p.eye=[raw.eye[0],raw.eye[1]+offset];p.neck=[raw.neck[0],raw.neck[1]+offset];p.crownY=raw.crownY+offset;
  if(raw.neckFit)p.neckFit={...raw.neckFit,y:raw.neckFit.y+offset};
  p.bbox=(raw.bbox||[32,20,224,spec.baseline||CANON]).map((n,i)=>i%2?n+offset:n);
  p.facePolygon=(raw.facePolygon||[]).map(([x,y])=>[x,y+offset]);if(raw.headMask)p.headMask={...raw.headMask,cy:raw.headMask.cy+offset};
  p.earPolygons=(raw.earPolygons||[]).map(poly=>poly.map(([x,y])=>[x,y+offset]));p.foregroundPolygons=(raw.foregroundPolygons||[]).map(poly=>poly.map(([x,y])=>[x,y+offset]));p.propY=(raw.propY||256)+offset;
  p.paws=(raw.paws||[[raw.eye[0]-raw.headWidth*.13,CANON-offset-8],[raw.eye[0]+raw.headWidth*.13,CANON-offset-8]]).map(pt=>[pt[0],pt[1]+offset,...pt.slice(2)]);
  return p;
 }
 function base(ctx,source,key){const spec=art.sprites[source]||art.sprites.idle;const f=spec.frames[clamp(key|0,0,spec.frames.length-1)];ctx.drawImage(images[spec.src],f.x,f.y,f.w||256,f.h||256,0,CANON-(spec.baseline||CANON),256,256);}
 function item(ctx,id,lm,slot){
  const cfg=art.items[id],im=images[cfg?.src];if(!cfg||!im||cfg.slot!==slot)return;
  const overrides=art.fitOverrides?.[id]?.[lm.family||'']||{};
  const width=lm.headWidth,profile=lm.profile?.72:1;
  ctx.save();
  if(slot==='head'){
   const isClip=cfg.kind==='clip';ctx.translate(lm.eye[0],lm.eye[1]);ctx.rotate(lm.angle||0);
   const w=width*cfg.w*(isClip?profile:(lm.profile?.94:1))*(overrides.scaleX||1),h=width*cfg.h*(lm.profile&&!isClip?1.18:1)*(overrides.scaleY||1);
   if(isClip){ctx.translate(-width*(lm.profile?.11:.33)+(overrides.x||0),(lm.crownY-lm.eye[1])-width*.015+(overrides.y||0));ctx.drawImage(im,-w/2,-h/2,w,h);}
   else{ctx.translate((lm.profile?-width*.03:0)+(overrides.x||0),(lm.crownY-lm.eye[1])+width*.14+(overrides.y||0));ctx.drawImage(im,-w/2,-h,w,h);}
  }else{
   const fit=lm.neckFit||{x:lm.neck[0],y:lm.neck[1],angle:lm.angle||0,scale:[1,1]};
   const [px,py]=cfg.pivot||[.5,.12];
   ctx.translate(fit.x,fit.y);ctx.rotate(fit.angle);
   const w=width*cfg.w*profile*fit.scale[0],h=width*cfg.h*fit.scale[1];
   ctx.drawImage(im,-w*px,-h*py,w,h);
  }
  ctx.restore();
 }
 function restoreMask(ctx,source,key,paint){ctx.save();paint(ctx);ctx.clip();base(ctx,source,key);ctx.restore();}
 function drawFrame(ctx,source='idle',key=0,equipped={}){
  source=sourceId(source);const lm=canonicalPose(source,key);base(ctx,source,key);
  if(equipped.neck){
   const off=neckSurface||(neckSurface=document.createElement('canvas'));if(off.width!==256)off.width=off.height=256;const oc=off.getContext('2d');oc.setTransform(1,0,0,1,0,0);oc.globalCompositeOperation='source-over';oc.clearRect(0,0,256,256);item(oc,equipped.neck,lm,'neck');oc.globalCompositeOperation='destination-in';base(oc,source,key);ctx.drawImage(off,0,0);
   restoreMask(ctx,source,key,c=>{c.beginPath();if(lm.facePolygon?.length){c.moveTo(...lm.facePolygon[0]);for(const p of lm.facePolygon.slice(1))c.lineTo(...p);c.closePath();}else{c.save();c.translate(...lm.eye);c.rotate(lm.angle||0);c.ellipse(0,-lm.headWidth*.10,lm.headWidth*.54,lm.headWidth*.51,0,0,TAU);c.restore();}});
   if(lm.restoreProps)restoreMask(ctx,source,key,c=>{c.beginPath();c.rect(0,lm.propY,256,256-lm.propY);});
  }
  if(equipped.head){item(ctx,equipped.head,lm,'head');if(art.items[equipped.head]?.kind==='hat'&&lm.earPolygons.length)restoreMask(ctx,source,key,c=>{c.beginPath();for(const ps of lm.earPolygons){c.moveTo(...ps[0]);for(const p of ps.slice(1))c.lineTo(...p);c.closePath();}});}
  if(lm.foregroundPolygons.length&&(equipped.head||equipped.neck))restoreMask(ctx,source,key,c=>{c.beginPath();for(const ps of lm.foregroundPolygons){c.moveTo(...ps[0]);for(const p of ps.slice(1))c.lineTo(...p);c.closePath();}});
 }
 function keep(cache,key,value,max){cache.set(key,value);if(cache.size>max){const oldKey=cache.keys().next().value,old=cache.get(oldKey);cache.delete(oldKey);if(old&&old!==value){old.width=old.height=1;}}return value;}
 function actor(source,key,equipped){
  const id=[source,key,equipped.head||'',equipped.neck||''].join(':');if(actorCache.has(id)){stats.actorHits++;return actorCache.get(id);}
  const c=document.createElement('canvas');c.width=c.height=320;const cc=c.getContext('2d');cc.translate(32,32);cc.imageSmoothingEnabled=false;drawFrame(cc,source,key,equipped);stats.actorBuilds++;return keep(actorCache,id,c,110);
 }
 function blendedPose(a,b,t){
  const angle=lerp(a.angle||0,b.angle||0,t);return{...a,eye:[lerp(a.eye[0],b.eye[0],t),lerp(a.eye[1],b.eye[1],t)],neck:[lerp(a.neck[0],b.neck[0],t),lerp(a.neck[1],b.neck[1],t)],headWidth:lerp(a.headWidth,b.headWidth,t),paws:(a.paws||[]).map((p,i)=>{const q=b.paws?.[i]||p;return[lerp(p[0],q[0],t),lerp(p[1],q[1],t)];}),angle};
 }
 function triangle(ctx,image,s,d){
  const [s0,s1,s2]=s,[d0,d1,d2]=d;
  const den=(s1[0]-s0[0])*(s2[1]-s0[1])-(s2[0]-s0[0])*(s1[1]-s0[1]);if(Math.abs(den)<.01)return;
  const a=((d1[0]-d0[0])*(s2[1]-s0[1])-(d2[0]-d0[0])*(s1[1]-s0[1]))/den;
  const c=((s1[0]-s0[0])*(d2[0]-d0[0])-(s2[0]-s0[0])*(d1[0]-d0[0]))/den;
  const b=((d1[1]-d0[1])*(s2[1]-s0[1])-(d2[1]-d0[1])*(s1[1]-s0[1]))/den;
  const e=((s1[0]-s0[0])*(d2[1]-d0[1])-(s2[0]-s0[0])*(d1[1]-d0[1]))/den;
  const tx=d0[0]-a*s0[0]-c*s0[1],ty=d0[1]-b*s0[0]-e*s0[1];
  const mx=(d0[0]+d1[0]+d2[0])/3,my=(d0[1]+d1[1]+d2[1])/3;
  const expanded=d.map(([x,y])=>{const length=Math.hypot(x-mx,y-my)||1;return[x+(x-mx)/length*2.5,y+(y-my)/length*2.5];});
  ctx.save();ctx.beginPath();ctx.moveTo(...expanded[0]);ctx.lineTo(...expanded[1]);ctx.lineTo(...expanded[2]);ctx.closePath();ctx.clip();ctx.transform(a,b,c,e,tx,ty);ctx.drawImage(image,0,0);ctx.restore();
 }
 function geometry(image,lm,target,id,time){
  const c=document.createElement('canvas');c.width=c.height=320;const cx=c.getContext('2d');cx.imageSmoothingEnabled=false;
  const phase=time/durationFor(id),osc=Math.sin(phase*TAU),headD=(target.angle||0)-(lm.angle||0),hs=clamp(target.headWidth/lm.headWidth,.94,1.06);
  const cs=Math.cos(headD),sn=Math.sin(headD),eye=lm.eye,neck=lm.neck;
  function warp(x,y){
   const px=x-32,py=y-32;
   const headWeight=1-smooth((py-(neck[1]-lm.headWidth*.16))/(lm.headWidth*.25));
   const ex=px-eye[0],ey=py-eye[1];
   const hx=(ex*cs-ey*sn)*hs+target.eye[0]-px,hy=(ex*sn+ey*cs)*hs+target.eye[1]-py;
   const bodyWeight=(1-headWeight)*(1-smooth((py-neck[1])/(CANON-neck[1]||1)));
   let dx=hx*headWeight+(target.neck[0]-neck[0])*bodyWeight,dy=hy*headWeight+(target.neck[1]-neck[1])*bodyWeight;
   if(['walk','run','knead'].includes(id))for(let i=0;i<lm.paws.length;i++){const pp=lm.paws[i],tp=target.paws?.[i]||pp;const weight=Math.exp(-(((px-pp[0])/23)**2+((py-pp[1])/24)**2));dx+=clamp(tp[0]-pp[0],-15,15)*weight;dy+=clamp(tp[1]-pp[1],-15,15)*weight;}
   // Local articulation retains the illustrated silhouette, rather than scaling
   // the entire animal. Headwear is inside this actor buffer and follows it.
   if(['idle','sleep','loaf','doze'].includes(id)){
    const breathe=Math.sin(time*TAU/(id==='sleep'?3.2:2.8));const torso=Math.exp(-(((py-(neck[1]+20))/45)**2))*(1-headWeight);
    dx+=(px-neck[0])*.008*breathe*torso;dy-=1.8*breathe*torso;
   }
   if(['tail','idle','sleep'].includes(id)){
    const side=px>eye[0]+lm.headWidth*.30?1:px<eye[0]-lm.headWidth*.30?-1:0;
    if(side&&py>neck[1]-5){const w=smooth((Math.abs(px-eye[0])-lm.headWidth*.30)/(lm.headWidth*.24));dy+=Math.sin(time*TAU/1.4)*w*(id==='tail'?4:1);}
   }
   if(id==='knead')for(let i=0;i<2;i++){const pp=lm.paws[i]||[neck[0]+(i?18:-18),CANON-9];const w=Math.exp(-((px-pp[0])**2+(py-pp[1])**2)/190);dy-=Math.max(0,Math.sin(time*TAU/0.6+i*Math.PI))*4*w;}
   if(id==='nuzzle'||id==='soothe'){const q=Math.sin(Math.PI*clamp(phase,0,1));dx+=headWeight*q*(id==='nuzzle'?4:1);dy+=headWeight*q*2;}
   if(id==='peek'){dx+=headWeight*osc*3;}
   return[x+dx,y+dy];
  }
  // Shared grid vertices guarantee adjacent triangles meet. These are actual
  // intermediate shape changes with one opaque source, never image crossfades.
  const n=8,step=320/n,points=[];for(let y=0;y<=n;y++){points[y]=[];for(let x=0;x<=n;x++)points[y][x]=warp(x*step,y*step);}
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
   const x0=x*step,y0=y*step,x1=x0+step,y1=y0+step;
   triangle(cx,image,[[x0,y0],[x1,y0],[x1,y1]],[points[y][x],points[y][x+1],points[y+1][x+1]]);
   triangle(cx,image,[[x0,y0],[x1,y1],[x0,y1]],[points[y][x],points[y+1][x+1],points[y+1][x]]);
  }return c;
 }
 function frameTime(id,time,motion){
  return motion?Math.floor(localTime(id,time)*30)/30:time;
 }
 function isDrawReady(options={}){
  if(!ready)return false;
  const id=resolve(options.clip),time=Math.max(0,Number(options.time)||0);
  const f=frameAt(id,frameTime(id,time,options.motion!==false&&!options.reducedMotion));
  const equip=options.equipped||{};
  const current=ensureActor(f.clip,equip);
  const next=ensureActor(f.nextClip,equip);
  return current&&next;
 }
 function prepared(id,time,equipped,motion=true){
  time=frameTime(id,time,motion);
  const f=frameAt(id,time),u=motion?smooth(f.mix):0,choose=u<.5?0:1;
  const source=choose?f.nextClip:f.clip,key=choose?f.nextKey:f.key;
  const a=canonicalPose(f.clip,f.key),b=canonicalPose(f.nextClip,f.nextKey),lm=choose?b:a,target=blendedPose(a,b,u);
  const canvas=actor(source,key,equipped);
  if(!motion)return{canvas,frame:f};
  const quant=Math.round(localTime(id,time)*30),cacheKey=[id,quant,equipped.head||'',equipped.neck||''].join(':');
  if(motionCache.has(cacheKey)){stats.geometryHits++;return{canvas:motionCache.get(cacheKey),frame:f};}
  stats.geometryBuilds++;return{canvas:keep(motionCache,cacheKey,geometry(canvas,lm,target,id,time),64),frame:f};
 }
 function draw(ctx,options={}){
  if(!isDrawReady(options))return false;
  const id=resolve(options.clip),time=Math.max(0,Number(options.time)||0),size=clamp(Number(options.size)||128,32,600),f=frameAt(id,time),p=f.phase;
  const equip=options.equipped||{};const image=prepared(id,time,equip,options.motion!==false&&!options.reducedMotion).canvas;
  let x=Number(options.x)||0,y=Number(options.y)||0,rotation=Number(options.rotation)||0;
  if(options.motion!==false){
   if(id==='held'||id==='wiggle')rotation+=Math.sin(TAU*p)*.02;
   if(id==='shake')x+=Math.sin(TAU*p*3)*size*.009*Math.sin(Math.PI*p);
   if(options.rootMotion){
    if(id==='jump')y-=Math.sin(Math.PI*clamp((p-.14)/.67,0,1))*size*.58;
    if(id==='celebrate')y-=Math.sin(Math.PI*clamp((p-.14)/.62,0,1))*size*.27;
    if(id==='run')y-=Math.max(0,Math.sin(TAU*p*2))*size*.022;
    if(id==='tumble'||id==='roll'){y-=Math.sin(Math.PI*p)*size*.5;rotation+=TAU*(id==='roll'?1:2)*smooth(p);}
   }
  }
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(x,y);ctx.translate(0,-size*.43);ctx.rotate(rotation);ctx.scale((options.facing===-1?-1:1)*(id==='turn'&&p>=.5?-1:1),1);
  const scale=size/256;ctx.drawImage(image,-160*scale,(-CANON+110-32)*scale,320*scale,320*scale);
  if(id==='cry'&&!art.sprites.cry?.refined){
   ctx.fillStyle='#A4D9EF';const lm=canonicalPose(f.clip,f.key);for(let side of [-1,1]){const q=(time*2+(side<0?0:.5))%1;const tx=(lm.eye[0]+side*lm.headWidth*.21-128)*scale,ty=(lm.eye[1]+q*27-CANON+110)*scale;ctx.beginPath();ctx.ellipse(tx,ty,2.2*scale,3.8*scale,0,0,TAU);ctx.fill();}
  }
  ctx.restore();stats.draws++;return true;
 }
 const api={preload,draw,drawFrame,isDrawReady,frameAt,clips,timeline,sourceId,durationFor,landmarkFor:canonicalPose,
  strideFor:(id,size=128)=>((id==='run'?220:120)*size/256),
  itemIds:Object.keys(art?.items||{}),get ready(){return ready;},get assetsReady(){return ready;},
  releaseAssets,
  getDiagnostics:()=>({...stats,decodedImages:Object.keys(images).length,loadingImages:loading.size,actorCache:actorCache.size,motionCache:motionCache.size,geometryHz:30}),
  clearCache:()=>{for(const c of [...actorCache.values(),...motionCache.values()])c.width=c.height=1;actorCache.clear();motionCache.clear();}};
 globalThis.PurrpleRenderer=Object.freeze(api);
})();
