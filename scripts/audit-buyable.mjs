/**
 * Can a stranger actually buy this? Asked of every storefront product, and
 * answered by putting one in a real cart and following the real checkout URL.
 *
 * Why this exists, 2026-09-17. Todd: "test and make sure it works. all
 * products buyable now?" Nothing here could answer that. The existing checks
 * each look at one field: `audit-shipping` at `requiresShipping`,
 * `audit-catalog` at title and image, `audit-share-cards` at meta tags. A
 * product can pass all of them and still be unbuyable, which is exactly what
 * happened to eight products found this afternoon: three sat ARCHIVED and
 * five did not exist, while all eight were being advertised on X.
 *
 * The checks, in the order a buyer hits them:
 *
 *   1. The PDP answers 200 on the live domain. A product can be ACTIVE and
 *      still 404 if it is not published to the headless channels, which is
 *      the trap recorded in CLAUDE.md.
 *   2. The Storefront API returns it, with a variant id and a price above
 *      zero.
 *   3. `availableForSale` is true.
 *   4. `requiresShipping` is false. A shipping-flagged digital product hard
 *      blocks every buyer outside the delivery zones and is invisible until
 *      the checkout page.
 *   5. A REAL cart is created through the Storefront API, and the
 *      `checkoutUrl` it returns is checked for existence and for being on the
 *      checkout host. This is the only step that exercises the whole path
 *      rather than a field, and it is the one that would have caught the
 *      shipping bug on 2026-09-07 rather than two days later.
 *
 * The check does NOT fetch the checkout URL, and that is deliberate.
 * Shopify's bot protection answers **403 to every scripted request** on the
 * checkout domain, whatever User-Agent is sent. The first version of this
 * file followed the URL and reported all 122 products as having a broken
 * checkout, at a moment when a real customer had bought twelve hours earlier.
 * Verified in a real browser on 2026-09-17: the same cart URL loads a
 * complete checkout, $16.49, a payment step, and NO shipping step. A uniform
 * failure across an entire catalogue is nearly always the instrument, not the
 * subject. `--follow-checkout` re-enables the fetch for a human reading the
 * output, and its 403s should be read as "not measurable from here".
 *
 * What it CANNOT check, and nothing here can: whether a downloadable file is
 * attached. The Digital Products connector refuses to authorize from an agent
 * session, so "buyable" here means the money can be taken. Whether the buyer
 * then receives anything is a separate question, tracked per product in
 * docs/EIGHT-PRODUCTS-TO-ACTIVATE.md. That gap is stated rather than papered
 * over, because a green run that implies delivery works would be worse than
 * no run at all.
 *
 * Usage:
 *   node scripts/audit-buyable.mjs [--limit n] [--origin https://...] [--no-checkout]
 *   node scripts/audit-buyable.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

/**
 * The pure half: given what was observed for one product, what is wrong.
 * @param {{
 *   handle: string,
 *   pdpStatus: number | null,
 *   variantId: string | null,
 *   price: number | null,
 *   availableForSale: boolean | null,
 *   requiresShipping: boolean | null,
 *   checkoutStatus: number | null,
 *   checkoutUrl: string | null,
 * }} p
 */
export function auditBuyable(p) {
  const issues = [];
  const add = (what) => issues.push({handle: p.handle, what});

  if (p.pdpStatus !== null && p.pdpStatus !== 200) {
    add(`product page answers ${p.pdpStatus}, not 200`);
  }
  if (!p.variantId) {
    add('no purchasable variant on the Storefront API');
    return issues;
  }
  if (p.price === null || !(p.price > 0)) {
    add(`price is ${p.price}, so checkout would take nothing`);
  }
  if (p.availableForSale === false) add('variant is not available for sale');
  if (p.requiresShipping === true) {
    add('variant requires shipping, which blocks buyers outside the delivery zones');
  }
  if (p.checkoutUrl !== null && p.checkoutUrl === '') {
    add('cart was created but carries no checkout URL');
  }
  if (p.checkoutUrl && !/^https:\/\/[^/]*streamwidgetshop\.com\//.test(p.checkoutUrl)) {
    add(`checkout URL is on ${new URL(p.checkoutUrl).host}, not the shop domain`);
  }
  /* 403 is the bot wall, not a broken checkout. Only a status that means the
   * cart itself is gone counts. See the header. */
  if (p.checkoutStatus !== null && [404, 410, 500, 502, 503].includes(p.checkoutStatus)) {
    add(`checkout URL answers ${p.checkoutStatus}, the cart did not survive`);
  }
  return issues;
}

