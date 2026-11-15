/* Independent browser journeys for the refinement. Uses the labeled local
 * preview adapter. Native Firefox authorization/lifecycle checks are separate. */
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'verification/refinement-ui');
const checks=[],errors=[];
const check=(name,pass,detail)=>{checks.push({name,pass:!!pass,...(detail===undefined?{}:{detail})});if(!pass)console.log('FAILED',name,detail||'');};
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:require('./browser_runtime.cjs').executable(),args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--allow-file-access-from-files']});
 const page=await browser.newPage({viewport:{width:390,height:680}});
 page.on('pageerror',e=>errors.push(e.message));
 const state=()=>page.evaluate(()=>PurrpleCompact.getState());
 const compactView=async name=>{await page.locator(`[data-compact-view="${name}"]`).click();};
 const compactURL='file://'+path.join(root,'extension/popup.html');
 try{
  await page.goto(compactURL);await page.waitForFunction(()=>globalThis.PurrpleCompact?.getState());
  await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForFunction(()=>PurrpleCompact.getState());
  check('preview-is-explicit',await page.locator('#preview-label').isVisible());
  check('new-save-has-no-invented-tasks',(await state()).tasks.length===0);
  await page.locator('#compact-task-title').fill('Read the notes & make one small start');
  await page.waitForFunction(()=>PurrpleCompact.getState().drafts?.quickTask?.includes?.('one small start')||PurrpleCompact.getState().drafts?.quickTask?.text?.includes('one small start'));
  const expectedDraft=await page.locator('#compact-task-title').inputValue();
  await page.reload();await page.waitForFunction(()=>PurrpleCompact.getState());
  check('task-draft-recovers-after-popup-reload',await page.locator('#compact-task-title').inputValue()===expectedDraft);
  await page.locator('#compact-task-add').click();await page.waitForFunction(()=>PurrpleCompact.getState().tasks.length===1);
  check('quick-task-is-saved',(await state()).tasks[0].title===expectedDraft);
  check('committed-task-clears-draft',!(await state()).drafts.quickTask?.text&&!(typeof (await state()).drafts.quickTask==='string'&&(await state()).drafts.quickTask));
  const taskId=(await state()).tasks[0].id;
  await page.locator(`[data-compact-action="complete"][data-id="${taskId}"]`).click();
  await page.waitForFunction(()=>PurrpleCompact.getState().wallet.balance>0);
  check('completion-earns-once',(await state()).wallet.balance===20);
  await page.evaluate(async()=>{for(let i=0;i<5;i++){await PurrpleClient.action({type:'TASK_ADD',title:'Refinement test task '+i,effort:'large'});const s=await PurrpleClient.get();await PurrpleClient.action({type:'TASK_TOGGLE',id:s.tasks[s.tasks.length-1].id});}});
  await compactView('focus');await page.locator('#compact-minutes').selectOption('5');await page.locator('#compact-focus-start').click();
  await page.waitForFunction(()=>PurrpleCompact.getState().focus?.status==='running');check('focus-starts-in-popup',(await state()).focus.status==='running');
  await page.locator('#compact-focus-pause').click();await page.waitForFunction(()=>PurrpleCompact.getState().focus?.status==='paused');
  await page.reload();await page.waitForFunction(()=>PurrpleCompact.getState());await compactView('focus');
  check('paused-focus-survives-popup-close-reload',(await state()).focus.status==='paused');
  await page.locator('#compact-focus-pause').click();await page.waitForFunction(()=>PurrpleCompact.getState().focus?.status==='running');
  await page.locator('#compact-focus-end').click();await page.waitForFunction(()=>!PurrpleCompact.getState().focus);check('focus-can-end-from-popup',!(await state()).focus);
  await compactView('wardrobe');
  check('wardrobe-catalog-has-fifteen-items',await page.locator('#compact-shop-grid [data-compact-action="try"]').count()===15);
  await page.locator('[data-compact-action="try"][data-id="moon-bow"]').click();
  check('try-on-does-not-equip',(await state()).equipped.head===null);
  check('trying-on-status-is-visible',await page.locator('body').innerText().then(t=>/trying on/i.test(t)));
  await page.locator('[data-compact-action="buy"][data-id="moon-bow"]').click();await page.waitForFunction(()=>PurrpleCompact.getState().owned.includes('moon-bow'));
  await page.locator('[data-compact-action="wear"][data-id="moon-bow"]').click();await page.waitForFunction(()=>PurrpleCompact.getState().equipped.head==='moon-bow');
  check('wear-is-explicit-and-persists',(await state()).equipped.head==='moon-bow');
  await page.locator('[data-compact-action="buy"][data-id="star-bandana"]').click();await page.waitForFunction(()=>PurrpleCompact.getState().owned.includes('star-bandana'));
  await page.locator('[data-compact-action="wear"][data-id="star-bandana"]').click();await page.waitForFunction(()=>PurrpleCompact.getState().equipped.neck==='star-bandana');
  check('head-and-neck-outfit-combine',(await state()).equipped.head==='moon-bow'&&(await state()).equipped.neck==='star-bandana');
  await page.locator('#compact-shop-search').fill('no such purple garment');check('wardrobe-search-has-empty-state',await page.locator('#compact-shop-grid').innerText().then(t=>/no|nothing/i.test(t)));
  await page.locator('#compact-shop-clear').click();check('wardrobe-clear-restores-results',await page.locator('#compact-shop-grid [data-compact-action="try"]').count()===15);
  await compactView('talk');
  check('large-conversation-bank',await page.evaluate(()=>PurrpleTalk.CATALOG.length>=80));
  check('all-prompts-have-three-replies',await page.evaluate(()=>PurrpleTalk.CATALOG.every(p=>p.variants.length>=3)));
  const talkRoot=page.locator('#compact-talk-root');
  await talkRoot.locator('[data-talk-search]').fill('I love you');
  await talkRoot.locator('[data-talk-send="love-you"]').click();await page.waitForFunction(()=>PurrpleCompact.getState().talk.last?.promptId==='love-you');
  const first=(await state()).talk.last.text;check('love-prompt-has-affectionate-response',/love|purr|affection|cuddle/i.test(first));
  await talkRoot.locator('[data-talk-send="love-you"]').click();await page.waitForFunction(previous=>PurrpleCompact.getState().talk.last.text!==previous,first);
  const second=(await state()).talk.last.text;check('consecutive-replies-do-not-repeat',first!==second,{first,second});
  await talkRoot.locator('[data-talk-favorite="love-you"]').click();await page.waitForFunction(()=>PurrpleCompact.getState().talk.favorites.includes('love-you'));
  check('favorite-persists',(await state()).talk.favorites.includes('love-you'));
  await talkRoot.locator('[data-talk-clear]').click();await talkRoot.locator('[data-talk-search]').fill('a phrase not in any prompt');
  check('talk-search-has-useful-empty-state',await talkRoot.innerText().then(t=>/no|nothing|try/i.test(t)));
  await talkRoot.locator('[data-talk-clear]').click();check('talk-clear-restores-prompts',await talkRoot.locator('[data-talk-send]').count()>0);
  for(const width of [420,390,320]){
   await page.setViewportSize({width,height:680});
   for(const tab of ['today','focus','wardrobe','talk']){
    await compactView(tab);check(`compact-no-horizontal-overflow-${tab}-${width}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(out,`compact-${tab}-${width}.png`),fullPage:true});
   }
  }
  await page.setViewportSize({width:1280,height:950});await page.goto('file://'+path.join(root,'extension/app.html'));await page.waitForFunction(()=>PurrpleUI.getState());
  check('full-home-shares-popup-outfit',await page.evaluate(()=>PurrpleUI.getState().equipped.head==='moon-bow'&&PurrpleUI.getState().equipped.neck==='star-bandana'));
  check('full-home-shares-conversation-history',await page.evaluate(()=>PurrpleUI.getState().talk.history.some(r=>r.promptId==='love-you')));
  for(const width of [1280,390,320]){
   await page.setViewportSize({width,height:900});
   for(const tab of ['today','focus','wardrobe','talk','settings']){await page.locator(`[data-view="${tab}"]`).click();check(`full-no-horizontal-overflow-${tab}-${width}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,`home-${tab}-${width}.png`),fullPage:true});}
  }
  const art=await page.evaluate(()=>({clips:PurrpleRenderer.clips.map(c=>({id:c.id,duration:c.duration,frames:c.sourceFrames??c.frames??null})),items:PurrpleRenderer.itemIds.length}));
  check('shared-renderer-covers-all-outfits',art.items===15);
  check('movement-library-expanded',art.clips.length>=40,art.clips.map(x=>x.id));
  await page.setViewportSize({width:1100,height:850});await page.goto('file://'+path.join(root,'extension/animations.html'));await page.waitForFunction(()=>globalThis.PurrpleRenderer?.ready);
  check('animation-explorer-loads-shared-renderer',await page.evaluate(()=>PurrpleRenderer.ready));
  await page.screenshot({path:path.join(out,'animation-explorer.png'),fullPage:true});
  await page.goto('file://'+path.join(root,'extension/INSTALL-PURRPLE.html'));
  check('installation-guide-says-i-love-you',await page.locator('body').innerText().then(t=>t.includes('I love you')));
  check('installation-guide-distinguishes-signed-and-temporary',await page.locator('body').innerText().then(t=>/signed/i.test(t)&&/temporary/i.test(t)));
  for(const width of [1100,390,320]){await page.setViewportSize({width,height:900});check(`guide-no-overflow-${width}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,`install-guide-${width}.png`),fullPage:true});}
 }catch(e){check('journeys-complete',false,e.stack||String(e));}
 check('no-browser-page-errors',errors.length===0,errors);
 const report={scope:'Independent production UI journeys in Chromium with clearly labeled local preview. Native Firefox checked separately.',passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass).length,checks,errors};
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();if(report.failed)process.exitCode=1;
})();
