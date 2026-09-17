/**
 * Every share card must point at a real product IMAGE, and must state that
 * image's real size or no size at all.
 *
 * Why this exists, 2026-09-17
 * ---------------------------
 * Todd posted a Discord unfurl of the Dreamy Lotus product page: a narrow
 * sliver of the listing art inside a wide black box, and read it as "the
 * video change killed the meta image".
 *
 * The image was never the video. `featuredImage` is defined by the
 * Storefront API as equivalent to `images(first: 1)`, and `images` excludes
 * video media, so it cannot return a frame grab. Checked across the whole
 * live catalogue: 122 products, 0 without a featured image, 0 whose featured
 * image is a video preview URL.
 *
 * What was wrong was the pair of tags NEXT to it. `og:image:width` and
 * `og:image:height` were hardcoded to 1200x630 on every page, product pages
 * included, and **not one of the 122 product featured images is 1.91:1**:
 * 83 are square, 37 are 4:3, one is 5:4, one is portrait. Discord, Slack and
 * X lay a card out from the declared size before fetching the bytes, so
 * every product share on every platform was being framed as a wide banner
 * around an image that is not one.
 *
 * So this checks the two failure modes that actually happen, on the LIVE
 * rendered HTML rather than on the source:
 *
 *   1. `og:image` points at something that is not a product image, which is
 *      what Todd thought had happened and is the more expensive failure.
 *   2. `og:image:width`/`height` disagree with the bytes actually served.
 *      Present and wrong is worse than absent, because absent makes every
 *      consumer measure the image itself.
 *
 * Usage:
 *   node scripts/audit-share-cards.mjs [--limit n] [--origin https://...]
 *   node scripts/audit-share-cards.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';
// The SHIPPED tag logic, imported directly. app/lib/ogImage.js has no
// imports of its own precisely so this line works in plain Node: a test that
// reimplements the thing it is testing proves nothing.
import {ogImageDimensions, ogImageTags} from '../app/lib/ogImage.js';

const ROOT = path.resolve(import.meta.dirname, '..');

const env = Object.fromEntries(
  fs
    .readFileSync(`${ROOT}/.env`, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [
      l.slice(0, l.indexOf('=')).trim(),
      l
        .slice(l.indexOf('=') + 1)
        .trim()
        .replace(/^['"]|['"]$/g, ''),
    ]),
);

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};

const ORIGIN = arg('--origin', 'https://streamwidgetshop.com');
const LIMIT = Number(arg('--limit', 12));

/** A Shopify video preview image lives under this path segment. Seeing one
 * in an `og:image` is the regression this file is named for. */
const VIDEO_PREVIEW_MARKER = '/preview_images/';

const META = (html, key, attr) =>
  new RegExp(
    `<meta[^>]*${attr}=["']${key}["'][^>]*content=["']([^"']*)["']`,
    'i',
  ).exec(html)?.[1] ??
  new RegExp(
    `<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${key}["']`,
    'i',
  ).exec(html)?.[1] ??
  null;

const decode = (s) => (s || '').replace(/&amp;/g, '&');

/**
 * The pure half, so the rules can be tested without the network.
 * @param {{
 *   handle: string,
 *   ogImage: string | null,
 *   declaredWidth: string | null,
 *   declaredHeight: string | null,
 *   actualWidth: number | null,
 *   actualHeight: number | null,
 * }} card
 */
export function auditCard(card) {
  const issues = [];
  const add = (what) => issues.push({handle: card.handle, what});

  if (!card.ogImage) {
    add('no og:image at all');
    return issues;
  }
  if (card.ogImage.includes(VIDEO_PREVIEW_MARKER)) {
    add('og:image is a VIDEO preview frame, not a product image');
  }

  const declared =
    card.declaredWidth != null && card.declaredHeight != null
      ? {width: Number(card.declaredWidth), height: Number(card.declaredHeight)}
      : null;

  // Absent is allowed and is the deliberate fallback. Only a declaration
  // that contradicts the served bytes is a finding.
  if (!declared) return issues;

  if (!(declared.width > 0) || !(declared.height > 0)) {
    add(`og:image:width/height are not positive numbers (${card.declaredWidth}x${card.declaredHeight})`);
    return issues;
  }
  if (card.actualWidth == null || card.actualHeight == null) return issues;

  if (
    declared.width !== card.actualWidth ||
    declared.height !== card.actualHeight
  ) {
    add(
      `og:image:width/height say ${declared.width}x${declared.height}, the image served is ` +
        `${card.actualWidth}x${card.actualHeight}`,
    );
  }
  return issues;
}

