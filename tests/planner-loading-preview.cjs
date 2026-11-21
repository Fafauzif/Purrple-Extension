/* Real browser layout against an intentionally slow extension state reply. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { executable } = require('./browser_runtime.cjs');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const core = require('../extension/js/core.js');

(async () => {
  const browser = await chromium.launch({ executablePath: executable(),
    args: ['--single-process', '--no-zygote', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 540 } });
    await page.clock.install();
    const state = core.reduce(core.defaultState(), { type:'TASK_ADD', title:'Loaded task' });
    await page.addInitScript(state => {
      let get;
      const delayed = new Promise(resolve => { get = resolve; });
      window.resolvePlanner = () => get({ok:true,state});
      window.browser = { runtime: { id:'loading-preview', getURL: name => new URL(name, location.href).href,
        sendMessage: () => delayed, onMessage: {addListener() {}} } };
    }, state);
    for (const name of ['app', 'popup']) {
      const root=page.locator(name==='app'?'#main':'#compact-main');
      await page.goto(pathToFileURL(path.join(__dirname, '../extension', name+'.html')).href);
      await page.getByRole('main').count();
      await page.clock.runFor(180);
      assert.equal(await page.locator('.skeleton-row').count(), 0);
      await page.clock.runFor(170);
      assert.equal(await page.locator('.skeleton-row').count(), 3);
      assert.equal(await root.getAttribute('aria-busy'), 'true');
      assert.equal(await root.evaluate(node=>node.inert), true);
      await page.evaluate(() => resolvePlanner());
      await page.getByText('Loaded task', {exact:true}).first().waitFor();
      assert.equal(await page.locator('.skeleton-row').count(), 0);
      assert.equal(await root.evaluate(node=>node.inert), false);
    }
    console.log('PASS: delayed skeleton uses the real Today layout and clears after state arrives.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
