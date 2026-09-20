#!/usr/bin/env node
/* Records hero-video.html's #canvas as a looping clip of the REAL Moon Jar Goal
 * widget filling, hitting its goal and resetting.
 *
 * Why this exists: the homepage hero was a still (app/assets/hero-widgets.webp,
 * built by compose.mjs from four captured widget PNGs). These are animated
 * products and a photograph of one says nothing about what it does. This swaps
 * the jar still for the live widget, drives it with real tip, sub, follow and
 * cheer events through the same StreamElements shim the Widget Stage uses, and
 * records the same 1600x1000 canvas so the composition does not move.
 *
 * The page tilt is NOT baked in here. `.hero-stream-frame` in app.css carries
 * `transform: rotate(3deg)`, so it applies to whatever media sits in the frame.
 * A video inherits the tilt, the scanline and the rounded border untouched.
 *
 *   node hero/record.mjs
 *
 * Writes app/assets/hero-widgets.mp4 and .webm, plus a poster frame.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const STAGE = path.resolve(ROOT, '../sws-widget-stage/public');
const FRAMES = path.join(HERE, '.frames');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8795;

const FPS = 30;
/* 17s, not 12, and the extra 5 are load bearing.
 *
 * The clip has to LOOP. Frame 0 is an empty jar with the lid seated, so the
 * last frame has to be too, or the hero visibly jumps from full to empty every
 * cycle. Hitting the goal pops the lid and launches the tokens out, and that
 * celebration plus the 2s auto reset plus the jar settling runs well past 12s.
 * The first render ended mid-celebration with the lid still in the air. */
const SECONDS = 17;
const TOTAL = FPS * SECONDS;

const TYPES = {
  '.html': 'text/html', '.png': 'image/png', '.json': 'application/json',
  '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.gif': 'image/gif',
};

