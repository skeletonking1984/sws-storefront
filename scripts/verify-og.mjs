#!/usr/bin/env node
/**
 * Pre-deploy and post-deploy share card (OG) check.
 *
 * Why, 2026-10-18: /bundle shared in Discord had an unfurl showing the
 * default banner with the moon jar sitting on top of the chat bubbles. The
 * card had looked like that since 2026-09-08 and nothing ever looked at the
 * picture itself. audit-share-cards.mjs checks product tags only and needs
 * .env; this one needs no secrets, reads the rendered HTML the way Discord
 * does, downloads every og:image and checks it.
 *
 * Per page it fails when:
 *   - og:image or twitter:image is missing, relative, or not the same URL
 *   - the image does not load (non-200) or is not an image
 *   - declared og:image:width/height disagree with the real pixels
 *   - the shape is wrong for the page kind (default banner must be 1200x630,
 *     product and collection cards must be square 1200x1200)
 *   - a product page falls back to the default banner instead of its own art
 *   - the URL asks the CDN to crop (crop=), which cuts words off listing art
 *   - a product card's image is not the art actually shown on that page
 *   - --expect-build: the default banner is not the og-image asset from this
 *     build's dist/client/assets (catches a stale or wrong card)
 *
 * Usage:
 *   node scripts/verify-og.mjs                         # live site
 *   node scripts/verify-og.mjs --origin http://localhost:3199 --expect-build
 *   node scripts/verify-og.mjs --save /tmp/og-shots    # also save every image
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const arg = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const ORIGIN = (arg('--origin', 'https://streamwidgetshop.com')).replace(/\/$/, '');
const SAVE = arg('--save', null);
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(ORIGIN);
const EXPECT_BUILD = args.includes('--expect-build');
const ROOT = path.resolve(import.meta.dirname, '..');
const UA = 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)';

// Key pages. Add one here whenever a new route ships.
const PAGES = [
  {path: '/', kind: 'default'},
  {path: '/bundle', kind: 'wide', expect: /\/assets\/og-image-bundle-[^/]+\.jpg/},
  {path: '/collections/all', kind: 'default'},
  {path: '/collections/widgets', kind: 'collection'},
  {path: '/collections/halloween', kind: 'collection'},
  {path: '/collections/bundles', kind: 'collection'},
  {path: '/pages/how-it-works', kind: 'default'},
  {path: '/free-chat-widget', kind: 'wide'},
  {path: '/pages/custom-widgets', kind: 'wide'},
  {path: '/products/demon-samurai-stream-overlay-pack-animated-katana-goal-bar-multistream-chat-alerts-digital-download', kind: 'product'},
  {path: '/products/celestial-stream-kit', kind: 'product'},
  {path: '/products/multistream-chat-widget-pack', kind: 'product'},
];
for (const p of arg('--extra', '').split(',').filter(Boolean)) {
  PAGES.push({path: p, kind: p.startsWith('/products/') ? 'product' : 'default'});
}

const SHAPES = {
  default: {w: 1200, h: 630},
  wide: {w: 1200, h: 630},
  product: {w: 1200, h: 1200},
  collection: {w: 1200, h: 1200},
};

function imageSize(buf) {
  // PNG
  if (buf.slice(0, 8).toString('hex') === '89504e470d0a1a0a') {
    return {w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: 'png'};
  }
  // JPEG: walk segments to the SOF marker
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let o = 2;
    while (o < buf.length) {
      if (buf[o] !== 0xff) { o++; continue; }
      const m = buf[o + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) {
        return {h: buf.readUInt16BE(o + 5), w: buf.readUInt16BE(o + 7), type: 'jpeg'};
      }
      o += 2 + buf.readUInt16BE(o + 2);
    }
  }
  // WebP (VP8X / VP8 / VP8L)
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') {
    const c = buf.slice(12, 16).toString();
    if (c === 'VP8X') return {w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3), type: 'webp'};
    if (c === 'VP8 ') return {w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff, type: 'webp'};
    if (c === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return {w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1, type: 'webp'};
    }
  }
  return null;
}

const meta = (html, key) => {
  const re = new RegExp(`<meta[^>]+(?:property|name)="${key.replace(/[:]/g, '\\:')}"[^>]*content="([^"]*)"`, 'i');
  const m = html.match(re);
  return m ? m[1].replace(/&amp;/g, '&') : null;
};

let buildAsset = null;
if (EXPECT_BUILD) {
  const dir = path.join(ROOT, 'dist/client/assets');
  buildAsset = fs.existsSync(dir)
    ? fs.readdirSync(dir).find((f) => /^og-image-[^-]+.*\.jpg$/.test(f) && !f.includes('free-chat') && !f.includes('custom-widgets') && !f.includes('bundle'))
    : null;
  if (!buildAsset) {
    console.error('FAIL --expect-build: no og-image-*.jpg in dist/client/assets. Build first.');
    process.exit(1);
  }
}

if (SAVE) fs.mkdirSync(SAVE, {recursive: true});
let failures = 0;
const fail = (page, msg) => { failures++; console.log(`  FAIL ${msg}`); };

for (const page of PAGES) {
  const url = ORIGIN + page.path;
  console.log(`${page.kind.padEnd(10)} ${page.path}`);
  let res;
  try { res = await fetch(url, {headers: {'user-agent': UA}, redirect: 'follow'}); }
  catch (e) { fail(page, `page fetch error ${e.message}`); continue; }
  if (res.status === 404 && page.optional) { console.log('  skip (404, optional)'); continue; }
  if (!res.ok) { fail(page, `page HTTP ${res.status}`); continue; }
  const html = await res.text();

  const og = meta(html, 'og:image');
  const tw = meta(html, 'twitter:image');
  const dw = Number(meta(html, 'og:image:width'));
  const dh = Number(meta(html, 'og:image:height'));
  if (!og) { fail(page, 'no og:image'); continue; }
  // A local preview serves build assets from its own http origin; live must
  // be absolute https.
  const okAbsolute = /^https:\/\//.test(og) || (LOCAL && og.startsWith(ORIGIN + '/'));
  if (!okAbsolute) fail(page, `og:image not absolute https: ${og}`);
  if (tw !== og) fail(page, 'twitter:image differs from og:image');
  if (/[?&]crop=/.test(og)) fail(page, 'og:image asks the CDN to crop');

  const isDefault = /\/assets\/og-image-[^/]+\.jpg/.test(og) && !/free-chat|custom-widgets|og-image-bundle/.test(og);
  if ((page.kind === 'product' || page.kind === 'collection') && isDefault) {
    fail(page, `${page.kind} page uses the default banner, not its own art`);
  }
  if (page.kind === 'default' && buildAsset && !og.endsWith('/' + buildAsset)) {
    fail(page, `default banner is ${og.split('/').pop()}, this build has ${buildAsset}`);
  }
  if (page.expect && !page.expect.test(og)) fail(page, `og:image ${og.split('/').pop()} is not this page's own card`);
  if (page.kind === 'product') {
    // The share art must be the product's own image, i.e. the same CDN file
    // the page shows. Compare the file path without query params.
    const file = new URL(og).pathname.split('/').pop();
    if (!html.includes(file.split('?')[0])) fail(page, `og:image file ${file} is not shown on the page`);
  }

  const ir = await fetch(og, {headers: {'user-agent': UA}});
  if (!ir.ok) { fail(page, `image HTTP ${ir.status}`); continue; }
  const ct = ir.headers.get('content-type') || '';
  if (!ct.startsWith('image/')) fail(page, `image content-type ${ct}`);
  const buf = Buffer.from(await ir.arrayBuffer());
  const size = imageSize(buf);
  if (!size) { fail(page, 'could not read image size'); continue; }
  if (dw && dh && (dw !== size.w || dh !== size.h)) {
    fail(page, `declared ${dw}x${dh} but image is ${size.w}x${size.h} (would render squished or boxed)`);
  }
  const want = SHAPES[page.kind];
  if (want && (size.w !== want.w || size.h !== want.h)) {
    fail(page, `image is ${size.w}x${size.h}, ${page.kind} cards must be ${want.w}x${want.h}`);
  }
  if (buf.length > 5 * 1024 * 1024) fail(page, `image is ${Math.round(buf.length / 1024)} KB (X limit 5 MB)`);
  console.log(`  ok-so-far ${size.w}x${size.h} ${size.type} ${Math.round(buf.length / 1024)} KB`);
  if (SAVE) {
    const name = (page.path === '/' ? 'home' : page.path.replace(/^\//, '').replace(/[^a-z0-9]+/gi, '-')).slice(0, 60);
    fs.writeFileSync(path.join(SAVE, `${name}.${size.type === 'jpeg' ? 'jpg' : size.type}`), buf);
  }
}

console.log(failures ? `\nverify-og: ${failures} failure(s)` : '\nverify-og: all share cards OK');
console.log('Pixels pass, but look at the saved images (--save) before a card-changing deploy.');
process.exit(failures ? 1 : 0);
