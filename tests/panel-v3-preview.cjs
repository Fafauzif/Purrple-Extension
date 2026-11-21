/* Real Chromium rendering with a simulated extension transport. See
 * chromium-packaged.cjs and firefox_packaged_v2.py for installed-addon checks. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');
const { executable } = require('./browser_runtime.cjs');
const core = require('../extension/js/core.js');
const extension = path.resolve(__dirname, '../extension');
const origin = 'https://purrple-fixture.invalid';
const pageOrigin = 'https://browser-fixture.invalid';
const contentScripts = require('../extension/manifest.json').content_scripts[0].js;
const mime = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ttf': 'font/ttf' };

async function run() {
  const browser = await chromium.launch({ executablePath: executable(),
    args: ['--single-process', '--no-zygote', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage({ viewport: { width: 880, height: 680 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(6000);
    const errors = [], opened = [];
    page.on('pageerror', error => errors.push(error.message));
    let state = core.defaultState(), checkpoint=null, rejectedArrival=false;
    await page.exposeBinding('purrpleFixtureMessage', ({ frame }, request) => {
      const fromPanel = frame.url().startsWith(origin + '/popup.html') || frame.url().startsWith(origin + '/game.html');
      switch (request.type) {
        case 'GET_STATE': return { ok: true, state: fromPanel ? state : core.publicState(state) };
        case 'ACTION':
          assert.ok(fromPanel);
          state = core.reduce(state, request.action);
          return { ok: true, state };
        case 'PET_CLAIM':
          if (frame.url().endsWith('/next-page') && !rejectedArrival) {
            rejectedArrival=true;
            return { ok:true, active:false };
          }
          return { ok:true,leaseId:'preview-lease',position:{x:.82,y:1},presence:checkpoint };
        case 'PET_SAVE':
        case 'PET_RELEASE':
          if(request.presence)checkpoint=request.presence;
          return {ok:true,saved:true,released:true};
        case 'PET_PANEL_OPEN': {
          opened.push(request.view);
          const target = new URL(request.view === 'play' ? '/game.html' : '/popup.html', origin);
          target.searchParams.set('panel', '1');
          target.searchParams.set('token', 'preview-token');
          target.searchParams.set('view', request.view);
          if (request.game) target.searchParams.set('game', request.game);
          return { ok: true, url: target.href, token: 'preview-token' };
        }
        case 'PET_AMBIENT': return { ok: true };
        case 'OPEN_APP': throw Error('The workspace opened a new tab instead of the page panel.');
        default: return { ok: true };
      }
    });
    await page.addInitScript(({ origin }) => {
      const runtime = {
        id: 'preview-fixture',
        getURL: name => new URL(name, origin + '/').href,
        sendMessage: message => globalThis.purrpleFixtureMessage(message),
        onMessage: { addListener() {}, removeListener() {} }
      };
      globalThis.browser = { runtime };
      if (parent === window) {
        const attachShadow = Element.prototype.attachShadow;
        Element.prototype.attachShadow = function (options) {
          const root = attachShadow.call(this, options);
          if (this.tagName === 'PURRPLE-COMPANION') globalThis.fixtureShadow = root;
          return root;
        };
      }
    }, { origin });
    await page.route(origin + '/**', async route => {
      const filename = new URL(route.request().url()).pathname.slice(1);
      const file = path.resolve(extension, filename);
      assert.ok(file.startsWith(extension + path.sep));
      await route.fulfill({ contentType: mime[path.extname(file)] || 'application/octet-stream',
        body: await fs.readFile(file) });
    });
    await page.route(pageOrigin + '/**', route => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>Work fixture</title><button id="host-action">Host action</button>'
    }));
    await page.goto(pageOrigin);
    for (const script of contentScripts) await page.addScriptTag({ path: path.join(extension, script) });
    await page.waitForFunction(() => document.querySelector('purrple-companion')?.dataset.active === 'true');
    const panel = () => page.frames().find(frame => frame.url().startsWith(origin + '/popup.html') || frame.url().startsWith(origin + '/game.html'));
    const click = selector => page.evaluate(selector => fixtureShadow.querySelector(selector).click(), selector);
    const waitRoute = part => page.waitForFunction(({ origin, part }) => {
      const target = fixtureShadow.querySelector('iframe')?.src;
      return target?.startsWith(origin) && target.includes(part);
    }, { origin, part }).then(() => panel()?.url().includes(part) ? undefined : page.waitForEvent('framenavigated', {
      predicate: frame => frame.url().includes(part),
      timeout: 2000
    }).catch(error => { if (!panel()?.url().includes(part)) throw error; }));
    assert.equal(await page.evaluate(() => fixtureShadow.querySelector('.paw')), null);
    const box = await page.evaluate(() => fixtureShadow.querySelector('.actor').getBoundingClientRect().toJSON());
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    assert.notEqual(await page.locator('purrple-companion').getAttribute('data-state'), 'held');
    await page.mouse.up();
    const design = await page.evaluate(() => [...fixtureShadow.querySelectorAll('.menu [data-action]')].map(el => {
      const style=getComputedStyle(el);
      return [style.left,style.top];
    }));
    assert.equal(design.length,6);
    assert.equal(new Set(design.map(JSON.stringify)).size,6);
    await click('[data-action="today"]');
    await waitRoute('view=today');
    await panel().locator('#compact-task-title').fill('Read two pages');
    await panel().locator('#compact-task-title').press('Enter');
    await panel().getByText('Read two pages', { exact: true }).waitFor();
    await panel().locator('#compact-task-title').press('Escape');
    await page.waitForFunction(() => !fixtureShadow.querySelector('iframe'));
    await page.waitForFunction(() => fixtureShadow.activeElement?.className === 'actor');
    await page.evaluate(() => fixtureShadow.querySelector('.actor').focus());
    await page.keyboard.press('Enter');
    await click('[data-action="more"]');
    await click('[data-action="calendar"]');
    await waitRoute('view=calendar');
    await panel().locator('#compact-calendar').waitFor({ state: 'visible' });
    await click('.panel-close');
    await page.evaluate(() => fixtureShadow.querySelector('.actor').focus());
    await page.keyboard.press('Enter');
    await click('[data-action="play"]');
    await click('[data-action="companion-play-paw-pairs"]');
    await waitRoute('game=paw-pairs');
    await panel().getByRole('heading', { name: 'Paw Pairs' }).waitFor();
    assert.equal(await panel().locator('#compact-main, .cp-nav, .cp-bond').count(), 0);
    await panel().getByRole('button', { name: /start|begin/i }).first().click();
    await panel().locator('.cg-pairs .cg-card').first().waitFor();
    await click('.panel-close');
    await page.evaluate(() => fixtureShadow.querySelector('.actor').focus());
    await page.keyboard.press('Enter');
    await click('[data-action="care"]');
    await click('[data-action="companion-gifts"]');
    await waitRoute('view=gifts');
    await panel().locator('#compact-companion-content canvas').waitFor({ state: 'visible' });
    await page.locator('#host-action').click();
    await page.waitForFunction(() => !fixtureShadow.querySelector('iframe'));
    assert.deepEqual(opened, ['today', 'calendar', 'play', 'gifts']);
    assert.equal(page.url(), pageOrigin + '/');
    await page.evaluate(() => { PurrpleCompanionDebug.play('nap'); });
    await page.waitForFunction(() => PurrpleCompanionDebug.snapshot().clip === 'sleep');
    const before=await page.evaluate(() => PurrpleCompanionDebug.snapshot());
    await page.goto(pageOrigin + '/next-page');
    for (const script of contentScripts) await page.addScriptTag({ path: path.join(extension, script) });
    await page.waitForFunction(() => PurrpleCompanionDebug?.snapshot().active && PurrpleCompanionDebug.snapshot().clip === 'sleep',null,{timeout:3000});
    assert.ok(rejectedArrival,'The first claim was denied to exercise the early retry.');
    const after=await page.evaluate(() => PurrpleCompanionDebug.snapshot());
    assert.equal(after.size,before.size);
    assert.ok(Math.abs(after.x-before.x)<1);
    assert.deepEqual(errors, []);
    console.log('Passed four same-page routes, task creation, Escape focus return, and host-page click-through (real Chromium with simulated transport).');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
