#!/usr/bin/env node
/* Rasterizes app/assets/favicon.svg (the SWS sticker lighthouse mark) into the
 * PNG sizes browsers and iOS actually ask for. Re-run after editing the SVG. */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const SVG = path.join(ROOT, 'app/assets/favicon.svg');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8796;

const sizes = [
  [32, path.join(ROOT, 'app/assets/favicon.png')],
  [180, path.join(ROOT, 'app/assets/apple-touch-icon.png')],
  [320, path.join(HERE, 'icon-preview.png')],
];

const svg = fs.readFileSync(SVG, 'utf8');
const server = http.createServer((req, res) => {
  const size = Number(new URL(req.url, 'http://x').searchParams.get('size') || 320);
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent}
    #box{width:${size}px;height:${size}px}#box svg{display:block;width:100%;height:100%}</style>
    <div id="box">${svg}</div>`);
});
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-color-profile=srgb'],
});
for (const [size, out] of sizes) {
  const page = await browser.newPage();
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${PORT}/?size=${size}`, { waitUntil: 'networkidle0' });
  const box = await page.$('#box');
  await box.screenshot({ path: out, omitBackground: true });
  console.log('wrote', out, `${size}x${size}`);
  await page.close();
}
await browser.close();
server.close();
