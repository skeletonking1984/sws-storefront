#!/usr/bin/env node
/* Renders og.html's #canvas (1200x630, the same real widget PNGs the homepage
 * hero uses, composited on the hand-built space background) via puppeteer-core
 * and saves the social share card to app/assets/og-image.jpg. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const OUT = path.join(ROOT, 'app/assets/og-image.jpg');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8795;
const TYPES = { '.html': 'text/html', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(HERE, p === '/' ? 'og.html' : p);
  if (!file.startsWith(HERE) || !fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-color-profile=srgb'],
  defaultViewport: { width: 1200, height: 630, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://127.0.0.1:${PORT}/og.html`, { waitUntil: 'networkidle0', timeout: 30000 });
await page.evaluate(() => document.fonts.ready);
await new Promise((r) => setTimeout(r, 400));
const canvas = await page.$('#canvas');
await canvas.screenshot({ path: OUT, type: 'jpeg', quality: 90 });
console.log('wrote', OUT, Math.round(fs.statSync(OUT).size / 1024) + ' KB');

await browser.close();
server.close();
