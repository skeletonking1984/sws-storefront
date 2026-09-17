/**
 * Resolve Etsy listing ids to LIVE streamwidgetshop.com product URLs.
 *
 * Why: social posts have always linked to Etsy, which is the one channel that
 * exposes no traffic source data to sellers at all. A post that sends someone
 * to Etsy cannot be measured, so every promotion of a product was unmeasurable
 * by construction. Todd, 2026-09-17: "for all typefully posts with products,
 * switch to using the shopify site link, not etsy."
 *
 * Fails closed, deliberately. A listing whose Shopify product does not resolve
 * on the Storefront API gets `null` and the caller keeps the Etsy link, rather
 * than being handed a guessed handle that 404s a buyer mid-scroll. The join
 * file carries 186 rows and the live catalogue is 122 products, so a miss is
 * expected, not exceptional.
 *
 * Usage:
 *   node scripts/etsy-to-shopify-link.mjs <listing_id> [<listing_id> ...]
 *   node scripts/etsy-to-shopify-link.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

/**
 * Swap the product URL in a post while keeping everything else, the UTM tags
 * included. Those tags are what makes the weekly ROAS check possible, so they
 * travel with the link rather than being rebuilt and quietly dropped.
 *
 * @param {string} text
 * @param {(listingId: string) => string | null} resolve
 * @returns {{text: string, swapped: Array<{listingId: string, to: string}>, kept: string[]}}
 */
export function swapEtsyLinks(text, resolve) {
  const swapped = [];
  const kept = [];
  const out = String(text).replace(
    /https?:\/\/(?:www\.)?etsy\.com\/listing\/(\d+)(\/[^\s?]*)?(\?[^\s]*)?/g,
    (whole, listingId, _slug, query = '') => {
      const url = resolve(listingId);
      if (!url) {
        kept.push(listingId);
        return whole;
      }
      swapped.push({listingId, to: url + query});
      return url + query;
    },
  );
  return {text: out, swapped, kept};
}

if (process.argv.includes('--self-test')) {
  const resolve = (id) =>
    id === '1790018033' ? 'https://streamwidgetshop.com/products/star-goal' : null;
  const cases = [
    [
      'swaps the host and path, keeps every UTM parameter byte for byte',
      'Look → https://www.etsy.com/listing/1790018033/liquid-filling-goal-widget-vtuber-asset?utm_source=x-organic&utm_medium=social&utm_campaign=star-goal-bestseller',
      'Look → https://streamwidgetshop.com/products/star-goal?utm_source=x-organic&utm_medium=social&utm_campaign=star-goal-bestseller',
    ],
    [
      'an unresolvable listing KEEPS its Etsy link rather than 404ing a buyer',
      'Look → https://www.etsy.com/listing/9999999999/whatever?utm_source=x-organic',
      'Look → https://www.etsy.com/listing/9999999999/whatever?utm_source=x-organic',
    ],
    [
      'a link with no slug and no query still swaps',
      'https://etsy.com/listing/1790018033',
      'https://streamwidgetshop.com/products/star-goal',
    ],
    [
      'text around the link is untouched, including the arrow and the newline',
      'One chat feed →\nhttps://www.etsy.com/listing/1790018033/x?utm_source=x-organic\n\n💜',
      'One chat feed →\nhttps://streamwidgetshop.com/products/star-goal?utm_source=x-organic\n\n💜',
    ],
    [
      'two links in one post are both handled independently',
      'a https://www.etsy.com/listing/1790018033/x b https://www.etsy.com/listing/9999999999/y',
      'a https://streamwidgetshop.com/products/star-goal b https://www.etsy.com/listing/9999999999/y',
    ],
    [
      'a post with no link is returned unchanged',
      'Subathon advice nobody gives you: cap the timer before you start.',
      'Subathon advice nobody gives you: cap the timer before you start.',
    ],
    [
      'an etsy SHOP link is not a listing link and is left alone',
      'https://www.etsy.com/shop/StreamWidgetShop',
      'https://www.etsy.com/shop/StreamWidgetShop',
    ],
  ];
  let pass = 0;
  for (const [name, input, expected] of cases) {
    const got = swapEtsyLinks(input, resolve).text;
    const ok = got === expected;
    if (ok) pass++;
    console.log(
      `${ok ? 'pass' : 'FAIL'}  ${name}` +
        (ok ? '' : `\n        expected ${JSON.stringify(expected)}\n        got      ${JSON.stringify(got)}`),
    );
  }
  console.log(`\n${pass}/${cases.length} self-test cases pass.`);
  process.exit(pass === cases.length ? 0 : 1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(`${ROOT}/.env`, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [
      l.slice(0, l.indexOf('=')).trim(),
      l.slice(l.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, ''),
    ]),
);

const rows = JSON.parse(fs.readFileSync(`${ROOT}/data/etsy-video-map.json`, 'utf8')).rows;
const byListing = new Map(rows.map((r) => [String(r.etsy_listing_id), r.handle]));

/** Only a handle the Storefront API actually serves is offered. */
async function liveHandles(handles) {
  const unique = [...new Set(handles)];
  const fields = unique
    .map((h, i) => `p${i}: product(handle: ${JSON.stringify(h)}) { handle title }`)
    .join('\n');
  const res = await fetch(`https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
    },
    body: JSON.stringify({query: `query{${fields}}`}),
  });
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  const live = new Map();
  unique.forEach((h, i) => {
    const node = body.data[`p${i}`];
    if (node?.handle) live.set(h, node.title);
  });
  return live;
}

const ids = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
if (!ids.length) {
  console.log('Pass one or more Etsy listing ids, or --self-test.');
  process.exit(1);
}

const candidates = ids.map((id) => ({id, handle: byListing.get(id) || null}));
const live = await liveHandles(candidates.map((c) => c.handle).filter(Boolean));

for (const {id, handle} of candidates) {
  if (!handle) {
    console.log(`${id}\tNO MAP\tkeep the Etsy link`);
  } else if (!live.has(handle)) {
    console.log(`${id}\tNOT LIVE (${handle})\tkeep the Etsy link`);
  } else {
    console.log(`${id}\thttps://streamwidgetshop.com/products/${handle}\t${live.get(handle)}`);
  }
}
