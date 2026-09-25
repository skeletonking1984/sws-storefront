/**
 * Audit the Product JSON-LD on live product pages against what Google needs
 * for a merchant listing.
 *
 * Why this exists, 2026-09-17
 * ---------------------------
 * Search Console has flagged this markup three times now, each time a
 * different missing field, each time found by Todd opening Search Console
 * rather than by anything here:
 *
 *   2026-09-16  applicableCountry missing on 29 items
 *   2026-09-16  shippingDestination and deliveryTime missing on 29 items
 *   2026-09-15  returnMethod missing on 5 items
 *
 * Search Console is a lagging indicator: it reports on pages it has already
 * recrawled, so the gap between shipping a defect and hearing about it is
 * days to weeks. This turns that into something answerable in one command,
 * and makes "fix all of them" a list rather than a guess.
 *
 * The rule it encodes, which is the part worth keeping: a recommended field
 * is worth stating ONLY when it can be stated truthfully. `returnMethod` sat
 * empty for exactly that reason until KeepProduct turned up (see below).
 * Anything this reports as missing is either a real gap or a deliberate
 * omission that belongs in DELIBERATE below, with its reason.
 *
 * Usage:
 *   node scripts/audit-structured-data.mjs [--limit n] [--origin https://...]
 *   node scripts/audit-structured-data.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

const env = Object.fromEntries(
  fs
    .readFileSync(`${ROOT}/.env`, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [
      l.slice(0, l.indexOf('=')).trim(),
      l
        .slice(l.indexOf('=') + 1)
        .trim()
        .replace(/^['"]|['"]$/g, ''),
    ]),
);

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const ORIGIN = arg('--origin', 'https://streamwidgetshop.com');
const LIMIT = Number(arg('--limit', 8));

/**
 * Fields that are absent ON PURPOSE, each with the reason. Reported as notes,
 * never as failures, so the run can go green while still saying out loud what
 * is not there. Without this the audit would either nag forever or would have
 * to pretend these fields do not exist.
 */
const DELIBERATE = {
  'offers.priceValidUntil':
    'these listings have no fixed sale window, so any date would be invented',
  'offers.hasMerchantReturnPolicy.merchantReturnLink':
    'Google treats it as an ALTERNATIVE to applicableCountry plus returnPolicyCategory, ' +
    'so supplying it invites Google to follow the link and ignore the 30 day window',
  'offers.gtin':
    'digital widgets have no GTIN, and inventing one is worse than omitting it',
  'offers.hasMerchantReturnPolicy.returnFees':
    'the general fee field reads as covering change-of-mind returns, which the 2026-09-25 ' +
    'policy does not give; the fee is stated on itemDefectReturnFees instead',
  'offers.hasMerchantReturnPolicy.customerRemorseReturnFees':
    'no schema.org value means "change-of-mind returns not accepted"; every value would ' +
    'claim such returns exist',
};

/* Google's documented enums. `returnMethod` carries a fourth value Google
 * does not document but schema.org defines, and it is the only truthful one
 * for a download: KeepProduct, "the consumer can keep the product, even when
 * receiving a refund". Accepted here for that reason, with the physical three
 * accepted too. ReturnByMail on a digital item would clear the Search Console
 * warning and be a lie about the refund process. */
const ENUMS = {
  'offers.availability': [
    'https://schema.org/InStock',
    'https://schema.org/OutOfStock',
    'https://schema.org/PreOrder',
    'https://schema.org/BackOrder',
    'https://schema.org/SoldOut',
  ],
  'offers.itemCondition': [
    'https://schema.org/NewCondition',
    'https://schema.org/UsedCondition',
    'https://schema.org/RefurbishedCondition',
    'https://schema.org/DamagedCondition',
  ],
  'offers.hasMerchantReturnPolicy.returnPolicyCategory': [
    'https://schema.org/MerchantReturnFiniteReturnWindow',
    'https://schema.org/MerchantReturnNotPermitted',
    'https://schema.org/MerchantReturnUnlimitedWindow',
  ],
  'offers.hasMerchantReturnPolicy.returnMethod': [
    'https://schema.org/KeepProduct',
    'https://schema.org/ReturnAtKiosk',
    'https://schema.org/ReturnByMail',
    'https://schema.org/ReturnInStore',
  ],
  'offers.hasMerchantReturnPolicy.itemDefectReturnFees': [
    'https://schema.org/FreeReturn',
    'https://schema.org/ReturnFeesCustomerResponsibility',
    'https://schema.org/ReturnShippingFees',
  ],
  'offers.hasMerchantReturnPolicy.returnFees': [
    'https://schema.org/FreeReturn',
    'https://schema.org/ReturnFeesCustomerResponsibility',
    'https://schema.org/ReturnShippingFees',
  ],
  'offers.hasMerchantReturnPolicy.refundType': [
    'https://schema.org/ExchangeRefund',
    'https://schema.org/FullRefund',
    'https://schema.org/StoreCreditRefund',
  ],
};

