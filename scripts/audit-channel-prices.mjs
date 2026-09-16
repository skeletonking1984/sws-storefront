/**
 * Compares the PRICE of every product that lives on BOTH Etsy and the
 * Shopify storefront, and reports any mismatch. Runs nightly as part of
 * channel health.
 *
 *   ETSY_PACKAGE_ROOT=../sws-etsy-mcp node scripts/audit-channel-prices.mjs
 *   npm run audit:prices
 *
 * THE CENTS-NOT-STRINGS TRAP: a previous attempt at this exact comparison
 * produced a FALSE mismatch by comparing prices as formatted strings, so
 * "$10.4" and "$10.40" read as different prices when they are the same
 * price. Money is never compared as text in this script. Every price is
 * normalised to an INTEGER number of cents before comparison:
 *
 *   Etsy:     listActiveListings() already runs the raw {amount, divisor}
 *             object Etsy's API returns (eg {amount:1040, divisor:100})
 *             through money(), which yields a JS float in dollars (10.4).
 *             A float re-multiplied by 100 can drift (10.4 * 100 can land
 *             on 1039.9999999999998), so this script rounds that product
 *             to the nearest integer cent rather than trusting the float.
 *   Shopify:  the Storefront API returns price as a decimal STRING
 *             (eg "10.40"). Parsed to a float, then rounded to integer
 *             cents the same way, never string-compared against Etsy's.
 *
 * Two real rows are normalised and printed with their working before the
 * main comparison runs, so a silent unit mismatch is visible immediately
 * rather than buried in a wall of per-product output.
 *
 * THE JOIN: data/etsy-video-map.json, on shopify_product_id <-> etsy
 * listing id. About 115-121 of the ~124 storefront-visible Shopify
 * products map to an Etsy listing; the rest are unmapped and that is NOT
 * a finding, just a reported count.
 *
 * FAIL CLOSED ON ETSY: listActiveListings requires ETSY_PACKAGE_ROOT set
 * to the sws-etsy-mcp checkout, or it cannot find its token file and the
 * Etsy half returns nothing. A silent zero-row Etsy result must never
 * read as a clean pass, so this script exits non-zero LOUDLY if the Etsy
 * fetch throws or comes back empty.
 *
 * Exit 1 on: the Etsy fail-closed condition, or one or more real price
 * mismatches. Exit 0 when every joined pair matches.
 */
import fs from 'node:fs';
import {listActiveListings} from '../../sws-etsy-mcp/dist/api.js';

const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1).replace(/^["']|["']$/g, '')];
    }),
);

const domain = env.PUBLIC_STORE_DOMAIN;
const token = env.PUBLIC_STOREFRONT_API_TOKEN;

if (!domain || !token) {
  console.error('Missing PUBLIC_STORE_DOMAIN or PUBLIC_STOREFRONT_API_TOKEN in .env');
  process.exit(1);
}

