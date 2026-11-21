'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const extension = path.resolve(__dirname, '../extension');
const box = vm.createContext({});
for (const file of ['renderer-data.js', 'wardrobe-v2.js', 'renderer.js']) {
  vm.runInContext(fs.readFileSync(path.join(extension, 'js', file), 'utf8'), box);
}
const { PurrpleArt: art, PurrpleWardrobeV2: wardrobe, PurrpleRenderer: renderer } = box;

test('the shared renderer retains legacy IDs and loads every new wearable and room asset', () => {
  const legacy = Object.keys(art.items);
  const ids = [...legacy, ...wardrobe.items.map(item => item.id), ...wardrobe.decor.map(item => item.id)];
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(legacy.length, 15);
  assert.equal(wardrobe.items.length + wardrobe.decor.length, 18);
  for (const id of legacy) assert(renderer.itemIds.includes(id));
  for (const item of [...wardrobe.items, ...wardrobe.decor]) {
    const bytes = fs.readFileSync(path.resolve(extension, item.src));
    assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
    assert.equal(bytes.readUInt8(25), 6, `${item.id} needs explicit transparent RGBA pixels`);
    assert(bytes.readUInt32BE(16) <= 224 && bytes.readUInt32BE(20) <= 224);
    if (!item.slot) continue;
    assert.equal(renderer.itemFit(item.id).slot, item.slot);
    assert(fs.existsSync(path.resolve(extension, 'assets/wardrobe/thumbs', `${item.id}.png`)));
  }
});

test('measured centers normalize every authored sprite baseline and keep lens openings paired', () => {
  for (const [clip, sprite] of Object.entries(art.sprites)) {
    assert.equal(wardrobe.anchors[clip].length, sprite.frames.length);
    sprite.frames.forEach((_, key) => {
      const original = art.poses[clip][key];
      const { eyes, paw, lap } = renderer.landmarkFor(clip, key).accessoryFit;
      const offset = 232 - (sprite.baseline || 232);
      assert.equal(eyes.length, original.profile ? 1 : 2);
      for (const [x,y,w,h] of eyes) {
        assert(x > 0 && x < 256 && y > 0 && y < 256 && w > 0 && h > 0, `${clip}/${key} optical limits`);
      }
      if (eyes.length === 2) assert(eyes[0][0] < eyes[1][0], `${clip}/${key} eye ordering`);
      if (paw) assert(paw[2] > 0 && paw[1] <= original.bbox[3]+offset);
      if (lap) assert(lap[2] > 0 && lap[3] > 0 && lap[1] <= original.bbox[3]+offset);
    });
  }
});

test('poses with authored hand-held props or locomotion retain the selected outfit without visual interference', () => {
  for (const clip of ['read', 'study', 'walk', 'run', 'heart', 'reminder']) {
    for (const frame of wardrobe.anchors[clip]) assert.equal(frame.p, null, clip);
  }
  for (const clip of ['walk', 'run', 'jump', 'study', 'read']) {
    for (const frame of wardrobe.anchors[clip]) assert.equal(frame.l, null, clip);
  }
  assert(renderer.landmarkFor('idle', 0).accessoryFit.paw);
  assert(renderer.landmarkFor('idle', 0).accessoryFit.lap);
  assert(renderer.landmarkFor('sleep', 0).accessoryFit.lap);
});

test('the quilt sits at the same lap height as the idle head moves and drapes across the curl in previews', () => {
  const idle = renderer.landmarkFor('idle', 0);
  const upright = renderer.landmarkFor('idle', 3);
  assert(Math.abs(idle.eye[1] - upright.eye[1]) > 10);
  assert(Math.abs(idle.accessoryFit.lap[1] - upright.accessoryFit.lap[1]) < 2);

  const item = renderer.itemFit('quilted-lap-blanket');
  const curled = renderer.landmarkFor(item.previewPose, 0);
  assert.equal(curled.family, 'sleep');
  assert(curled.accessoryFit.lap[4] < -.35);
});
