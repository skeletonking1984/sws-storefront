/**
 * Verifies the X Shopping CSV feed against X's PUBLISHED spec, field by field.
 *
 * WHY THIS IS STRICTER THAN verify-feed.mjs. That verifier checked fields were
 * PRESENT and the feed still failed 122 of 122 on X, because presence was
 * never the problem: the values were in Google's vocabulary, not X's.
 * "in_stock" is present, well-formed, and rejected. So every check here
 * asserts an ACCEPTED VALUE, not a populated one.
 *
 * Source of the rules: https://business.x.com/en/help/shopping-specs.html
 *
 *   node scripts/verify-feed-csv.mjs
 */
import {readFileSync} from 'node:fs';

const R = new URL('..', import.meta.url).pathname;
const {FEED_QUERY, PAGE_SIZE} = await import(`${R}/app/lib/productFeed.js`);
const {buildFeedCsv, X_COLUMNS, X_AVAILABILITY} = await import(
  `${R}/app/lib/productFeedCsv.js`
);

const env = Object.fromEntries(
  readFileSync(`${R}/.env`, 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

async function gql(query, variables) {
  const res = await fetch(
    `https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
      },
      body: JSON.stringify({query, variables}),
    },
  );
  return res.json();
}

const nodes = [];
let after = null;
for (let i = 0; i < 10; i++) {
  const j = await gql(FEED_QUERY, {first: PAGE_SIZE, after});
  if (j.errors) { console.error(JSON.stringify(j.errors).slice(0, 300)); process.exit(1); }
  nodes.push(...j.data.products.nodes);
  if (!j.data.products.pageInfo.hasNextPage) break;
  after = j.data.products.pageInfo.endCursor;
}

const {csv, items, skippedIp} = buildFeedCsv(nodes, 'https://streamwidgetshop.com');
const fail = [];

/*
 * A REAL CSV PARSER, not a split(','). 32 of 122 titles contain a comma, and
 * the entire point of this file is to catch the row-shifting that causes. A
 * naive split would shift the same way the bug does and agree with it.
 */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
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

if (String(header) !== String(X_COLUMNS)) fail.push(`header mismatch: ${header}`);
if (body.length !== items) fail.push(`parsed ${body.length} rows, builder reported ${items}`);
if (items === 0) fail.push('feed is empty');

const col = (r, name) => r[X_COLUMNS.indexOf(name)];

// EVERY row must have exactly as many fields as the header. This is the check
// that catches an unquoted comma, and it is why the parser above is real.
const ragged = body.filter((r) => r.length !== X_COLUMNS.length);
if (ragged.length) fail.push(`${ragged.length} row(s) have the wrong field count, a quoting bug`);

for (const name of ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand']) {
  const missing = body.filter((r) => !col(r, name)).length;
  if (missing) fail.push(`${missing} row(s) missing required field ${name}`);
}

// The four things X actually rejected. Accepted VALUES, not presence.
const badAvail = body.filter((r) => !X_AVAILABILITY.has(col(r, 'availability')));
if (badAvail.length) fail.push(`${badAvail.length} row(s) with availability X rejects, e.g. "${col(badAvail[0], 'availability')}"`);

const badLink = body.filter((r) => !/^https?:\/\//.test(col(r, 'link')));
if (badLink.length) fail.push(`${badLink.length} row(s) whose link lacks http/https`);

const badImg = body.filter((r) => !/^https?:\/\//.test(col(r, 'image_link')));
if (badImg.length) fail.push(`${badImg.length} row(s) whose image_link lacks http/https`);

const badPrice = body.filter((r) => !/^\d+\.\d{2} [A-Z]{3}$/.test(col(r, 'price')));
if (badPrice.length) fail.push(`${badPrice.length} row(s) with a malformed price, e.g. "${col(badPrice[0], 'price')}"`);

const badCondition = body.filter((r) => !['new', 'used', 'refurbished'].includes(col(r, 'condition')));
if (badCondition.length) fail.push(`${badCondition.length} row(s) with a condition X rejects`);

// X's caps.
const longTitle = body.filter((r) => col(r, 'title').length > 150);
if (longTitle.length) fail.push(`${longTitle.length} title(s) over X's 150 char cap`);
const longId = body.filter((r) => col(r, 'id').length > 100);
if (longId.length) fail.push(`${longId.length} id(s) over X's 100 char cap`);
const longDesc = body.filter((r) => col(r, 'description').length > 5000);
if (longDesc.length) fail.push(`${longDesc.length} description(s) over X's 5000 char cap`);

const ids = body.map((r) => col(r, 'id'));
if (new Set(ids).size !== ids.length) fail.push('duplicate id: X ignores ALL instances of a repeated id');

// sale_price must be strictly lower than price, or X rejects the row.
const badSale = body.filter((r) => {
  const s = col(r, 'sale_price');
  if (!s) return false;
  return parseFloat(s) >= parseFloat(col(r, 'price'));
});
if (badSale.length) fail.push(`${badSale.length} row(s) where sale_price is not below price`);

// An item marked "in stock" must carry inventory >= 1 or X will not show it.
const badInv = body.filter((r) => col(r, 'availability') === 'in stock' && !(Number(col(r, 'inventory')) >= 1));
if (badInv.length) fail.push(`${badInv.length} in-stock row(s) with inventory < 1, X will hide these`);

// Descriptions must be plain text.
const htmlDesc = body.filter((r) => /<[a-z/][^>]*>/i.test(col(r, 'description')));
if (htmlDesc.length) fail.push(`${htmlDesc.length} description(s) still contain HTML`);

const IP_CHECK = /pok[eé]?-?\s?mon|pikachu|charizard|star ?wars|valorant|genshin|fortnite|minecraft|zelda|among us/i;
const leaked = body.filter((r) => IP_CHECK.test(col(r, 'title')));
if (leaked.length) fail.push(`IP LEAKED: ${leaked.map((r) => col(r, 'title')).slice(0, 2).join(' | ')}`);

console.log(`rows            : ${body.length}`);
console.log(`excluded for IP : ${skippedIp}`);
console.log(`size            : ${(csv.length / 1024).toFixed(0)} KB`);
console.log(`titles w/ comma : ${body.filter((r) => col(r, 'title').includes(',')).length} (quoting is load bearing)`);
console.log(`longest title   : ${Math.max(...body.map((r) => col(r, 'title').length))} (X caps 150)`);
console.log(`availability    : ${[...new Set(body.map((r) => col(r, 'availability')))].join(', ')}`);
console.log();

if (fail.length) {
  console.error('FAIL');
  for (const f of fail) console.error('  ' + f);
  process.exit(1);
}
console.log("PASS: every row satisfies X Shopping's published spec.");
