/**
 * Audit: no storefront-visible product may require shipping.
 *
 * Every SWS product is a digital download. A variant whose inventory item has
 * requiresShipping = true turns checkout into a physical checkout: the buyer is
 * forced to enter a shipping address, and any buyer in a country outside the
 * shop's two delivery zones (US + 27 countries) is HARD BLOCKED with "no
 * shipping methods available". Nine products shipped that way until 2026-09-09.
 *
 * Products created through the Admin API default to requiresShipping = true, so
 * this regresses every time a product is created outside the Shopify Admin UI.
 * Run this after any catalog write.
 *
 * Usage: node scripts/audit-shipping.mjs
 * Exit 0 = clean, exit 1 = at least one product would force a shipping checkout.
 */
import fs from 'node:fs';

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

const QUERY = `query ShippingAudit($after: String) {
  products(first: 250, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      handle
      title
      variants(first: 10) { nodes { id title requiresShipping } }
    }
  }
}`;

async function storefront(variables) {
  const res = await fetch(`https://${domain}/api/2025-07/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({query: QUERY, variables}),
  });
  const json = await res.json();
  if (json.errors) {
    console.error(JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }
  return json.data.products;
}

let after = null;
let checked = 0;
const offenders = [];

do {
  const page = await storefront({after});
  for (const product of page.nodes) {
    checked += 1;
    for (const variant of product.variants.nodes) {
      if (variant.requiresShipping) {
        offenders.push(`${product.handle} (variant: ${variant.title})`);
      }
    }
  }
  after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
} while (after);

if (offenders.length === 0) {
  console.log(`OK: ${checked} storefront products, none require shipping.`);
  process.exit(0);
}

console.error(
  `FAIL: ${offenders.length} variant(s) across ${checked} storefront products require shipping.`,
);
console.error('These force a shipping checkout and block buyers outside the delivery zones.\n');
for (const offender of offenders) console.error(`  ${offender}`);
console.error(
  '\nFix in Admin (Product > Shipping > uncheck "This is a physical product"), or via' +
    '\nproductVariantsBulkUpdate with inventoryItem: { requiresShipping: false }.',
);
process.exit(1);
