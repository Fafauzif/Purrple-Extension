/* Chromium with the labeled local preview adapter exercises the actual Undo controls. */
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const {executable} = require('./browser_runtime.cjs');

async function verifyCalendarUndo(page, compact) {
  const status = page.locator(compact ? '#compact-status' : '#toast');
  const undo = status.getByRole('button', {name:'Undo', exact:true});
  const nav = compact ? '[data-compact-view="calendar"]' : '[data-view="calendar"]';
  await page.locator(nav).click();
  await page.locator('#planner-add').click();
  const title = compact ? 'Reversible compact block' : 'Reversible calendar block';
  await page.locator('#planner-block-title').fill(title);
  await page.locator('#planner-block-all-day').check();
  await page.locator('#planner-save').click();
  await undo.waitFor();
  assert.equal(await status.getAttribute('role'), 'status');
  const block = page.locator('.planner-entry').filter({hasText:title}).first();
  await block.click();
  await page.locator('#planner-remove').click();
  await block.waitFor({state:'hidden'});
  await undo.click();
  await block.waitFor();
}

async function verifyArchiveUndo(page) {
  const title = 'A prioritized task';
  const id = await page.evaluate(async title => {
    const snapshot = await PurrpleClient.action({type:'TASK_ADD',title});
    const {id} = snapshot.tasks.find(task => task.title === title);
    await PurrpleClient.action({type:'TASK_PLAN_PRIORITY',id,enabled:true});
    return id;
  }, title);
  const row = page.locator(`#task-list [data-task="${id}"]`);
  await row.locator('summary').click();
  await row.getByRole('button',{name:'Archive',exact:true}).click();
  await row.waitFor({state:'hidden'});
  await page.locator('#toast').getByRole('button',{name:'Undo',exact:true}).click();
  await row.waitFor();
  assert.ok(await page.evaluate(id => PurrpleUI.getState().priorities.includes(id), id));
}

async function verifyRoomUndo(page) {
  await page.locator('[data-view="companion"]').click();
  const before = await page.evaluate(async () => {
    const snapshot = await PurrpleClient.action({type:'COMPANION_ROOM_MOVE',id:'plum-cushion',position:{x:45,y:82}});
    return snapshot.companion.room.placements['plum-cushion'];
  });
  await page.locator('.cp-room-arrange > summary').click();
  await page.locator('.cp-room-arrange').getByRole('button',{name:'Reset layout'}).click();
  const undo = page.locator('#toast').getByRole('button',{name:'Undo',exact:true});
  await undo.waitFor();
  assert.notDeepEqual(await page.evaluate(() => PurrpleUI.getState().companion.room.placements['plum-cushion']), before);
  await undo.click();
  await page.waitForFunction(before => JSON.stringify(PurrpleUI.getState().companion.room.placements['plum-cushion']) === JSON.stringify(before), before);
}

(async () => {
  const args = process.env.PURRPLE_SINGLE_PROCESS === '1' ? ['--single-process','--no-zygote','--disable-dev-shm-usage'] : [];
  const browser = await chromium.launch({executablePath:executable(),args});
  const page = await browser.newPage({viewport:{width:960,height:720},reducedMotion:'reduce'});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const navigate = name => page.goto(pathToFileURL(path.join(__dirname,'../extension',name)).href).then(() => page.locator('#preview-label').waitFor());
  try {
    await navigate('app.html');
    await verifyArchiveUndo(page);
    await verifyCalendarUndo(page,false);
    await verifyRoomUndo(page);
    await page.setViewportSize({width:360,height:420});
    await navigate('popup.html');
    await verifyCalendarUndo(page,true);
    assert.deepEqual(errors, []);
    console.log('PASS: Task archive restores its priority, calendar removal is reversible in both surfaces, and room reset has an immediate Undo.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});
