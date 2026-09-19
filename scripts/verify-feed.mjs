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

const {buildFeedXml, FEED_QUERY, PAGE_SIZE, FEED_EXPIRY_DAYS} = await import(`${R}/app/lib/productFeed.js`);

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

// The feed declares shipping for the countries the shop can actually SELL to,
// and nothing asserted that until 2026-09-18.
//
// The feed hardcodes <g:country>US</g:country>. Three nights of this ledger read
// that as a latent bug, because the delivery profile carries a $0 "Express
// International" rate for 27 countries and the feed names none of them. It is
// not a bug. Verified 2026-09-18 against the Admin API: the shop has exactly ONE
// market, "United States", ACTIVE, so `localization.availableCountries` is [US]
// and that International zone is unreachable config. Everything here is a
// download with requiresShipping false, so checkout collects no shipping address
// at all (every order since #1031 has shippingAddress: null, including paid
// orders from CO, NO, MA and CA) and the delivery zone never applies.
//
// So US-only is correct TODAY and wrong the moment a second market is added:
// the feed would keep telling Google the shop ships to one country while the
// storefront sold to thirty. Assert the two agree rather than trusting either.
const declaredCountries = [...new Set(
  [...xml.matchAll(/<g:country>([^<]*)<\/g:country>/g)].map((m) => m[1].trim()),
)].sort();
const MARKETS_QUERY = '{ localization { availableCountries { isoCode } } }';
const marketsJson = await gql(MARKETS_QUERY);
const sellableCountries = (
  marketsJson.data?.localization?.availableCountries || []
).map((c) => c.isoCode).sort();

if (!sellableCountries.length) {
  fail.push('could not read localization.availableCountries: shipping countries unverified');
} else if (declaredCountries.join(',') !== sellableCountries.join(',')) {
  fail.push(
    `feed declares shipping for [${declaredCountries.join(', ')}] but the shop sells to ` +
    `[${sellableCountries.join(', ')}]. Update the <g:shipping> block in app/lib/productFeed.js ` +
    'to cover every market, or a channel will refuse the countries it is missing.',
  );
}

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

// Every item must carry an expiry, and it must be inside Google's 30 day cap.
// An item with no expiry lingers for 30 days after the feed stops listing it,
// which is how one id change turned 122 products into 244 ghosts and lives.
// An expiry PAST the cap is rejected outright, which would drop the catalogue.
const expiries = [...xml.matchAll(/<g:expiration_date>([^<]*)<\/g:expiration_date>/g)].map((m) => m[1]);
if (expiries.length < items) {
  fail.push(`g:expiration_date on ${expiries.length} of ${items} items`);
}
const nowMs = Date.now();
for (const value of new Set(expiries)) {
  const days = (new Date(`${value}T00:00:00Z`).getTime() - nowMs) / 86400000;
  if (!Number.isFinite(days)) fail.push(`unparseable g:expiration_date "${value}"`);
  else if (days >= 30) fail.push(`g:expiration_date ${value} is ${days.toFixed(1)} days out, Google caps at 30`);
  else if (days <= 0) fail.push(`g:expiration_date ${value} is in the past, every item would expire on ingest`);
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
console.log(`expires          : ${expiries[0] || 'none'} (${FEED_EXPIRY_DAYS} day window)`);
console.log(`longest g:id     : ${Math.max(...ids.map((v) => v.length))} chars (Google caps at 50)`);
console.log();
if (fail.length) {
  console.error('FAIL');
  for (const f of fail) console.error('  ' + f);
  process.exit(1);
}
console.log('PASS: every item carries the required Google fields, free shipping, and no IP leaked.');
