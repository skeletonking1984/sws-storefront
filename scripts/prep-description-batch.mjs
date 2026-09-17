/**
 * Assemble everything a description rewrite needs, for one batch of the
 * BAT-172 queue, in ONE pass.
 *
 * Why it exists: docs/COPY-STANDARD.md says every factual claim must come
 * from that product's own live Etsy listing and its file manifest. Doing
 * that interactively is two MCP round trips per product plus a Shopify read,
 * which is what made the first batch expensive. This writes a single JSON
 * file the writer works from and the apply step writes back through.
 *
 * Usage:
 *   ETSY_PACKAGE_ROOT=../sws-etsy-mcp node scripts/prep-description-batch.mjs <n> [outfile]
 *
 * The batch is the FIRST n handles the descriptions audit still calls a raw
 * Etsy dump, in audit order, so successive nights walk the queue rather than
 * re-picking the same products.
 */
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const env = Object.fromEntries(
  fs
    .readFileSync(`${ROOT}/.env`, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [
      l.slice(0, l.indexOf('=')).trim(),
      // Values in this .env are quoted, and an unstripped quote turns the
      // shop domain into a hostname DNS cannot resolve.
      l
        .slice(l.indexOf('=') + 1)
        .trim()
        .replace(/^['"]|['"]$/g, ''),
    ]),
);

const BATCH = Number(process.argv[2] || 10);
const OUT = process.argv[3] || `${ROOT}/data/description-batch.json`;

/** The queue, straight from the audit, so the two can never disagree. */
function queuedHandles() {
  // The audit exits 1 whenever it finds anything, which is every run while
  // this queue is non-empty, so a throwing execFileSync would make this
  // script unable to read the very list it exists to read.
  let out;
  try {
    out = execFileSync('node', [`${ROOT}/scripts/audit-descriptions.mjs`], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch (err) {
    out = err.stdout || '';
    if (!out) throw err;
  }
  return out
    .split('\n')
    .filter((l) => l.includes('[raw Etsy dump]'))
    .map((l) => l.split('[raw Etsy dump]')[1].trim());
}

async function fetchShopifyProducts() {
  const url = `https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`;
  const query = `query($c:String){products(first:100,after:$c){pageInfo{hasNextPage endCursor}
    nodes{id handle title productType descriptionHtml seo{title description}
    priceRange{minVariantPrice{amount}}
    worksWith: metafield(namespace:"custom",key:"works_with"){value}}}}`;
  const all = [];
  let cursor = null;
  do {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
      },
      body: JSON.stringify({query, variables: {c: cursor}}),
    });
    const body = await res.json();
    if (body.errors) throw new Error(JSON.stringify(body.errors));
    all.push(...body.data.products.nodes);
    cursor = body.data.products.pageInfo.hasNextPage
      ? body.data.products.pageInfo.endCursor
      : null;
  } while (cursor);
  return all;
}

/** Etsy, through the sibling MCP package's own OAuth refresh. */
async function etsyClient() {
  const dist = path.resolve(ROOT, '../sws-etsy-mcp/dist');
  const {getAll, get} = await import(pathToFileURL(path.join(dist, 'client.js')));
  const {resolveShopId} = await import(pathToFileURL(path.join(dist, 'api.js')));
  return {getAll, get, shopId: await resolveShopId()};
}

const queue = queuedHandles();
console.log(`Queue ${queue.length}.`);

const products = Object.fromEntries((await fetchShopifyProducts()).map((p) => [p.handle, p]));
const mapRows = JSON.parse(fs.readFileSync(`${ROOT}/data/etsy-video-map.json`, 'utf8')).rows;
const byHandle = Object.fromEntries(mapRows.map((r) => [r.handle, r]));

const {getAll, get, shopId} = await etsyClient();
const listings = Object.fromEntries(
  (await getAll(`/v3/application/shops/${shopId}/listings`, {state: 'active'})).map((l) => [
    String(l.listing_id),
    l,
  ]),
);

/*
 * A product with no mapped Etsy listing cannot be rewritten to the standard:
 * "What You Get" comes from the file manifest and nothing else, so with no
 * manifest the only way to fill that section is to invent it. Those handles
 * are reported as a separate blocked list and the batch walks past them to
 * the next writable one, so a couple of unmapped products cannot stall the
 * queue behind them night after night.
 */
const rows = [];
const blocked = [];
for (const handle of queue) {
  if (rows.length >= BATCH) break;
  const product = products[handle];
  if (!product) {
    blocked.push({handle, why: 'not in the Storefront API'});
    continue;
  }
  const mapped = byHandle[handle];
  const listing = mapped ? listings[String(mapped.etsy_listing_id)] : null;
  if (!listing) {
    blocked.push({handle, why: 'no mapped active Etsy listing, no file manifest'});
    continue;
  }

  // The file manifest is the ONLY source for "What You Get". A listing with
  // no readable manifest is carried through with files:null rather than
  // guessed at, so the writer can see the gap instead of inventing a zip.
  let files = null;
  if (listing) {
    try {
      const res = await get(
        `/v3/application/shops/${shopId}/listings/${listing.listing_id}/files`,
      );
      // The field is `filename`, not `name`. Reading the wrong key yields a
      // manifest of nulls, which looks like a listing with unnamed files
      // rather than like a bug, and "What You Get" is written off this.
      files = (res.results || []).map((f) => ({
        filename: f.filename,
        size: f.filesize,
        type: f.filetype,
      }));
    } catch (err) {
      console.log(`  files failed for ${listing.listing_id}: ${err.message}`);
    }
  }

  rows.push({
    handle,
    shopify_product_id: product.id,
    shopify_title: product.title,
    product_type: product.productType,
    price: product.priceRange?.minVariantPrice?.amount ?? null,
    works_with: product.worksWith ? JSON.parse(product.worksWith.value) : null,
    seo: product.seo,
    current_description_html: product.descriptionHtml,
    etsy_listing_id: listing ? String(listing.listing_id) : null,
    etsy_title: listing?.title ?? null,
    etsy_description: listing?.description ?? null,
    etsy_files: files,
  });
  console.log(
    `  ${handle}\n    etsy ${listing ? listing.listing_id : 'UNMAPPED'}, ${files ? files.length : 0} file(s)`,
  );
}

if (blocked.length) {
  console.log(`\nBlocked, skipped past (${blocked.length}):`);
  for (const b of blocked) console.log(`  ${b.handle}\n    ${b.why}`);
}

fs.writeFileSync(
  OUT,
  JSON.stringify(
    {generated_at: new Date().toISOString(), queue_size: queue.length, blocked, rows},
    null,
    2,
  ),
);
console.log(`\nWrote ${rows.length} row(s) to ${path.relative(ROOT, OUT)}`);
