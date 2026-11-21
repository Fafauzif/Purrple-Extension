/* Browser-driven user scenarios against the same production UI and pure core.
 * Native extension tests are separate; this suite uses the labeled local preview.
 */
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),out=path.join(root,'verification/ui');
const binary=require('./browser_runtime.cjs').executable();
const reports=[],errors=[];
const check=(name,pass,detail)=>{reports.push({name,pass:!!pass,detail});if(!pass)console.log('FAILED',name,detail);};
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({executablePath:binary,args:['--no-sandbox','--disable-dev-shm-usage','--no-zygote','--single-process','--allow-file-access-from-files']});
 const page=await browser.newPage({viewport:{width:1280,height:950},acceptDownloads:true});
 page.on('pageerror',e=>errors.push(e.message));
 const state=()=>page.evaluate(()=>PurrpleUI.getState());
 const view=name=>page.locator(`[data-view="${name}"]`).click();
 const taskAction=async(action,id)=>{
   const row=page.locator(`[data-task="${id}"]`);
   const menu=row.locator('.task-actions');
   if(await menu.getAttribute('open')===null)await menu.locator('summary').click();
   await row.locator(`[data-action="${action}"]`).click();
 };
 try{
  await page.goto('file://'+path.join(root,'extension/app.html'));
  await page.waitForFunction(()=>PurrpleUI.getState());
  await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForFunction(()=>PurrpleUI.getState());
  check('preview-is-explicit',await page.locator('#preview-label').isVisible());
  check('no-fake-starter-tasks',(await state()).tasks.length===0);
  await page.locator('#quick-form button').click();
  check('empty-task-validation',await page.locator('#quick-error').isVisible());
  await page.locator('#quick-title').fill('Read the seminar notes');await page.locator('#quick-form button').click();
  await page.waitForFunction(()=>PurrpleUI.getState().tasks.length===1);
  check('quick-add-saved',(await state()).tasks[0].title==='Read the seminar notes');
  let task=(await state()).tasks[0];
  await taskAction('edit-task',task.id);
  await page.locator('#task-title').fill('Read <strong>notes</strong> & annotate');
  await page.locator('#task-subtasks').fill('Read\nRead\nAnnotate');
  await page.locator('#save-task').click();await page.waitForFunction(()=>!document.getElementById('task-dialog').open);
  check('title-escaped',await page.locator('.task-title').textContent()==='Read <strong>notes</strong> & annotate');
  check('no-title-html-injection',await page.locator('.task-title strong').count()===0);
  task=(await state()).tasks[0];
  check('duplicate-subtask-titles-have-unique-ids',new Set(task.subtasks.map(s=>s.id)).size===3);
  await taskAction('edit-task',task.id);await page.locator('#save-task').click();await page.waitForFunction(()=>!document.getElementById('task-dialog').open);
  check('duplicate-subtask-edit-roundtrip',(await state()).tasks[0].subtasks.length===3);
  await page.locator('[data-subtask]').first().check();
  await page.waitForFunction(()=>PurrpleUI.getState().tasks[0].subtasks[0].done);
  check('subtask-persists',(await state()).tasks[0].subtasks[0].done);
  await page.locator(`[data-action="toggle-task"][data-id="${task.id}"]`).click();
  await page.waitForFunction(()=>PurrpleUI.getState().wallet.balance===20);
  check('completion-awards-coins',(await state()).wallet.balance===20);
  await page.locator('[data-task-filter="done"]').click();
  await page.locator(`[data-action="toggle-task"][data-id="${task.id}"]`).click();
  await page.locator('[data-task-filter="open"]').click();
  await page.locator(`[data-action="toggle-task"][data-id="${task.id}"]`).click();
  check('reopen-cannot-farm-coins',(await state()).wallet.balance===20);
  for(const title of ['Prepare a presentation','Finish a lab report']){
   await page.locator('#new-task').click();await page.locator('#task-title').fill(title);await page.locator('#task-effort').selectOption('large');await page.locator('#save-task').click();await page.waitForFunction(()=>!document.getElementById('task-dialog').open);
   const t=(await state()).tasks.find(x=>x.title===title);await page.locator(`[data-action="toggle-task"][data-id="${t.id}"]`).click();
  }
  check('effort-rewards-correct',(await state()).wallet.balance===80);
  await view('wardrobe');
  check('fifteen-items',await page.locator('.shop-card').count()===15);
  await page.locator('[data-action="preview-item"][data-id="moon-bow"]').click();
  check('try-on-is-preview-only',(await state()).equipped.head===null&&await page.locator('#preview-tag').isVisible());
  check('try-on-keeps-keyboard-focus',await page.evaluate(()=>document.activeElement.dataset.id==='moon-bow'&&document.activeElement.dataset.action==='preview-item'));
  await page.locator('[data-action="buy-item"][data-id="moon-bow"]').click();
  await page.waitForFunction(()=>PurrpleUI.getState().owned.includes('moon-bow'));
  check('purchase-spends-once',(await state()).wallet.balance===60);
  await page.locator('[data-action="equip-item"][data-id="moon-bow"]').click();
  check('head-item-equipped',(await state()).equipped.head==='moon-bow');
  await page.locator('[data-action="buy-item"][data-id="star-bandana"]').click();await page.locator('[data-action="equip-item"][data-id="star-bandana"]').click();
  check('head-and-neck-combine',(await state()).equipped.head==='moon-bow'&&(await state()).equipped.neck==='star-bandana');
  await page.locator('[data-action="preview-item"][data-id="cozy-beanie"]').click();await page.locator('#reset-preview').click();
  check('discard-preview-preserves-outfit',(await state()).equipped.head==='moon-bow');
  check('unaffordable-items-disabled',await page.locator('[data-action="buy-item"][data-id="crescent-crown"]').isDisabled());
  await page.screenshot({path:path.join(out,'wardrobe-desktop.png'),fullPage:true});
  await view('focus');await page.locator('#focus-minutes').selectOption('5');await page.locator('#focus-start').click();
  check('session-starts',(await state()).focus?.status==='running');
  await page.locator('#focus-pause').click();check('session-pauses',(await state()).focus?.status==='paused');
  await page.reload();await page.waitForFunction(()=>PurrpleUI.getState());await view('focus');
  check('paused-session-survives-reload',(await state()).focus?.status==='paused');
  await page.locator('#focus-pause').click();check('session-resumes',(await state()).focus?.status==='running');
  await page.locator('#focus-cancel').click();check('session-cancels-without-coins',!(await state()).focus&&(await state()).wallet.balance===40);
  await page.locator('[data-break="5"]').click();check('break-is-free',(await state()).focus?.kind==='break');await page.locator('#focus-cancel').click();
  await view('settings');await page.locator('#setting-name').fill('Jamie');await page.locator('#setting-motion').check();await page.locator('#setting-fps').selectOption('24');await page.locator('#settings-form button[type="submit"]').click();
  check('settings-save',(await state()).settings.name==='Jamie'&&(await state()).settings.fps===24&&(await state()).settings.reducedMotion);
  const downloadPromise=page.waitForEvent('download');await page.locator('#backup-export').click();const download=await downloadPromise;const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
  check('backup-contains-progress',backup.state.wallet.balance===40&&backup.state.owned.length===2);
  const before=JSON.stringify(await state());await page.locator('#backup-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{ nope')});
  check('bad-backup-preserves-state',JSON.stringify(await state())===before);
  await page.locator('#backup-file').setInputFiles({name:'Purrple.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  check('import-requires-confirmation',await page.locator('#confirm-dialog').evaluate(el=>el.open));
  check('restore-initially-focuses-cancel',await page.locator('#confirm-cancel').evaluate(el=>el===document.activeElement));
  await page.locator('#confirm-cancel').click();check('cancel-restore-preserves-data',JSON.stringify(await state())===before);
  await page.locator('#backup-file').setInputFiles({name:'Purrple.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await page.locator('#confirm-ok').click();await page.waitForFunction(()=>!document.getElementById('confirm-dialog').open);
  check('backup-roundtrip',(await state()).wallet.balance===40&&(await state()).equipped.head==='moon-bow');
  await view('today');await page.locator('[data-task-filter="done"]').click();await taskAction('archive-task',task.id);
  await page.locator('[data-task-filter="archived"]').click();check('archive-visible',await page.locator(`[data-task="${task.id}"]`).count()===1);await taskAction('archive-task',task.id);
  check('archive-restores',!(await state()).tasks.find(t=>t.id===task.id).archived);
  await page.locator('[data-task-filter="open"]').click();await page.locator('#task-search').fill('no-such-task');check('search-empty-feedback',await page.locator('#task-list .empty-state').textContent().then(s=>s.includes('No matching tasks')));await page.locator('#clear-task-search').click();check('clear-search-refocuses',await page.locator('#task-search').evaluate(el=>el===document.activeElement));
  for(const width of [1280,390,320]){
   await page.setViewportSize({width,height:900});
   for(const tab of ['today','focus','wardrobe','settings']){await view(tab);check(`no-overflow-${tab}-${width}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,`${tab}-${width}.png`),fullPage:true});}
  }
  await page.goto('file://'+path.join(root,'extension/popup.html'));await page.waitForFunction(()=>PurrpleUI.getState());check('popup-loads',await page.locator('#open-app').isVisible());await page.screenshot({path:path.join(out,'popup.png'),fullPage:true});
 }catch(error){check('scenario-completed',false,String(error));}
 check('no-page-errors',errors.length===0,errors);
 const report={browser:'Chromium headless shell',scope:'Production UI with clearly labeled local preview adapter; native Firefox tested separately',passed:reports.filter(r=>r.pass).length,failed:reports.filter(r=>!r.pass).length,checks:reports,errors};
 fs.writeFileSync(path.join(out,'preview-tests.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();if(report.failed)process.exitCode=1;
})();
