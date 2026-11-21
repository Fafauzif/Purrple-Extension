/* Produce fit evidence from Chromium Canvas and the shared extension scripts. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES
  ? `${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/playwright` : 'playwright');
const { executable } = require('../tests/browser_runtime.cjs');
const root = path.resolve(__dirname, '..');

async function main() {
  const browser = await chromium.launch({ executablePath: executable(), headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage();
    await page.goto(pathToFileURL(path.join(root, 'art/fit-preview.html')).href);
    await page.waitForFunction(() => globalThis.PurrpleFit?.ready);
    const measureWardrobeFit = require('./wardrobe-v2-canvas-probe.cjs');
    const result = await page.evaluate(measureWardrobeFit, !process.argv.includes('--preview-only'));
    result.record.browser = `Chromium ${browser.version()}`;
    result.record.scope = 'Actual shared browser Canvas compositor loaded via its local development fit viewer';
    const output = process.env.PURRPLE_FIT_OUTPUT || path.join(root, 'verification/wardrobe-v2');
    fs.mkdirSync(output, { recursive: true });
    for (const [name, value] of Object.entries(result.sheets)) fs.writeFileSync(path.join(output, `${name}.png`), Buffer.from(value, 'base64'));
    fs.writeFileSync(path.join(output, 'coverage.json'), JSON.stringify(result.record, null, 2) + '\n');
    if (process.argv.includes('--thumbnails')) {
      const folder = path.join(root, 'extension/assets/wardrobe/thumbs');
      for (const [name, value] of Object.entries(result.thumbs)) fs.writeFileSync(path.join(folder, `${name}.png`), Buffer.from(value, 'base64'));
    }
    console.log(JSON.stringify(result.record, null, 2));
    if (result.record.clipped.length || result.record.insufficientPixels.length || result.record.unexpectedPixels.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
