/**
 * Refreshes the homepage "Best sellers" data and prints the Admin GraphQL
 * procedure to sync the real `best-sellers` Shopify collection.
 *
 * WHAT THIS DOES.
 *
 * 1. Runs `scripts/build-top-sellers.mjs` (Etsy revenue, the shop's real
 *    sales signal, see that file for why BEST_SELLING is wrong here) to
 *    refresh `app/data/top-sellers.json`.
 * 2. Resolves each candidate handle against the live Storefront API (the
 *    same public token the site itself uses). A handle that does not
 *    resolve is not ACTIVE and published to this storefront's channel, so
 *    it is dropped rather than shown.
 * 3. Drops anything carrying the `do-not-use-ip` tag, or whose title/tags
 *    match IP_TERMS (app/lib/ipTerms.js -- the same list the product feed
 *    uses to keep Pokemon etc. off ad channels). Belt and suspenders: the
 *    tag is the intended signal, the term match catches a product that
 *    earns under a renamed title before it is tagged.
 * 4. Takes the top 8 survivors and writes `app/data/best-sellers.json`,
 *    which `app/routes/_index.jsx` reads directly for the homepage row.
 * 5. Prints the exact Admin GraphQL mutations to create/refresh a REAL
 *    Shopify collection at handle `best-sellers`, in the same rank order,
 *    published to Headless + SWS Storefront + Online Store. This script
 *    has no Admin API token (this repo's other write scripts don't either,
 *    see scripts/activate-products.mjs -- Admin writes go through an
 *    operator session with the Shopify Admin MCP/UI). It prints rather
 *    than executes, on purpose.
 *
 * Usage:
 *   node scripts/refresh-best-sellers.mjs [--days 45] [--skip-revenue-pull]
 *
 *   --skip-revenue-pull   reuse the existing app/data/top-sellers.json
 *                         instead of re-running the Etsy pull (faster,
 *                         useful when it was just refreshed).
 *
 * Weekly routine: this is the one command. It replaces running
 * build-top-sellers.mjs and best-sellers filtering as two separate steps.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {isIpRisky} from '../app/lib/productFeed.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const argv = process.argv.slice(2);
const days = Number(argv[argv.indexOf('--days') + 1]) || 45;
const SKIP_REVENUE_PULL = argv.includes('--skip-revenue-pull');

const TOP_SELLERS_PATH = path.join(ROOT, 'app/data/top-sellers.json');
const OUT = path.join(ROOT, 'app/data/best-sellers.json');
const KEEP = 8;

/**
 * How many candidates from top-sellers.json get checked against the
 * Storefront API before giving up. top-sellers.json keeps 12; a couple of
 * IP-tagged or drafted rows can appear in there, so check a few more than
 * KEEP to have enough survivors.
 */
const CANDIDATE_POOL = 16;

if (!SKIP_REVENUE_PULL) {
  console.log(`Running build-top-sellers.mjs --days ${days}...\n`);
  execFileSync(
    process.execPath,
    [path.join(ROOT, 'scripts/build-top-sellers.mjs'), '--days', String(days)],
    {
      cwd: ROOT,
      stdio: 'inherit',
      env: {
        ...process.env,
        ETSY_PACKAGE_ROOT:
          process.env.ETSY_PACKAGE_ROOT || path.resolve(ROOT, '../sws-etsy-mcp'),
      },
    },
  );
  console.log('');
} else {
  console.log('--skip-revenue-pull: reusing existing app/data/top-sellers.json\n');
}

const topSellers = JSON.parse(fs.readFileSync(TOP_SELLERS_PATH, 'utf8'));
const candidates = (topSellers.detail || []).slice(0, CANDIDATE_POOL);

if (!candidates.length) {
  console.error('app/data/top-sellers.json has no ranked rows, nothing to do.');
  process.exit(1);
}

// Same .env parse as scripts/audit-shipping.mjs and friends -- read at
// runtime, never printed, never committed.
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, '.env'), 'utf8')
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

const aliasQuery = `#graphql
  query BestSellerCandidates(${candidates.map((_, i) => `$h${i}: String!`).join(', ')}) {
    ${candidates
      .map((_, i) => `p${i}: product(handle: $h${i}) { id title handle tags }`)
      .join('\n    ')}
  }
`;

