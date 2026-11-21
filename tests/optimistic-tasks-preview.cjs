/* Delayed saves through Chromium's explicit local preview adapter. */
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const {executable} = require('./browser_runtime.cjs');

async function verify(page, compact) {
  const pathName = compact ? 'popup.html' : 'app.html';
  await page.goto(pathToFileURL(path.join(__dirname, '../extension', pathName)).href);
  await page.locator('#preview-label').waitFor();
  assert.equal(await page.evaluate(() => PurrpleClient.native), false);
  const title = compact ? 'Compact pending task' : 'Home pending task';
  await page.evaluate(title => PurrpleClient.action({type:'TASK_ADD', title}), title);
  const completion = page.getByRole('button', {name:'Complete ' + title});
  const checked = page.getByRole('button', {name:'Reopen ' + title});
  const balance = page.locator('#coin-balance');
  const before = Number(await balance.textContent());

  await page.evaluate(() => {
    const original = PurrpleClient.action;
    window.completionCalls = 0;
    PurrpleClient.action = action => {
      if (action.type !== 'TASK_SET_DONE') return original(action);
      window.completionCalls++;
      return new Promise((resolve, reject) => {
        window.resolveCompletion = () => original(action).then(resolve, reject);
        window.rejectCompletion = () => reject(Error('Test save failure.'));
      });
    };
  });
  await completion.focus();
  await page.keyboard.press('Enter');
  assert.equal(await checked.getAttribute('aria-pressed'), 'true');
  assert.equal(await checked.getAttribute('aria-busy'), 'true');
  assert.equal(Number(await balance.textContent()), before);
  assert.equal(await checked.evaluate(node => node === document.activeElement), true);
  await checked.dispatchEvent('click');
  assert.equal(await page.evaluate(() => window.completionCalls), 1);

  await page.evaluate(() => window.rejectCompletion());
  await completion.waitFor();
  assert.equal(await completion.getAttribute('aria-pressed'), 'false');
  assert.equal(await completion.evaluate(node => node === document.activeElement), true);
  const toast = page.locator(compact ? '#compact-status' : '#toast');
  assert.match(await toast.textContent(), /Test save failure/);

  await completion.click();
  await checked.waitFor();
  await page.evaluate(() => window.resolveCompletion());
  await checked.waitFor({state:'hidden'});
  assert.equal(Number(await balance.textContent()), before + 1);
  assert.equal(await page.evaluate(() => window.completionCalls), 2);
  await page.getByRole('button', {name:'Undo', exact:true}).click();
  await page.evaluate(() => window.resolveCompletion());
  await completion.waitFor();
  assert.equal(Number(await balance.textContent()), before + 1);
}

(async () => {
  const args = process.env.PURRPLE_SINGLE_PROCESS === '1' ? ['--single-process','--no-zygote','--disable-dev-shm-usage'] : [];
  const browser = await chromium.launch({executablePath:executable(),args});
  const page = await browser.newPage({viewport:{width:1000,height:700},reducedMotion:'reduce'});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  try {
    await verify(page, false);
    await verify(page, true);
    assert.deepEqual(errors, []);
    console.log('PASS: Immediate task check, duplicate suppression, rollback, focus and committed rewards in home and compact previews.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});
