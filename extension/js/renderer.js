/* Shared Purrple actor. Approved illustrations, authored pose holds, and
 * silhouette registration. A complete dressed pose is always drawn once.
 */
(() => {
 'use strict';
 const art=globalThis.PurrpleArt, wardrobe=globalThis.PurrpleWardrobeV2, TAU=Math.PI*2, CANON=232;
 const artItems={...art.items,...Object.fromEntries((wardrobe?.items||[]).map(item=>[item.id,item]))};
 const slots=['head','neck',...(wardrobe?.slots||[])];
 const scriptURL=globalThis.document?.currentScript?.src;
 const fallbackBase=scriptURL?new URL('../',scriptURL).href:'';
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function characterSize(value){return Number.isFinite(value)?clamp(value,64,256):128;}
 // The artwork uses atlas coordinates while the preference is in viewport CSS pixels.
 // Limit the renderer only when the canvas cannot fit the dressed pose above its anchor.
 function surfaceSize(canvas,preferred,anchorY,{miniature=false}={}){
  const {width,height}=canvas.getBoundingClientRect();
  if(width<=0||height<=0||!canvas.width||!canvas.height)return 0;
  const cssScale=width/canvas.width;
  const target=characterSize(preferred)*(miniature ? .3 : 1);
  const size=Math.min(target/cssScale,(canvas.width-4)/1.05,(anchorY-2)/.98,600);
  return size>=32?size:0;
 }
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
 const images={},actorCache=new Map(),timingCache=new Map();let ready=false,pending=null,neckSurface=null,assetEpoch=0;
 const loading=new Map();
 const stats={actorBuilds:0,actorHits:0,draws:0,pixelReads:0};
 function sourceId(id){if(id==='brush'&&!art.sprites.brush?.refined)return 'pat';return Object.hasOwn(art.sprites,id)?id:(Object.hasOwn(fallback,id)?fallback[id]:'idle');}
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
  const paths=all?new Set([...Object.values(art.sprites).map(x=>x.src),...Object.values(artItems).map(x=>x.src)]):new Set([art.sprites.idle.src]);
  if(pending&&ready&&[...paths].every(p=>images[p]))return Promise.resolve(api);
  pending=Promise.all([...paths].map(loadImage)).then(()=>{ready=true;return api;});return pending;
 }
 function ensureActor(source,equipped){
  const paths=[art.sprites[source]?.src,...slots.map(slot=>artItems[equipped[slot]]?.src)].filter(Boolean);
  const missing=paths.filter(src=>!images[src]);for(const src of missing)loadImage(src).catch(()=>{});return !missing.length;
 }
 function releaseAssets(){assetEpoch++;for(const key of Object.keys(images))delete images[key];loading.clear();api.clearCache();pending=null;}
 function resolve(id){if(Object.hasOwn(aliases,id))id=aliases[id];return Object.hasOwn(defs,id)?id:'idle';}
 const defs=Object.fromEntries(baseDefs.map(([id,name,duration,loop,category])=>[id,{id,name,duration,loop:!!loop,category}]));
 function fitTiming(seq,id){const total=seq.reduce((n,f)=>n+f.ms,0),scale=defs[id].duration*1000/total;return seq.map(f=>({...f,ms:f.ms*scale}));}
 function authoredTimeline(id){
  id=resolve(id);const d=defs[id],source=sourceId(id),spec=art.sprites[source],count=spec.frames.length;
  // Dedicated refinement art owns explicit frame durations. Existing six-key
  // sheets retain short movement beats, plus intentional neutral holds.
  if(id==='home')return fitTiming([...timeline('walk'),...timeline('walk'),...timeline('walk'),...timeline('walk').slice(0,6)],id);
  if(id==='chase'){
   const gait=timeline('run'),last=timeline('walk').slice(0,5);
   const strides=[...gait,...gait,...last].map(beat=>({...beat,ms:beat.ms*.89}));
   return fitTiming([...strides,...timeline('toy')],id);
  }
  if(id==='released')return[{source,key:0,ms:defs[id].duration*1000}];
  if(id==='loaf')return fitTiming(Array.from({length:count},(_,key)=>({source,key,ms:key===count-1?10:1})),id);
  if(id==='doze')return fitTiming(Array.from({length:count},(_,i)=>({source,key:count-1-i,ms:1})),id);
  if(id==='cry'&&spec.refined)return keyBeats([0,1,2,3,4],[13,10,16,24,37]);
  if(id==='turn'&&spec.refined&&count>=12)return keyBeats([5,4,3,2,1,0,10,9,8,7,6],[9,7,8,9,8,19,8,9,8,7,8]);
  if(id==='jump'&&spec.refined)return keyBeats([0,1,2,3,4,5,6,7,8,9,10,9,1,11],[10,8,9,5,7,10,9,8,6,7,8,4,4,9]);
  if(id==='impact'&&spec.refined)return keyBeats([0,1,2,3,4,3,2,5,6,10,11],[6,6,10,10,15,10,10,6,7,9,11]);
  if(id==='pat'&&spec.refined)return keyBeats([0,1,2,3,4,3,2,8,9,10,11],[12,8,7,7,14,6,6,8,8,10,14]);
  if(id==='read'&&spec.refined)return keyBeats([0,1,2,3,4,5,6,7,8,9,8,2,1,0],[9,5,6,7,8,8,8,8,6,8,6,6,5,10]);
  if(id==='sleep'&&count===6)return keyBeats([0,1,2,3,2,1,0],[20,13,12,10,12,13,20]);
  if(id==='look'||id==='peek')return keyBeats([5,3,2,1,0,1,2,3,4,3,5],[12,7,6,7,14,7,6,6,14,7,14]);

  function keyBeats(keys,weights){return fitTiming(keys.map((key,index)=>({source,key,ms:weights[index]})),id);}
  if(spec.timing?.length===count)return fitTiming(spec.timing.map((ms,key)=>({source,key,ms})),id);
  if(spec.frames.every(f=>Number(f.durationMs)>0))return fitTiming(spec.frames.map((f,key)=>({source,key,ms:f.durationMs})),id);
  let keys=Array.from({length:count},(_,i)=>i),weights=keys.map(()=>1);
  if(count===6){
   if(id==='idle')keys=[0],weights=[1];
   if(id==='tail')keys=[0,1,2,3,5,3,2,1,0],weights=[2,1,1,1,2,1,1,1,2];
   if(id==='blink')weights=[17,1.5,1,1,1.5,8];
   if(id==='ear')weights=[6,1,1,1,1,6];
   if(id==='stretch')keys=[0,1,2,3,4,5,4,3,2,1,0],weights=[2,1,1,1,1,2,1,1,1,1,2];
   if(['study','read','think','heart','reminder','pat','brush','nuzzle','listen'].includes(id))weights=[3,1,1.3,1.8,1,3];
   if(id==='doze')weights=[1,2,2,6,2,1];
  }
  const sum=weights.reduce((a,b)=>a+b,0);return keys.map((key,i)=>({source,key,ms:d.duration*1000*weights[i]/sum}));
 }
 function timeline(id){
  id=resolve(id);
  if(!timingCache.has(id))timingCache.set(id,Object.freeze(authoredTimeline(id).map(Object.freeze)));
  return timingCache.get(id);
 }
 function durationFor(id){return defs[resolve(id)].duration;}
 function usedFrames(id){return new Set(timeline(id).map(f=>f.source+':'+f.key)).size;}
 function availableFrames(id){if(id==='home')return nframes('walk');if(id==='chase')return nframes('run')+nframes('walk')+nframes('toy');return nframes(id);}
 const clips=baseDefs.map(([id])=>({...defs[id],duration:durationFor(id),sourceFrames:usedFrames(id),availableFrames:availableFrames(id),geometryHz:30,stride:id==='walk'?120:id==='run'?220:0,artwork:['home','chase'].includes(id)?'composed movement sequence':art.sprites[id]?'dedicated illustrated keys':'composed from '+sourceId(id),timing:'per-frame durations'}));
 function localTime(id,t){const d=durationFor(id);return defs[id].loop?((Math.max(0,t)%d)+d)%d:clamp(Math.max(0,t),0,d-.000001);}
 function rawSample(id,time){
  id=resolve(id);const duration=durationFor(id),local=localTime(id,time),phase=clamp(local/duration,0,.999999);
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
  const fit=wardrobe?.anchors[source]?.[clamp(key|0,0,poses.length-1)];
  p.accessoryFit=fit?{
   ear:fit.b?[fit.b[0]*256,fit.b[1]*256+offset]:null,
   eyes:fit.e.map(([x,y,w,h])=>[x*256,y*256+offset,w*256,h*256]),
   paw:fit.p?[fit.p[0]*256,fit.p[1]*256+offset,fit.p[2]*256]:null,
   lap:fit.l?[fit.l[0]*256,fit.l[1]*256+offset,fit.l[2]*256,fit.l[3]*256,fit.l[4]]:null
  }:null;
  p.paws=(raw.paws||[[raw.eye[0]-raw.headWidth*.13,CANON-offset-8],[raw.eye[0]+raw.headWidth*.13,CANON-offset-8]]).map(pt=>[pt[0],pt[1]+offset,...pt.slice(2)]);
  return p;
 }
 function base(ctx,source,key){const spec=art.sprites[source]||art.sprites.idle;const f=spec.frames[clamp(key|0,0,spec.frames.length-1)];ctx.drawImage(images[spec.src],f.x,f.y,f.w||256,f.h||256,0,CANON-(spec.baseline||CANON),256,256);}
 function item(ctx,id,lm,slot){
  const cfg=artItems[id],im=images[cfg?.src];if(!cfg||!im||cfg.slot!==slot)return;
  const overrides=art.fitOverrides?.[id]?.[lm.family||'']||{};
  const width=lm.headWidth,profile=lm.profile?.72:1;
  ctx.save();
  if(slot==='head'&&cfg.earAnchor&&lm.accessoryFit?.ear){
   const [x,y]=lm.accessoryFit.ear,w=width*cfg.w,h=width*cfg.h;
   ctx.translate(x,y);ctx.rotate(lm.angle||0);ctx.drawImage(im,-w/2,-h/2,w,h);
  }else if(slot==='head'){
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
 function line(ctx,points,color,width){
  ctx.beginPath();ctx.moveTo(...points[0]);for(const p of points.slice(1))ctx.lineTo(...p);
  ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke();
 }
 function faceDetail(ctx,id,lm){
  const cfg=artItems[id],image=images[cfg?.src],eyes=lm.accessoryFit?.eyes;
  if(!image||cfg.slot!=='face'||!eyes?.length)return;
  const [left,right]=eyes,angle=right?Math.atan2(right[1]-left[1],right[0]-left[0]):0;
  const lensSizes=eyes.map(([,,width,height])=>Math.max(lm.headWidth*.175,Math.max(width,height)*cfg.lens));
  ctx.save();
  if(right){
   const distance=Math.hypot(right[0]-left[0],right[1]-left[1]);
   const start=[left[0]+Math.cos(angle)*lensSizes[0]*.43,left[1]+Math.sin(angle)*lensSizes[0]*.43-2];
   const end=[right[0]-Math.cos(angle)*lensSizes[1]*.43,right[1]-Math.sin(angle)*lensSizes[1]*.43-2];
   if(distance>19)line(ctx,[start,[(start[0]+end[0])/2,(start[1]+end[1])/2-2],end],cfg.bridge,3.75);
   line(ctx,[[left[0]-lensSizes[0]*.44,left[1]-3],[left[0]-lensSizes[0]*.67,left[1]-5]],cfg.bridge,3.2);
   line(ctx,[[right[0]+lensSizes[1]*.44,right[1]-3],[right[0]+lensSizes[1]*.66,right[1]-5]],cfg.bridge,3.2);
  }else{
   const [x,y]=left,len=lensSizes[0];
   line(ctx,[[x-len*.35,y-len*.10],[x-lm.headWidth*.36,y-len*.26],[x-lm.headWidth*.41,y-len*.13]],cfg.bridge,4);
   line(ctx,[[x-len*.45,y-len*.14],[x-lm.headWidth*.34,y-len*.24]],cfg.highlight,1.4);
  }
  eyes.forEach(([x,y],i)=>{
   const side=lensSizes[i],w=right?side:side*.88,h=side*(id==='study-frames'?.86:1);
   ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.drawImage(image,-w/2,-h/2,w,h);ctx.restore();
  });
  ctx.restore();
 }
 function fittedLayer(ctx,id,lm,slot){
  const cfg=artItems[id],image=images[cfg?.src],fit=lm.accessoryFit;
  const point=slot==='paw'?fit?.paw:fit?.lap;
  if(!image||cfg.slot!==slot||!point)return;
  const [x,y,width,height,angle]=point,[px,py]=cfg.pivot;
  const w=slot==='paw'?lm.headWidth*cfg.w:width,h=slot==='paw'?lm.headWidth*cfg.h:height;
  ctx.save();ctx.translate(x,y);ctx.rotate(slot==='paw'?cfg.tilt:angle);ctx.drawImage(image,-w*px,-h*py,w,h);ctx.restore();
 }
 function drawFrame(ctx,source='idle',key=0,equipped={}){
  source=sourceId(source);const lm=canonicalPose(source,key);base(ctx,source,key);
  if(equipped.body)fittedLayer(ctx,equipped.body,lm,'body');
  if(equipped.neck){
   const off=neckSurface||(neckSurface=document.createElement('canvas'));if(off.width!==256)off.width=off.height=256;const oc=off.getContext('2d');oc.setTransform(1,0,0,1,0,0);oc.globalCompositeOperation='source-over';oc.clearRect(0,0,256,256);item(oc,equipped.neck,lm,'neck');oc.globalCompositeOperation='destination-in';base(oc,source,key);ctx.drawImage(off,0,0);
   restoreMask(ctx,source,key,c=>{c.beginPath();if(lm.facePolygon?.length){c.moveTo(...lm.facePolygon[0]);for(const p of lm.facePolygon.slice(1))c.lineTo(...p);c.closePath();}else{c.save();c.translate(...lm.eye);c.rotate(lm.angle||0);c.ellipse(0,-lm.headWidth*.10,lm.headWidth*.54,lm.headWidth*.51,0,0,TAU);c.restore();}});
   if(lm.restoreProps)restoreMask(ctx,source,key,c=>{c.beginPath();c.rect(0,lm.propY,256,256-lm.propY);});
  }
  if(equipped.head){item(ctx,equipped.head,lm,'head');if(artItems[equipped.head]?.kind==='hat'&&lm.earPolygons.length)restoreMask(ctx,source,key,c=>{c.beginPath();for(const ps of lm.earPolygons){c.moveTo(...ps[0]);for(const p of ps.slice(1))c.lineTo(...p);c.closePath();}});}
  if(equipped.face)faceDetail(ctx,equipped.face,lm);
  if(equipped.paw&&lm.accessoryFit?.paw){
   fittedLayer(ctx,equipped.paw,lm,'paw');
   const [x,y,r]=lm.accessoryFit.paw;
   restoreMask(ctx,source,key,c=>{c.beginPath();c.ellipse(x+1,y+2,r*.62,r*.49,0,0,TAU);});
  }
  if(lm.foregroundPolygons.length&&slots.some(slot=>equipped[slot]))restoreMask(ctx,source,key,c=>{c.beginPath();for(const ps of lm.foregroundPolygons){c.moveTo(...ps[0]);for(const p of ps.slice(1))c.lineTo(...p);c.closePath();}});
 }
 function keep(cache,key,value,max){cache.set(key,value);if(cache.size>max){const oldKey=cache.keys().next().value,old=cache.get(oldKey);cache.delete(oldKey);if(old&&old!==value){old.width=old.height=1;}}return value;}
 function actor(source,key,equipped){
  const id=[source,key,...slots.map(slot=>equipped[slot]||'')].join(':');if(actorCache.has(id)){stats.actorHits++;return actorCache.get(id);}
  const c=document.createElement('canvas');c.width=c.height=320;const cc=c.getContext('2d');cc.translate(32,32);cc.imageSmoothingEnabled=false;drawFrame(cc,source,key,equipped);stats.actorBuilds++;return keep(actorCache,id,c,110);
 }
 // Read the silhouette, not synthetic eye detections. The closed-eye,
 // profile and prop drawings have visibly different face landmarks.
 function registration(source,key,rootCentered){
  const point=art.registration[source][key],sprite=art.sprites[source];
  const y=rootCentered?point[2]:point[1];
  return {x:point[0],y:y+CANON-(sprite.baseline||CANON)};
 }
 function playbackPose(id,f,motion){
  const u=motion?smooth(f.mix):0;
  // Turn at the frontal key. Keep exactly one facing while that key is
  // visible, then change facing on the next drawn three-quarter pose.
  const swap=u>=.5,source=swap?f.nextClip:f.clip,key=swap?f.nextKey:f.key;
  const rootCentered=['jump','chase','toy'].includes(id);
  const a=registration(f.clip,f.key,rootCentered),b=registration(f.nextClip,f.nextKey,rootCentered),shown=swap?b:a;
  const x=lerp(a.x,b.x,u),y=lerp(a.y,b.y,u),turn=id==='turn';
  const flipped=turn&&key>=6;
  const travel=['walk','run','home','chase','jump'].includes(id);
  const xFollow=turn ? 0 : travel ? .42 : .26, limit=turn ? 48 : 28;
  const shiftX=clamp(128+(x-128)*xFollow-shown.x,-limit,limit);
  const freelyHeld=['held','wiggle','tumble','released','roll'].includes(id);
  const scaleRoom=rootCentered ? .18 : .10;
  const scaleY=motion&&!freelyHeld?clamp((CANON-y)/(CANON-shown.y||1),1-scaleRoom,1+scaleRoom):1;
  const shiftY=motion&&freelyHeld?clamp(y-shown.y,-7,7):0;
  const breath=motion&&['idle','sleep','loaf'].includes(id)
    ?1+Math.sin(f.phase*TAU)*.007:1;
  return{source,key,shiftX,shiftY,scaleY:scaleY*breath,flip:flipped};
 }
 function isDrawReady(options={}){
  if(!ready)return false;
  const id=resolve(options.clip),time=Math.max(0,Number(options.time)||0);
  const f=frameAt(id,time),equip=options.equipped||{};
  const current=ensureActor(f.clip,equip);
  if(f.nextClip===f.clip)return current;
  const next=ensureActor(f.nextClip,equip);
  return options.motion!==false&&!options.reducedMotion&&f.mix>=.5?next:current;
 }
 function draw(ctx,options={}){
  if(!isDrawReady(options))return false;
  const id=resolve(options.clip),time=Math.max(0,Number(options.time)||0),size=clamp(Number(options.size)||128,32,600),f=frameAt(id,time),p=f.phase;
  const motion=options.motion!==false&&!options.reducedMotion;
  const pose=playbackPose(id,f,motion),image=actor(pose.source,pose.key,options.equipped||{});
  let x=Number(options.x)||0,y=Number(options.y)||0,rotation=Number(options.rotation)||0;
  if(motion){
   if(id==='held'||id==='wiggle')rotation+=Math.sin(TAU*p)*.012;
   if(options.rootMotion){
    if(id==='jump')y-=Math.sin(Math.PI*clamp((p-.14)/.67,0,1))*size*.58;
    if(id==='celebrate')y-=Math.sin(Math.PI*clamp((p-.14)/.62,0,1))*size*.27;
    if(id==='run')y-=Math.max(0,Math.sin(TAU*p*2))*size*.022;
    if(id==='tumble'||id==='roll'){y-=Math.sin(Math.PI*p)*size*.5;rotation+=TAU*(id==='roll'?1:2)*smooth(p);}
   }
  }
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.translate(x,y);ctx.translate(0,-size*.43);ctx.rotate(rotation);ctx.scale((options.facing===-1?-1:1)*(pose.flip?-1:1),1);
  const scale=size/256;
  ctx.translate(pose.shiftX*scale,(110+pose.shiftY)*scale);
  ctx.scale(1,pose.scaleY);
  ctx.drawImage(image,-160*scale,(-CANON-32)*scale,320*scale,320*scale);
  if(id==='cry'&&!art.sprites.cry?.refined){
   ctx.fillStyle='#A4D9EF';const lm=canonicalPose(f.clip,f.key);for(let side of [-1,1]){const q=(time*2+(side<0?0:.5))%1;const tx=(lm.eye[0]+side*lm.headWidth*.21-128)*scale,ty=(lm.eye[1]+q*27-CANON)*scale;ctx.beginPath();ctx.ellipse(tx,ty,2.2*scale,3.8*scale,0,0,TAU);ctx.fill();}
  }
  ctx.restore();stats.draws++;return true;
 }
 const api={preload,draw,drawFrame,isDrawReady,characterSize,surfaceSize,frameAt,clips,timeline,sourceId,durationFor,landmarkFor:canonicalPose,
  strideFor:(id,size=128)=>((id==='run'?220:120)*size/256),
  itemIds:Object.keys(artItems),itemFit:id=>artItems[id],get ready(){return ready;},get assetsReady(){return ready;},
  releaseAssets,
  getDiagnostics:()=>({...stats,decodedImages:Object.keys(images).length,loadingImages:loading.size,actorCache:actorCache.size,geometryHz:30}),
  clearCache:()=>{for(const c of actorCache.values())c.width=c.height=1;actorCache.clear();}};
 globalThis.PurrpleRenderer=Object.freeze(api);
})();