async function storefront(query, variables) {
  const res = await fetch(`https://${domain}/api/2025-07/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({query, variables}),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(`Storefront API error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

const variables = Object.fromEntries(candidates.map((c, i) => [`h${i}`, c.handle]));
const resolved = await storefront(aliasQuery, variables);

const survivors = [];
for (let i = 0; i < candidates.length; i++) {
  const product = resolved[`p${i}`];
  const candidate = candidates[i];
  if (!product) {
    console.log(`  DROP  ${candidate.handle}  (does not resolve: not active/published here)`);
    continue;
  }
  const tags = product.tags || [];
  if (tags.includes('do-not-use-ip')) {
    console.log(`  DROP  ${candidate.handle}  (tagged do-not-use-ip)`);
    continue;
  }
  if (isIpRisky({title: product.title, tags})) {
    console.log(`  DROP  ${candidate.handle}  (title/tags match IP_TERMS)`);
    continue;
  }
  survivors.push({...candidate, id: product.id, title: product.title});
  if (survivors.length >= KEEP) break;
}

if (survivors.length < KEEP) {
  console.log(
    `\nOnly ${survivors.length} of ${KEEP} survived filtering from a pool of ` +
      `${candidates.length}. Homepage padding (FAN_FAVORITE_HANDLES) covers the rest.`,
  );
}

const next = {
  generatedAt: new Date().toISOString(),
  window: topSellers.window,
  source:
    'app/data/top-sellers.json (Etsy revenue), resolved active via Storefront API, ' +
    'filtered for do-not-use-ip tag and IP_TERMS',
  handles: survivors.map((s) => s.handle),
  detail: survivors.map((s, i) => ({
    rank: i + 1,
    handle: s.handle,
    id: s.id,
    title: s.title,
    listing_id: s.listing_id,
    revenue: s.revenue,
    units: s.units,
  })),
};

fs.writeFileSync(OUT, `${JSON.stringify(next, null, 2)}\n`);

console.log(`\nBest sellers (top ${survivors.length}), window ${next.window.since} to ${next.window.until}:\n`);
console.log('rank  revenue    units  handle');
next.detail.forEach((row) => {
  console.log(
    `${String(row.rank).padStart(4)}  $${String(row.revenue).padStart(8)}  ${String(row.units).padStart(5)}  ${row.handle}`,
  );
});
console.log(`\nwrote ${path.relative(ROOT, OUT)}`);

// ---------------------------------------------------------------------------
// Admin GraphQL procedure. No Admin API token is reachable from this repo's
// scripts (see CLAUDE.md / scripts/activate-products.mjs -- every catalog
// write here goes through an operator session with the Shopify Admin MCP or
// the Admin UI). Printed, not executed.
// ---------------------------------------------------------------------------
const PUBLICATIONS = [
  ['Stream Widget Shop Headless', 'gid://shopify/Publication/201721348286'],
  ['SWS Storefront', 'gid://shopify/Publication/201722527934'],
  ['Online Store', 'gid://shopify/Publication/132110254270'],
];

console.log('\n' + '='.repeat(78));
console.log('ADMIN PROCEDURE (run via the Shopify Admin MCP or Admin UI GraphiQL --');
console.log('no token is reachable from this repo\'s scripts, see CLAUDE.md):');
console.log('='.repeat(78));

console.log(`
1. Does the "best-sellers" collection already exist? Check first:

   query { collectionByHandle(handle: "best-sellers") { id title } }

   If it returns null, create it:

   mutation {
     collectionCreate(input: {
       title: "Best Sellers"
       handle: "best-sellers"
       sortOrder: MANUAL
     }) {
       collection { id handle }
       userErrors { field message }
     }
   }

   If it already exists, reuse its id below and skip to step 2 -- do not
   create a second collection at the same handle.

2. Set membership to EXACTLY this ranked list (drop anything not in it,
   add anything missing). Replace <COLLECTION_ID> with the id from step 1.

   mutation {
     collectionAddProducts(
       id: "<COLLECTION_ID>"
       productIds: [
${survivors.map((s) => `         "${s.id}"`).join(',\n')}
       ]
     ) {
       collection { id }
       userErrors { field message }
     }
   }

   If the collection already had OTHER products in it (from a stale prior
   run), remove them first with collectionRemoveProducts using their ids.

3. Lock in the rank order (MANUAL sortOrder honours insertion order from
   collectionAddProducts, but reorder explicitly to be certain):

   mutation {
     collectionReorderProducts(
       id: "<COLLECTION_ID>"
       moves: [
${survivors.map((s, i) => `         {id: "${s.id}", newPosition: "${i}"}`).join(',\n')}
       ]
     ) {
       job { id }
       userErrors { field message }
     }
   }

4. Publish to every channel the homepage link needs to work from:
${PUBLICATIONS.map(
  ([name, id]) => `
   mutation {
     publishablePublish(
       id: "<COLLECTION_ID>"
       input: {publicationId: "${id}"}
     ) {
       userErrors { field message }
     }
   }
   # -> ${name}`,
).join('\n')}

5. Verify: /collections/best-sellers should 200 and list exactly these ${survivors.length}
   products in this order. The homepage row itself does NOT depend on this
   collection (it reads app/data/best-sellers.json directly, already
   updated above) -- this collection only backs the "Shop all" link and
   any other channel (Google/Meta) that wants a real collection to point
   at.
`);
