/* Independent black-box journeys for the actual shared-renderer motion studio.
 * No production writes, fake user ratings, or native-extension claims.
 */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'verification/review/explorer-round1.json');
const checks=[],errors=[],requests=[],measurements=[],screenshots=[],outfits=[],sourceCounts=[];
const check=(name,pass,detail)=>{const r={name,pass:!!pass,...(detail===undefined?{}:{detail})};checks.push(r);if(!pass)console.log('FAIL',JSON.stringify(r));};
const digest=()=>Object.fromEntries(['extension/animations.html','extension/js/animation-explorer.js','extension/js/renderer.js','extension/js/renderer-data.js'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')]));
const before=digest();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'purrple-explorer-review-'));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const browser=await chromium.launch({executablePath:require('./browser_runtime.cjs').executable(),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--disable-gpu','--allow-file-access-from-files']});
 const page=await browser.newPage({viewport:{width:1280,height:1000},acceptDownloads:true});
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
 const state=()=>page.evaluate(()=>PurrpleMotionStudio.getState());
 const select=async id=>page.evaluate(id=>{PurrpleMotionStudio.select(id);PurrpleMotionStudio.seek(PurrpleMotionStudio.clips.find(c=>c.id===id).duration*.4);},id);
 // Ignore the floor/shadow band: it is stage scenery, not character geometry.
 const pixels=()=>page.evaluate(()=>{
   const c=document.querySelector('#stage'),g=c.getContext('2d'),d=g.getImageData(0,0,c.width,c.height).data;let hash=2166136261,ink=0,minx=c.width,maxx=0,miny=c.height,maxy=0;
   for(let y=0;y<480;y++)for(let x=0;x<c.width;x++){let i=(y*c.width+x)*4;const r=d[i],v=d[i+1],b=d[i+2];if(b>v+9&&r<232&&b>85){ink++;minx=Math.min(x,minx);maxx=Math.max(x,maxx);miny=Math.min(y,miny);maxy=Math.max(y,maxy);}if(x%3===0&&y%3===0)hash=Math.imul(hash^r^(v<<8)^(b<<16),16777619)>>>0;}
   return{hash,ink,bbox:[minx,miny,maxx,maxy],center:(minx+maxx)/2,background:document.querySelector('#background').value,samples:[[...g.getImageData(0,0,1,1).data],[...g.getImageData(24,0,1,1).data]]};
 });
 async function snapshot(name){const p=path.join(tmp,name+'.png');await page.screenshot({path:p,fullPage:true});screenshots.push(p);}
 try{
  await page.goto('file://'+path.join(root,'extension/animations.html'));await page.waitForFunction(()=>globalThis.PurrpleMotionStudio?.getState().ready,null,{timeout:45000});
  check('all-45-clips-populate-library',await page.locator('#clips button').count()===45);
  const clips=await page.evaluate(()=>PurrpleMotionStudio.clips.map(c=>({id:c.id,name:c.name,duration:c.duration,sourceFrames:c.sourceFrames,availableFrames:c.availableFrames,geometryHz:c.geometryHz})));
  for(const clip of clips){
   await select(clip.id);const s=await state(),px=await pixels();
   const samples=await page.evaluate(id=>{const c=PurrpleMotionStudio.clips.find(c=>c.id===id),set=new Set();for(let i=0;i<1000;i++){const f=PurrpleRenderer.frameAt(id,c.duration*i/1000);set.add(f.clip+':'+f.key);set.add(f.nextClip+':'+f.nextKey);}return[...set];},clip.id);
   sourceCounts.push({id:clip.id,reported:clip.sourceFrames,observedKeys:samples.length,available:clip.availableFrames,geometryHz:clip.geometryHz});
   check('clip-renders-'+clip.id,s.id===clip.id&&px.ink>1000&&s.errors.length===0,{ink:px.ink,bbox:px.bbox});
   check('honest-source-count-'+clip.id,clip.sourceFrames===samples.length,{reported:clip.sourceFrames,observed:samples.length});
  }
  const items=await page.evaluate(()=>Object.entries(PurrpleArt.items).map(([id,v])=>({id,slot:v.slot})));
  check('all-fifteen-items-in-ui',items.length===15&&(await page.locator('#head option').count())+(await page.locator('#neck option').count())===17);
  await select('idle');await page.locator('#reset-outfit').click();const bare=await pixels();
  for(const item of items){
   await page.locator('#reset-outfit').click();await page.locator('#'+item.slot).selectOption(item.id);const s=await state(),px=await pixels();
   outfits.push({item:item.id,slot:item.slot,hash:px.hash,bareHash:bare.hash});
   check('preview-item-'+item.id,s.outfit[item.slot]===item.id&&px.hash!==bare.hash,{outfit:s.outfit,ink:px.ink});
  }
  const head=items.find(x=>x.id==='moon-bow')||items.find(x=>x.slot==='head'),neck=items.find(x=>x.id==='star-bandana')||items.find(x=>x.slot==='neck');
  await page.locator('#head').selectOption(head.id);await page.locator('#neck').selectOption(neck.id);
  for(const id of ['walk','sleep','stretch','held','tumble','study','cry','wave']){
   await select(id);const s=await state(),combined=await pixels();
   await page.locator('#reset-outfit').click();const naked=await pixels();
   await page.locator('#head').selectOption(head.id);const headOnly=await pixels();
   await page.locator('#neck').selectOption(neck.id);const full=await pixels();
   check('head-neck-combine-'+id,s.outfit.head===head.id&&s.outfit.neck===neck.id&&combined.hash!==naked.hash&&full.hash!==headOnly.hash,{combined:full.hash,head:headOnly.hash,bare:naked.hash});
  }
  await page.locator('#reset-outfit').click();check('clear-outfit-clears-both-slots',await page.evaluate(()=>{let s=PurrpleMotionStudio.getState();return!s.outfit.head&&!s.outfit.neck;}));
  await page.locator('#search').fill('NO-SUCH-LITTLE-MOVEMENT');check('search-useful-empty-state',await page.locator('#clips button').count()===0&&/no movements/i.test(await page.locator('#clips').innerText()));
  await page.locator('#clear').click();check('clear-search-restores45-and-focus',await page.locator('#clips button').count()===45&&await page.locator('#search').evaluate(e=>e===document.activeElement));
  await page.locator('#categories button').filter({hasText:/^Movement$/}).focus();await page.keyboard.press('Enter');
  check('category-restricts-results',await page.locator('#clips button').count()>0&&await page.locator('#clips button').count()<45);
  check('category-keyboard-focus-preserved',await page.locator('#categories button').filter({hasText:/^Movement$/}).evaluate(e=>e===document.activeElement));
  await page.locator('#categories button').filter({hasText:/^All$/}).click();await page.locator('[data-clip="walk"]').focus();await page.keyboard.press('Enter');
  check('clip-keyboard-focus-preserved',await page.locator('[data-clip="walk"]').evaluate(e=>e===document.activeElement));
  await page.evaluate(()=>{PurrpleMotionStudio.select('idle');PurrpleMotionStudio.pause();});let s=await state();await wait(250);check('pause-freezes-time',Math.abs((await state()).time-s.time)<.001);
  await page.locator('#next').click();check('step-forward-one-presentation-frame',Math.abs((await state()).time-1/30)<.001);
  await page.locator('#previous').click();check('step-back-restores-zero',Math.abs((await state()).time)<.001);
  await page.locator('#scrub').evaluate(e=>{e.value=750;e.dispatchEvent(new Event('input',{bubbles:true}));});s=await state();check('scrub-precise-and-paused',!s.playing&&Math.abs(s.time-s.source.duration*.75)<.01);
  await page.locator('#restart').click();await wait(150);s=await state();check('restart-replays-current-clip',s.playing&&s.time>.03&&s.time<.5);
  await page.locator('#speed').selectOption('.25');await page.locator('#restart').click();await wait(800);s=await state();check('quarter-speed-advances-correctly',s.time>.12&&s.time<.3,s.time);await page.locator('#speed').selectOption('1');
  await page.evaluate(()=>{const c=document.querySelector('#stage'),g=c.getContext('2d'),fill=g.fillRect.bind(g);g.fillRect=(...v)=>{if(v[0]===0&&v[1]===0&&v[2]===960&&v[3]===600)window.__paint++;return fill(...v);};});
  for(const fps of ['24','30','60']){
   await page.locator('#fps').selectOption(fps);await page.evaluate(()=>{PurrpleMotionStudio.select('idle');window.__paint=0;window.__start=performance.now();});await wait(1500);
   const rate=await page.evaluate(()=>window.__paint*1000/(performance.now()-window.__start));measurements.push({requested:+fps,rendered:+rate.toFixed(2)});
   check('display-fps-'+fps,(await state()).fps===+fps&&rate>+fps*.55&&rate<+fps*1.25,rate);
  }
  await page.locator('#fps').selectOption('30');await page.evaluate(()=>PurrpleMotionStudio.select('wave'));await wait(1500);s=await state();check('one-shot-stops-at-end',!s.playing&&Math.abs(s.time-s.source.duration)<.02,s);
  await page.evaluate(()=>PurrpleMotionStudio.select('wave'));await page.locator('#loop').check();await wait(1500);s=await state();check('loop-checkbox-repeats-one-shot',s.playing&&s.time<s.source.duration,s.time);
  await select('walk');await page.locator('#facing').uncheck();const right=await pixels();await page.locator('#facing').check();const left=await pixels();check('face-left-changes-render',left.hash!==right.hash);await page.locator('#facing').uncheck();
  await page.locator('#size').evaluate(e=>{e.value=128;e.dispatchEvent(new Event('input',{bubbles:true}));});const small=await pixels();await page.locator('#size').evaluate(e=>{e.value=384;e.dispatchEvent(new Event('input',{bubbles:true}));});const large=await pixels();check('size-control-changes-rendered-size',large.ink>small.ink*3&&await page.locator('#size-label').innerText()==='384 px',{small:small.ink,large:large.ink});
  await page.locator('#size').evaluate(e=>{e.value=256;e.dispatchEvent(new Event('input',{bubbles:true}));});
  for(const background of ['paper','dark','checker']){await page.locator('#background').selectOption(background);const first=await page.evaluate(()=>[...document.querySelector('#stage').getContext('2d').getImageData(0,0,1,1).data]);check('background-'+background,first[3]===255,first);}
  await page.locator('#background').selectOption('paper');
  // Inspect the same explicit timeline position on both sides; background RAF
  // scheduling must not decide whether a Travel toggle comparison passes.
  await select('walk');await page.locator('#travel').check();await page.evaluate(()=>PurrpleMotionStudio.render());const traveled=await pixels();await page.locator('#travel').uncheck();await page.evaluate(()=>PurrpleMotionStudio.render());const still=await pixels();check('travel-control-moves-character',Math.abs(traveled.center-still.center)>20,{traveled,still,inspectedSeconds:(await state()).time});
  await page.locator('#travel').check();await page.evaluate(()=>PurrpleMotionStudio.seek(.65));
  // Dispatch the actual DOM handlers synchronously, then pause and paint in the
  // same turn. Both comparisons are at time0; an old R handler that forgot to
  // reset elapsed still retains the .65s displacement and fails unchanged5px.
  const keyTime=await page.evaluate(()=>{document.activeElement?.blur();document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'r',code:'KeyR',bubbles:true}));PurrpleMotionStudio.pause();PurrpleMotionStudio.render();return PurrpleMotionStudio.getState().time;});const keyRestart=await pixels();
  const buttonTime=await page.evaluate(()=>{document.querySelector('#restart').click();PurrpleMotionStudio.pause();PurrpleMotionStudio.render();return PurrpleMotionStudio.getState().time;});const buttonRestart=await pixels();check('R-restart-matches-button-travel-position',keyTime===0&&buttonTime===0&&Math.abs(keyRestart.center-buttonRestart.center)<5,{keyboard:keyRestart.center,button:buttonRestart.center,keyboardSeconds:keyTime,buttonSeconds:buttonTime});await page.locator('#travel').uncheck();
  await page.locator('h1').click();await page.keyboard.press('Space');const k1=await state();await page.keyboard.press('Space');const k2=await state();check('space-toggles-playback',k1.playing!==k2.playing);
  await page.evaluate(()=>PurrpleMotionStudio.seek(0));await page.locator('h1').click();await page.keyboard.press('ArrowRight');check('keyboard-arrow-steps',Math.abs((await state()).time-1/30)<.001);
  const downloadEvent=page.waitForEvent('download');await page.locator('#export').click();const download=await downloadEvent,downloadPath=path.join(tmp,'saved-pose.png');await download.saveAs(downloadPath);const png=fs.readFileSync(downloadPath);check('save-pose-downloads512PNG',png.readUInt32BE(16)===512&&png.readUInt32BE(20)===512,{filename:download.suggestedFilename(),bytes:png.length});
  await page.locator('#speed').selectOption('2');await page.locator('#tour').click();const tourStart=(await state()).id;await wait(1900);check('tour-advances-to-next-movement',(await state()).id!==tourStart,{start:tourStart,after:(await state()).id});await page.locator('#speed').selectOption('1');await select('idle');
  for(const width of [1280,390,320]){await page.setViewportSize({width,height:900});check('no-horizontal-overflow-'+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));check('controls-fit-'+width,await page.locator('.options select').evaluateAll(els=>els.every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})));await snapshot('explorer-'+width);}
  await page.emulateMedia({reducedMotion:'reduce'});await page.reload();await page.waitForFunction(()=>PurrpleMotionStudio.getState().ready);check('reduced-motion-starts-paused',!(await state()).playing);await page.locator('[data-clip="walk"]').click();check('explicit-play-allowed-with-reduced-motion',(await state()).playing);
  check('no-runtime-errors',errors.length===0,errors);check('no-network-requests',requests.length===0,requests);
 }catch(e){check('complete-journey',false,e.stack||String(e));}
 const after=digest();const changed=Object.keys(before).filter(k=>before[k]!==after[k]);
 const report={scope:'Independent black-box motion explorer checks in Chromium headless shell under a local file URL. Not native Firefox extension evidence, not human-user validation.',passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length,checks,measurements,sourceCounts,outfits,errors,requests,screenshots,sourceDigests:{before,after,changedDuringRun:changed}};
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed,measurements,failedChecks:checks.filter(c=>!c.pass),screenshots,changedDuringRun:changed},null,2));await browser.close();if(report.failed)process.exitCode=1;
})();