if (process.argv.includes('--self-test')) {
  const cases = [
    [
      'a truthful square card passes',
      {handle: 'a', ogImage: 'https://cdn/x.jpg?width=1200', declaredWidth: '1200', declaredHeight: '1200', actualWidth: 1200, actualHeight: 1200},
      0,
    ],
    [
      'the exact bug: square image declared as 1200x630',
      {handle: 'a', ogImage: 'https://cdn/x.jpg?width=1200', declaredWidth: '1200', declaredHeight: '630', actualWidth: 1200, actualHeight: 1200},
      1,
    ],
    [
      'a 4:3 image declared as 1200x630',
      {handle: 'a', ogImage: 'https://cdn/x.jpg?width=1200', declaredWidth: '1200', declaredHeight: '630', actualWidth: 1200, actualHeight: 933},
      1,
    ],
    [
      'NO declared size passes, it is the deliberate fallback',
      {handle: 'a', ogImage: 'https://cdn/x.jpg?width=1200', declaredWidth: null, declaredHeight: null, actualWidth: 1200, actualHeight: 1200},
      0,
    ],
    [
      'a video preview frame as the share image is caught',
      {handle: 'a', ogImage: 'https://cdn/files/preview_images/abc.thumbnail.0000000000.jpg', declaredWidth: '1280', declaredHeight: '1280', actualWidth: 1280, actualHeight: 1280},
      1,
    ],
    [
      'a video preview frame is caught even when its size is truthful and it is the only fault',
      {handle: 'a', ogImage: 'https://cdn/files/preview_images/abc.jpg', declaredWidth: null, declaredHeight: null, actualWidth: null, actualHeight: null},
      1,
    ],
    [
      'a missing og:image is caught',
      {handle: 'a', ogImage: null, declaredWidth: '1200', declaredHeight: '630', actualWidth: null, actualHeight: null},
      1,
    ],
    [
      'the real 1200x630 default card passes',
      {handle: 'a', ogImage: 'https://streamwidgetshop.com/assets/og-image-abc.jpg', declaredWidth: '1200', declaredHeight: '630', actualWidth: 1200, actualHeight: 630},
      0,
    ],
    [
      'a declaration that cannot be checked (image bytes unreadable) passes rather than guesses',
      {handle: 'a', ogImage: 'https://cdn/x.jpg', declaredWidth: '1200', declaredHeight: '630', actualWidth: null, actualHeight: null},
      0,
    ],
    [
      'a non-numeric declaration is caught',
      {handle: 'a', ogImage: 'https://cdn/x.jpg', declaredWidth: 'auto', declaredHeight: '630', actualWidth: 1200, actualHeight: 1200},
      1,
    ],
  ];
  let pass = 0;
  for (const [name, input, expected] of cases) {
    const got = auditCard(input).length;
    const ok = got === expected;
    if (ok) pass++;
    console.log(`${ok ? 'pass' : 'FAIL'}  ${name}  (expected ${expected}, got ${got})`);
  }

  /*
   * The other half: the tags this site actually EMITS. An unattended run
   * cannot start a dev server and an Oxygen preview URL answers 302 behind
   * Shopify OAuth, so this is the only place the emit logic gets exercised
   * before it reaches production. Each case feeds the real exported
   * functions and asserts on what comes back out.
   */
  const DEFAULT = 'https://streamwidgetshop.com/assets/og-image-abc.jpg';
  const tagFor = (opts) => {
    const tags = ogImageTags({defaultImage: DEFAULT, ...opts});
    const find = (k, attr) => tags.find((t) => t[attr] === k)?.content ?? null;
    return {
      image: find('og:image', 'property'),
      width: find('og:image:width', 'property'),
      height: find('og:image:height', 'property'),
      twitter: find('twitter:image', 'name'),
    };
  };

  const emitCases = [
    [
      'no image: the default card keeps its real 1200x630',
      () => tagFor({}),
      {image: DEFAULT, width: '1200', height: '630', twitter: DEFAULT},
    ],
    [
      'a square product image is declared square, not 1200x630',
      () => tagFor({image: 'https://cdn/x.jpg?width=1200', imageWidth: 1200, imageHeight: 1200}),
      {image: 'https://cdn/x.jpg?width=1200', width: '1200', height: '1200', twitter: 'https://cdn/x.jpg?width=1200'},
    ],
    [
      'a 4:3 product image is declared 4:3',
      () => tagFor({image: 'https://cdn/x.jpg', imageWidth: 1200, imageHeight: 933}),
      {image: 'https://cdn/x.jpg', width: '1200', height: '933', twitter: 'https://cdn/x.jpg'},
    ],
    [
      'an image with UNKNOWN size emits no size rather than a guess',
      () => tagFor({image: 'https://cdn/x.jpg'}),
      {image: 'https://cdn/x.jpg', width: null, height: null, twitter: 'https://cdn/x.jpg'},
    ],
    [
      'twitter:image always matches og:image',
      () => {
        const t = tagFor({image: 'https://cdn/y.jpg', imageWidth: 800, imageHeight: 800});
        return {image: t.image, width: t.width, height: t.height, twitter: t.twitter};
      },
      {image: 'https://cdn/y.jpg', width: '800', height: '800', twitter: 'https://cdn/y.jpg'},
    ],
  ];

  for (const [name, run, expected] of emitCases) {
    const got = run();
    const ok = JSON.stringify(got) === JSON.stringify(expected);
    if (ok) pass++;
    console.log(
      `${ok ? 'pass' : 'FAIL'}  ${name}` +
        (ok ? '' : `\n        expected ${JSON.stringify(expected)}\n        got      ${JSON.stringify(got)}`),
    );
  }

  const dimCases = [
    ['a 1589x1589 source capped at 1200 is 1200x1200', [{width: 1589, height: 1589}, 1200], {width: 1200, height: 1200}],
    ['a 1589x1236 source capped at 1200 is 1200x933', [{width: 1589, height: 1236}, 1200], {width: 1200, height: 933}],
    ['the CDN never upscales: an 800px source stays 800', [{width: 800, height: 600}, 1200], {width: 800, height: 600}],
    ['a portrait source stays portrait', [{width: 800, height: 1000}, 1200], {width: 800, height: 1000}],
    ['a missing size is null, never a default', [{width: null, height: null}, 1200], null],
    ['a zero size is null rather than a division by zero', [{width: 0, height: 0}, 1200], null],
    ['a non-numeric size is null', [{width: 'auto', height: 'auto'}, 1200], null],
    ['no image at all is null', [null, 1200], null],
  ];
  for (const [name, [image, max], expected] of dimCases) {
    const got = ogImageDimensions(image, max);
    const ok = JSON.stringify(got) === JSON.stringify(expected);
    if (ok) pass++;
    console.log(
      `${ok ? 'pass' : 'FAIL'}  ${name}` +
        (ok ? '' : `  expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`),
    );
  }

  const total = cases.length + emitCases.length + dimCases.length;
  console.log(`\n${pass}/${total} self-test cases pass.`);
  process.exit(pass === total ? 0 : 1);
}

