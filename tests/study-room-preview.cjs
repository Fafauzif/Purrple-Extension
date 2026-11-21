/* Real Chromium rendering through the explicitly labeled local preview. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { executable } = require('./browser_runtime.cjs');

async function verifyStudyRoom() {
  const args = process.env.PURRPLE_SINGLE_PROCESS === '1'
    ? ['--single-process', '--no-zygote', '--disable-dev-shm-usage'] : [];
  const browser = await chromium.launch({ executablePath: executable(), args });

  try {
    const page = await browser.newPage({
      viewport: { width: 1370, height: 1000 },
      reducedMotion: 'reduce'
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.join(__dirname, '../extension/app.html')).href);
    await page.locator('#preview-label').waitFor();
    assert.equal(await page.evaluate(() => PurrpleClient.native), false);

    const navigate = view => page.locator(`[data-view="${view}"]`).click();
    const waitPhase = phase => page.waitForFunction(
      expected => document.querySelector('#view-focus').dataset.session === expected, phase);
    const lamp = () => page.locator('.study-companion').evaluate(node => getComputedStyle(node, '::before').opacity);

    await navigate('focus');
    await waitPhase('idle');
    assert.equal(await lamp(), '0');
    await page.locator('#focus-start').click();
    await waitPhase('focus');
    assert.equal(await lamp(), '1');
    await page.locator('#focus-pause').click();
    await waitPhase('paused');
    assert.equal(await lamp(), '0.38');

    await page.locator('#theme-toggle').click();
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'night');
    assert.match(await page.locator('.study-companion').evaluate(node => getComputedStyle(node).backgroundImage), /study-night-rest\.png/);
    await navigate('companion');
    assert.match(await page.locator('.cp-backdrop').evaluate(node => getComputedStyle(node).backgroundImage), /room-night\.png/);

    const arrangement = page.locator('.cp-room-arrange');
    await page.evaluate(() => { globalThis.originalRoomCanvas = document.querySelector('.cp-cat'); });
    assert.equal(await arrangement.getAttribute('open'), null);
    await page.locator('.cp-decor-plum-cushion').click();
    const horizontal = page.locator('[data-cp-input="x"]');
    await horizontal.press('ArrowRight');
    assert.equal(await arrangement.getAttribute('open'), '');
    assert.equal(await arrangement.locator('.cp-axis output').first().textContent(), (await horizontal.inputValue()) + '%');
    await arrangement.getByRole('button', { name: 'Place decoration' }).click();
    assert.equal(await page.evaluate(() => globalThis.originalRoomCanvas === document.querySelector('.cp-cat')), true);

    await page.locator('[data-cp="room-route"][data-id="gifts"]').click();
    await page.locator('[data-cp="give"][data-id="pressed-flower"]').click();
    await page.locator('.cp-thank-you').waitFor();
    await page.getByRole('img', { name: 'Purrple receiving the gift' }).waitFor();
    await page.locator('.cp-gift-present').waitFor();
    await page.locator('[data-cp="place-gift"]').click();
    await arrangement.locator('[data-cp="place"]').click();
    await page.locator('.cp-decor-pressed-flower-frame').waitFor();

    const play = page.locator('[data-cp-key="room-play"]');
    await play.click();
    const dialog = page.locator('#play-dialog');
    await dialog.locator('[data-cp="open-game"][data-id="paw-pairs"]').click();
    await dialog.getByRole('button', { name: 'Begin', exact: true }).click();
    await dialog.locator('.cg-card').first().waitFor();
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.dataset.cpKey === 'room-play');


    await page.setViewportSize({ width: 263, height: 740 });
    if (await arrangement.getAttribute('open') === null) await arrangement.locator('summary').click();
    await arrangement.locator('.cp-room-controls').waitFor();
    const narrow = await arrangement.locator('.cp-room-controls').evaluate(controls => ({
      width: innerWidth,
      over: [...document.querySelectorAll('*')].filter(el => el.getBoundingClientRect().right > innerWidth + 1)
        .slice(0,10).map(el=>[el.tagName,el.id,String(el.className).slice(0,40),el.getBoundingClientRect().right]),
      scrollWidth: document.documentElement.scrollWidth,
      right: controls.getBoundingClientRect().right,
      fields: [...controls.querySelectorAll('select,input,button')].map(control => {
        const { right, height } = control.getBoundingClientRect();
        return { right, height, name: control.id || control.textContent };
      })
    }));
    assert.ok(narrow.scrollWidth <= narrow.width &&
      narrow.fields.every(field => field.right <= narrow.right + 1 && field.height >= 44), JSON.stringify(narrow));
    await page.setViewportSize({ width: 360, height: 740 });
    await navigate('focus');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('#focus-pause').click();
    await page.evaluate(() => {
      const now = Date.now.bind(Date);
      Date.now = () => now() + 26 * 60 * 1000;
    });
    await waitPhase('finished');
    assert.equal(await page.locator('#timer-kind').textContent(), 'Session complete');
    assert.equal(await lamp(), '0');
    assert.deepEqual(errors, []);

    console.log('PASS: Night room and Focus lighting, keyboard placement, and visible gift reaction in Chromium preview.');
  } finally {
    await browser.close();
  }
}

verifyStudyRoom().catch(error => { console.error(error); process.exitCode = 1; });
