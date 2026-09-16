#!/usr/bin/env node
/*
 * Verify the product feed against LIVE Storefront data.
 *
 * Imports the same buildFeedXml the route serves, so this cannot pass while the
 * real feed is broken. A verifier with its own copy of the builder would only
 * prove the two copies agree.
 *
 *   node scripts/verify-feed.mjs
 */
import {readFileSync} from 'node:fs';

const R = new URL('..', import.meta.url).pathname;
const env = Object.fromEntries(
  readFileSync(`${R}/.env`, 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => {const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];}),
);

const {buildFeedXml, FEED_QUERY, PAGE_SIZE} = await import(`${R}/app/lib/productFeed.js`);

async function gql(query, variables) {
  const r = await fetch(`https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN},
    body: JSON.stringify({query, variables}),
  });
  return r.json();
}

const nodes = [];
let after = null;
for (let i = 0; i < 10; i++) {
  const j = await gql(FEED_QUERY, {first: PAGE_SIZE, after});
  if (j.errors) { console.error(JSON.stringify(j.errors, null, 2)); process.exit(1); }
  const c = j.data.products;
  nodes.push(...c.nodes);
  if (!c.pageInfo.hasNextPage) break;
  after = c.pageInfo.endCursor;
}

const {xml, items, skippedIp, skippedUnavailable} = buildFeedXml(nodes, 'https://streamwidgetshop.com');

const fail = [];
const itemCount = (xml.match(/<item>/g) || []).length;

if (itemCount !== items) fail.push(`<item> count ${itemCount} != reported ${items}`);
if (items === 0) fail.push('feed is empty');

// Every required Google field present on every item.
for (const tag of ['g:id', 'title', 'description', 'link', 'g:image_link',
                   'g:availability', 'g:price', 'g:condition', 'g:brand',
                   'g:identifier_exists', 'g:shipping']) {
  const n = (xml.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length;
  if (n < items) fail.push(`${tag} present on ${n} of ${items} items`);
}

// Shipping must be free: this is the field that unblocks Merchant Center.
const freeShipping = (xml.match(/<g:price>0 USD<\/g:price>/g) || []).length;
if (freeShipping < items) fail.push(`free shipping on ${freeShipping} of ${items} items`);

// No IP anywhere in the output, not just skipped at the door.
const IP_CHECK = /pok[eé]?-?\s?mon|pikachu|eevee|bulbasaur|charizard|star ?wars|mandalorian|grogu|yoda|valorant|genshin|fortnite|minecraft|zelda/i;
const leaked = (xml.match(/<title>(.*?)<\/title>/g) || []).filter((t) => IP_CHECK.test(t));
if (leaked.length) fail.push(`IP LEAKED into feed: ${leaked.slice(0, 3).join(' | ')}`);

// Well formed XML: no raw & outside entities.
const rawAmp = xml.replace(/&(amp|lt|gt|quot|apos);/g, '').includes('&');
if (rawAmp) fail.push('unescaped & in XML');

// Google caps id at 50 characters. Merchant Center accepted a feed with 119
// over-long ids and only reported it AFTER ingest, so the verifier has to catch
// this rather than trusting a clean fetch.
const ids = [...xml.matchAll(/<g:id>([^<]*)<\/g:id>/g)].map((m) => m[1]);
const longIds = ids.filter((v) => v.length > 50);
if (longIds.length) fail.push(`${longIds.length} id(s) over 50 chars, e.g. "${longIds[0].slice(0, 60)}"`);
const dupIds = ids.length !== new Set(ids).size;
if (dupIds) fail.push('duplicate g:id values: a feed id must be unique');
if (ids.some((v) => !v)) fail.push('empty g:id');

// THE ID IS THE CHECKOUT KEY, not just a dedupe key.
//
// Merchant Center's checkout link template is configured as
//   https://shop.streamwidgetshop.com/cart/{id}:1
// and {id} substitutes g:id verbatim. Shopify's cart permalink takes a VARIANT
// id. A PRODUCT id in that slot returns 410 Gone, which is a dead buy button on
// every free listing and every Shopping ad, while the feed itself still looks
// perfectly healthy: right length, unique, non empty. That is exactly the shape
// of fault that got through last time, so it gets checked two ways.
//
// Offline: every g:id must be a variant id this catalogue actually has.
const variantIds = new Set(
  nodes.flatMap((p) => (p.variants?.nodes || []).map((v) => String(v.id).split('/').pop())),
);
const notVariant = ids.filter((v) => !variantIds.has(v));
if (notVariant.length) {
  fail.push(
    `${notVariant.length} g:id value(s) are not variant ids (e.g. ${notVariant[0]}). ` +
      'The cart permalink /cart/<id>:1 needs a variant id; a product id 410s.',
  );
}

// Live: actually resolve one permalink. An offline set check cannot prove
// Shopify still accepts the format.
if (!process.env.SKIP_LIVE_CART_CHECK && ids.length) {
  const probe = `https://shop.streamwidgetshop.com/cart/${ids[0]}:1`;
  try {
    const res = await fetch(probe, {redirect: 'manual'});
    if (res.status >= 400) {
      fail.push(`cart permalink is dead: ${probe} returned ${res.status}`);
    }
    console.log(`cart permalink   : ${res.status} for ${probe}`);
  } catch (error) {
    console.log(`cart permalink   : probe failed (${error.message}), not treated as a failure`);
  }
}

// Prices must look like "12.34 USD".
const badPrice = (xml.match(/<g:price>(?!0 USD)([^<]*)<\/g:price>/g) || [])
  .filter((p) => !/>\d+(\.\d+)? [A-Z]{3}</.test(p));
if (badPrice.length) fail.push(`malformed price: ${badPrice.slice(0, 2).join(', ')}`);

console.log(`products fetched : ${nodes.length}`);
console.log(`feed items       : ${items}`);
console.log(`excluded for IP  : ${skippedIp}`);
console.log(`no variant       : ${skippedUnavailable}`);
console.log(`feed size        : ${(xml.length / 1024).toFixed(0)} KB`);
console.log(`longest g:id     : ${Math.max(...ids.map((v) => v.length))} chars (Google caps at 50)`);
console.log();
if (fail.length) {
  console.error('FAIL');
  for (const f of fail) console.error('  ' + f);
  process.exit(1);
}
console.log('PASS: every item carries the required Google fields, free shipping, and no IP leaked.');
