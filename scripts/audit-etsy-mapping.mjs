/**
 * Audit every Etsy listing -> Shopify product row in data/etsy-video-map.json
 * by comparing the actual image assets on both sides.
 *
 * Why this exists: the map is what decides which demo video gets attached to a
 * product AND which customer reviews get shown on its page (scripts/
 * build-etsy-reviews.mjs joins through it). A mispaired row therefore puts a
 * stranger's video and a stranger's reviews on a product page, which is worse
 * than having neither. On 2026-09-10 exactly that was found on
 * celestial-butterfly / sakura-butterfly, and the two bad rows were both
 * marked `confidence: reviewed`, so that field cannot be trusted.
 *
 * The test that actually discriminates is a CROSS match, not a self match.
 * Shopify keeps the original Etsy filename behind a hash prefix, so both sides
 * expose the same numeric CDN id out of `il_fullxfull.<ID>_xxxx.jpg`.
 *
 *   self overlap    the product holds its own listing's art          -> correct
 *   no overlap, and no other listing claims those ids                -> STALE
 *   no overlap, and another listing's CURRENT ids match exactly      -> MISPAIRED
 *
 * The stale case is benign and common: the listing's photos were refreshed on
 * Etsy after the Shopify import, so the ids diverge while the art is the same
 * widget. Treating "no overlap" as "wrong" overstates the damage by an order of
 * magnitude, which is the mistake a previous pass made.
 *
 * The video filename is NOT a usable second opinion here: Shopify re-encodes an
 * uploaded video and the Storefront API serves it under a content hash, so the
 * original `<listing_id>.mp4` name is only visible through the Admin API.
 *
 * Reads Etsy through the sibling sws-etsy-mcp compiled client (same dependency
 * as scripts/pull-etsy-reviews.mjs) and Shopify through the read only
 * Storefront token in .env. Writes nothing to either service.
 *
 * Usage:
 *   node scripts/audit-etsy-mapping.mjs          human report, exit 1 on a mispairing
 *   node scripts/audit-etsy-mapping.mjs --json   full result to stdout, exit 0
 *   node scripts/audit-etsy-mapping.mjs --apply  rewrite data/etsy-video-map.json
 *                                                from the image proof
 *
 * --apply only ever moves a row to the product whose art IS that listing's art,
 * and only when exactly one storefront product matches. A row whose product is
 * proven to belong to a different listing is UNMAPPED rather than guessed, which
 * drops its reviews instead of showing them on a stranger's page. Rows with no
 * art overlap in either direction (the stale photo case) are left untouched.
 * Nothing is written to Shopify or Etsy; rerun the video sync and
 * scripts/build-etsy-reviews.mjs afterwards.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MCP_DIST = path.resolve(ROOT, '../sws-etsy-mcp/dist');
const OUT = path.join(ROOT, 'data/etsy-mapping-audit.json');
const asJson = process.argv.includes('--json');

const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1).replace(/^["']|["']$/g, '')];
    }),
);

/** Pull the numeric Etsy CDN id out of any il_fullxfull filename. */
const CDN_ID = /il_(?:fullxfull|\d+x\d+)\.(\d+)_/g;
function idsFrom(text) {
  const out = new Set();
  if (!text) return out;
  for (const m of String(text).matchAll(CDN_ID)) out.add(m[1]);
  return out;
}

// ---- Etsy side -------------------------------------------------------------
const {getAll} = await import(pathToFileURL(path.join(MCP_DIST, 'client.js')));
const {resolveShopId} = await import(pathToFileURL(path.join(MCP_DIST, 'api.js')));

const shopId = await resolveShopId();
const etsyRaw = await getAll(
  `/v3/application/shops/${shopId}/listings`,
  {state: 'active', includes: 'Images'},
  {pageSize: 50},
);

/** listing_id -> {title, ids:Set} for every ACTIVE listing, images included. */
const etsy = new Map();
for (const l of etsyRaw) {
  const ids = new Set();
  for (const img of l.images ?? []) {
    for (const id of idsFrom(img.url_fullxfull ?? img.url_570xN ?? '')) ids.add(id);
  }
  etsy.set(String(l.listing_id), {title: l.title, ids});
}

/** Reverse index: CDN id -> the listing(s) currently serving it. */
const byImageId = new Map();
for (const [lid, row] of etsy) {
  for (const id of row.ids) {
    if (!byImageId.has(id)) byImageId.set(id, new Set());
    byImageId.get(id).add(lid);
  }
}

