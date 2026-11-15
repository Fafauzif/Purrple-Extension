/* Focused chattiness policy contract. APIs, renderer and visibility are fixture
 * adapters; virtual time tests the real content.js cooldown/suppression code.
 */
const fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:require('./browser_runtime.cjs').executable(),args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--disable-gpu']});
 const context=await browser.newContext({viewport:{width:360,height:260},timezoneId:'UTC'}),page=await context.newPage();
 await page.clock.install({time:new Date('2026-11-15T12:00:00Z')});
 await page.setContent('<p>A host page</p>');
 await page.evaluate(()=>{
  window.settings={petEnabled:true,size:96,fps:24,chattiness:'quiet',hiddenHosts:[],quietHours:{enabled:false,start:'22:00',end:'07:00'}};window.listeners=[];window.messages=[];
  Object.defineProperty(document,'hidden',{get:()=>false});document.hasFocus=()=>true;
  const attach=Element.prototype.attachShadow;Element.prototype.attachShadow=function(o){const r=attach.call(this,o);if(this.localName==='purrple-companion')window.fixtureRoot=r;return r;};
  // A 20Hz virtual presentation clock preserves the real .05s physics clamp.
  requestAnimationFrame=cb=>setTimeout(()=>cb(performance.now()),50);cancelAnimationFrame=clearTimeout;
  window.browser={runtime:{id:'fixture',getURL:p=>'https://extension.invalid/'+p,onMessage:{addListener:fn=>listeners.push(fn)},sendMessage:async m=>m.type==='GET_STATE'?{ok:true,state:{settings,equipped:{},focus:null}}:m.type==='PET_CLAIM'?{ok:true,leaseId:'fixture',position:{x:.7,y:1}}:{ok:true}}};
  window.PurrpleRenderer={preload:async()=>{},clearCache(){},releaseAssets(){},draw(){}};
  window.prefs=(patch,focus=null)=>{settings={...settings,...patch};listeners.forEach(fn=>fn({type:'STATE_CHANGED',state:{settings,equipped:{},focus}}));};
 });
 await page.addScriptTag({content:fs.readFileSync(path.join(root,'extension/js/content.js'),'utf8')});
 await page.clock.runFor(100);
 await page.evaluate(()=>new MutationObserver(()=>{const s=fixtureRoot.querySelector('.speech');if(!s.hidden){const text=s.querySelector('p').textContent;if(messages.at(-1)?.text!==text)messages.push({text,at:Date.now()});}}).observe(fixtureRoot.querySelector('.speech'),{attributes:true,subtree:true,childList:true}));
 const results=[],check=(id,pass,detail)=>results.push({id,pass:!!pass,detail});
 await page.clock.runFor(350000);check('quiet-never-generates-ambient',await page.evaluate(()=>messages.length===0));
 await page.evaluate(()=>prefs({chattiness:'chatty'}));await page.clock.runFor(179000);check('chatty-no-early-remark',await page.evaluate(()=>messages.length===0));
 await page.clock.runFor(7000);check('chatty-remarks-after-three-minutes',await page.evaluate(()=>messages.length===1),await page.evaluate(()=>messages));
 await page.evaluate(()=>{fixtureRoot.querySelector('.speech').hidden=true;messages=[];prefs({chattiness:'balanced'});});
 await page.clock.runFor(470000);check('balanced-no-early-remark',await page.evaluate(()=>messages.length===0));
 await page.clock.runFor(20000);check('balanced-remarks-after-eight-minutes',await page.evaluate(()=>messages.length===1));
 await page.clock.setSystemTime(new Date('2026-11-15T23:30:00Z'));
 await page.evaluate(()=>{fixtureRoot.querySelector('.speech').hidden=true;messages=[];prefs({chattiness:'chatty',quietHours:{enabled:true,start:'22:00',end:'07:00'}});});
 await page.clock.runFor(210000);check('cross-midnight-quiet-hours-suppress-ambient',await page.evaluate(()=>messages.length===0));
 await page.evaluate(()=>prefs({quietHours:{enabled:false,start:'22:00',end:'07:00'}},{kind:'focus',status:'running',endsAt:Date.now()+600000}));
 await page.clock.runFor(210000);check('focus-session-suppresses-ambient',await page.evaluate(()=>messages.length===0));
 const report={scope:'Real content.js cooldowns exercised with controlled clock, stubbed API/renderer/visibility; not native integration',results,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length};
 fs.writeFileSync(path.join(root,'verification/content-chattiness.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();if(report.failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