/* Two roots: the hero folder, and the Widget Stage public dir under /stage so
 * the live jar can pull the real bundle and the real shim rather than a copy
 * that would drift. */
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  let file;
  if (url.startsWith('/stage/')) {
    file = path.join(STAGE, url.slice('/stage/'.length));
    if (!file.startsWith(STAGE)) { res.writeHead(403); res.end(); return; }
  } else {
    file = path.join(HERE, url === '/' ? 'hero-video.html' : url);
    if (!file.startsWith(HERE)) { res.writeHead(403); res.end(); return; }
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: [
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
    '--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required',
  ],
  defaultViewport: { width: 1600, height: 1000, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  pageerror:', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('  console:', m.text()); });

/* Listen for the boot BEFORE navigating. The shim posts {type:'ready'} the
 * moment it runs, and attaching the listener after goto loses that race about
 * half the time, which then reads as a broken widget when it is a broken test. */
await page.evaluateOnNewDocument(() => {
  window.__jarReady = false;
  window.addEventListener('message', (e) => {
    if (e.data && e.data.__sws === true && e.data.type === 'ready') window.__jarReady = true;
  });
});

await page.goto(`http://127.0.0.1:${PORT}/hero-video.html`, { waitUntil: 'networkidle0', timeout: 30000 });
await page.waitForFunction(() => window.__jarReady === true, { timeout: 15000 })
  .catch(() => console.log('  warning: widget never reported ready, recording anyway'));
await new Promise((r) => setTimeout(r, 900));

/* The event script. goalTarget is 50, so this fills it and leaves time for the
 * celebration and the 2s auto reset, which is what makes the clip loop. */
const SCRIPT = [
  { at: 0.6, listener: 'tip-latest', event: { name: 'VoltVixen', amount: 5, message: 'that glow is INSANE' } },
  { at: 1.7, listener: 'follower-latest', event: { name: 'PixelPawz' } },
  { at: 2.4, listener: 'tip-latest', event: { name: 'KickFlip', amount: 8, message: 'setup needed this' } },
  { at: 3.4, listener: 'subscriber-latest', event: { name: 'ModMatrix', amount: 1, tier: '1000' } },
  { at: 4.2, listener: 'cheer-latest', event: { name: 'kittykick', amount: 300 } },
  { at: 5.0, listener: 'tip-latest', event: { name: 'StarDotGIF', amount: 12, message: 'saving this shop' } },
  { at: 6.1, listener: 'follower-latest', event: { name: 'lunarbyte' } },
  { at: 6.9, listener: 'tip-latest', event: { name: 'noodlecat', amount: 10, message: 'y2k revival is real' } },
  { at: 7.8, listener: 'subscriber-latest', event: { name: 'brewhaha', amount: 1, tier: '2000' } },
  { at: 7.4, listener: 'tip-latest', event: { name: 'Widget_shop', amount: 15, message: 'goal!' } },
];

await page.evaluate((script) => {
  const frame = document.getElementById('jarframe');
  for (const step of script) {
    setTimeout(() => {
      frame.contentWindow.postMessage(
        { __sws: true, type: 'event', payload: { listener: step.listener, event: step.event } },
        '*',
      );
    }, step.at * 1000);
  }
}, SCRIPT);

fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

/* Capture on a VIRTUAL clock, not the wall clock.
 *
 * The obvious loop, sleep until the next 1/30s tick then screenshot, produces a
 * broken clip: an element screenshot of this canvas costs about 500ms, so 12
 * seconds of intended animation gets sampled across three real minutes. Played
 * back at 30fps the jar fills in half a second and then sits there, and the
 * whole point of the clip is gone.
 *
 * Emulation.setVirtualTimePolicy freezes the page clock and advances it by an
 * exact budget per frame. rAF, CSS animations, setTimeout and Matter's physics
 * step all run off that clock, so each frame is exactly 1/30s after the last no
 * matter how slow the screenshot is. Deterministic, and it reruns identically. */
const cdp = await page.createCDPSession();
const STEP_MS = 1000 / FPS;

/* Capture straight through CDP rather than elementHandle.screenshot().
 *
 * Puppeteer's element screenshot measures the box with an `evaluate` first, and
 * evaluate needs the renderer to run JS. With virtual time paused the renderer
 * will not, so that call never returns and the run dies in CallbackRegistry.
 * Page.captureScreenshot is browser side and needs no page JS, so it works
 * while the clock is frozen.
 *
 * The clip is safe to hardcode: #canvas is 1600x1000 at the document origin and
 * the viewport is the same size, so the clip is the canvas exactly. */
const CLIP = { x: 0, y: 0, width: 1600, height: 1000, scale: 1 };

await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause' });

const started = Date.now();
for (let i = 0; i < TOTAL; i++) {
  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    clip: CLIP,
    fromSurface: true,
    captureBeyondViewport: false,
  });
  fs.writeFileSync(path.join(FRAMES, `f${String(i).padStart(4, '0')}.png`), Buffer.from(shot.data, 'base64'));
  const expired = new Promise((r) => cdp.once('Emulation.virtualTimeBudgetExpired', r));
  await cdp.send('Emulation.setVirtualTimePolicy', {
    policy: 'advance',
    budget: STEP_MS,
    maxVirtualTimeTaskStarvationCount: 10000,
  });
  await expired;
  if (i % 60 === 0) console.log(`  frame ${i}/${TOTAL}`);
}
console.log(`  captured ${TOTAL} frames of virtual time in ${((Date.now() - started) / 1000).toFixed(1)}s real`);

await browser.close();
server.close();

/* Encode. mp4 first because it is what Safari and every social embed want;
 * webm as the smaller alternate source. yuv420p and even dimensions or Safari
 * refuses the file outright. */
const mp4 = path.join(ROOT, 'app/assets/hero-widgets.mp4');
const webm = path.join(ROOT, 'app/assets/hero-widgets.webm');
const input = path.join(FRAMES, 'f%04d.png');

execFileSync('ffmpeg', [
  '-y', '-framerate', String(FPS), '-i', input,
  '-vf', 'scale=1600:1000:flags=lanczos',
  '-c:v', 'libx264', '-profile:v', 'high', '-crf', '24', '-preset', 'slow',
  '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4,
], { stdio: ['ignore', 'ignore', 'inherit'] });

execFileSync('ffmpeg', [
  '-y', '-framerate', String(FPS), '-i', input,
  '-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0', '-row-mt', '1',
  '-pix_fmt', 'yuv420p', '-an', webm,
], { stdio: ['ignore', 'ignore', 'inherit'] });

const kb = (p) => Math.round(fs.statSync(p).size / 1024) + ' KB';
console.log('wrote', mp4, kb(mp4));
console.log('wrote', webm, kb(webm));
