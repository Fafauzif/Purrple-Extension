/* Browser-side Canvas comparison, shared by Firefox and Chromium runners. */
function measureWardrobeFit(reviewAll, range, includeSheets = true) {
  const { items } = PurrpleWardrobeV2;
  const ids = PurrpleRenderer.itemIds;
  const samples = [ ['idle', 0], ['look', 0], ['walk', 6], ['held', 0], ['sleep', 3], ['wake', 6],
    ['loaf', 3], ['read', 0], ['study', 6], ['cry', 0], ['turn', 6], ['wave', 3] ];
  const canvasForFrame = () => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 320;
    return canvas;
  };
  const frame = (clip, key, equipped = {}, canvas = canvasForFrame()) => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(1, 0, 0, 1, 32, 32);
    ctx.clearRect(-32, -32, 320, 320);
    ctx.imageSmoothingEnabled = false;
    PurrpleRenderer.drawFrame(ctx, clip, key, equipped);
    return canvas;
  };
  const baseCanvas = canvasForFrame(), fitCanvas = canvasForFrame();
  const pixels = canvas => new Uint32Array(canvas.getContext('2d').getImageData(0, 0, 320, 320).data.buffer);
  const encode = canvas => canvas.toDataURL('image/png').split(',')[1];
  const record = { rendered: 0, intentionalPoseFallbacks: 0, clipped: [], insufficientPixels: [], unexpectedPixels: [], byId: {} };
  for (const id of ids) record.byId[id] = { rendered: 0, fallback: 0, min: null, peak: 0 };
  if (reviewAll) for (const [clip, sprite] of Object.entries(PurrpleArt.sprites).slice(...(range || []))) {
    sprite.frames.forEach((_, key) => {
      const base = pixels(frame(clip, key, {}, baseCanvas));
      for (const id of ids) {
        const slot = PurrpleRenderer.itemFit(id).slot;
        const pose = PurrpleWardrobeV2.anchors[clip][key];
        const supported = (slot !== 'paw' || Boolean(pose.p)) && (slot !== 'body' || Boolean(pose.l));
        const equipped = { [slot]: id };
        const actual = pixels(frame(clip, key, equipped, fitCanvas));
        let delta = 0;
        let edge = 0;
        for (let i = 0; i < base.length; i++) {
          if (base[i] === actual[i]) continue;
          delta++;
          if (i%320 === 0 || i%320 === 319 || i < 320 || i >= 319*320) edge++;
        }
        if (supported) {
          record.rendered++;
          const stats = record.byId[id];
          stats.rendered++;
          stats.min = Math.min(stats.min ?? delta, delta);
          stats.peak = Math.max(stats.peak, delta);
          if (delta < 20) record.insufficientPixels.push({ id, clip, key, delta });
          if (edge) record.clipped.push({ id, clip, key, edge });
        } else {
          record.intentionalPoseFallbacks++;
          record.byId[id].fallback++;
          if (delta) record.unexpectedPixels.push({ id, clip, key, delta });
        }
      }
    });
  }
  if (!includeSheets) return { record };
  const columns = 6;
  const labels = samples.map(([clip,key]) => `${clip} / ${key}`);
  const fits = items.map(({ id, slot }) => [id, { [slot]: id }]);
  fits.push(['combined', { head: 'silk-ear-bow', neck: 'rose-knit-scarf', face: 'round-moon-glasses',
    paw: 'pocket-reader', body: 'quilted-lap-blanket' }]);
  const sheets = {};
  for (const [name, equipped] of fits) {
    const sheet = document.createElement('canvas');
    sheet.width = columns * 178;
    sheet.height = 724;
    const ctx = sheet.getContext('2d');
    ctx.font = '13px system-ui';
    for (let index = 0; index < samples.length * 2; index++) {
      const [clip,key] = samples[index % samples.length];
      const light = index < samples.length;
      const x = index % columns * 178, y = Math.floor(index / columns) * 181;
      ctx.fillStyle = light ? '#fbf7fa' : '#282038';
      ctx.fillRect(x, y, 178, 181);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(frame(clip, key, equipped), x + 10, y, 158, 158);
      ctx.fillStyle = light ? '#392840' : '#f9e7fd';
      ctx.fillText(labels[index % samples.length], x + 9, y + 173);
    }
    sheets[name] = encode(sheet);
  }
  const motion = document.createElement('canvas');
  motion.width = 1080; motion.height = 440;
  const ctx = motion.getContext('2d');
  ctx.fillStyle = '#fbf7fa'; ctx.fillRect(0, 0, 1080, 220);
  ctx.fillStyle = '#282038'; ctx.fillRect(0, 220, 1080, 220);
  const options = { equipped: fits.at(-1)[1] };
  for (const [row, facing] of [[0, 1], [1, -1]]) {
    const snapshots = [['idle', .53, 96], ['blink', 1.2, 128], ['walk', .34, 128], ['turn', .44, 128],
      ['held', .54, 162], ['sleep', 1.2, 174]];
    snapshots.forEach(([clip, time, size], index) => {
      const x = index*180+90, y = row*220+184;
      PurrpleRenderer.draw(ctx, { ...options, clip, time, size, x, y, facing, motion: !row });
      ctx.fillStyle = row ? '#f9e7fd' : '#392840';
      ctx.fillText(`${clip} · ${size}px`, x-49, y+22);
    });
  }
  sheets['combined-native-size'] = encode(motion);
  const thumbs = Object.fromEntries(items.map(item => [
    item.id, encode(frame(item.previewPose || 'idle', 0, { [item.slot]: item.id }))
  ]));
  return { record, sheets, thumbs };
}
if (typeof module === "object" && module.exports) module.exports = measureWardrobeFit;
