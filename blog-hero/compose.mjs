#!/usr/bin/env node
/*
 * Render blog hero cards from heroes.json.
 *
 * Serves this directory over http rather than loading hero.html from file://,
 * because a file:// page cannot load the woff2 faces and the headline silently
 * falls back to system-ui. That exact failure already cost a round trip once on
 * 2026-09-15, when a local harness made it look like the site's font had
 * changed when it had not.
 *
 *   node compose.mjs              renders every hero in heroes.json
 *   node compose.mjs <slug> ...   renders only those
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire('/Users/todd/Documents/orgs/SWS/repos/sws-monthly-report/package.json');
const puppeteer = require('puppeteer-core');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8795;
const TYPES = {'.html': 'text/html', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json'};

const heroes = JSON.parse(fs.readFileSync(path.join(HERE, 'heroes.json'), 'utf8'));
const only = process.argv.slice(2);
const list = only.length ? heroes.filter((h) => only.includes(h.slug)) : heroes;
if (!list.length) { console.error('nothing to render'); process.exit(1); }

fs.mkdirSync(OUT, {recursive: true});

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  const file = path.join(HERE, p === '/' ? 'hero.html' : p);
  if (!file.startsWith(HERE) || !fs.existsSync(file)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, {'content-type': TYPES[path.extname(file)] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-color-profile=srgb'],
  defaultViewport: {width: 1200, height: 630, deviceScaleFactor: 2},
});

for (const h of list) {
  const page = await browser.newPage();
  await page.setViewport({width: 1200, height: 630, deviceScaleFactor: 2});
  const url = `http://127.0.0.1:${PORT}/hero.html?c=${encodeURIComponent(JSON.stringify(h))}`;
  await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 20000});
  /*
   * Wait on the page's OWN readiness flag, which is set only after every
   * sticker has decoded and the fonts have loaded. A fixed sleep here renders
   * a background-only card whenever a PNG is slow, and that card looks
   * deliberate enough to ship by mistake.
   */
  await page.waitForFunction('window.__HERO_READY__ === true', {timeout: 20000});
  const el = await page.$('#canvas');
  const file = path.join(OUT, `${h.slug}.png`);
  await el.screenshot({path: file});
  console.log('wrote', path.basename(file), Math.round(fs.statSync(file).size / 1024) + ' KB');
  await page.close();
}

await browser.close();
server.close();
