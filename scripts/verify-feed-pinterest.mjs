/**
 * Verifies the Pinterest feed against Pinterest's PUBLISHED spec and against
 * the column set in their own sample CSV.
 *
 * Same discipline as verify-feed-csv.mjs: every check asserts an ACCEPTED
 * VALUE, never a populated one. X's feed had every required field present and
 * failed 122 of 122, because the values were in Google's vocabulary.
 *
 * Pinterest's rule that makes this worse than X's: "If they're missing, or
 * formatted incorrectly, your ENTIRE retail catalog will fail ingestion." Not
 * the row. The catalog.
 *
 *   node scripts/verify-feed-pinterest.mjs
 */
import {readFileSync} from 'node:fs';

const R = new URL('..', import.meta.url).pathname;
const {FEED_QUERY, PAGE_SIZE} = await import(`${R}/app/lib/productFeed.js`);
const {buildPinterestCsv, PINTEREST_COLUMNS} = await import(
  `${R}/app/lib/productFeedCsv.js`
);

const env = Object.fromEntries(
  readFileSync(`${R}/.env`, 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
  }),
);

const nodes = [];
let after = null;
for (let i = 0; i < 10; i++) {
  const res = await fetch(`https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
    },
    body: JSON.stringify({query: FEED_QUERY, variables: {first: PAGE_SIZE, after}}),
  });
  const j = await res.json();
  if (j.errors) { console.error(JSON.stringify(j.errors).slice(0, 300)); process.exit(1); }
  nodes.push(...j.data.products.nodes);
  if (!j.data.products.pageInfo.hasNextPage) break;
  after = j.data.products.pageInfo.endCursor;
}

// Must match PINTEREST_LINK_ORIGIN in the route. Pinterest refuses any link on
// a domain the account has not claimed, and the apex is held by a deactivated
// account, so links point at the claimed shop subdomain instead.
const PINTEREST_LINK_ORIGIN = 'https://shop.streamwidgetshop.com';
const {csv, items, skippedIp} = buildPinterestCsv(nodes, PINTEREST_LINK_ORIGIN);
const fail = [];

function parseCsv(text) {
  const rows = []; let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCsv(csv);
const header = rows[0];
const body = rows.slice(1).filter((r) => r.length > 1);
const col = (r, n) => r[PINTEREST_COLUMNS.indexOf(n)];

if (String(header) !== String(PINTEREST_COLUMNS)) fail.push(`header mismatch: ${header}`);
if (body.length !== items) fail.push(`parsed ${body.length}, builder said ${items}`);
if (items === 0) fail.push('feed is empty');

const ragged = body.filter((r) => r.length !== PINTEREST_COLUMNS.length);
if (ragged.length) fail.push(`${ragged.length} ragged row(s), a quoting bug`);

// Pinterest's REQUIRED set. A miss fails the whole catalog, not the row.
for (const name of ['id', 'title', 'description', 'link', 'image_link', 'price', 'availability']) {
  const missing = body.filter((r) => !col(r, name)).length;
  if (missing) fail.push(`${missing} row(s) missing REQUIRED ${name} (fails the whole catalog)`);
}

const AVAIL = new Set(['in stock', 'out of stock', 'preorder']);
const badAvail = body.filter((r) => !AVAIL.has(col(r, 'availability')));
if (badAvail.length) fail.push(`${badAvail.length} row(s) with availability Pinterest rejects, e.g. "${col(badAvail[0], 'availability')}"`);

// Pinterest's caps, all different from X's.
const caps = [['id', 127], ['title', 500], ['description', 10000], ['link', 511], ['image_link', 2000], ['item_group_id', 127]];
for (const [name, max] of caps) {
  const over = body.filter((r) => (col(r, name) || '').length > max);
  if (over.length) fail.push(`${over.length} ${name}(s) over Pinterest's ${max} char cap`);
}

// Every link must be on the CLAIMED domain. This is the check that would have
// caught Error 139 before an ingest instead of after it.
const offDomain = body.filter((r) => !col(r, 'link').startsWith(`${PINTEREST_LINK_ORIGIN}/`));
if (offDomain.length) {
  fail.push(`${offDomain.length} link(s) not on the claimed domain ${PINTEREST_LINK_ORIGIN}, e.g. ${col(offDomain[0], 'link')}`);
}

const badLink = body.filter((r) => !/^https?:\/\//.test(col(r, 'link')));
if (badLink.length) fail.push(`${badLink.length} link(s) not starting http`);
const badImg = body.filter((r) => !/^https?:\/\//.test(col(r, 'image_link')));
if (badImg.length) fail.push(`${badImg.length} image_link(s) not starting http`);

// "Do not use 0 values or currency symbols."
const badPrice = body.filter((r) => !/^\d+\.\d{2} [A-Z]{3}$/.test(col(r, 'price')) || parseFloat(col(r, 'price')) === 0);
if (badPrice.length) fail.push(`${badPrice.length} bad price, e.g. "${col(badPrice[0], 'price')}"`);

const badSale = body.filter((r) => {
  const s = col(r, 'sale_price'); if (!s) return false;
  return parseFloat(s) <= 0 || parseFloat(s) >= parseFloat(col(r, 'price'));
});
if (badSale.length) fail.push(`${badSale.length} sale_price not below price, or zero`);

const ids = body.map((r) => col(r, 'id'));
if (new Set(ids).size !== ids.length) fail.push('duplicate id');

const htmlDesc = body.filter((r) => /<[a-z/][^>]*>/i.test(col(r, 'description')));
if (htmlDesc.length) fail.push(`${htmlDesc.length} description(s) contain HTML (spec says plain text)`);

// Every field quoted, matching Pinterest's own sample.
const unquoted = csv.split('\n').filter(Boolean).filter((line) => !line.startsWith('"'));
if (unquoted.length) fail.push(`${unquoted.length} line(s) do not start with a quoted field`);

const IP_CHECK = /pok[eé]?-?\s?mon|pikachu|charizard|star ?wars|valorant|genshin|fortnite|minecraft|zelda|among us/i;
const leaked = body.filter((r) => IP_CHECK.test(col(r, 'title')));
if (leaked.length) fail.push(`IP LEAKED: ${col(leaked[0], 'title').slice(0, 50)}`);

console.log(`rows             : ${body.length}`);
console.log(`excluded for IP  : ${skippedIp}`);
console.log(`size             : ${(csv.length / 1024).toFixed(0)} KB`);
console.log(`availability     : ${[...new Set(body.map((r) => col(r, 'availability')))].join(', ')}`);
console.log(`shipping         : ${col(body[0], 'shipping')}`);
console.log(`google category  : ${col(body[0], 'google_product_category')}`);
console.log(`longest title    : ${Math.max(...body.map((r) => col(r, 'title').length))} (cap 500)`);
console.log();

if (fail.length) { console.error('FAIL'); for (const f of fail) console.error('  ' + f); process.exit(1); }
console.log("PASS: every row satisfies Pinterest's published spec.");
