const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');const box={globalThis:null};box.globalThis=box;vm.createContext(box);vm.runInContext(fs.readFileSync(path.join(root,'extension/js/renderer-data.js'),'utf8'),box);vm.runInContext(fs.readFileSync(path.join(root,'extension/js/renderer.js'),'utf8'),box);const R=box.PurrpleRenderer,A=box.PurrpleArt;
test('45 clips resolve variable source frames and finite per-frame durations',()=>{assert.equal(R.clips.length,45);for(const c of R.clips){assert(c.duration>0);assert(c.sourceFrames<=c.availableFrames,`${c.id} must report its actual available source pool`);const timeline=R.timeline(c.id);assert(timeline.length>0);for(const f of timeline){assert(f.ms>0);assert(f.key>=0&&f.key<A.sprites[f.source].frames.length);}for(let n=0;n<=60;n++){const f=R.frameAt(c.id,c.duration*n/60);assert(Number.isFinite(f.mix));assert(f.key>=0&&f.key<A.sprites[f.clip].frames.length);assert(f.nextKey>=0&&f.nextKey<A.sprites[f.nextClip].frames.length);}}});
test('dense refinement is actual source art, not an expanded six-frame list',()=>{for(const id of ['walk','run','held','cry','jump','impact','turn','knead']){const s=A.sprites[id];assert(s.refined);assert(s.frames.length>=12);assert(s.sourceKeys>=12);assert.equal(new Set(s.frames.map(f=>[f.x,f.y].join(','))).size,s.frames.length);}});
test('throw recovery contracts and one-shot final frames remain stable',()=>{for(const [id,duration]of [['released',.12],['cry',1.25],['paw-wipe',.75],['soothe',1.2]]){const c=R.clips.find(c=>c.id===id);assert(Math.abs(c.duration-duration)<.00001);assert.equal(c.loop,false);const f=R.frameAt(id,1000),e=R.frameAt(id,duration);assert.equal(f.key,e.key);assert.equal(f.clip,e.clip);}});
test('normalization uses per-atlas baseline with finite accessory anchors',()=>{for(const [id,s]of Object.entries(A.sprites)){assert.equal(A.poses[id].length,s.frames.length);for(let i=0;i<s.frames.length;i++){const p=R.landmarkFor(id,i);for(const n of [...p.eye,...p.neck,p.crownY,p.headWidth,p.angle])assert(Number.isFinite(n),`${id}/${i}`);assert(p.headWidth>0);assert(p.bbox[3]<=256);}}assert.equal(R.itemIds.length,15);});
test('gait distance scales with viewing size and brush uses dedicated art when available',()=>{assert.equal(R.strideFor('walk',128),60);assert.equal(R.strideFor('walk',256),120);assert(R.strideFor('run',128)>R.strideFor('walk',128));const f=R.frameAt('brush',.3);assert.equal(f.clip,A.sprites.brush.refined?'brush':'pat');});

test('neckwear uses a source registration and a band pivot rather than the torso origin',()=>{
 for(const [clip,poses] of Object.entries(A.poses))for(const [key,pose] of poses.entries()){
  const resolved=R.landmarkFor(clip,key);
  const fit=resolved.neckFit;
  assert(Number.isFinite(fit.x)&&Number.isFinite(fit.y)&&Number.isFinite(fit.angle),clip+':'+key);
  assert(fit.scale.every(v=>v>0&&v<=1));
  assert(Math.abs(fit.y-pose.neckFit.y)<25);
 }
 const idle=R.landmarkFor('idle',0),loaf=R.landmarkFor('loaf',5),curl=R.landmarkFor('sleep',0);
 assert(idle.neckFit.y<idle.neck[1]-8);
 assert(Math.abs(loaf.neckFit.x-loaf.eye[0])<2);
 assert(curl.neckFit.x<curl.neck[0]-9 && curl.neckFit.scale[0]<.7);
 for(const item of Object.values(A.items).filter(item=>item.slot==='neck'))assert(item.pivot[1]>0&&item.pivot[1]<.25);
});
