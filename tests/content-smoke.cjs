/* Host-page interaction smoke test. Browser APIs and drawing are stubbed;
 * native Firefox integration is verified by the separate installed-addon QA.
 */
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:require('./browser_runtime.cjs').executable(),args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--disable-gpu']});
 const context=await browser.newContext({viewport:{width:1000,height:700}});const page=await context.newPage();const results=[],errors=[];
 const check=(id,pass,detail)=>results.push({id,pass:!!pass,detail});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.setContent('<button id="host-button" style="position:absolute;left:20px;top:20px;width:150px;height:50px">Host page button</button><p id="host-result"></p><script>document.querySelector("#host-button").onclick=()=>document.querySelector("#host-result").textContent="clicked";</script>');
 await page.evaluate(()=>{
  window.testMessages=[];window.testListeners=[];window.preloadCalls=0;window.cacheClears=0;window.testInactive=true;
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>testInactive});document.hasFocus=()=>!testInactive;
  window.browser={runtime:{id:'test-companion',onMessage:{addListener:fn=>testListeners.push(fn)},sendMessage:async msg=>{
   testMessages.push(msg);
   if(msg.type==='GET_STATE')return{ok:true,state:{settings:{petEnabled:true,size:128,fps:30,hiddenHosts:[],reducedMotion:false},equipped:{head:'moon-bow',neck:'star-bandana'},focus:null}};
   if(msg.type==='PET_CLAIM')return{ok:true,leaseId:'test-lease',position:{x:.82,y:1}};
   return{ok:true};
  }}};
  window.PurrpleRenderer={preload:async()=>{preloadCalls++;},clearCache:()=>cacheClears++,draw:(ctx,p)=>{window.lastRendererPose=p;ctx.fillStyle='#bda0df';ctx.beginPath();ctx.arc(p.x,p.y-p.size*.45,p.size*.35,0,Math.PI*2);ctx.fill();}};
 });
 await page.addScriptTag({content:fs.readFileSync(path.join(root,'extension/js/content.js'),'utf8')});
 check('inactive-tab-defers-art-preload',await page.evaluate(()=>preloadCalls===0));
 check('inactive-tab-has-tiny-canvas',await page.locator('purrple-companion').evaluate(h=>h.shadowRoot.querySelector('canvas').width===1));
 await page.evaluate(()=>{testInactive=false;dispatchEvent(new Event('focus'));});
 await page.waitForFunction(()=>document.querySelector('purrple-companion')?.dataset.active==='true');
 const snapshot=()=>page.evaluate(()=>PurrpleCompanionDebug.snapshot());
 check('mounted-with-active-lease',(await snapshot()).active);
 check('equipped-passed-to-renderer',await page.evaluate(()=>lastRendererPose.equipped.head==='moon-bow'&&lastRendererPose.equipped.neck==='star-bandana'));
 await page.locator('#host-button').click();check('host-page-button-clicks-through',await page.locator('#host-result').textContent()==='clicked');
 const host=page.locator('purrple-companion');
 await host.locator('.paw').click();check('play-menu-visible',await host.locator('.menu').isVisible());
 await host.locator('[data-action="pat"]').click();check('pat-state',(await snapshot()).clip==='pat');
 await host.locator('.paw').click();await host.locator('[data-action="brush"]').click();check('brush-state',(await snapshot()).clip==='brush');
 await host.locator('.house').click();await page.waitForFunction(()=>PurrpleCompanionDebug.snapshot().atHome&&document.querySelector('purrple-companion').shadowRoot.querySelector('.actor').hidden,{timeout:5000});check('home-nap-hidden',(await snapshot()).atHome&&!(await host.locator('.actor').isVisible()));
 await host.locator('.house').click();check('wake-restores-visible',!(await snapshot()).atHome&&await host.locator('.actor').isVisible());
 const box=await host.locator('.actor').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(450,260,{steps:8});
 check('drag-held-state',(await snapshot()).state==='held');
 await page.mouse.move(570,190,{steps:3});await page.mouse.up();check('release-enters-air',(await snapshot()).state==='air');
 await page.waitForTimeout(2800);let s=await snapshot();check('throw-settles-in-bounds',s.x>=0&&s.x<=1000&&s.y<=700&&s.state!=='air',s);
 await page.evaluate(()=>testListeners.forEach(fn=>fn({type:'STATE_CHANGED',state:{settings:{petEnabled:false,size:128,fps:30,hiddenHosts:[]},equipped:{head:'moon-bow',neck:'star-bandana'},focus:null}})));
 check('setting-hide-removes-companion',await host.evaluate(el=>el.style.display==='none'));
 check('hide-clears-actor-cache',await page.evaluate(()=>cacheClears>0));
 check('hide-releases-canvas-buffer',await host.evaluate(h=>h.shadowRoot.querySelector('canvas').width===1));
 check('lease-release-sent',await page.evaluate(()=>testMessages.some(m=>m.type==='PET_RELEASE')));
 check('no-page-errors',errors.length===0,errors);
 const report={scope:'Chromium DOM smoke test with stubbed browser API, renderer and deterministic document-visibility state; not native extension proof',results,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length};
 fs.mkdirSync(path.join(root,'verification'),{recursive:true});fs.writeFileSync(path.join(root,'verification/content-smoke.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();if(report.failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
