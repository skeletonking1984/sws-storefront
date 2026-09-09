#!/usr/bin/env node
/*
 * Turn one logo image into every asset the storefront needs.
 *
 *   npm run logo -- ~/Downloads/new-logo.png
 *
 * Writes, all from that single source:
 *   app/assets/logo.png           horizontal lockup (mark left, wordmark right) - header, footer
 *   app/assets/logo-stacked.png   the source lockup, keyed and trimmed        - hero
 *   app/assets/favicon.png        32px, mark only
 *   app/assets/apple-touch-icon.png  180px, mark only on brand background
 *   app/assets/mark.png           512px mark, for anything else that needs it
 *   screenshots/logo-qa.png       contact sheet at real render sizes
 *
 * Expects a logo on a flat dark background (the usual generator output). The
 * background is keyed out so the art sits on the purple site without a black box.
 *
 * WHY THE KNEE MATTERS: the obvious key is alpha = brightness, but that leaves
 * every mid-tone pixel semi-transparent. A #7C3AED purple peaks at 237, so the
 * whole mark renders at ~93% opacity and looks washed out against the site's
 * lighter purple. So anything brighter than KNEE is treated as fully covered and
 * keeps its true colour; only the dim outer pixels ramp down into transparency.
 * That keeps the glow soft while the strokes stay solid.
 *
 * Layout detection is by alpha, not hardcoded rows, so new art still works: the
 * first run of non-empty rows is the mark, the runs below it are the wordmark,
 * and a trailing short run (a sparkle or flourish) is dropped from the
 * horizontal lockup.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// Anything at or below this brightness is background. Keep this above the
// compression noise floor of the source: webp/jpg leave faint speckle in the
// black plate, and if that survives the key it registers as a band of "art" a
// few pixels tall at the image edge, which then gets picked as the mark.
const FLOOR = 24;
// Anything at or above this brightness is fully opaque, at its true colour.
const KNEE = 80;
// Brand background, used behind the iOS icon (it may not be transparent).
const BRAND_BG = '#0b0713';

const source = process.argv[2];
if (!source) {
  console.error('usage: npm run logo -- <path-to-logo-image>');
  console.error('       supports png, jpg, webp - anything Chrome can decode');
  process.exit(1);
}
const srcPath = path.resolve(process.cwd(), source);
if (!fs.existsSync(srcPath)) {
  console.error(`no such file: ${srcPath}`);
  process.exit(1);
}

const ext = path.extname(srcPath).slice(1).toLowerCase() || 'png';
const mime = ext === 'jpg' ? 'jpeg' : ext;
const uri = `data:image/${mime};base64,${fs.readFileSync(srcPath).toString('base64')}`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox'],
});
const page = await browser.newPage();

const out = await page.evaluate(
  async ({uri, floor, knee, brandBg}) => {
    const img = new Image();
    img.src = uri;
    await img.decode();

    const W = img.naturalWidth;
    const H = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const image = ctx.getImageData(0, 0, W, H);
    const px = image.data;
    const srcHadAlpha = (() => {
      for (let i = 3; i < px.length; i += 4) if (px[i] < 250) return true;
      return false;
    })();

    if (!srcHadAlpha) {
      for (let i = 0; i < px.length; i += 4) {
        const r = px[i];
        const g = px[i + 1];
        const b = px[i + 2];
        const peak = Math.max(r, g, b);

        if (peak <= floor) {
          px[i + 3] = 0;
          continue;
        }
        if (peak >= knee) {
          // Fully covered: keep the colour exactly as drawn.
          px[i + 3] = 255;
          continue;
        }
        // Dim outer pixel: ramp alpha and lift the colour back to full strength.
        const a = Math.round(((peak - floor) / (knee - floor)) * 255);
        const scale = 255 / Math.max(peak, 1);
        px[i] = Math.min(255, Math.round(r * scale));
        px[i + 1] = Math.min(255, Math.round(g * scale));
        px[i + 2] = Math.min(255, Math.round(b * scale));
        px[i + 3] = a;
      }
      ctx.putImageData(image, 0, 0);
    }

    const alpha = ctx.getImageData(0, 0, W, H).data;
    const on = (x, y) => alpha[(y * W + x) * 4 + 3] > 14;

    // rows that contain art
    const filledRow = [];
    for (let y = 0; y < H; y++) {
      let n = 0;
      for (let x = 0; x < W; x++) if (on(x, y)) n++;
      filledRow.push(n > Math.max(3, W * 0.004));
    }
    const bands = [];
    let start = null;
    for (let y = 0; y < H; y++) {
      if (filledRow[y] && start === null) start = y;
      if (!filledRow[y] && start !== null) {
        bands.push([start, y - 1]);
        start = null;
      }
    }
    if (start !== null) bands.push([start, H - 1]);
    // Drop slivers: real logo elements are never a couple of pixels tall.
    const minBand = Math.max(3, Math.round(H * 0.02));
    const kept = bands.filter(([a, b]) => b - a + 1 >= minBand);
    bands.length = 0;
    bands.push(...kept);
    if (!bands.length) throw new Error('image is empty after keying');

    const cols = (y0, y1) => {
      let a = W;
      let b = -1;
      for (let y = y0; y <= y1; y++)
        for (let x = 0; x < W; x++)
          if (on(x, y)) {
            if (x < a) a = x;
            if (x > b) b = x;
          }
      return [a, b];
    };

    const mark = bands[0];
    const rest = bands.slice(1);
    // Drop a trailing flourish: a final band much shorter than the one before it.
    let wordBands = rest;
    if (rest.length > 1) {
      const last = rest[rest.length - 1];
      const prev = rest[rest.length - 2];
      const lastH = last[1] - last[0];
      const prevH = prev[1] - prev[0];
      if (lastH < prevH * 0.8) wordBands = rest.slice(0, -1);
    }

    const [mx0, mx1] = cols(mark[0], mark[1]);
    const mW = mx1 - mx0 + 1;
    const mH = mark[1] - mark[0] + 1;

    const hasWord = wordBands.length > 0;
    let wx0 = 0;
    let wx1 = 0;
    let wY0 = 0;
    let wY1 = 0;
    if (hasWord) {
      wY0 = wordBands[0][0];
      wY1 = wordBands[wordBands.length - 1][1];
      [wx0, wx1] = cols(wY0, wY1);
    }
    const wW = wx1 - wx0 + 1;
    const wH = wY1 - wY0 + 1;

    const draw = (sx, sy, sw, sh, targetW, targetH, bg, pad = 0) => {
      const o = document.createElement('canvas');
      o.width = targetW;
      o.height = targetH;
      const g = o.getContext('2d');
      g.imageSmoothingQuality = 'high';
      if (bg) {
        g.fillStyle = bg;
        g.fillRect(0, 0, targetW, targetH);
      }
      const iw = targetW * (1 - pad * 2);
      const ih = targetH * (1 - pad * 2);
      const s = Math.min(iw / sw, ih / sh);
      const dw = sw * s;
      const dh = sh * s;
      g.drawImage(c, sx, sy, sw, sh, (targetW - dw) / 2, (targetH - dh) / 2, dw, dh);
      return o.toDataURL('image/png');
    };

    // Stacked lockup: the whole thing, trimmed.
    const [ax0, ax1] = cols(bands[0][0], bands[bands.length - 1][1]);
    const aY0 = bands[0][0];
    const aY1 = bands[bands.length - 1][1];
    const aW = ax1 - ax0 + 1;
    const aH = aY1 - aY0 + 1;
    const stackedW = 900;
    const stacked = draw(ax0, aY0, aW, aH, stackedW, Math.round((aH / aW) * stackedW), null);

    // Horizontal lockup: mark at full height, wordmark at 62% beside it.
    let horizontal = stacked;
    let horizDims = [stackedW, Math.round((aH / aW) * stackedW)];
    if (hasWord) {
      const TH = 240;
      const markW = Math.round((mW / mH) * TH);
      const wordH = Math.round(TH * 0.62);
      const wordW = Math.round((wW / wH) * wordH);
      const gap = Math.round(TH * 0.14);
      const o = document.createElement('canvas');
      o.width = markW + gap + wordW;
      o.height = TH;
      const g = o.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(c, mx0, mark[0], mW, mH, 0, 0, markW, TH);
      g.drawImage(c, wx0, wY0, wW, wH, markW + gap, Math.round((TH - wordH) / 2), wordW, wordH);
      horizontal = o.toDataURL('image/png');
      horizDims = [o.width, o.height];
    }

    return {
      stacked,
      horizontal,
      favicon: draw(mx0, mark[0], mW, mH, 32, 32, null, 0.02),
      apple: draw(mx0, mark[0], mW, mH, 180, 180, brandBg, 0.1),
      mark: draw(mx0, mark[0], mW, mH, 512, 512, null, 0.04),
      info: {size: [W, H], bands, srcHadAlpha, horizDims},
    };
  },
  {uri, floor: FLOOR, knee: KNEE, brandBg: BRAND_BG},
);

const write = (dataUrl, rel) => {
  const dest = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(dest), {recursive: true});
  fs.writeFileSync(dest, Buffer.from(dataUrl.split(',')[1], 'base64'));
  console.log(`  ${rel}  ${fs.statSync(dest).size} bytes`);
};

console.log(`source ${srcPath}`);
console.log(`  ${out.info.size.join('x')}, bands ${JSON.stringify(out.info.bands)}`);
console.log(out.info.srcHadAlpha ? '  source already had alpha, key skipped' : '  keyed dark background out');
console.log('wrote:');
write(out.horizontal, 'app/assets/logo.png');
write(out.stacked, 'app/assets/logo-stacked.png');
write(out.favicon, 'app/assets/favicon.png');
write(out.apple, 'app/assets/apple-touch-icon.png');
write(out.mark, 'app/assets/mark.png');

// Contact sheet at the sizes the site actually renders.
const b64 = (rel) => fs.readFileSync(path.join(ROOT, rel)).toString('base64');
const h = b64('app/assets/logo.png');
const v = b64('app/assets/logo-stacked.png');
const qa = `<!doctype html><meta charset=utf-8><style>
body{margin:0;font:12px/1.4 -apple-system,sans-serif;color:#f3ecff;background:#0b0713}
.r{padding:14px 20px;border-bottom:1px solid rgba(255,255,255,.08);display:flex;align-items:center;gap:16px}
.l{width:180px;color:#a89ec4;font-size:10px;letter-spacing:.06em;text-transform:uppercase}
.glass{background:rgba(255,255,255,.06)}
.hero{background:linear-gradient(150deg,#4c3a6b,#2a1f43 60%,#0b0713)}
img{display:block}</style>
<div class="r glass"><div class="l">header 44</div><img src="data:image/png;base64,${h}" style="height:44px"></div>
<div class="r hero"><div class="l">header on hero</div><img src="data:image/png;base64,${h}" style="height:44px"></div>
<div class="r"><div class="l">footer 56</div><img src="data:image/png;base64,${h}" style="height:56px"></div>
<div class="r hero"><div class="l">hero 220 stacked</div><img src="data:image/png;base64,${v}" style="height:220px"></div>`;
const qaPath = path.join(ROOT, 'screenshots/logo-qa.html');
fs.mkdirSync(path.dirname(qaPath), {recursive: true});
fs.writeFileSync(qaPath, qa);

const shot = await browser.newPage();
await shot.setViewport({width: 820, height: 700, deviceScaleFactor: 2});
await shot.goto(`file://${qaPath}`, {waitUntil: 'networkidle0'});
await shot.screenshot({path: path.join(ROOT, 'screenshots/logo-qa.png'), fullPage: true});
fs.unlinkSync(qaPath);
await browser.close();
console.log('  screenshots/logo-qa.png  (contact sheet)');
console.log('\nhard reload localhost:3000 to see it (Cmd+Shift+R).');
