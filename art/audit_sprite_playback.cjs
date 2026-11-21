/* Browser audit of every stored drawing and 30 Hz sample of every clip. */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { executable } = require('../tests/browser_runtime.cjs');
const modules = process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
const { chromium } = require(modules ? path.join(modules, 'playwright') : 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.argv[2] || path.join(root, 'verification/sprite-playback.json'));

async function audit() {
  const browser = await chromium.launch({
    executablePath: executable(),
    args: ['--no-sandbox', '--single-process', '--no-zygote', '--allow-file-access-from-files']
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(pathToFileURL(path.join(root, 'extension/animations.html')).href);
    await page.waitForFunction(() => PurrpleMotionStudio?.getState().ready);
    const report = await page.evaluate(() => {
      PurrpleMotionStudio.pause();
      const renderer = PurrpleRenderer;
      const canvas = document.createElement('canvas');
      canvas.width = 244;
      canvas.height = 254;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const equipped = {
        head: 'cozy-beanie',
        neck: 'star-bandana',
        face: 'study-frames',
        paw: 'starglow-pencil',
        body: 'quilted-lap-blanket'
      };

      function measure(previous) {
        const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let area = 0, sumX = 0, sumY = 0, edge = 0, changed = 0, union = 0;
        for (let y = 0; y < canvas.height; y++) {
          for (let x = 0; x < canvas.width; x++) {
            const i = (y * canvas.width + x) * 4;
            const visible = rgba[i + 3] > 96;
            const wasVisible = !!previous && previous[i + 3] > 96;
            if (visible) {
              area++;
              sumX += x;
              sumY += y;
              if (!x || !y || x === canvas.width - 1 || y === canvas.height - 1) edge++;
            }
            if (previous && (visible || wasVisible)) {
              union++;
              const colorDifference = Math.abs(rgba[i] - previous[i])
                + Math.abs(rgba[i + 1] - previous[i + 1])
                + Math.abs(rgba[i + 2] - previous[i + 2]);
              if (visible !== wasVisible || colorDifference > 38) changed++;
            }
          }
        }
        return { rgba, area, edge, center: [sumX / area, sumY / area], change: union ? changed / union : 0 };
      }

      const sourceFrames = [];
      for (const [id, sprite] of Object.entries(PurrpleArt.sprites)) {
        for (let key = 0; key < sprite.frames.length; key++) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.save();
          ctx.translate(58, 62);
          ctx.scale(.5, .5);
          renderer.drawFrame(ctx, id, key, equipped);
          ctx.restore();
          const { area, edge } = measure();
          if (!area || edge) throw new Error(`Source pose is blank or clipped: ${id}/${key}`);
          sourceFrames.push({ id, key, area });
        }
      }

      const playback = [];
      for (const variant of [
        { label: 'standard', outfit: {}, rootMotion: false },
        { label: 'dressed', outfit: equipped, rootMotion: false },
        { label: 'studio', outfit: {}, rootMotion: true }
      ]) {
        for (const clip of renderer.clips) {
          const samples = [];
          const steps = Math.ceil(clip.duration * 30);
          let previous;
          for (let index = 0; index <= steps; index++) {
            const time = index === steps ? clip.duration : index / 30;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const start = performance.now();
            const drawn = renderer.draw(ctx, {
              clip: clip.id, time, size: 128, x: 122, y: 210,
              equipped: variant.outfit, rootMotion: variant.rootMotion
            });
            const submitMS = performance.now() - start;
            const sample = measure(previous?.rgba);
            if (!drawn || !sample.area || sample.edge) {
              throw new Error(`Playback is missing or clipped: ${variant.label}/${clip.id}/${index}`);
            }
            const shift = previous ? Math.hypot(
              sample.center[0] - previous.center[0], sample.center[1] - previous.center[1]
            ) : 0;
            samples.push({ index, time, shift, change: sample.change, area: sample.area, submitMS });
            previous = sample;
          }
          playback.push({ clip: clip.id, variant: variant.label, loop: clip.loop, samples });
        }
      }

      return { clipCount: renderer.clips.length, sourceFrames, playback };
    });
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ ...report, errors }, null, 2));
    const samples = report.playback.flatMap(row => row.samples);
    const times = samples.map(row => row.submitMS).sort((a, b) => a - b);
    console.log(JSON.stringify({
      clips: report.clipCount, sourceFrames: report.sourceFrames.length, samples: samples.length,
      p95SubmitMS: times[Math.floor(times.length * .95)], errors
    }));
    if (errors.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

audit().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
