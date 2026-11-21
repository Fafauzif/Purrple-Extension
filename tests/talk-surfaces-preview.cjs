/* Render Talk in Chromium. The roaming fixture simulates extension messaging. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');
const { executable } = require('./browser_runtime.cjs');
const core = require('../extension/js/core.js');
const manifest = require('../extension/manifest.json');
const extension = path.resolve(__dirname, '../extension');
const fixtureSite = 'https://work-fixture.invalid';
const fixtureExtension = 'https://talk-fixture.invalid';
const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };

async function verifyRoaming(browser) {
  const page = await browser.newPage({ viewport: { width: 880, height: 680 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let state = core.defaultState();
  let hold = null;
  let replies = 0;
  let position = { x: .82, y: 1 };
  await page.exposeBinding('talkFixtureMessage', async ({ frame }, request) => {
    const fromPlanner = frame.url().startsWith(fixtureExtension + '/popup.html');
    switch (request.type) {
      case 'GET_STATE': return { ok: true, state: fromPlanner ? state : core.publicState(state) };
      case 'PET_CLAIM': return { ok: true, leaseId: 'talk-lease', position };
      case 'PET_SAVE': case 'PET_RELEASE':
        if (request.position) position = request.position;
        return { ok: true };
      case 'PET_PANEL_OPEN': return { ok: true, token: 'talk-token',
        url: fixtureExtension + '/popup.html?panel=1&view=today&token=talk-token' };
      case 'PET_TALK': {
        replies++;
        const deferred = hold;
        if (deferred) {
          deferred.started();
          await deferred.wait;
        }
        state = core.reduce(state, { type: 'TALK_REPLY', promptId: request.promptId });
        return { ok: true, reply: state.talk.last };
      }
      default: return { ok: true };
    }
  });
  await page.addInitScript(origin => {
    globalThis.browser = { runtime: {
      id: 'talk-fixture', getURL: name => new URL(name, origin + '/').href,
      sendMessage: message => globalThis.talkFixtureMessage(message),
      onMessage: { addListener() {}, removeListener() {} }
    } };
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) {
      const root = attach.call(this, options);
      if (this.tagName === 'PURRPLE-COMPANION') globalThis.talkShadow = root;
      return root;
    };
  }, fixtureExtension);
  await page.route(fixtureExtension + '/**', async route => {
    const relative = new URL(route.request().url()).pathname.slice(1);
    const file = path.resolve(extension, relative);
    assert.ok(file.startsWith(extension + path.sep));
    await route.fulfill({ contentType: type[path.extname(file)] || 'application/octet-stream',
      body: await fs.readFile(file) });
  });
  await page.route(fixtureSite + '/**', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>Talk fixture</title><button id="host-action">Host action</button>'
  }));
  await page.goto(fixtureSite);
  for (const script of manifest.content_scripts[0].js) {
    await page.addScriptTag({ path: path.join(extension, script) });
  }
  await page.waitForFunction(() => document.querySelector('purrple-companion')?.dataset.active === 'true');
  const visible = selector => page.waitForFunction(selector =>
    Boolean(talkShadow.querySelector(selector)?.getClientRects().length), selector);
  const click = async selector => {
    await visible(selector);
    const point = await page.evaluate(selector => {
      const button = talkShadow.querySelector(selector);
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      return talkShadow.elementFromPoint(x, y)?.closest(selector) === button ? { x, y } : null;
    }, selector);
    assert.ok(point, selector + ' must receive the actual pointer');
    await page.mouse.click(point.x, point.y);
  };
  const openTalk = async () => {
    await page.evaluate(() => talkShadow.querySelector('.actor').focus());
    await page.keyboard.press('Enter');
    await click('.menu [data-action="talk"]');
  };
  const deferReply = () => {
    let resolve, started;
    const wait = new Promise(done => { resolve = done; });
    const requested = new Promise(done => { started = done; });
    hold = { wait, started };
    return { requested, release: () => { hold = null; resolve(); } };
  };
  const reply = '.speech:not([hidden])';
  const keepTalking = reply + ' [data-action="hello"]';
  await click('.actor');
  await click('.menu [data-action="today"]');
  await page.waitForFunction(() => talkShadow.querySelector('.panel')?.dataset.ready === 'true');
  const planner = page.frames().find(frame => frame.url().startsWith(fixtureExtension + '/popup.html'));
  await planner.getByRole('button', { name: 'Keep panel open' }).click();
  await page.locator('#host-action').click();
  assert.equal(await page.evaluate(() => talkShadow.querySelector('.panel').hidden), false);

  // At this width it is physically impossible to fit the speech beside the
  // planner. Its controls still need to win hit-testing where they overlap.
  await page.setViewportSize({ width: 370, height: 420 });
  await page.waitForFunction(() => {
    const actor = talkShadow.querySelector('.actor').getBoundingClientRect();
    return Math.abs(actor.bottom - (innerHeight - 12)) < 1;
  });
  await openTalk();
  await click('.menu [data-action="hello"]');
  await visible(keepTalking);
  const first = state.talk.last.text;
  assert.equal(await page.evaluate(() => talkShadow.querySelector('.speech p').textContent), first);
  assert.equal(await page.evaluate(() => {
    const s = talkShadow.querySelector('.speech').getBoundingClientRect();
    const p = talkShadow.querySelector('.panel').getBoundingClientRect();
    return s.left < p.right && p.left < s.right && s.top < p.bottom && p.top < s.bottom;
  }), true);
  assert.equal(await page.evaluate(() => talkShadow.querySelector('.menu').hidden), true);
  await click(keepTalking);
  await page.waitForFunction(previous => talkShadow.querySelector('.speech p').textContent !== previous, first);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => talkShadow.querySelector('.speech').hidden && talkShadow.activeElement?.className === 'actor');
  assert.equal(await page.evaluate(() => talkShadow.querySelector('.panel').hidden), false);

  await openTalk();
  const next = deferReply();
  const count = replies;
  await click('.menu [data-action="hello"]');
  await next.requested;
  await click('.menu [data-action="hello"]');
  assert.equal(replies, count + 1);
  await page.locator('#host-action').focus();
  next.release();
  await visible(reply);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'host-action');
  await click('.speech .dismiss');

  await openTalk();
  const stale = deferReply();
  await click('.menu [data-action="hello"]');
  await stale.requested;
  await page.keyboard.press('Escape');
  stale.release();
  await page.waitForFunction(() => talkShadow.querySelector('.menu').hidden);
  const last = replies;
  await openTalk();
  await click('.menu [data-action="joke"]');
  await visible(reply + ' [data-action="joke"]');
  assert.equal(replies, last + 1);
  assert.equal(await page.evaluate(() => talkShadow.querySelector('.speech p').textContent), state.talk.last.text);
  assert.deepEqual(errors, []);
}

async function verifyControls(browser, file, actorId, menuId, speechId) {
  const page = await browser.newPage({ viewport: { width: 360, height: 420 } });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(pathToFileURL(path.join(extension, file)).href);
  const actor = page.locator('#' + actorId);
  await actor.waitFor();
  await actor.focus();
  await page.keyboard.press('Enter');
  const menu = page.locator('#' + menuId);
  assert.equal(await menu.isVisible(), true);
  await menu.getByRole('button', { name: 'Talk', exact: true }).click();
  await menu.getByRole('button', { name: 'Say hello', exact: true }).click();
  const speech = page.locator('#' + speechId);
  await speech.getByRole('button', { name: 'Keep talking', exact: true }).waitFor();
  await page.waitForFunction(id => document.querySelector('#' + id).contains(document.activeElement), speechId);
  assert.equal(await menu.isVisible(), false);
  await speech.getByRole('button', { name: 'Back', exact: true }).click();
  await menu.getByRole('button', { name: 'Tell a joke', exact: true }).click();
  await speech.getByRole('button', { name: 'Tell another', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.waitForFunction(id => document.activeElement.id === id, actorId);
  assert.equal(await speech.isVisible(), false);
  assert.deepEqual(errors, []);
}

async function inBrowser(check) {
  const browser = await chromium.launch({ executablePath: executable(),
    args: ['--single-process', '--no-zygote', '--disable-dev-shm-usage'] });
  try {
    await check(browser);
  } finally { await browser.close(); }
}
async function run() {
  await inBrowser(verifyRoaming);
  await inBrowser(browser => verifyControls(browser, 'app.html', 'dashboard-pet', 'dashboard-pet-menu', 'dashboard-pet-speech'));
  await inBrowser(browser => verifyControls(browser, 'popup.html', 'compact-pet', 'compact-pet-menu', 'compact-pet-speech'));
  console.log('PASS: Pinned-panel Talk stacking, delayed replies, Escape, and compact and dashboard Talk in Chromium.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