/** Dollars, as a float or a decimal string, to an integer number of cents. */
function toCents(dollars) {
  const n = typeof dollars === 'string' ? parseFloat(dollars) : dollars;
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function fmtCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

// ---- Shopify: every storefront-visible product, with price -------------

const QUERY = `query($c:String){
  products(first:250, after:$c){
    pageInfo{hasNextPage endCursor}
    nodes{ id handle title priceRange{minVariantPrice{amount currencyCode}} }
  }
}`;

async function allStorefrontProducts() {
  let cursor = null;
  const out = [];
  do {
    const res = await fetch(`https://${domain}/api/2025-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': token,
      },
      body: JSON.stringify({query: QUERY, variables: {c: cursor}}),
    });
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 300));
    out.push(...json.data.products.nodes);
    cursor = json.data.products.pageInfo.hasNextPage
      ? json.data.products.pageInfo.endCursor
      : null;
  } while (cursor);
  return out;
}

const shopifyProducts = await allStorefrontProducts();

// ---- Etsy: every active listing ------------------------------------------
//
// Requires ETSY_PACKAGE_ROOT, or the shared client resolves its token file
// from process.cwd() and fails, or worse, quietly returns zero rows. A
// zero-row Etsy result must FAIL LOUDLY, never read as a clean comparison.

let etsyListings = [];
let etsyError = null;
try {
  etsyListings = await listActiveListings(undefined);
} catch (error) {
  etsyError = error.message;
}

if (etsyError) {
  console.log(`FAIL: the Etsy half of this audit did not run: ${etsyError}`);
  console.log(
    '  Run with ETSY_PACKAGE_ROOT=/Users/todd/Documents/orgs/SWS/repos/sws-etsy-mcp',
  );
  console.log('  A zero-row Etsy result is NOT a pass. This is not "0 mismatches", it is FAILED.');
  process.exit(1);
}

if (etsyListings.length === 0) {
  console.log('FAIL: Etsy returned zero active listings. Fetch fail-closed, not a real empty shop.');
  console.log(
    '  Check ETSY_PACKAGE_ROOT=/Users/todd/Documents/orgs/SWS/repos/sws-etsy-mcp is set and the token is authorised.',
  );
  process.exit(1);
}

console.log(
  `Fetched ${shopifyProducts.length} storefront-visible Shopify products and ${etsyListings.length} active Etsy listings.\n`,
);

const etsyById = new Map(etsyListings.map((l) => [String(l.listing_id), l]));

// ---- the join: data/etsy-video-map.json ----------------------------------

const map = JSON.parse(
  fs.readFileSync(new URL('../data/etsy-video-map.json', import.meta.url), 'utf8'),
);

const gidToListingId = new Map();
for (const row of map.rows) {
  if (!row.shopify_product_id || !row.etsy_listing_id) continue;
  gidToListingId.set(row.shopify_product_id, String(row.etsy_listing_id));
}

// ---- normalisation check: show the working on two real rows -------------

console.log('Normalisation check (cents, not strings):');
let shown = 0;
for (const p of shopifyProducts) {
  const listingId = gidToListingId.get(p.id);
  if (!listingId) continue;
  const listing = etsyById.get(listingId);
  if (!listing || listing.price == null) continue;
  const shopifyAmount = p.priceRange.minVariantPrice.amount;
  const shopifyCents = toCents(shopifyAmount);
  const etsyCents = toCents(listing.price);
  console.log(
    `  ${p.handle}\n` +
      `    Shopify: "${shopifyAmount}" (string) -> ${shopifyCents} cents\n` +
      `    Etsy:    ${listing.price} (dollars, from amount/divisor via money()) -> ${etsyCents} cents\n` +
      `    Same price: ${shopifyCents === etsyCents}`,
  );
  shown += 1;
  if (shown === 2) break;
}
console.log('');

// ---- compare every joined pair --------------------------------------------

let compared = 0;
let matched = 0;
const mismatches = [];
const mappedButMissingListing = [];

for (const p of shopifyProducts) {
  const listingId = gidToListingId.get(p.id);
  if (!listingId) continue; // handled below as "unmapped"

  const listing = etsyById.get(listingId);
  if (!listing || listing.price == null) {
    mappedButMissingListing.push({handle: p.handle, listingId});
    continue;
  }

  const shopifyCents = toCents(p.priceRange.minVariantPrice.amount);
  const etsyCents = toCents(listing.price);
  compared += 1;

  if (shopifyCents === etsyCents) {
    matched += 1;
  } else {
    mismatches.push({
      handle: p.handle,
      etsyListingId: listingId,
      etsyPrice: fmtCents(etsyCents),
      shopifyPrice: fmtCents(shopifyCents),
      deltaCents: shopifyCents - etsyCents,
    });
  }
}

const mappedGids = new Set(gidToListingId.keys());
const unmapped = shopifyProducts.filter((p) => !mappedGids.has(p.id));

// ---- report ----------------------------------------------------------------

console.log(`Compared: ${compared}`);
console.log(`Matched:  ${matched}`);
console.log(`Mismatched: ${mismatches.length}`);
console.log(`Unmapped (no Etsy listing in the join file, not a finding): ${unmapped.length}`);
if (mappedButMissingListing.length) {
  console.log(
    `Mapped in join file but listing not found among active Etsy listings: ${mappedButMissingListing.length} (listing may be inactive)`,
  );
}
console.log('');

if (mismatches.length) {
  console.log('PRICE MISMATCHES:');
  for (const m of mismatches) {
    console.log(
      `  ${m.handle}  etsy_listing_id=${m.etsyListingId}  Etsy=${m.etsyPrice}  Shopify=${m.shopifyPrice}  delta=${(m.deltaCents / 100).toFixed(2)}`,
    );
  }
  console.log(`\nFAIL: ${mismatches.length} product(s) priced differently across channels.`);
} else {
  console.log('OK: every joined product is priced the same on both channels.');
}

process.exit(mismatches.length ? 1 : 0);
