/* UI regression checks for drafts, button intent and visible pending feedback. */
const {chromium}=require('playwright');
const path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),checks=[],errors=[];
const check=(name,pass)=>checks.push({name,pass:!!pass});
(async()=>{
 const browser=await chromium.launch({executablePath:require('./browser_runtime.cjs').executable(),args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--allow-file-access-from-files']});
 const page=await browser.newPage({viewport:{width:390,height:680}});page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('file://'+path.join(root,'extension/popup.html'));await page.waitForFunction(()=>globalThis.PurrpleCompact?.getState());
  await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForFunction(()=>PurrpleCompact.getState());
  await page.locator('#compact-task-effort').selectOption('large');await page.locator('#compact-task-title').fill('A recoverable little draft');
  await page.reload();await page.waitForFunction(()=>PurrpleCompact.getState());
  check('compact-draft-effort-survives-immediate-reload',await page.locator('#compact-task-effort').inputValue()==='large');
  check('compact-draft-survives-immediate-reload',await page.locator('#compact-task-title').inputValue()==='A recoverable little draft');
  await page.locator('#compact-task-add').click();await page.waitForFunction(()=>PurrpleCompact.getState().tasks.length===1);
  await page.locator('[data-compact-action="complete"]').click();await page.waitForFunction(()=>PurrpleCompact.getState().tasks[0].done);
  check('freshly-created-task-completes-on-first-real-click',await page.evaluate(()=>PurrpleCompact.getState().wallet.balance===30));
  await page.locator('[data-compact-undo]').click();await page.waitForFunction(()=>!PurrpleCompact.getState().tasks[0].done);
  check('compact-undo-reopens-without-removing-earned-coins',await page.evaluate(()=>PurrpleCompact.getState().wallet.balance===30));
  await page.locator('[data-compact-view="talk"]').click();
  check('four-quick-thoughts-visible-without-scrolling',await page.locator('[data-talk-quick]').evaluateAll(buttons=>buttons.length===4&&buttons.every(b=>{const r=b.getBoundingClientRect();return r.top>=0&&r.bottom<document.querySelector('.compact-footer').getBoundingClientRect().top;})));
  await page.evaluate(()=>{const original=PurrpleClient.action;PurrpleClient.action=async a=>{if(a.type==='TALK_REPLY')await new Promise(resolve=>setTimeout(resolve,300));return original(a);};});
  await page.locator('[data-talk-quick="love-you"]').click();
  check('all-reply-choices-show-pending-disabled-state',await page.locator('[data-talk-send],[data-talk-quick]').evaluateAll(buttons=>buttons.every(b=>b.disabled)));
  check('pending-reply-is-explained',await page.locator('[data-talk-status]').isVisible());
  await page.waitForFunction(()=>PurrpleCompact.getState().talk.total===1);await page.waitForFunction(()=>!document.querySelector('[data-talk-quick]').disabled);
  check('reply-choices-reenable-after-save',await page.locator('[data-talk-quick]').first().isEnabled());
  await page.locator('[data-talk-browse]').evaluate(el=>el.open=true);
  await page.locator('[data-talk-more]').click();
  await page.locator('[data-talk-send]').last().focus();
  check('compact-reply-stays-visible-while-browsing',await page.locator('[data-talk-reply]').evaluate(el=>{const r=el.getBoundingClientRect(),m=document.querySelector('#compact-main').getBoundingClientRect();return r.top>=m.top-1&&r.bottom<=m.bottom;}));
  check('keyboard-focused-prompt-clears-sticky-reply',await page.evaluate(()=>document.activeElement.getBoundingClientRect().top>=document.querySelector('[data-talk-reply]').getBoundingClientRect().bottom));
  await page.goto('file://'+path.join(root,'extension/app.html'));await page.waitForFunction(()=>PurrpleUI.getState());
  await page.locator('#quick-title').fill('The full home remembers this too');await page.reload();await page.waitForFunction(()=>PurrpleUI.getState());
  check('full-home-shares-large-draft-size',await page.locator('#quick-effort').inputValue()==='large');
  check('full-home-draft-survives-immediate-reload',await page.locator('#quick-title').inputValue()==='The full home remembers this too');
  await page.evaluate(()=>location.hash='settings');await page.waitForFunction(()=>!document.querySelector('#view-settings').hidden);
  check('existing-full-home-receives-settings-route',await page.locator('#settings-heading').isVisible());
  await page.goto('file://'+path.join(root,'extension/popup.html'));await page.waitForFunction(()=>PurrpleCompact.getState());
  check('draft-effort-shares-from-full-home-to-popup',await page.locator('#compact-task-effort').inputValue()==='large');
  check('draft-shares-from-full-home-to-popup',await page.locator('#compact-task-title').inputValue()==='The full home remembers this too');
  check('no-browser-page-errors',errors.length===0);
 }catch(error){checks.push({name:'journey-complete',pass:false,detail:error.stack});}
 const report={passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length,checks,errors};
 fs.writeFileSync(path.join(root,'verification/refinement-ui/edges.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();if(report.failed)process.exitCode=1;
})();
