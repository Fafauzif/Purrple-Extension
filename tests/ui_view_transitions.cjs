/* Real Chromium verifies the optional View Transition API in local preview. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { executable } = require('./browser_runtime.cjs');

async function verify() {
  const args = ['--allow-file-access-from-files'];
  if (process.env.PURRPLE_SINGLE_PROCESS === '1') args.push('--single-process', '--no-zygote', '--disable-dev-shm-usage');
  const browser = await chromium.launch({ executablePath:executable(), args });
  const extension = pathToFileURL(path.join(__dirname, '../extension/')).href;
  try {
    const page = await browser.newPage({ viewport:{ width:900, height:780 }, reducedMotion:'no-preference' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.fixtureTransitions = [];
      const start = document.startViewTransition;
      if (!start) return;
      const marked = () => [...document.querySelectorAll('[data-purrple-transition-actor]')].map(node => node.id || node.className);
      document.startViewTransition = update => {
        const record = { from:marked() };
        fixtureTransitions.push(record);
        const transition = start.call(document, async () => {
          await update();
          record.to = marked();
        });
        transition.ready.then(() => {
          record.actorDuration = getComputedStyle(document.documentElement, '::view-transition-group(purrple-actor)').animationDuration;
        }, () => {});
        transition.finished.then(() => { record.finished = true; }, () => {});
        return transition;
      };
    });
    for (const [file, attribute, oldActor, nextActor] of [
      ['app.html', 'data-view', 'companion-canvas', 'focus-canvas'],
      ['popup.html', 'data-compact-view', 'compact-canvas', 'compact-canvas']
    ]) {
      await page.goto(extension + file);
      await page.waitForFunction(() => globalThis.PurrpleUI?.getState() || globalThis.PurrpleCompact?.getState());
      await page.evaluate(() => PurrpleClient.action({ type:'SETTINGS', patch:{ reducedMotion:false } }));
      const nav = (view) => page.locator(`button[${attribute}="${view}"]`).first();
      const focus = nav('focus');
      assert.notEqual(await focus.getAttribute('aria-current'), 'page');
      const supported = await page.evaluate(() => typeof document.startViewTransition === 'function');
      await focus.click();
      await page.waitForFunction(attribute => document.querySelector(`button[${attribute}="focus"]`).getAttribute('aria-current') === 'page', attribute);
      if (supported) {
        await page.waitForFunction(() => fixtureTransitions[0]?.finished);
        const record = await page.evaluate(() => fixtureTransitions[0]);
        assert.deepEqual(record.from, [oldActor]);
        assert.deepEqual(record.to, [nextActor]);
        assert.ok(Number.parseFloat(record.actorDuration) <= .22);
        assert.equal(await page.locator('[data-purrple-transition-actor]').count(), 0);
      }

      await page.evaluate(attribute => {
        document.querySelector(`button[${attribute}="calendar"]`).click();
        document.querySelector(`button[${attribute}="today"]`).click();
      }, attribute);
      await page.waitForFunction(attribute => document.querySelector(`button[${attribute}="today"]`).getAttribute('aria-current') === 'page', attribute);
      const starts = () => page.evaluate(() => fixtureTransitions.length);
      const prior = await starts();

      await page.emulateMedia({ reducedMotion:'reduce' });
      await focus.click();
      assert.equal(await focus.getAttribute('aria-current'), 'page');
      assert.equal(await starts(), prior);
      await page.emulateMedia({ reducedMotion:'no-preference' });
      await page.evaluate(() => PurrpleClient.action({ type:'SETTINGS', patch:{ reducedMotion:true } }));
      await nav('calendar').click();
      assert.equal(await nav('calendar').getAttribute('aria-current'), 'page');
      assert.equal(await starts(), prior);

      await page.evaluate(() => PurrpleClient.action({ type:'SETTINGS', patch:{ reducedMotion:false } }));
      await page.evaluate(() => { document.startViewTransition = undefined; });
      await nav('today').click();
      assert.equal(await nav('today').getAttribute('aria-current'), 'page');
      assert.equal(await starts(), prior);
    }
    assert.deepEqual(errors, []);
    console.log('PASS: Dashboard and compact declarations, rapid tab changes, both reduced-motion settings, and immediate navigation fallback.');
  } finally {
    await browser.close();
  }
}

verify().catch(error => { console.error(error); process.exitCode = 1; });
