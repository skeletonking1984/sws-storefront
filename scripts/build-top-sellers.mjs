/**
 * Ranks the catalogue by REAL sales and writes data/top-sellers.json, which the
 * homepage's "Top widgets" band reads.
 *
 * WHY THIS IS NOT JUST `sortKey: BEST_SELLING`.
 *
 * The Storefront API can sort a collection by best selling for free, and it is
 * the obvious answer, and it is wrong here. Shopify's best-selling signal is
 * built from SHOPIFY orders, and this shop took **7 orders in 90 days** on
 * Shopify against **769 on Etsy**. Ordering the homepage by 7 transactions
 * across a 124 product catalogue is not sales data, it is noise with a
 * plausible name.
 *
 * Measured 2026-09-21: `BEST_SELLING` on the top-widgets collection drops the
 * Multistream Chat Widget out of the top 6 entirely. That product is Etsy's
 * number one by a wide margin, 80 units and $1,171 over 90 days, 16.6% of all
 * revenue. Shipping an ordering that hides the best seller is worse than the
 * frozen manual order it would replace.
 *
 * So the ranking comes from Etsy, joined back to Shopify handles through
 * data/etsy-video-map.json, which is the authoritative join in this repo (see
 * CLAUDE.md: it is proven on shared Etsy CDN image ids, not title similarity).
 *
 * WHAT IT RANKS BY. Revenue, not units. A $2.42 goal widget selling 4 copies is
 * not outperforming a $14.64 multistream chat selling 3. The homepage band is
 * prime real estate and it should carry what earns.
 *
 * Usage:
 *   ETSY_PACKAGE_ROOT=/Users/todd/Documents/orgs/SWS/repos/sws-etsy-mcp \
 *     node scripts/build-top-sellers.mjs [--days 45] [--check]
 *
 *   --check   compare the existing file against a fresh pull and exit 1 if the
 *             top slots have moved. For the weekly routine.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
/* app/data/, not the repo root data/. The `~/` alias resolves to app/, so a
 * file the homepage imports has to live there. The root data/ folder is for
 * things only scripts read. */
const OUT = path.join(ROOT, 'app/data/top-sellers.json');

const argv = process.argv.slice(2);
const CHECK = argv.includes('--check');
const days = Number(argv[argv.indexOf('--days') + 1]) || 45;

/** How many handles the file carries. The band shows 6; the rest are slack for
 *  anything that goes DRAFT or archived between refreshes. */
const KEEP = 12;

const mapPath = path.join(ROOT, 'data/etsy-video-map.json');
const raw = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const rows = Array.isArray(raw) ? raw : raw.rows || Object.values(raw);

/** etsy listing id -> shopify handle */
const byListing = new Map();
for (const row of rows) {
  if (row && row.etsy_listing_id && row.handle) {
    byListing.set(Number(row.etsy_listing_id), row.handle);
  }
}

const mcpDist = path.resolve(
  process.env.ETSY_PACKAGE_ROOT || path.resolve(ROOT, '../sws-etsy-mcp'),
  'dist',
);
/* The Etsy client resolves its .env and token file from process.cwd(), so
 * running it from this repo fails with a misleading "Not authorized yet".
 * Documented in CLAUDE.md; this is the same reason pull-etsy-reviews.mjs and
 * audit-etsy-mapping.mjs need ETSY_PACKAGE_ROOT. */
const cwd = process.cwd();
process.chdir(path.resolve(mcpDist, '..'));
const {productRevenue} = await import(pathToFileURL(path.join(mcpDist, 'api.js')));

const until = new Date();
const since = new Date(until.getTime() - days * 24 * 3600 * 1000);
const rev = await productRevenue({
  since: since.toISOString().slice(0, 10),
  until: until.toISOString().slice(0, 10),
});
process.chdir(cwd);

const ranked = [];
const unmapped = [];
for (const product of rev.products || []) {
  const handle = byListing.get(Number(product.listing_id));
  if (!handle) {
    unmapped.push({listing_id: product.listing_id, title: product.title, revenue: product.revenue});
    continue;
  }
  ranked.push({
    handle,
    listing_id: product.listing_id,
    title: product.title,
    revenue: product.revenue,
    units: product.units,
  });
}
ranked.sort((a, b) => b.revenue - a.revenue);
const top = ranked.slice(0, KEEP);

const next = {
  generatedAt: new Date().toISOString(),
  window: {since: since.toISOString().slice(0, 10), until: until.toISOString().slice(0, 10), days},
  source: 'etsy productRevenue, joined through data/etsy-video-map.json',
  etsyOrders: rev.order_count,
  etsyRevenue: rev.total_revenue,
  mappedProducts: ranked.length,
  unmappedProducts: unmapped.length,
  handles: top.map((t) => t.handle),
  detail: top,
};

if (CHECK) {
  let current = null;
  try {
    current = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  } catch {
    console.log('no data/top-sellers.json yet, run without --check');
    process.exit(1);
  }
  const before = (current.handles || []).slice(0, 6);
  const after = next.handles.slice(0, 6);
  const moved = before.join('|') !== after.join('|');
  console.log(`window ${next.window.since} to ${next.window.until}, ${rev.order_count} Etsy orders`);
  console.log(`file generated ${current.generatedAt}`);
  if (!moved) {
    console.log('top 6 unchanged');
    process.exit(0);
  }
  console.log('\ntop 6 MOVED, rerun without --check to refresh:');
  after.forEach((h, i) => {
    const was = before[i];
    console.log(`  ${i + 1}. ${h}${was === h ? '' : `   (was ${was || 'nothing'})`}`);
  });
  process.exit(1);
}

fs.writeFileSync(OUT, `${JSON.stringify(next, null, 2)}\n`);
console.log(
  `${rev.order_count} Etsy orders over ${days} days, ` +
    `${ranked.length} mapped to Shopify handles, ${unmapped.length} unmapped`,
);
top.slice(0, 6).forEach((t, i) =>
  console.log(`  ${i + 1}. $${String(t.revenue).padStart(8)}  ${t.units}u  ${t.title.slice(0, 54)}`),
);
if (unmapped.length) {
  console.log(`\nunmapped, earning but not joined to a Shopify product:`);
  unmapped
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)
    .forEach((u) => console.log(`  $${String(u.revenue).padStart(8)}  ${u.title.slice(0, 54)}`));
}
console.log(`\nwrote ${path.relative(ROOT, OUT)}`);
