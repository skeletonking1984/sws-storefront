/**
 * Pull EVERY Etsy review for the shop into data/etsy-reviews-raw.json.
 *
 * Why this exists: the raw file used to hold only the 100 most recent reviews,
 * because that is the ceiling of the `etsy_get_reviews` MCP tool (limit max
 * 100, no offset parameter). Splitting 100 shop-wide reviews across the
 * catalogue left most products showing one or two, while the same listing had
 * dozens on Etsy. This walks the underlying paginated endpoint instead and
 * takes all of them, which took the storefront from 75 attached reviews across
 * 26 products to 727 across 83.
 *
 * It talks to Etsy through the sws-etsy-mcp package's own compiled client, so
 * the OAuth token refresh, retries and shop resolution are the ones already in
 * use rather than a second copy. That makes this script dependent on a SIBLING
 * repo being present and built:
 *
 *   ../sws-etsy-mcp/dist/{client,api}.js   plus its .env and .etsy-tokens.json
 *
 * If that path moves, this script is the only thing that breaks.
 *
 * Usage: node scripts/pull-etsy-reviews.mjs
 * Then:  node scripts/build-etsy-reviews.mjs
 */
import {writeFileSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MCP_DIST = path.resolve(ROOT, '../sws-etsy-mcp/dist');

const {getAll} = await import(pathToFileURL(path.join(MCP_DIST, 'client.js')));
const {resolveShopId, getShop} = await import(
  pathToFileURL(path.join(MCP_DIST, 'api.js'))
);

/** @param {number|undefined} t Etsy epoch seconds */
const isoDay = (t) => (t ? new Date(t * 1000).toISOString().slice(0, 10) : null);

const shopId = await resolveShopId();

// The shop stats block is NOT decoration. build-etsy-reviews.mjs reads it to
// produce app/data/etsy-shop-stats.json, which is what the site renders as the
// shop rating. An earlier version of this pull wrote `shop: shopId`, a bare
// number, and the build silently emitted undefined for every stat because
// JSON.stringify drops undefined keys rather than throwing. Always write the
// real object, and let the build fail loudly if it is missing.
const shop = await getShop();

const raw = await getAll(
  `/v3/application/shops/${shopId}/reviews`,
  {},
  {pageSize: 100, hardCap: 5000},
);

const reviews = raw.map((rv) => ({
  listing_id: rv.listing_id,
  transaction_id: rv.transaction_id,
  rating: rv.rating,
  review: rv.review,
  language: rv.language,
  date: isoDay(rv.created_timestamp ?? rv.create_timestamp),
}));

if (reviews.length < 500) {
  // A short pull almost certainly means pagination silently stopped, and
  // overwriting a good file with a truncated one is how the 100-review
  // ceiling went unnoticed for days. Refuse rather than write.
  console.error(
    `Refusing to write: only ${reviews.length} reviews came back, expected the full shop history. Check pagination before rerunning.`,
  );
  process.exit(1);
}

const out = {
  fetched_at: new Date().toISOString(),
  source:
    'getReviewsByShop, fully paginated via getAll (every review, not the most recent 100)',
  shop: {
    shop_id: shop.shop_id,
    shop_name: shop.shop_name,
    review_count: shop.review_count,
    review_average: shop.review_average,
    transaction_sold_count: shop.transaction_sold_count,
    num_favorers: shop.num_favorers,
  },
  reviews,
};

writeFileSync(
  path.join(ROOT, 'data/etsy-reviews-raw.json'),
  `${JSON.stringify(out, null, 2)}\n`,
);

const perListing = {};
for (const r of reviews) perListing[r.listing_id] = (perListing[r.listing_id] || 0) + 1;

console.log('Etsy review pull');
console.log('-----------------');
console.log(`Reviews pulled:        ${reviews.length}`);
console.log(`Shop reports:          ${shop.review_count}`);
console.log(`Distinct listings:     ${Object.keys(perListing).length}`);
console.log(`With written text:     ${reviews.filter((r) => (r.review || '').trim()).length}`);
console.log('Written to data/etsy-reviews-raw.json');
console.log('Now run: node scripts/build-etsy-reviews.mjs');
