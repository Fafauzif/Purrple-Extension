/* Regression for a308×167 iframe, matching native Firefox150% short-window QA. */
const {chromium}=require('playwright'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),checks=[],errors=[];const check=(name,pass,detail)=>checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});
(async()=>{
 const browser=await chromium.launch({executablePath:require('./browser_runtime.cjs').executable(),args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--allow-file-access-from-files']});
 const page=await browser.newPage({viewport:{width:333,height:231}});page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('file://'+path.join(root,'tests/short-panel-fixture.html'));const frame=page.frames().find(f=>f.url().includes('popup.html'));await frame.waitForFunction(()=>globalThis.PurrpleCompact?.getState());
  const geometry=await frame.evaluate(()=>({viewport:innerHeight,main:document.querySelector('#compact-main').clientHeight,document:document.scrollingElement.scrollHeight,width:document.scrollingElement.scrollWidth,viewWidth:innerWidth}));
  check('short-panel-has-intrinsic-usable-content',geometry.main>200,geometry);check('full-document-is-scrollable',geometry.document>geometry.viewport*2);check('short-panel-no-horizontal-overflow',geometry.width<=geometry.viewWidth);
  await frame.locator('[data-talk-quick="love-you"]').focus();
  check('keyboard-can-reach-talk-choice',await frame.evaluate(()=>{const el=document.activeElement,r=el.getBoundingClientRect();return el.dataset.talkQuick==='love-you'&&r.top>=0&&r.bottom<=innerHeight;}));
  await page.screenshot({path:path.join(root,'verification/refinement-ui/short-panel-talk-keyboard.png')});
  await page.keyboard.press('Enter');await frame.waitForFunction(()=>PurrpleCompact.getState().talk.last?.promptId==='love-you');check('keyboard-can-send-talk-in-short-panel',await frame.evaluate(()=>PurrpleCompact.getState().talk.last.promptId==='love-you'));
  await frame.locator('[data-compact-view="today"]').focus();await page.keyboard.press('Enter');await frame.locator('#compact-task-title').focus();await page.keyboard.type('A small-screen plan');await page.keyboard.press('Tab');
  check('keyboard-reaches-task-add-within-visible-viewport',await frame.evaluate(()=>{const el=document.activeElement,r=el.getBoundingClientRect();return el.id==='compact-task-add'&&r.top>=0&&r.bottom<=innerHeight;}));
  await page.screenshot({path:path.join(root,'verification/refinement-ui/short-panel-task-keyboard.png')});
  await page.keyboard.press('Enter');await frame.waitForFunction(()=>PurrpleCompact.getState().tasks.some(t=>t.title==='A small-screen plan'));check('keyboard-can-submit-task-in-short-panel',true);
  await frame.locator('#panel-close').focus();check('inner-close-is-keyboard-reachable',await frame.evaluate(()=>{const el=document.activeElement,r=el.getBoundingClientRect();return el.id==='panel-close'&&r.top>=0&&r.bottom<=innerHeight;}));
  await page.screenshot({path:path.join(root,'verification/refinement-ui/short-panel.png')});
 }catch(error){check('short-panel-journey-complete',false,error.stack);}
 check('no-browser-page-errors',errors.length===0,errors);const report={passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length,checks};fs.writeFileSync(path.join(root,'verification/refinement-ui/short-panel.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();if(report.failed)process.exitCode=1;
})();
