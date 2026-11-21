/* Chromium preview coverage for dashboard and compact command navigation. */
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const {executable} = require('./browser_runtime.cjs');

const root = path.resolve(__dirname, '../extension');
async function checkSurface(context, file, modifier, display) {
  const compact = file === 'popup.html';
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(pathToFileURL(path.join(root, file)).href);
    await page.waitForFunction(() => window.PurrpleUI?.getState());
    const trigger = page.getByRole('button', {name:'Open commands', exact:true});
    const dialog = page.getByRole('dialog', {name:'Commands'});
    const search = dialog.getByRole('combobox', {name:'Search commands'});
    const task = page.locator(compact ? '#compact-task-title' : '#quick-title');

    assert.ok((await trigger.getAttribute('title')).includes(display));
    await trigger.focus();
    await page.keyboard.press(modifier + '+k');
    await search.waitFor({state:'visible'});
    await search.fill('not a command');
    await dialog.getByText('No matching commands.').waitFor();
    await search.press('Escape');
    await dialog.waitFor({state:'hidden'});
    await page.waitForFunction(() => document.activeElement?.classList.contains('purrple-command-trigger'));

    await page.keyboard.press(modifier + '+Shift+Enter');
    await page.waitForFunction(selector => document.activeElement === document.querySelector(selector),
      compact ? '#compact-task-title' : '#quick-title');
    await task.fill('Private command-test task');
    await task.press(modifier + '+k');
    assert.equal(await dialog.count(), 0);
    await task.press(modifier + '+Alt+2');
    assert.ok(await task.isVisible(), 'Shortcuts leave editing fields alone');
    await task.press('Enter');
    await page.waitForFunction(() => PurrpleUI.getState().tasks.some(task => task.title === 'Private command-test task'));

    await trigger.click();
    await search.fill('Private command-test task');
    assert.ok(await dialog.getByRole('option').count() >= 1, 'Visible task actions are indexed');
    await search.fill('calendar');
    await search.press('ArrowDown');
    await search.press('ArrowUp');
    await search.press('Enter');
    await dialog.waitFor({state:'hidden'});
    await page.locator(compact ? '#compact-calendar' : '#view-calendar').waitFor({state:'visible'});

    await trigger.click();
    await search.fill('New calendar block');
    await search.press('Enter');
    await page.locator('#planner-cancel').waitFor({state:'visible'});
    await page.locator('#planner-cancel').click();
    await trigger.focus();
    await trigger.press(modifier + '+Alt+3');
    await page.locator(compact ? '#compact-focus' : '#view-focus').waitFor({state:'visible'});
    await trigger.click();
    await search.fill('Wardrobe');
    assert.ok(await dialog.getByRole('option').getByText(modifier === 'Meta' ? '⌥⌘5' : 'Ctrl+Alt+5').isVisible());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.keyboard.press('Escape');
    if (!compact) {
      await page.setViewportSize({width:263,height:420});
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await trigger.click();
      await search.waitFor({state:'visible'});
    }
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
}
async function checkPlatform(options, file, modifier, display) {
  const browser = await chromium.launch({executablePath:executable(), args:['--single-process','--no-zygote','--disable-dev-shm-usage']});
  try {
    const context = await browser.newContext(options);
    if (modifier === 'Meta') await context.addInitScript(() => {
      Object.defineProperty(navigator,'userAgentData',{value:{platform:'macOS'}});
    });
    await checkSurface(context, file, modifier, display);
  } finally { await browser.close(); }
}
(async () => {
  await checkPlatform({viewport:{width:360,height:420}}, 'app.html', 'Control', 'Ctrl+K');
  await checkPlatform({viewport:{width:308,height:277},reducedMotion:'reduce'}, 'popup.html', 'Meta', '⌘K');
  console.log('PASS: Command search, keyboard navigation, Ctrl/Cmd hints, typing protection, and focus restoration in both previews.');
})().catch(error => { console.error(error); process.exitCode = 1; });
