/**
 * Every platform a product page claims must be a platform that product's own
 * Etsy listing claims. This audits that, and emits the corrected values.
 *
 * Why it exists: Todd opened the Potion Bottle goal widget on 2026-09-14 and
 * said "I don't think this is multi-stream". He was right. The page claimed
 * Twitch, YouTube and Kick in its title, its H1, its SEO title and its badge
 * row. Etsy listing 1790033028 says "THIS ITEM IS FOR OBS/OBS STUDIO,
 * STREAMLABS, AND STREAMELEMENTS", names only Twitch, and ships two zips and
 * a manual setup PDF. No YouTube. No Kick.
 *
 * The leak is structural, not a typo. `ProductHighlights.jsx` reads
 * `parseWorksWith(metafield) || worksWithPlatforms(description)`, and 26
 * products have no metafield, so their badge row is parsed out of the
 * description's own "Works With" prose. When that prose is wrong the page
 * confirms its own error, and `app/lib/platforms.js` already documents that
 * substring matching cannot tell a claim from its denial.
 *
 * Ground truth is the Etsy listing, which is what docs/COPY-STANDARD.md
 * already names as authoritative. Rules:
 *
 * - **Twitch is the baseline.** Every one of the 186 active listings names
 *   Twitch or a Twitch-only concept (bits, subs), verified, so Twitch is
 *   never treated as an overclaim. Four listings use an older boilerplate
 *   that never says "Twitch" but does say "TYPES OF GOALS: DONATION FOLLOWER
 *   BITS SUPPORT", and bits are Twitch only.
 * - **YouTube, Kick and TikTok must be named** in that listing's own title or
 *   description. Only 29 of 186 listings name YouTube and 27 name Kick, so
 *   the Etsy side is honest and the inflation is Shopify side.
 * - **A goal widget never claims TikTok, even when its own Etsy listing does.**
 *   11 listings say "TikTok Studio", so trusting the listing would propagate
 *   the error rather than catch it. Verified 2026-09-14 at three levels: the
 *   shipped code is a StreamElements custom widget driven by `onWidgetLoad` /
 *   `onEventReceived` counting `tip`, `cheer`, `subscriber` and `follower`,
 *   with zero references to tiktok, youtube, kick, superchat or membership
 *   (unzipped 1728594513 and 1747633766); 30 of 30 listing manifests checked
 *   through `etsy_list_listing_files` ship only StreamElements/Streamlabs code
 *   zips plus a goal setup PDF, no TikTok artifact anywhere; and
 *   StreamElements has no TikTok integration, so no TikTok event can ever
 *   reach `onEventReceived`. The overlay would render in TikTok Studio as a
 *   browser source and then never fill.
 * - **Absence fails closed.** An unmapped product keeps Twitch plus whatever
 *   software its own copy names, and claims no extra chat platform. A missing
 *   badge costs a little scannability; a wrong one costs a refund and a one
 *   star review saying it does not work.
 *
 * Usage:
 *   node scripts/audit-platform-claims.mjs          write data/platform-claims.json
 *   node scripts/audit-platform-claims.mjs --check  report only, exit 1 on any overclaim
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const env = Object.fromEntries(
  fs.readFileSync(`${ROOT}/.env`, 'utf8').split('\n').filter(Boolean).map((line) => {
    const i = line.indexOf('=');
    return [line.slice(0, i), line.slice(i + 1).replace(/^["']|["']$/g, '')];
  }),
);

const CHAT = ['Twitch', 'YouTube', 'Kick', 'TikTok'];
const SOFTWARE = ['StreamElements', 'Streamlabs', 'OBS'];
const BASELINE = 'Twitch';
/** Twitch-only concepts. Their presence implies Twitch even when the word is absent. */
const TWITCH_ONLY = /\bbits\b|\bsub(s|scriber)?\b/i;

const word = (p) => new RegExp(p.replace(/([A-Z])/g, (m) => `[${m}${m.toLowerCase()}]`), 'i');
const names = (text, list) => list.filter((p) => word(p).test(text || ''));

/** Pull every active Etsy listing with its description, through the sibling MCP
 * package's own client so the OAuth refresh is the one already in use. Needs
 * ETSY_PACKAGE_ROOT, see this repo's CLAUDE.md. */
async function fetchEtsyListings() {
  const dist = path.resolve(ROOT, '../sws-etsy-mcp/dist');
  const {getAll} = await import(pathToFileURL(path.join(dist, 'client.js')));
  const {resolveShopId} = await import(pathToFileURL(path.join(dist, 'api.js')));
  const shopId = await resolveShopId();
  const rows = await getAll(`/v3/application/shops/${shopId}/listings`, {state: 'active'});
  return rows.map((l) => ({id: String(l.listing_id), title: l.title, description: l.description}));
}

async function fetchShopifyProducts() {
  const url = `https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`;
  const query = `query($c:String){products(first:100,after:$c){pageInfo{hasNextPage endCursor}
    nodes{id handle title productType descriptionHtml seo{title description}
    worksWith: metafield(namespace:"custom",key:"works_with"){value}}}}`;
  const all = [];
  let cursor = null;
  do {
    const res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN},
      body: JSON.stringify({query, variables: {c: cursor}}),
    });
    const body = await res.json();
    if (body.errors) throw new Error(JSON.stringify(body.errors));
    all.push(...body.data.products.nodes);
    cursor = body.data.products.pageInfo.hasNextPage ? body.data.products.pageInfo.endCursor : null;
  } while (cursor);
  return all;
}