// ---- Shopify side ----------------------------------------------------------
const QUERY = `query MappingAudit($after: String) {
  products(first: 100, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      handle
      title
      images(first: 25) { nodes { url } }
      media(first: 25) { nodes { __typename } }
    }
  }
}`;

async function storefront(after) {
  const res = await fetch(
    `https://${env.PUBLIC_STORE_DOMAIN}/api/2025-07/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
      },
      body: JSON.stringify({query: QUERY, variables: {after}}),
    },
  );
  const json = await res.json();
  if (json.errors) {
    console.error(JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }
  return json.data.products;
}

const products = new Map();
for (let after = null; ; ) {
  const page = await storefront(after);
  for (const p of page.nodes) {
    const ids = new Set();
    for (const img of p.images?.nodes ?? []) {
      for (const id of idsFrom(img.url)) ids.add(id);
    }
    products.set(p.id, {
      handle: p.handle,
      title: p.title,
      ids,
      hasVideo: (p.media?.nodes ?? []).some((m) => m.__typename === 'Video'),
    });
  }
  if (!page.pageInfo.hasNextPage) break;
  after = page.pageInfo.endCursor;
}

// Raw id sets are dumped outside the repo so follow up analysis (which
// listing does an unmapped product actually belong to) can run without
// hitting either API again.
fs.writeFileSync(
  '/tmp/etsy-mapping-cache.json',
  JSON.stringify({
    etsy: [...etsy].map(([lid, r]) => ({lid, title: r.title, ids: [...r.ids]})),
    products: [...products].map(([id, r]) => ({
      id,
      handle: r.handle,
      title: r.title,
      ids: [...r.ids],
      hasVideo: r.hasVideo,
    })),
  }),
);

// ---- Compare ---------------------------------------------------------------
const map = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/etsy-video-map.json'), 'utf8'));
const results = [];

for (const row of map.rows) {
  if (!row.shopify_product_id) continue;
  const lid = String(row.etsy_listing_id);
  const prod = products.get(row.shopify_product_id);
  const listing = etsy.get(lid);

  if (!prod) {
    results.push({lid, handle: row.handle, verdict: 'product_not_on_storefront'});
    continue;
  }
  if (!listing) {
    results.push({lid, handle: prod.handle, verdict: 'listing_not_active_on_etsy'});
    continue;
  }

  const overlap = [...prod.ids].filter((id) => listing.ids.has(id));
  if (overlap.length) {
    results.push({
      lid,
      handle: prod.handle,
      verdict: 'confirmed',
      overlap: overlap.length,
    });
    continue;
  }

  // No self overlap. Does some OTHER active listing currently serve this
  // product's art? That, and only that, proves a mispairing.
  const claims = new Map();
  for (const id of prod.ids) {
    for (const other of byImageId.get(id) ?? []) {
      if (other === lid) continue;
      claims.set(other, (claims.get(other) ?? 0) + 1);
    }
  }
  const ranked = [...claims.entries()].sort((a, b) => b[1] - a[1]);
  results.push({
    lid,
    handle: prod.handle,
    shopify_title: prod.title,
    etsy_title: listing.title,
    verdict: ranked.length ? 'mispaired' : 'stale_photos',
    claimed_by: ranked.map(([other, n]) => ({
      listing_id: other,
      matches: n,
      title: etsy.get(other)?.title,
    })),
    shopify_image_ids: [...prod.ids].slice(0, 6),
    etsy_image_ids: [...listing.ids].slice(0, 6),
    confidence: row.confidence,
  });
}

// ---- Proven pairing --------------------------------------------------------
// A listing is proven to belong to a product when that product, and no other,
// currently serves the listing's images. Ambiguous listings (more than one
// matching product, which means duplicate Shopify products) are reported and
// never applied.
const proven = [];
const ambiguous = [];
for (const [lid, listing] of etsy) {
  const hits = [];
  for (const [pid, prod] of products) {
    const n = [...prod.ids].filter((id) => listing.ids.has(id)).length;
    if (n > 0) hits.push({pid, prod, n});
  }
  if (hits.length === 1) proven.push({lid, listing, ...hits[0]});
  else if (hits.length > 1) ambiguous.push({lid, title: listing.title, hits: hits.length});
}

const changes = {corrected: [], added: [], unmapped: [], ambiguous};
if (process.argv.includes('--apply')) {
  const rowByLid = new Map(map.rows.map((r) => [String(r.etsy_listing_id), r]));
  // Snapshot the starting state. A row can be unmapped by one proven pair and
  // then mapped by its own a few iterations later, so classifying a change
  // against the live object would report the same row as both.
  const before = new Map(
    map.rows.map((r) => [String(r.etsy_listing_id), r.shopify_product_id]),
  );
  const today = new Date().toISOString().slice(0, 10);

  for (const {lid, prod, pid, n} of proven) {
    const row = rowByLid.get(lid);
    if (!row) continue; // every active listing already has a row
    if (row.shopify_product_id === pid) continue;

    // Whoever else claims this product is disproven by the same evidence.
    for (const other of map.rows) {
      if (other === row || other.shopify_product_id !== pid) continue;
      changes.unmapped.push({
        lid: String(other.etsy_listing_id),
        was: prod.handle,
        reason: `art proves ${prod.handle} is Etsy ${lid}`,
      });
      other.shopify_product_id = null;
      other.handle = null;
      other.shopify_title = null;
      other.confidence = 'reviewed_none';
      other.state = 'unmatched';
      other.note = `Unmapped ${today}: its Shopify product serves Etsy ${lid}'s current images, so this listing's true product is not established. Left unmapped rather than guessed.`;
    }

    const bucket = before.get(lid) ? changes.corrected : changes.added;
    bucket.push({lid, to: prod.handle, matches: n});
    row.shopify_product_id = pid;
    row.handle = prod.handle;
    row.shopify_title = prod.title;
    row.confidence = 'image_verified';
    row.score = null;
    row.note = `Paired ${today} by image identity: ${n} Etsy CDN image ids on this listing are the same ids Shopify serves for ${prod.handle}.`;
    if (row.state === 'unmatched') {
      // 'todo' is the vocabulary scripts/sync-etsy-videos.mjs uses for a row
      // that still needs its clip attached; its `pending` command filters on it.
      row.state = prod.hasVideo || !row.video_url ? 'done' : 'todo';
    }
  }

  map.generated_at = new Date().toISOString();
  fs.writeFileSync(
    path.join(ROOT, 'data/etsy-video-map.json'),
    JSON.stringify(map, null, 2) + '\n',
  );
}

const counts = results.reduce((acc, r) => {
  acc[r.verdict] = (acc[r.verdict] ?? 0) + 1;
  return acc;
}, {});

fs.writeFileSync(
  OUT,
  JSON.stringify(
    {generated_at: new Date().toISOString(), counts, results},
    null,
    2,
  ) + '\n',
);

if (asJson) {
  console.log(JSON.stringify({counts, results}, null, 2));
  process.exit(0);
}

console.log(`Etsy active listings with images: ${etsy.size}`);
console.log(`Storefront products: ${products.size}`);
console.log(`Mapped rows audited: ${results.length}`);
console.log(counts);
console.log(`\nWrote ${path.relative(ROOT, OUT)}`);
console.log(
  `Image proven listing to product pairs: ${proven.length}` +
    (ambiguous.length ? `, ambiguous (duplicate products): ${ambiguous.length}` : ''),
);
for (const a of ambiguous) console.log(`  AMBIGUOUS ${a.lid} matches ${a.hits} products`);
if (process.argv.includes('--apply')) {
  console.log(
    `\nApplied to data/etsy-video-map.json: ${changes.corrected.length} corrected, ` +
      `${changes.added.length} newly mapped, ${changes.unmapped.length} unmapped.`,
  );
  for (const ch of changes.corrected) console.log(`  CORRECT ${ch.lid} -> ${ch.to}`);
  for (const ch of changes.added) console.log(`  MAP     ${ch.lid} -> ${ch.to}`);
  for (const ch of changes.unmapped) {
    const remapped = changes.corrected.concat(changes.added).some((c) => c.lid === ch.lid);
    if (!remapped) console.log(`  UNMAP   ${ch.lid} (was ${ch.was})`);
  }
  process.exit(0);
}

const bad = results.filter((r) => r.verdict === 'mispaired');
if (bad.length) {
  console.log('\nMISPAIRED:');
  for (const r of bad) {
    console.log(
      `  ${r.handle}\n    mapped to ${r.lid} (${r.etsy_title?.slice(0, 60)})` +
        `\n    art belongs to ${r.claimed_by
          .map((c) => `${c.listing_id} x${c.matches}`)
          .join(', ')}`,
    );
  }
  process.exit(1);
}
