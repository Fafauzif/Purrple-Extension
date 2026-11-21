/* DOM interaction checks with real runtime artwork, stubbed extension APIs and deterministic
 * visibility. Native Firefox integration is a separate installed-addon suite.
 * The test fixture captures its own closed root; production exposes no getter.
 */
const fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:require('./browser_runtime.cjs').executable(),args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--disable-gpu']});
 const context=await browser.newContext({viewport:{width:1000,height:700}}),page=await context.newPage(),results=[],errors=[];
 await page.clock.install();
 const check=(id,pass,detail)=>results.push({id,pass:!!pass,detail});
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route('https://extension.invalid/**',route=>{const url=new URL(route.request().url());if(url.pathname.startsWith('/assets/')){const file=path.join(root,'extension',url.pathname);return route.fulfill({contentType:url.pathname.endsWith('.png')?'image/png':'application/octet-stream',body:fs.readFileSync(file)});}return route.fulfill({contentType:'text/html',body:'<!doctype html><button>Private UI fixture</button><script>parent.postMessage({source:"purrple-panel",type:"READY"},"*")</script>'});});
 await page.setContent('<button id="host-button" style="position:absolute;left:20px;top:20px;width:150px;height:50px">Host button</button><p id="host-result"></p><script>document.querySelector("#host-button").onclick=()=>document.querySelector("#host-result").textContent="clicked";</script>');
 await page.evaluate(()=>{
  window.testMessages=[];window.testListeners=[];window.holdReply=null;window.preloadCalls=0;window.cacheClears=0;window.testInactive=true;
  Object.defineProperty(document,'hidden',{configurable:true,get:()=>testInactive});document.hasFocus=()=>!testInactive;
  const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){const shadow=attach.call(this,options);if(this.localName==='purrple-companion')window.testShadowRoot=shadow;return shadow;};
  window.browser={runtime:{id:'test-companion',getURL:p=>'https://extension.invalid/'+p,onMessage:{addListener:fn=>testListeners.push(fn)},sendMessage:async msg=>{
   testMessages.push(msg);
   if(msg.type==='GET_STATE')return{ok:true,state:{settings:{petEnabled:true,size:128,fps:30,hiddenHosts:[],reducedMotion:false},equipped:{head:'moon-bow',neck:'star-bandana'},focus:null}};
   if(msg.type==='PET_CLAIM')return{ok:true,leaseId:'test-lease',position:{x:.82,y:1}};
   if(msg.type==='PET_TALK')return new Promise(resolve=>{holdReply=()=>resolve({ok:true,reply:{id:'delayed',text:'A tiny hello that arrived late.',reaction:'heart'}});});
   if(msg.type==='PET_PANEL_OPEN')return{ok:true,token:'fixture-capability',url:'https://extension.invalid/popup.html?panel=1&token=fixture-capability'};
   return{ok:true};
  }}};
 });
 await page.addScriptTag({content:fs.readFileSync(path.join(root,'extension/js/renderer-data.js'),'utf8')});
 await page.addScriptTag({content:fs.readFileSync(path.join(root,'extension/js/renderer.js'),'utf8')});
 await page.evaluate(()=>{const actual=PurrpleRenderer;window.releaseCalls=0;window.PurrpleRenderer={...actual,preload:async options=>{preloadCalls++;return actual.preload(options);},clearCache:()=>{cacheClears++;actual.clearCache();},releaseAssets:()=>{releaseCalls++;actual.releaseAssets();},draw:(ctx,p)=>{window.lastRendererPose=p;window.lastDrawSucceeded=actual.draw(ctx,p);return lastDrawSucceeded;}};});
 await page.addScriptTag({content:fs.readFileSync(path.join(root,'extension/js/pet-menu.js'),'utf8')});
 await page.addScriptTag({content:fs.readFileSync(path.join(root,'extension/js/content.js'),'utf8')});
 const part=async sel=>(await page.evaluateHandle(sel=>testShadowRoot.querySelector(sel),sel)).asElement();
 const click=async sel=>(await part(sel)).click();
 const snapshot=()=>page.evaluate(()=>PurrpleCompanionDebug.snapshot());
 const waitClip=clip=>page.waitForFunction(clip=>document.querySelector('purrple-companion').dataset.clip===clip,clip,{timeout:9000});
 const menu=async()=>{if(await page.evaluate(()=>testShadowRoot.querySelector('.menu').hidden))await click('.actor');};
 const choose=async category=>{await menu();await click('.menu [data-action="'+category+'"]');};
 check('inactive-tab-defers-art-preload',await page.evaluate(()=>preloadCalls===0));
 check('inactive-tab-has-tiny-canvas',await page.evaluate(()=>testShadowRoot.querySelector('canvas').width===1));
 check('closed-root-hides-private-iframe-dom',await page.locator('purrple-companion').evaluate(h=>h.shadowRoot===null));
 await page.evaluate(()=>{testInactive=false;dispatchEvent(new Event('focus'));});
 await page.waitForFunction(()=>document.querySelector('purrple-companion')?.dataset.active==='true');
 check('mounted-with-active-lease',(await snapshot()).active);
 check('equipped-passed-to-renderer',await page.evaluate(()=>lastRendererPose.equipped.head==='moon-bow'&&lastRendererPose.equipped.neck==='star-bandana'));
 await page.locator('#host-button').click();check('host-page-button-clicks-through',await page.locator('#host-result').textContent()==='clicked');
 await choose('talk');await click('.menu [data-action=joke]');
 await page.keyboard.press('Escape');
 await page.evaluate(()=>holdReply());
 await page.clock.runFor(300);
 check('late-talk-response-cannot-reopen-dismissed-menu',await page.evaluate(()=>testShadowRoot.querySelector('.speech').hidden&&testShadowRoot.querySelector('.menu').hidden));
 await page.evaluate(()=>{
  testListeners.forEach(fn=>fn({type:'STATE_CHANGED',state:{settings:{petEnabled:true,size:128,fps:30,hiddenHosts:[],reducedMotion:false},equipped:{head:'moon-bow',neck:'star-bandana'},focus:null,talk:{last:{id:'broadcast-reply',text:'Private reply from another surface.',reaction:'heart',at:Date.now()}}}}));
 });
 check('broadcast-reply-does-not-show-in-webpage',await page.evaluate(()=>testShadowRoot.querySelector('.speech').hidden));
 await page.evaluate(()=>{
  testInactive=true;document.dispatchEvent(new Event('visibilitychange'));
  testListeners.forEach(fn=>fn({type:'REMINDER_NOTICE'}));
  window.realDateNow=Date.now;Date.now=()=>realDateNow()+61000;
  testInactive=false;document.dispatchEvent(new Event('visibilitychange'));
 });
 await page.waitForFunction(()=>PurrpleCompanionDebug.snapshot().active);
 check('expired-queued-notice-is-discarded',await page.evaluate(()=>testShadowRoot.querySelector('.speech').hidden));
 await page.evaluate(()=>{Date.now=realDateNow;});
 await menu();check('menu-six-primary-actions',await page.evaluate(()=>testShadowRoot.querySelectorAll('.actions > button').length===6));
 check('menu-primary-actions-fit-viewport',await page.evaluate(()=>[...testShadowRoot.querySelectorAll('.actions > button')].every(button=>{const r=button.getBoundingClientRect();return r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})));
 await click('[data-action="care"]');await click('[data-action="pat"]');check('pat-state',(await snapshot()).clip==='pat');
 for(const id of ['knead','wave','roll','loaf','nuzzle','stretch']){
  const tricksInCare=await page.evaluate(()=>!testShadowRoot.querySelector('.paw'));
  await choose(tricksInCare?'care':'play');await click('.menu [data-action=tricks]');
  check('play-drawer-'+id,await page.evaluate(()=>testShadowRoot.querySelector('.menu').dataset.level==='tricks'));
  await click('.menu [data-action="'+id+'"]');
  await page.waitForFunction(id=>lastRendererPose?.clip===id&&lastDrawSucceeded,id);
  check('product-plays-real-art-'+id,(await snapshot()).clip===id);
 }
 await choose('care');await click('[data-action="brush"]');check('brush-state',(await snapshot()).clip==='brush');
 await click('.house');await page.waitForFunction(()=>PurrpleCompanionDebug.snapshot().atHome&&testShadowRoot.querySelector('.actor').hidden,null,{timeout:7000});check('home-nap-hidden',(await snapshot()).atHome);
 await click('.house');check('wake-restores-visible',!(await snapshot()).atHome&&await(await part('.actor')).isVisible());
 await choose('today');
 await page.waitForFunction(()=>!!testShadowRoot.querySelector('.panel iframe'));
 check('floating-dashboard-uses-capability-url',await page.evaluate(()=>testShadowRoot.querySelector('.panel iframe').src.includes('token=fixture-capability')));
 await page.waitForFunction(()=>testShadowRoot.querySelector('.panel-status').hidden);
 check('floating-dashboard-ready',true);
 await page.locator('#host-button').click();
 check('outside-click-dismisses-unpinned-panel',await page.evaluate(()=>testShadowRoot.querySelector('.panel').hidden));
 check('panel-close-revokes-capability',await page.evaluate(()=>testMessages.some(m=>m.type==='PET_PANEL_CLOSE'&&m.token==='fixture-capability')));
 await page.evaluate(()=>{window.clipHistory=[];new MutationObserver(()=>{const id=document.querySelector('purrple-companion').dataset.clip;if(clipHistory.at(-1)!==id)clipHistory.push(id);}).observe(document.querySelector('purrple-companion'),{attributes:true,attributeFilter:['data-clip']});});
 let box=await(await part('.actor')).boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(450,260,{steps:8});
 check('drag-held-state',(await snapshot()).state==='held');
 await page.evaluate(()=>testListeners.forEach(fn=>fn({type:'REMINDER_NOTICE'})));
 check('reminder-does-not-interrupt-held',(await snapshot()).state==='held');
 await page.mouse.move(570,190,{steps:3});await page.mouse.up();check('release-enters-air',(await snapshot()).state==='air');
 await waitClip('cry');check('strong-throw-cries-once',true);
 await waitClip('paw-wipe');check('cry-recovers-through-paw-wipe',true);
 await waitClip('soothe');check('paw-wipe-recovers-through-soothe',true);
 await waitClip('reminder');check('queued-reminder-runs-after-recovery',true);
 const history=await page.evaluate(()=>clipHistory);check('cry-not-repeated-per-throw',history.filter(id=>id==='cry').length===1,history);
 let s=await snapshot();check('throw-remains-in-bounds',s.x>=0&&s.x<=1000&&s.y<=700,s);
 await choose('care');await click('[data-action="nap"]');
 box=await(await part('.actor')).boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2-20,box.y+box.height/2-30,{steps:5});await page.waitForTimeout(150);await page.mouse.up();
 await waitClip('sleep');check('soft-drop-restores-sleeper',(await snapshot()).clip==='sleep');
 await page.evaluate(()=>{PurrpleCompanionDebug.play('wake');window.ambientSeen=[];new MutationObserver(()=>{const id=document.querySelector('purrple-companion').dataset.clip;if(ambientSeen.at(-1)!==id)ambientSeen.push(id);}).observe(document.querySelector('purrple-companion'),{attributes:true,attributeFilter:['data-clip']});});
 await page.clock.runFor(190000);
 const ambient=await page.evaluate(()=>ambientSeen);
 for(const id of ['listen','knead','loaf','peek','nuzzle'])check('gentle-ambient-'+id,ambient.includes(id));
 await page.evaluate(()=>testListeners.forEach(fn=>fn({type:'STATE_CHANGED',state:{settings:{petEnabled:true,size:128,fps:30,hiddenHosts:[]},equipped:{head:'moon-bow',neck:'star-bandana'},focus:{kind:'focus',status:'running',endsAt:Date.now()+120000}}})));
 await page.clock.runFor(22000);check('focus-suppresses-ambient-movement',(await snapshot()).clip==='study');
 await page.evaluate(()=>testListeners.forEach(fn=>fn({type:'STATE_CHANGED',state:{settings:{petEnabled:false,size:128,fps:30,hiddenHosts:[]},equipped:{head:'moon-bow',neck:'star-bandana'},focus:null}})));
 check('setting-hide-removes-companion',await page.locator('purrple-companion').evaluate(el=>el.style.display==='none'));
 check('hide-clears-actor-cache',await page.evaluate(()=>cacheClears>0));check('hide-releases-canvas-buffer',await page.evaluate(()=>testShadowRoot.querySelector('canvas').width===1));
 check('hide-releases-decoded-art',await page.evaluate(()=>releaseCalls>0));
 check('lease-release-sent',await page.evaluate(()=>testMessages.some(m=>m.type==='PET_RELEASE')));check('no-page-errors',errors.length===0,errors);
 const report={scope:'Chromium DOM checks using the real renderer and bundled artwork; browser APIs, capability iframe and visibility are fixtures, clock is controlled; native Firefox integration is separate',results,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length};
 fs.mkdirSync(path.join(root,'verification'),{recursive:true});fs.writeFileSync(path.join(root,'verification/content-smoke.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();if(report.failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