/** Required: a missing one is a real Search Console error. */
const REQUIRED = [
  'name',
  'image',
  'offers.price',
  'offers.priceCurrency',
  'offers.availability',
  'offers.hasMerchantReturnPolicy.applicableCountry',
  'offers.hasMerchantReturnPolicy.returnPolicyCategory',
  'offers.shippingDetails.shippingRate',
  'offers.shippingDetails.shippingDestination',
];

/** Recommended: Search Console's "non-critical" warnings live here. */
const RECOMMENDED = [
  'description',
  'brand.name',
  'offers.url',
  'offers.itemCondition',
  'offers.hasMerchantReturnPolicy.merchantReturnDays',
  'offers.hasMerchantReturnPolicy.itemDefectReturnFees',
  'offers.hasMerchantReturnPolicy.returnMethod',
  'offers.hasMerchantReturnPolicy.refundType',
  'offers.shippingDetails.deliveryTime',
];

const at = (obj, dotted) =>
  dotted.split('.').reduce((node, key) => (node == null ? node : node[key]), obj);

const present = (value) =>
  value != null && value !== '' && !(Array.isArray(value) && value.length === 0);

/**
 * The pure half: given one parsed Product node, what is wrong with it.
 * @param {{handle: string, product: any}} input
 */
export function auditProduct({handle, product}) {
  const issues = [];
  const add = (severity, what) => issues.push({handle, severity, what});

  if (!product) {
    add('error', 'no Product JSON-LD on the page at all');
    return issues;
  }

  for (const field of REQUIRED) {
    if (!present(at(product, field))) add('error', `missing REQUIRED ${field}`);
  }
  for (const field of RECOMMENDED) {
    if (!present(at(product, field))) add('warning', `missing recommended ${field}`);
  }
  for (const [field, allowed] of Object.entries(ENUMS)) {
    const value = at(product, field);
    if (present(value) && !allowed.includes(value)) {
      add('error', `${field} is "${value}", not one of the allowed values`);
    }
  }

  // A finite return window that does not say how long is not a policy.
  const category = at(product, 'offers.hasMerchantReturnPolicy.returnPolicyCategory');
  const days = at(product, 'offers.hasMerchantReturnPolicy.merchantReturnDays');
  if (category === 'https://schema.org/MerchantReturnFiniteReturnWindow' && !present(days)) {
    add('error', 'returnPolicyCategory is a finite window but merchantReturnDays is missing');
  }

  /*
   * The structured data must not contradict the prose, which is the failure
   * this catalogue has already had twice: twelve product descriptions denied
   * refunds while this markup granted them, and before that the FAQ did.
   * Here the machine-readable halves have to agree with each other at least.
   */
  if (category === 'https://schema.org/MerchantReturnNotPermitted' && present(days)) {
    add('error', 'returns are marked not permitted yet a return window is given');
  }

  /*
   * Added 2026-09-25 with the refund policy that refunds only defects (broken
   * and unfixable, never arrived, not as described, double charge) and never a
   * change of mind. A general or customer-remorse FreeReturn advertises free
   * change-of-mind returns in Search, which is exactly what the policy refuses.
   * The markup carried a blanket returnFees FreeReturn until this date.
   */
  for (const field of ['returnFees', 'customerRemorseReturnFees']) {
    if (present(at(product, `offers.hasMerchantReturnPolicy.${field}`))) {
      add('error', `${field} is set, which claims change-of-mind returns the refund policy does not give; use itemDefectReturnFees`);
    }
  }

  return issues;
}

