/* Real browser rendering with the explicit localStorage preview adapter. */
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const {executable} = require('./browser_runtime.cjs');
const {verifyCompactWorkday} = require('./workday-v3-smoke.cjs');

async function main() {
  const args = process.env.PURRPLE_SINGLE_PROCESS === '1'
    ? ['--single-process','--no-zygote','--disable-dev-shm-usage']
    : [];
  const browser = await chromium.launch({executablePath:executable(),args});
  const page = await browser.newPage({viewport:{width:360,height:420},reducedMotion:'reduce'});
  const scriptErrors=[];
  page.on('pageerror', error => scriptErrors.push(error.message));
  const popup = pathToFileURL(path.join(__dirname,'../extension/popup.html')).href;
  const navigate = () => page.goto(popup);
  try {
    await navigate();
    await page.locator('#preview-label').waitFor({state:'visible'});
    assert.equal(await page.evaluate(() => PurrpleClient.native), false);
    await verifyCompactWorkday({
      evaluate:expression=>page.evaluate(expression),
      waitFor:expression=>page.waitForFunction(expression),
      get:()=>page.evaluate(() => PurrpleCompact.getState()),
      navigate
    });
    assert.deepEqual(scriptErrors,[]);
    console.log('PASS: Compact capture, edit, scheduling, focus, completion, Undo and theme persistence in the labeled local preview.');
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
