/* Optional Canvas adapter for contact sheets and asset reproduction.
 * Install @napi-rs/canvas in the development environment. Firefox remains
 * the acceptance target for browser rendering and interactions.
 */
'use strict';
const { createCanvas, Image } = require('@napi-rs/canvas');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const runtime = path.resolve(__dirname, '../extension');
const sandbox = {
  Image,
  document: { createElement: () => createCanvas(1, 1) },
  location: { protocol: 'moz-extension:' },
  browser: { runtime: { getURL: file => fs.readFileSync(path.join(runtime, file)) } }
};
vm.createContext(sandbox);
for (const file of ['renderer-data.js', 'renderer.js']) {
  vm.runInContext(fs.readFileSync(path.join(runtime, 'js', file), 'utf8'), sandbox);
}
const renderer = sandbox.PurrpleRenderer;
const art = sandbox.PurrpleArt;
function paint(clip, key, equip = {}) {
  const canvas = createCanvas(320, 320);
  const context = canvas.getContext('2d');
  context.translate(32, 32);
  context.imageSmoothingEnabled = false;
  renderer.drawFrame(context, clip, key, equip);
  return canvas;
}
function pixels(canvas) {
  return canvas.getContext('2d').getImageData(0, 0, 320, 320).data;
}
function difference(base, fit) {
  let visible = 0, overflow = false;
  for (let i = 0; i < base.length; i += 4) {
    if (base[i] === fit[i] && base[i + 1] === fit[i + 1] && base[i + 2] === fit[i + 2] && base[i + 3] === fit[i + 3]) continue;
    visible++;
    const x = (i / 4) % 320, y = Math.floor(i / 1280);
    if (x === 0 || x === 319 || y === 0 || y === 319) overflow = true;
  }
  return { visible, overflow };
}
async function main() {
  await renderer.preload({ all: true });
  const report = { scope: 'Bundled Canvas renderer with a Node Canvas adapter', count: 0, issues: [] };
  for (const [clip, sprite] of Object.entries(art.sprites)) {
    for (let key = 0; key < sprite.frames.length; key++) {
      const base = pixels(paint(clip, key));
      for (const [id, item] of Object.entries(art.items)) {
        const fit = paint(clip, key, { [item.slot]: id });
        const result = difference(base, pixels(fit));
        if (result.visible < 20 || result.overflow) report.issues.push({ clip, key, id, ...result });
        report.count++;
      }
    }
  }
  for (const [id, item] of Object.entries(art.items)) {
    if (process.argv.includes('--thumbnails')) {
      fs.writeFileSync(path.join(runtime, 'assets/wardrobe/thumbs', id + '.png'),
        paint('idle', 0, { [item.slot]: id }).toBuffer('image/png'));
    }
  }
  const sheet = createCanvas(1200, 670), context = sheet.getContext('2d');
  context.fillStyle = '#f8f3fb';
  context.fillRect(0, 0, sheet.width, sheet.height);
  const samples = [['idle', 0], ['idle', 3], ['walk', 0], ['run', 2], ['held', 2], ['sleep', 0],
    ['loaf', 3], ['loaf', 5], ['read', 1], ['study', 4], ['cry', 1], ['wake', 0]];
  for (const [index, [clip, key]] of samples.entries()) {
    for (const [row, id] of ['moon-collar', 'cozy-scarf'].entries()) {
      const x = index % 6 * 200, y = (Math.floor(index / 6) * 2 + row) * 165;
      context.imageSmoothingEnabled = false;
      context.drawImage(paint(clip, key, { neck: id }), x + 21, y - 7, 158, 158);
      context.fillStyle = '#3c2748';
      context.font = '13px sans-serif';
      context.fillText(clip + ':' + key + ' ' + id, x + 16, y + 154);
    }
  }
  const output = process.env.PURRPLE_FIT_SHEET;
  if (output) fs.writeFileSync(output, sheet.toBuffer('image/png'));
  console.log(JSON.stringify(report, null, 2));
  if (report.issues.length) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
