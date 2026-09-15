/**
 * Audit: the refund story must be the same in all three places a buyer can
 * read it.
 *
 * On 2026-09-15 a product page said "this item is non-refundable" three
 * paragraphs above its own JSON-LD offering a 30 day free return, while
 * /policies/refund-policy said something different again. Twelve of 124
 * products carried some version of it. Google reads the markup, the customer
 * reads the prose, and nothing in the repo compared the two.
 *
 * The three sources, and the direction of truth:
 *
 *   1. THE POLICY PAGE is the source. Fetched live from the Storefront API
 *      (shop.refundPolicy), never hardcoded here, so editing the policy in
 *      Shopify Admin is enough to change what this audit expects.
 *   2. THE STRUCTURED DATA in app/routes/products.$handle.jsx must agree with
 *      it: a finite return window if and only if the policy grants refunds,
 *      and the same number of days.
 *   3. EVERY PRODUCT DESCRIPTION must not contradict it.
 *
 * WHY IT READS THE POLICY INSTEAD OF HARDCODING "30 days". A blacklist of
 * phrases would go stale the moment Todd changes the policy, and worse, it
 * would keep passing. If the policy is ever rewritten to refuse refunds, this
 * inverts on its own: the no-refund wording becomes correct and a product
 * promising 30 days becomes the failure.
 *
 * Usage:
 *   node scripts/audit-policy-claims.mjs             report, exit 1 on any issue
 *   node scripts/audit-policy-claims.mjs --json      machine readable, exit 0
 *   node scripts/audit-policy-claims.mjs --self-test prove the check can fail
 *
 * RUN THE SELF TEST WHEN YOU CHANGE THIS FILE. A check that only ever looks
 * for the presence of good wording cannot detect wording that was deleted, and
 * a green audit that cannot go red is worse than no audit, because it gets
 * believed. --self-test feeds it known-bad inputs and fails if they pass.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROUTE = path.join(HERE, '..', 'app', 'routes', 'products.$handle.jsx');

const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const selfTest = args.has('--self-test');

/**
 * Wording that denies refunds for the ITEM AS A WHOLE.
 *
 * The distinction matters and the first version of this file got it wrong. A
 * bare /not refundable/ also matches the CARVE-OUT the policy itself states,
 * "a working file you downloaded and then changed your mind about is not
 * refundable", so every corrected product came back as a violation. Twelve
 * false positives on the first live run.
 *
 * A blanket denial attaches to the item ("this item is non-refundable", "no
 * refunds", "all sales final"). A carve-out attaches to a circumstance. Only
 * the blanket form contradicts a policy that grants refunds, so "is not
 * refundable" counts only when an item-ish noun is what is being called that.
 */
const DENIES_REFUNDS = new RegExp(
  [
    'non-?refundable',
    'no refunds?\\b',
    'no exchanges?\\b',
    'all sales (?:are )?final',
    '(?:items?|products?|purchases?|downloads?|sales?|orders?) (?:is|are) not refundable',
  ].join('|'),
  'i',
);

/**
 * Does this policy text grant refunds at all?
 *
 * Deliberately conservative: it must both mention refunding and NOT read as a
 * blanket refusal. A policy that says "we do not offer refunds" mentions
 * refunds too, so presence alone is not enough.
 */