if (process.argv.includes('--self-test')) {
  const good = {
    name: 'A widget',
    description: 'A widget you can buy',
    image: ['https://cdn/x.jpg'],
    brand: {name: 'Stream Widget Shop'},
    offers: {
      price: '10.15',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
      url: 'https://streamwidgetshop.com/products/a',
      hasMerchantReturnPolicy: {
        applicableCountry: ['US'],
        returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
        merchantReturnDays: 30,
        itemDefectReturnFees: 'https://schema.org/FreeReturn',
        returnMethod: 'https://schema.org/KeepProduct',
        refundType: 'https://schema.org/FullRefund',
      },
      shippingDetails: {
        shippingRate: {value: '0', currency: 'USD'},
        shippingDestination: [{addressCountry: 'US'}],
        deliveryTime: {handlingTime: {minValue: 0}},
      },
    },
  };
  const clone = (mutate) => {
    const copy = JSON.parse(JSON.stringify(good));
    mutate(copy);
    return copy;
  };

  const cases = [
    ['the shipped markup passes clean', good, {errors: 0, warnings: 0}],
    [
      'the 2026-09-15 finding: returnMethod missing',
      clone((p) => delete p.offers.hasMerchantReturnPolicy.returnMethod),
      {errors: 0, warnings: 1},
    ],
    [
      'the 2026-09-16 finding: applicableCountry missing is an ERROR, not a warning',
      clone((p) => delete p.offers.hasMerchantReturnPolicy.applicableCountry),
      {errors: 1, warnings: 0},
    ],
    [
      'the other 2026-09-16 finding: shippingDestination and deliveryTime',
      clone((p) => {
        delete p.offers.shippingDetails.shippingDestination;
        delete p.offers.shippingDetails.deliveryTime;
      }),
      {errors: 1, warnings: 1},
    ],
    [
      'KeepProduct is accepted, it is the only truthful value for a download',
      good,
      {errors: 0, warnings: 0},
    ],
    [
      'a made-up returnMethod is caught rather than assumed fine',
      clone((p) => {
        p.offers.hasMerchantReturnPolicy.returnMethod = 'https://schema.org/ReturnByCarrierPigeon';
      }),
      {errors: 1, warnings: 0},
    ],
    [
      'a finite window with no day count is caught',
      clone((p) => delete p.offers.hasMerchantReturnPolicy.merchantReturnDays),
      {errors: 1, warnings: 1},
    ],
    [
      'returns not permitted AND a return window is a contradiction',
      clone((p) => {
        p.offers.hasMerchantReturnPolicy.returnPolicyCategory =
          'https://schema.org/MerchantReturnNotPermitted';
      }),
      {errors: 1, warnings: 0},
    ],
    [
      'the pre-2026-09-25 blanket returnFees FreeReturn is caught (claims free change-of-mind returns)',
      clone((p) => {
        p.offers.hasMerchantReturnPolicy.returnFees = 'https://schema.org/FreeReturn';
      }),
      {errors: 1, warnings: 0},
    ],
    [
      'the exact old live markup (returnFees, no itemDefectReturnFees) is an error plus a warning',
      clone((p) => {
        p.offers.hasMerchantReturnPolicy.returnFees = 'https://schema.org/FreeReturn';
        delete p.offers.hasMerchantReturnPolicy.itemDefectReturnFees;
      }),
      {errors: 1, warnings: 1},
    ],
    [
      'customerRemorseReturnFees of any value is caught',
      clone((p) => {
        p.offers.hasMerchantReturnPolicy.customerRemorseReturnFees =
          'https://schema.org/ReturnFeesCustomerResponsibility';
      }),
      {errors: 1, warnings: 0},
    ],
    [
      'no Product markup at all is one clear error, not a pile of them',
      null,
      {errors: 1, warnings: 0},
    ],
    [
      'an empty image array counts as missing, not as present',
      clone((p) => {
        p.image = [];
      }),
      {errors: 1, warnings: 0},
    ],
    [
      'a zero price is still present, 0 must not read as absent',
      clone((p) => {
        p.offers.price = '0';
      }),
      {errors: 0, warnings: 0},
    ],
  ];

  let pass = 0;
  for (const [name, product, expected] of cases) {
    const found = auditProduct({handle: 'x', product});
    const errors = found.filter((f) => f.severity === 'error').length;
    const warnings = found.filter((f) => f.severity === 'warning').length;
    const ok = errors === expected.errors && warnings === expected.warnings;
    if (ok) pass++;
    console.log(
      `${ok ? 'pass' : 'FAIL'}  ${name}` +
        (ok
          ? ''
          : `\n        expected ${expected.errors}e/${expected.warnings}w, got ${errors}e/${warnings}w` +
            `\n        ${found.map((f) => f.what).join('; ')}`),
    );
  }
  console.log(`\n${pass}/${cases.length} self-test cases pass.`);
  process.exit(pass === cases.length ? 0 : 1);
}

function productJsonLd(html) {
  const blocks = [...html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
  for (const [, raw] of blocks) {
    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      const found = nodes.find((n) => n?.['@type'] === 'Product');
      if (found) return found;
    } catch {
      /* a block that will not parse is reported by its absence */
    }
  }
  return null;
}

async function handles() {
  const res = await fetch(`https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
    },
    body: JSON.stringify({query: `query{products(first:250,sortKey:BEST_SELLING){nodes{handle}}}`}),
  });
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data.products.nodes.map((n) => n.handle);
}

const all = await handles();
const sample = all.slice(0, LIMIT);
console.log(`Checking Product structured data on ${sample.length} of ${all.length} pages, ${ORIGIN}.\n`);

const issues = [];
for (const handle of sample) {
  const html = await (await fetch(`${ORIGIN}/products/${handle}`)).text();
  const found = auditProduct({handle, product: productJsonLd(html)});
  issues.push(...found);
  const errors = found.filter((f) => f.severity === 'error').length;
  const warnings = found.filter((f) => f.severity === 'warning').length;
  console.log(`  ${errors ? 'FAIL' : warnings ? 'warn' : 'ok  '}  ${handle}  ${errors}e/${warnings}w`);
}

console.log('\nAbsent on purpose, not counted:');
for (const [field, why] of Object.entries(DELIBERATE)) {
  console.log(`  ${field}\n    ${why}`);
}

const errors = issues.filter((i) => i.severity === 'error');
const warnings = issues.filter((i) => i.severity === 'warning');
if (issues.length) {
  console.log(`\n${errors.length} error(s), ${warnings.length} warning(s):\n`);
  for (const i of issues) console.log(`  [${i.severity}] ${i.handle}\n    ${i.what}`);
}

if (!errors.length && !warnings.length) {
  console.log('\nEvery page carries every required and recommended field.');
}
process.exit(errors.length || warnings.length ? 1 : 0);