if (process.argv.includes('--self-test')) {
  const ok = {
    handle: 'x', pdpStatus: 200, variantId: 'gid://shopify/ProductVariant/1',
    price: 14.99, availableForSale: true, requiresShipping: false,
    checkoutStatus: 200, checkoutUrl: 'https://shop.streamwidgetshop.com/c/1',
  };
  const w = (o) => ({...ok, ...o});
  const cases = [
    ['a normal digital product passes', ok, 0],
    ['a 404 product page is caught', w({pdpStatus: 404}), 1],
    ['the 2026-09-07 bug: requiresShipping true', w({requiresShipping: true}), 1],
    ['a $0 product would take no money', w({price: 0}), 1],
    ['a sold out variant is caught', w({availableForSale: false}), 1],
    ['no variant at all is ONE clear finding, not a pile', w({variantId: null, price: null, availableForSale: null}), 1],
    ['a dead cart (500) is caught', w({checkoutStatus: 500}), 1],
    ['a 403 is the BOT WALL, not a finding: it passes', w({checkoutStatus: 403}), 0],
    ['a checkout URL on the wrong host is caught', w({checkoutUrl: 'https://evil.example/c/1'}), 1],
    ['the real shop.streamwidgetshop.com checkout host passes', w({checkoutUrl: 'https://shop.streamwidgetshop.com/cart/c/abc?key=1'}), 0],
    ['a cart with no checkout URL is caught', w({checkoutUrl: ''}), 1],
    ['unchecked fields (null) are not treated as failures', w({pdpStatus: null, checkoutStatus: null, checkoutUrl: null}), 0],
    ['a product can fail more than one way at once', w({pdpStatus: 404, requiresShipping: true}), 2],
  ];
  let pass = 0;
  for (const [name, input, expected] of cases) {
    const got = auditBuyable(input).length;
    const good = got === expected;
    if (good) pass++;
    console.log(`${good ? 'pass' : 'FAIL'}  ${name}  (expected ${expected}, got ${got})`);
  }
  console.log(`\n${pass}/${cases.length} self-test cases pass.`);
  process.exit(pass === cases.length ? 0 : 1);
}

const env = Object.fromEntries(
  fs
    .readFileSync(`${ROOT}/.env`, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [
      l.slice(0, l.indexOf('=')).trim(),
      l.slice(l.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, ''),
    ]),
);

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const ORIGIN = arg('--origin', 'https://streamwidgetshop.com');
const LIMIT = Number(arg('--limit', 0)) || Infinity;
const DO_CHECKOUT = !process.argv.includes('--no-checkout');
// Off by default: see the header, a scripted fetch always gets 403.
const FOLLOW_CHECKOUT = process.argv.includes('--follow-checkout');
const API = `https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`;

async function sf(query, variables) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
    },
    body: JSON.stringify({query, variables}),
  });
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
}

const PRODUCTS = `query($c:String){products(first:100,after:$c){pageInfo{hasNextPage endCursor}
  nodes{ handle title
    variants(first:1){nodes{ id availableForSale requiresShipping price{amount} }}
  }}}`;

const all = [];
let cursor = null;
do {
  const d = await sf(PRODUCTS, {c: cursor});
  all.push(...d.products.nodes);
  cursor = d.products.pageInfo.hasNextPage ? d.products.pageInfo.endCursor : null;
} while (cursor);

const sample = all.slice(0, LIMIT === Infinity ? all.length : LIMIT);
console.log(`Testing ${sample.length} storefront products on ${ORIGIN}.`);
console.log(
  DO_CHECKOUT
    ? 'Creating a REAL cart for each and checking the checkout URL it returns.\n'
    : 'Skipping the cart step.\n',
);

const CART = `mutation($lines:[CartLineInput!]!){cartCreate(input:{lines:$lines}){
  cart{ id checkoutUrl cost{totalAmount{amount}} }
  userErrors{ field message } }}`;

const issues = [];
let checked = 0;
for (const product of sample) {
  const v = product.variants.nodes[0];
  const row = {
    handle: product.handle,
    pdpStatus: null,
    variantId: v?.id ?? null,
    price: v ? Number(v.price.amount) : null,
    availableForSale: v?.availableForSale ?? null,
    requiresShipping: v?.requiresShipping ?? null,
    checkoutStatus: null,
    checkoutUrl: null,
  };

  const pdp = await fetch(`${ORIGIN}/products/${product.handle}`, {redirect: 'follow'});
  row.pdpStatus = pdp.status;

  if (DO_CHECKOUT && v?.id) {
    try {
      const d = await sf(CART, {lines: [{merchandiseId: v.id, quantity: 1}]});
      const errs = d.cartCreate.userErrors;
      if (errs?.length) {
        issues.push({handle: product.handle, what: `cart refused the line: ${errs.map((e) => e.message).join('; ')}`});
      } else {
        row.checkoutUrl = d.cartCreate.cart?.checkoutUrl ?? '';
        if (row.checkoutUrl && FOLLOW_CHECKOUT) {
          const co = await fetch(row.checkoutUrl, {redirect: 'follow'});
          row.checkoutStatus = co.status;
        }
      }
    } catch (err) {
      issues.push({handle: product.handle, what: `cart creation threw: ${err.message}`});
    }
  }

  const found = auditBuyable(row);
  issues.push(...found);
  checked++;
  if (found.length) {
    console.log(`  FAIL  ${product.handle}`);
    for (const f of found) console.log(`        ${f.what}`);
  } else if (checked % 25 === 0) {
    console.log(`  ok    ${checked}/${sample.length} ...`);
  }
}

console.log(`\n${checked} product(s) tested, ${issues.length} issue(s).`);
console.log(
  'NOT CHECKED, and not checkable from here: whether each product has its\n' +
    'downloadable file attached. The Digital Products connector refuses to\n' +
    'authorize from an agent session. "Buyable" above means the money can be\n' +
    'taken, not that a file is delivered.',
);
if (issues.length) {
  console.log('');
  for (const i of issues) console.log(`  ${i.handle}\n    ${i.what}`);
}
process.exit(issues.length ? 1 : 0);
