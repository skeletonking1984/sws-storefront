/**
 * For every EARNING Etsy listing that has no row in data/etsy-video-map.json,
 * decide whether a Shopify product for it already exists.
 *
 * WHY NOT TITLE MATCHING. It was tried first and it is worthless here. Three
 * different Froggy multistream listings all "matched" the one generic
 * Multistream Chat Widget at 0.8 similarity, "Moon Star Chat Widget" matched
 * the ten-widget Celestial Stream Kit at 0.8, and "Rose Flower Chat" matched a
 * plants widget. CLAUDE.md already records that title similarity put four rows
 * wrong in the existing map, and two of those were sitting at confidence
 * `reviewed`. A bad row here is worse than no row: the map decides which demo
 * video and which customer reviews land on a product page.
 *
 * So this uses the same proof audit-etsy-mapping.mjs uses. Shopify keeps the
 * original Etsy filename behind a hash prefix, so both sides expose the same
 * numeric CDN id out of `il_fullxfull.<ID>_xxxx.jpg`. A shared id is evidence.
 * A shared title is a coincidence.
 *
 * Three outcomes per listing:
 *   EXISTS    one storefront product serves this listing's image ids. It only
 *             needs a map row; nothing has to be created.
 *   AMBIGUOUS more than one product shares ids. Never guessed, always reported.
 *   ABSENT    no product serves any of them. Either it is genuinely not on
 *             Shopify, or its Etsy photos were refreshed after the import, which
 *             is the benign STALE case audit-etsy-mapping.mjs documents. This
 *             script cannot tell those apart and does not pretend to.
 *
 * Writes nothing. Read only against Etsy and the Storefront API.
 *
 * Usage:
 *   ETSY_PACKAGE_ROOT=../sws-etsy-mcp node scripts/find-unmapped-products.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const MCP_DIST = path.resolve(process.env.ETSY_PACKAGE_ROOT || path.resolve(ROOT, '../sws-etsy-mcp'), 'dist');

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split('\n').filter((l) => l.includes('='))
    .map((line) => {const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1).replace(/^["']|["']$/g, '')];}),
);

const CDN_ID = /il_(?:fullxfull|\d+x\d+)\.(\d+)_/g;
const idsFrom = (text) => {
  const out = new Set();
  if (text) for (const m of String(text).matchAll(CDN_ID)) out.add(m[1]);
  return out;
};

/*
 * "Unmapped" means the row has a NULL handle, not that the row is missing.
 *
 * All 28 of these are present in etsy-video-map.json carrying
 * `handle: null, confidence: "reviewed_none"`, which is a previous pass saying
 * it looked and found no Shopify product. That is a conclusion, not a gap, and
 * it is exactly the thing worth re-testing against the image proof: the same
 * file's history records four rows that title similarity got wrong, two of them
 * sitting at confidence `reviewed`.
 *
 * Filtering on presence rather than on a null handle is why the first run of
 * this script reported zero targets out of 28.
 */
const mapRaw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/etsy-video-map.json'), 'utf8'));
const mapRows = Array.isArray(mapRaw) ? mapRaw : mapRaw.rows || Object.values(mapRaw);
const mapped = new Set(mapRows.filter((r) => r.handle).map((r) => String(r.etsy_listing_id)));

const rev = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/etsy-revenue-45d.json'), 'utf8'));
const earning = new Map(rev.products.map((p) => [String(p.listing_id), p]));

const cwd = process.cwd();
process.chdir(path.resolve(MCP_DIST, '..'));
const {getAll} = await import(pathToFileURL(path.join(MCP_DIST, 'client.js')));
const {resolveShopId} = await import(pathToFileURL(path.join(MCP_DIST, 'api.js')));
const shopId = await resolveShopId();
const listings = await getAll(
  `/v3/application/shops/${shopId}/listings`,
  {state: 'active', includes: 'Images'},
  {pageSize: 50},
);
process.chdir(cwd);

/** listing_id -> image ids, for the unmapped EARNING listings only. */
const targets = new Map();
for (const l of listings) {
  const id = String(l.listing_id);
  if (mapped.has(id) || !earning.has(id)) continue;
  const ids = new Set();
  for (const img of l.images ?? []) for (const x of idsFrom(img.url_fullxfull ?? img.url_570xN ?? '')) ids.add(x);
  targets.set(id, {title: l.title, ids, rev: earning.get(id).revenue, units: earning.get(id).units});
}

const QUERY = `query($after:String){products(first:100,after:$after){pageInfo{hasNextPage endCursor}nodes{handle title images(first:25){nodes{url}}}}}`;
const products = [];
for (let after = null; ; ) {
  const res = await fetch(`https://${env.PUBLIC_STORE_DOMAIN}/api/2025-07/graphql.json`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN},
    body: JSON.stringify({query: QUERY, variables: {after}}),
  });
  const json = await res.json();
  if (json.errors) {console.error(JSON.stringify(json.errors, null, 2)); process.exit(1);}
  for (const p of json.data.products.nodes) {
    const ids = new Set();
    for (const img of p.images.nodes) for (const x of idsFrom(img.url)) ids.add(x);
    products.push({handle: p.handle, title: p.title, ids});
  }
  if (!json.data.products.pageInfo.hasNextPage) break;
  after = json.data.products.pageInfo.endCursor;
}

const exists = [], ambiguous = [], absent = [];
for (const [id, t] of targets) {
  const hits = products
    .map((p) => {let n = 0; for (const x of t.ids) if (p.ids.has(x)) n++; return {p, n};})
    .filter((h) => h.n > 0)
    .sort((a, b) => b.n - a.n);
  const row = {id, ...t, ids: t.ids.size};
  if (hits.length === 1) exists.push({...row, handle: hits[0].p.handle, shared: hits[0].n});
  else if (hits.length > 1) ambiguous.push({...row, hits: hits.slice(0, 3).map((h) => `${h.p.handle}(${h.n})`)});
  else absent.push(row);
}

const money = (a) => a.reduce((s, x) => s + x.rev, 0).toFixed(2);
const line = (x) => `  $${String(x.rev).padStart(6)}  ${String(x.units).padStart(2)}u  ${x.title.slice(0, 50)}`;

console.log(`${targets.size} earning listings with no map row, checked against ${products.length} storefront products\n`);
console.log(`PROVEN, product exists and only needs a map row: ${exists.length}, $${money(exists)}`);
exists.sort((a, b) => b.rev - a.rev).forEach((x) => console.log(`${line(x)}\n            ${x.shared}/${x.ids} shared image ids -> ${x.handle}`));
console.log(`\nAMBIGUOUS, more than one product shares its art: ${ambiguous.length}, $${money(ambiguous)}`);
ambiguous.sort((a, b) => b.rev - a.rev).forEach((x) => console.log(`${line(x)}\n            ${x.hits.join('  ')}`));
console.log(`\nNO SHARED ART: ${absent.length}, $${money(absent)}`);
console.log('  Either genuinely absent from Shopify, or the Etsy photos were');
console.log('  refreshed after import (the benign STALE case). Not distinguishable here.');
absent.sort((a, b) => b.rev - a.rev).forEach((x) => console.log(line(x)));
