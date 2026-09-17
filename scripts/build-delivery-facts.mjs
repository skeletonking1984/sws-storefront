/**
 * Builds app/data/product-delivery.json: for every storefront-visible
 * product, what the buyer actually receives and in what file format.
 *
 * This exists because the PDP answer block (app/lib/answerBlock.js) has to
 * name the file format, and the one thing this repo has learned repeatedly
 * is that a product's own prose is not a source of truth about the product
 * (see CLAUDE.md on the works_with metafield, and on descriptions that
 * contradicted the refund policy on their own page). So the delivery facts
 * come from the Etsy file manifest for that listing, which is the same
 * source docs/COPY-STANDARD.md already names as authoritative, joined
 * through data/etsy-video-map.json.
 *
 * A handle with no proven manifest gets NO entry. The answer block then
 * omits the format clause rather than guessing one, and
 * scripts/audit-answer-blocks.mjs reports the gap. A missing format costs
 * a slightly weaker answer; an invented one costs a refund.
 *
 *   node scripts/build-delivery-facts.mjs           # from committed data
 *   node scripts/build-delivery-facts.mjs --fetch   # pull missing manifests
 *
 * `--fetch` needs the sibling sws-etsy-mcp client, same as
 * scripts/audit-etsy-mapping.mjs:
 *   ETSY_PACKAGE_ROOT=../sws-etsy-mcp node scripts/build-delivery-facts.mjs --fetch
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MCP_DIST = path.resolve(ROOT, '../sws-etsy-mcp/dist');
const MANIFEST = path.join(ROOT, 'data/etsy-listing-files.json');
const OUT = path.join(ROOT, 'app/data/product-delivery.json');
const doFetch = process.argv.includes('--fetch');

/**
 * Products with no Etsy listing at all, proven from the actual upload files
 * on this Mac instead. Only a path that exists on disk may be listed here,
 * and the check below fails the build if one goes missing, so this can
 * never quietly decay into a hardcoded claim.
 */
const DISK_PROOF = {
  'celestial-stream-kit': [
    'products/bundles/02-celestial-stream-kit/upload/Celestial-Stream-Kit.zip',
    'products/bundles/02-celestial-stream-kit/upload/Celestial-Stream-Kit-Decorations.zip',
  ],
};
const ORGS_ROOT = path.resolve(ROOT, '../..');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function storefrontHandles() {
  const env = Object.fromEntries(
    fs
      .readFileSync(path.join(ROOT, '.env'), 'utf8')
      .split('\n')
      .filter((l) => l.includes('='))
      .map((line) => {
        const i = line.indexOf('=');
        return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
      }),
  );
  const query = `query($after:String){products(first:100, after:$after){pageInfo{hasNextPage endCursor} nodes{handle}}}`;
  let after = null;
  const handles = [];
  do {
    const res = await fetch(`https://${env.PUBLIC_STORE_DOMAIN}/api/2025-04/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
      },
      body: JSON.stringify({query, variables: {after}}),
    });
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors));
    const page = json.data.products;
    handles.push(...page.nodes.map((n) => n.handle));
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  return handles;
}

/**
 * Collapses a file list into the two facts the answer block needs: how many
 * archives, and whether a setup document ships with them. Deliberately not
 * the filenames: a filename is a detail a buyer cannot check before paying,
 * and a mispaired map row would put another product's filenames on the page
 * while the counts stay right (every one of the 117 measured manifests
 * ships at least one zip).
 */
function summarize(files) {
  const ext = (f) => (f.filename.split('.').pop() || '').toLowerCase();
  const archives = files.filter((f) => ext(f) === 'zip');
  const docs = files.filter((f) => ['pdf', 'rtf', 'txt'].includes(ext(f)));
  if (!archives.length) return null;
  return {
    archives: archives.length,
    setupDoc: docs.length > 0 ? ext(docs[0]).toUpperCase() : null,
  };
}

const manifest = readJson(MANIFEST);
const byListing = new Map(
  manifest.results.listings.map((l) => [String(l.listing_id), l.files]),
);
const rows = readJson(path.join(ROOT, 'data/etsy-video-map.json')).rows;
const handleToListing = new Map();
for (const row of rows) {
  if (row.handle) handleToListing.set(row.handle, String(row.etsy_listing_id));
}

const handles = await storefrontHandles();

if (doFetch) {
  const wanted = [
    ...new Set(
      handles
        .map((h) => handleToListing.get(h))
        .filter((id) => id && !byListing.has(id)),
    ),
  ];
  if (wanted.length) {
    const {listListingFiles} = await import(
      pathToFileURL(path.join(MCP_DIST, 'api.js'))
    );
    const fetched = await listListingFiles(wanted.map(Number));
    for (const listing of fetched.listings || []) {
      byListing.set(String(listing.listing_id), listing.files);
      manifest.results.listings.push(listing);
      if (!manifest.listing_ids_requested.includes(listing.listing_id)) {
        manifest.listing_ids_requested.push(listing.listing_id);
      }
    }
    manifest.results.count = manifest.results.listings.length;
    manifest.generated_at = new Date().toISOString();
    fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
    console.log(`fetched ${fetched.listings?.length ?? 0} manifests, wrote ${MANIFEST}`);
  } else {
    console.log('nothing missing to fetch');
  }
}

const out = {};
const unproven = [];
for (const handle of handles) {
  const diskFiles = DISK_PROOF[handle];
  if (diskFiles) {
    const missing = diskFiles.filter((p) => !fs.existsSync(path.join(ORGS_ROOT, p)));
    if (missing.length) {
      console.error(`FAIL: DISK_PROOF for ${handle} names files that do not exist:`);
      for (const m of missing) console.error(`  ${m}`);
      process.exit(1);
    }
    out[handle] = {
      archives: diskFiles.filter((p) => p.endsWith('.zip')).length,
      setupDoc: null,
      source: `disk:${diskFiles[0]}`,
    };
    continue;
  }
  const listingId = handleToListing.get(handle);
  const files = listingId ? byListing.get(listingId) : null;
  const summary = files ? summarize(files) : null;
  if (!summary) {
    unproven.push(handle);
    continue;
  }
  out[handle] = {...summary, source: `etsy:${listingId}`};
}

fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      note: 'Generated by scripts/build-delivery-facts.mjs. Do not hand edit.',
      products: out,
    },
    null,
    1,
  ) + '\n',
);

console.log(`storefront products: ${handles.length}`);
console.log(`delivery proven:     ${Object.keys(out).length}`);
console.log(`unproven (no entry): ${unproven.length}`);
for (const h of unproven) console.log(`  ${h}`);