/** Read a JPEG/PNG/WebP's real pixel size from its first bytes, so the check
 * compares the declaration against the SERVED image rather than against the
 * same catalogue field the page built the declaration from. Checking a
 * number against its own source would pass even if the transform changed it,
 * which is the whole class of bug here. */
async function servedSize(url) {
  try {
    const res = await fetch(url, {headers: {Range: 'bytes=0-65535'}});
    if (!res.ok && res.status !== 206) return null;
    const buf = Buffer.from(await res.arrayBuffer());

    if (buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
      return {width: buf.readUInt32BE(16), height: buf.readUInt32BE(20)};
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = buf[i + 1];
        // SOF0..SOF15, skipping the four that are not frame headers.
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
          return {height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7)};
        }
        i += 2 + buf.readUInt16BE(i + 2);
      }
      return null;
    }
    if (buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP') {
      const type = buf.slice(12, 16).toString('ascii');
      if (type === 'VP8X') return {width: (buf.readUIntLE(24, 3) & 0xffffff) + 1, height: (buf.readUIntLE(27, 3) & 0xffffff) + 1};
      if (type === 'VP8 ') return {width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff};
    }
    return null;
  } catch {
    return null;
  }
}

async function handles() {
  const url = `https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`;
  const query = `query{products(first:250,sortKey:BEST_SELLING){nodes{handle}}}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
    },
    body: JSON.stringify({query}),
  });
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data.products.nodes.map((n) => n.handle);
}

const all = await handles();
const sample = all.slice(0, LIMIT);
console.log(`Checking ${sample.length} of ${all.length} product share cards on ${ORIGIN}.`);

const issues = [];
for (const handle of sample) {
  const res = await fetch(`${ORIGIN}/products/${handle}`);
  const html = await res.text();
  const ogImage = decode(META(html, 'og:image', 'property'));
  const card = {
    handle,
    ogImage,
    declaredWidth: META(html, 'og:image:width', 'property'),
    declaredHeight: META(html, 'og:image:height', 'property'),
    actualWidth: null,
    actualHeight: null,
  };
  if (ogImage) {
    const size = await servedSize(ogImage);
    if (size) {
      card.actualWidth = size.width;
      card.actualHeight = size.height;
    }
  }
  const found = auditCard(card);
  const note =
    card.actualWidth != null ? `${card.actualWidth}x${card.actualHeight}` : 'size unread';
  console.log(
    `  ${found.length ? 'FAIL' : 'ok  '}  ${handle}\n        served ${note}, declared ${card.declaredWidth ?? 'none'}x${card.declaredHeight ?? 'none'}`,
  );
  issues.push(...found);
}

if (!issues.length) {
  console.log('\nEvery card points at a product image and states its real size, or no size.');
  process.exit(0);
}
console.log(`\n${issues.length} issue(s):\n`);
for (const i of issues) console.log(`  ${i.handle}\n    ${i.what}`);
process.exit(1);