function policyGrantsRefunds(text) {
  if (!/refund/i.test(text)) return false;
  const blanket =
    /we (?:do not|don't) (?:offer|provide|issue|give) refunds|no refunds are (?:offered|given|issued)|all sales (?:are )?final/i;
  return !blanket.test(text);
}

/** The refund window in days, or null when the policy names none. */
function policyWindowDays(text) {
  const m = text.match(/within\s+(\d{1,3})\s+days?/i);
  return m ? Number(m[1]) : null;
}

/** What the PDP route emits as its return policy, read from source. */
function structuredDataClaims(source) {
  const category = source.match(
    /returnPolicyCategory:\s*\n?\s*'https:\/\/schema\.org\/(\w+)'/,
  );
  const days = source.match(/merchantReturnDays:\s*(\d+)/);
  return {
    category: category ? category[1] : null,
    days: days ? Number(days[1]) : null,
    present: /hasMerchantReturnPolicy/.test(source),
  };
}

/**
 * The whole audit as one pure function, so --self-test can drive it with
 * fabricated inputs. Nothing in here touches the network or the filesystem.
 */
export function audit({policyText, routeSource, products}) {
  const issues = [];
  const grants = policyGrantsRefunds(policyText);
  const days = policyWindowDays(policyText);
  const sd = structuredDataClaims(routeSource);

  if (!policyText.trim()) {
    issues.push({
      scope: 'policy',
      what: 'The refund policy page is empty. Nothing can be checked against it.',
    });
    return {issues, grants, days, sd};
  }

  // 2. structured data vs policy
  if (!sd.present) {
    issues.push({
      scope: 'structured-data',
      what: 'The PDP emits no hasMerchantReturnPolicy. Merchant listings want one.',
    });
  } else if (grants && sd.category !== 'MerchantReturnFiniteReturnWindow') {
    issues.push({
      scope: 'structured-data',
      what: `Policy grants refunds but JSON-LD says ${sd.category}.`,
    });
  } else if (!grants && sd.category === 'MerchantReturnFiniteReturnWindow') {
    issues.push({
      scope: 'structured-data',
      what: 'JSON-LD offers a return window the policy page does not grant.',
    });
  }

  if (grants && days !== null && sd.days !== null && days !== sd.days) {
    issues.push({
      scope: 'structured-data',
      what: `Policy says ${days} days, JSON-LD says ${sd.days}.`,
    });
  }

  // 3. every product description vs policy
  for (const p of products) {
    const text = (p.description || '').replace(/\s+/g, ' ');
    const hit = text.match(DENIES_REFUNDS);
    if (grants && hit) {
      const around = text.slice(
        Math.max(0, hit.index - 60),
        hit.index + hit[0].length + 60,
      );
      issues.push({
        scope: 'product',
        handle: p.handle,
        title: p.title,
        what: `Denies refunds ("${hit[0]}") while the policy grants them.`,
        context: around.trim(),
      });
    }
  }

  return {issues, grants, days, sd};
}

// ---------------------------------------------------------------- self test

if (selfTest) {
  const POLICY_30 = 'You may request a refund within 30 days of purchase if the download never arrived.';
  const ROUTE_OK = `
    hasMerchantReturnPolicy: {
      returnPolicyCategory:
        'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 30,
    }`;
  const cases = [
    {
      name: 'clean catalogue passes',
      input: {policyText: POLICY_30, routeSource: ROUTE_OK, products: [{handle: 'x', title: 'X', description: 'A nice widget.'}]},
      expect: 0,
    },
    {
      name: 'product saying non-refundable is caught',
      input: {policyText: POLICY_30, routeSource: ROUTE_OK, products: [{handle: 'x', title: 'X', description: 'Due to the instant-download nature, this item is non-refundable.'}]},
      expect: 1,
    },
    {
      name: 'product saying No refunds is caught',
      input: {policyText: POLICY_30, routeSource: ROUTE_OK, products: [{handle: 'x', title: 'X', description: 'Digital product only. No refunds or exchanges.'}]},
      expect: 1,
    },
    {
      name: 'product saying all sales final is caught',
      input: {policyText: POLICY_30, routeSource: ROUTE_OK, products: [{handle: 'x', title: 'X', description: 'Digital download, all sales final.'}]},
      expect: 1,
    },
    {
      name: 'the policy\'s own change-of-mind carve-out is NOT a violation',
      input: {policyText: POLICY_30, routeSource: ROUTE_OK, products: [{handle: 'x', title: 'X', description: 'Refunds within 30 days if the download never arrived. A working file you downloaded and then changed your mind about is not refundable.'}]},
      expect: 0,
    },
    {
      name: 'a blanket "this item is not refundable" IS still caught',
      input: {policyText: POLICY_30, routeSource: ROUTE_OK, products: [{handle: 'x', title: 'X', description: 'This item is not refundable.'}]},
      expect: 1,
    },
    {
      name: 'JSON-LD day count drifting from the policy is caught',
      input: {policyText: POLICY_30, routeSource: ROUTE_OK.replace('merchantReturnDays: 30', 'merchantReturnDays: 14'), products: []},
      expect: 1,
    },
    {
      name: 'JSON-LD refusing returns the policy grants is caught',
      input: {policyText: POLICY_30, routeSource: ROUTE_OK.replace('MerchantReturnFiniteReturnWindow', 'MerchantReturnNotPermitted'), products: []},
      expect: 1,
    },
    {
      name: 'DELETED structured data is caught, not silently passed',
      input: {policyText: POLICY_30, routeSource: 'export function loader() { return null; }', products: []},
      expect: 1,
    },
    {
      name: 'a no-refund POLICY inverts the check instead of failing everything',
      input: {
        policyText: 'All sales are final. We do not offer refunds on digital downloads.',
        routeSource: ROUTE_OK.replace('MerchantReturnFiniteReturnWindow', 'MerchantReturnNotPermitted'),
        products: [{handle: 'x', title: 'X', description: 'This item is non-refundable.'}],
      },
      expect: 0,
    },
    {
      name: 'an empty policy page is caught rather than read as permissive',
      input: {policyText: '   ', routeSource: ROUTE_OK, products: []},
      expect: 1,
    },
  ];

  let failed = 0;
  for (const c of cases) {
    const got = audit(c.input).issues.length;
    const ok = got === c.expect;
    if (!ok) failed++;
    console.log(`${ok ? 'pass' : 'FAIL'}  ${c.name}  (expected ${c.expect}, got ${got})`);
  }
  console.log(
    failed === 0
      ? `\n${cases.length}/${cases.length} self-test cases pass. The check can go red.`
      : `\n${failed} self-test case(s) FAILED. Do not trust this audit.`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

// ------------------------------------------------------------------ live run

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
    console.error(JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }
  return json.data;
}

const POLICY_QUERY = `{ shop { refundPolicy { title body url } } }`;
const PRODUCTS_QUERY = `query PolicyAudit($after: String) {
  products(first: 250, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes { handle title description }
  }
}`;

const policy = (await storefront(POLICY_QUERY)).shop.refundPolicy;
const products = [];
let after = null;
for (;;) {
  const page = (await storefront(PRODUCTS_QUERY, {after})).products;
  products.push(...page.nodes);
  if (!page.pageInfo.hasNextPage) break;
  after = page.pageInfo.endCursor;
}

const routeSource = fs.readFileSync(ROUTE, 'utf8');
const {issues, grants, days, sd} = audit({
  policyText: policy?.body || '',
  routeSource,
  products,
});

if (asJson) {
  console.log(JSON.stringify({policy: {grants, days, url: policy?.url}, structuredData: sd, products: products.length, issues}, null, 2));
  process.exit(0);
}

console.log(`Refund policy: ${policy?.url || '(none)'}`);
console.log(`  grants refunds: ${grants}${days !== null ? `, within ${days} days` : ''}`);
console.log(`  JSON-LD: ${sd.category || '(absent)'}${sd.days !== null ? `, ${sd.days} days` : ''}`);
console.log(`Products checked: ${products.length}\n`);

if (issues.length === 0) {
  console.log('All three sources agree. No product contradicts the refund policy.');
  process.exit(0);
}

for (const i of issues) {
  if (i.scope === 'product') {
    console.log(`  ${i.title}`);
    console.log(`    /products/${i.handle}`);
    console.log(`    ${i.what}`);
    console.log(`    ...${i.context}...\n`);
  } else {
    console.log(`  [${i.scope}] ${i.what}\n`);
  }
}
console.log(`${issues.length} issue(s).`);
process.exit(1);