/** The "Works With" block of a COPY-STANDARD description, which is what feeds
 * the badge row when no metafield exists. */
function worksWithBlock(html) {
  if (!html) return null;
  const start = html.search(/Works With/i);
  if (start === -1) return null;
  const rest = html.slice(start + 'Works With'.length);
  const end = rest.search(/(Setup|FAQ|What You Get|Why Choose|Our Policy|Description)/i);
  const block = end === -1 ? rest.slice(0, 600) : rest.slice(0, end);
  return {start, block};
}

const listings = Object.fromEntries((await fetchEtsyListings()).map((l) => [l.id, l]));
const products = await fetchShopifyProducts();
const mapRows = JSON.parse(fs.readFileSync(`${ROOT}/data/etsy-video-map.json`, 'utf8')).rows;
const byHandle = Object.fromEntries(mapRows.map((r) => [r.handle, r]));

const rows = [];
for (const product of products) {
  const mapped = byHandle[product.handle];
  const listing = mapped ? listings[String(mapped.etsy_listing_id)] : null;
  const source = listing ? `${listing.title} ${listing.description}` : '';

  // Truth. Twitch is the baseline; every other chat platform must be named.
  const truthChat = listing
    ? [...new Set([
        ...(names(source, [BASELINE]).length || TWITCH_ONLY.test(source) ? [BASELINE] : []),
        ...names(source, CHAT.filter((p) => p !== BASELINE)),
      ])]
    : [BASELINE];
  const truthSoftware = listing ? names(source, SOFTWARE) : names(product.descriptionHtml, SOFTWARE);
  // See the TikTok rule in this file's header. A goal widget reads no chat and
  // receives no TikTok event, so the claim comes out even when the listing
  // makes it. Those listings are reported separately so Etsy can be corrected.
  const tiktokOnListingOnly = product.productType === 'Goal Widget' && truthChat.includes('TikTok');
  const chatTruth = tiktokOnListingOnly ? truthChat.filter((p) => p !== 'TikTok') : truthChat;
  const truth = [...CHAT.filter((p) => chatTruth.includes(p)), ...SOFTWARE.filter((p) => truthSoftware.includes(p))];

  // What the page claims today, per surface. Twitch is excluded from the
  // overclaim test everywhere, it is the baseline and always true here.
  const testable = CHAT.filter((p) => p !== BASELINE);
  const block = worksWithBlock(product.descriptionHtml);
  const current = {
    title: names(product.title, testable),
    seoTitle: names(product.seo?.title, testable),
    seoDescription: names(product.seo?.description, testable),
    badges: block ? names(block.block, testable) : [],
    metafield: (() => {
      try {
        const parsed = JSON.parse(product.worksWith?.value || 'null');
        return Array.isArray(parsed) ? parsed.filter((p) => testable.some((t) => t.toLowerCase() === p.toLowerCase())) : [];
      } catch { return []; }
    })(),
  };

  const over = {};
  for (const [surface, claimed] of Object.entries(current)) {
    const bad = claimed.filter((p) => !truth.some((t) => t.toLowerCase() === p.toLowerCase()));
    if (bad.length) over[surface] = bad;
  }

  rows.push({
    id: product.id, handle: product.handle, title: product.title, productType: product.productType,
    etsyListingId: mapped ? String(mapped.etsy_listing_id) : null,
    mapConfidence: mapped ? mapped.confidence : null,
    truth, current, over,
    etsyAlsoClaimsTikTok: tiktokOnListingOnly,
    hasOverclaim: Object.keys(over).length > 0,
    hasMetafield: Boolean(product.worksWith?.value),
    hasWorksWithBlock: Boolean(block),
  });
}

const mapped = rows.filter((r) => r.etsyListingId);
const over = rows.filter((r) => r.hasOverclaim);
console.log(`${rows.length} storefront products, ${mapped.length} mapped to an Etsy listing`);
console.log(`${rows.filter((r) => !r.hasMetafield).length} have NO works_with metafield, so their badges are parsed from description prose`);
console.log(`${over.length} claim a platform their own Etsy listing does not`);
const bySurface = {};
const byPlatform = {};
for (const row of over) {
  for (const [surface, bad] of Object.entries(row.over)) {
    bySurface[surface] = (bySurface[surface] || 0) + 1;
    for (const p of bad) byPlatform[p] = (byPlatform[p] || 0) + 1;
  }
}
console.log('  by surface: ', JSON.stringify(bySurface));
console.log('  by platform:', JSON.stringify(byPlatform));
const etsyToo = rows.filter((r) => r.etsyAlsoClaimsTikTok);
if (etsyToo.length) {
  console.log(`${etsyToo.length} goal widgets whose ETSY listing also claims TikTok, so Etsy needs the same correction:`);
  for (const r of etsyToo) console.log(`  ${r.etsyListingId}  ${r.title.slice(0, 70)}`);
}

if (process.argv.includes('--check')) process.exit(over.length ? 1 : 0);
fs.writeFileSync(`${ROOT}/data/platform-claims.json`, `${JSON.stringify(rows, null, 2)}\n`);
console.log(`wrote data/platform-claims.json`);
