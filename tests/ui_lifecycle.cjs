/* Chromium local-preview checks with explicit Back/Forward Cache event fixtures. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { executable } = require('./browser_runtime.cjs');

async function run() {
  const args = ['--allow-file-access-from-files'];
  if (process.env.PURRPLE_SINGLE_PROCESS === '1') args.push('--single-process', '--no-zygote', '--disable-dev-shm-usage');
  const browser = await chromium.launch({ executablePath:executable(), args });
  const extension = pathToFileURL(path.join(__dirname, '../extension/')).href;
  const errors = [];
  try {
    const context = await browser.newContext({ reducedMotion:'reduce' });
    await context.addInitScript(() => {
      const setItem = Storage.prototype.setItem;
      globalThis.previewWrites = 0;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'purrple-local-preview-v1') globalThis.previewWrites++;
        return setItem.call(this, key, value);
      };
    });
    async function open(file) {
      const page = await context.newPage();
      page.setDefaultTimeout(6000);
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(extension + file);
      return page;
    }
    const game = await open('game.html?game=paw-pairs');
    const begin = game.getByRole('button', { name:'Begin', exact:true });
    await begin.waitFor();
    await game.locator('.cg-round-details summary').click();
    await game.locator('[data-cp-input="variant"]').selectOption('4x6');
    assert.equal(await game.locator('.cg-ready-board .cg-card').count(), 24);
    assert.equal(await game.locator('.cg-round-details').getAttribute('open'), '');
    await begin.click();
    await game.locator('.cg-card').first().click();
    await game.locator('.cg-card.shown').waitFor();
    await game.evaluate(async () => {
      dispatchEvent(new PageTransitionEvent('pagehide', { persisted:true }));
      const state = await PurrpleClient.get();
      state.settings.theme = 'night';
      localStorage.setItem('purrple-local-preview-v1', JSON.stringify(state));
      dispatchEvent(new PageTransitionEvent('pageshow', { persisted:true }));
    });
    await game.waitForFunction(() => document.documentElement.dataset.theme === 'night');
    assert.equal(await game.locator('.cg-card.shown').count(), 1);
    await game.locator('.cg-card:not(.shown)').first().click();
    const gameState = await game.evaluate(() => PurrpleClient.get());
    assert.ok(gameState.companion.rounds['paw-pairs'].moves.length >= 2);
    await game.close();

    const room = await open('popup.html?view=room');
    const gift = room.locator('[data-cp-key="room-gift"]');
    await gift.waitFor();
    await room.evaluate(() => {
      dispatchEvent(new PageTransitionEvent('pagehide', { persisted:true }));
      dispatchEvent(new PageTransitionEvent('pageshow', { persisted:true }));
    });
    await gift.click();
    await room.locator('.cp-gift-layout').waitFor();
    await room.close();

    const first = await open('app.html');
    const second = await open('popup.html');
    await first.waitForFunction(() => globalThis.PurrpleUI?.getState());
    await second.waitForFunction(() => globalThis.PurrpleCompact?.getState());
    const writes = page => page.evaluate(() => globalThis.previewWrites);
    const before = await Promise.all([writes(first), writes(second)]);
    await first.evaluate(() => PurrpleClient.action({ type:'FOCUS_START', minutes:25 }));
    await second.waitForFunction(() => PurrpleCompact.getState()?.focus?.status === 'running');
    await first.evaluate(() => PurrpleClient.get());
    await second.evaluate(() => PurrpleClient.get());
    assert.deepEqual(await Promise.all([writes(first), writes(second)]), [before[0] + 1, before[1]]);
    assert.deepEqual(errors, []);
    console.log('PASS: Restored game and compact room keep working, and open previews do not echo timer writes.');
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
