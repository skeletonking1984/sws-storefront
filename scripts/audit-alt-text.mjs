/**
 * Audit: no product image on this storefront renders without alt text.
 *
 * Every image in this catalogue carried an empty alt until 2026-09-19.
 * Measured on the live Boba Drink PDP that morning: 31 of 55 <img> tags had
 * alt="". Twelve were Twitter's own adsct pixels and six were platform icons
 * correctly marked aria-hidden, so the page's real defect was its gallery,
 * and the gallery was empty because the DATA was empty: 676 of 918 media
 * nodes had no alt in Shopify.
 *
 * Four things are checked, and each one is a finding this catalogue has
 * actually produced:
 *
 *   empty      an image with no alt at all. Google Images indexes the
 *              featured image's alt, the Merchant Center feed carries it and
 *              every collection card renders it.
 *   filename   "HalloweenMashroomSpookySlideGoalWidgetCode.zip" style alt.
 *              Worse than empty, because it looks filled in.
 *   uniform    the same alt on all nine of a product's images. Named in
 *              LAUNCH.md as its own finding, so "fix the empties by stamping
 *              the title everywhere" is not a fix.
 *   dashes     em or en dashes, which are banned in all SWS copy.
 *
 * The house generator is scripts/build-alt-text.mjs. This file does not call
 * it: a check that runs the generator and then compares against the
 * generator's own output can only ever agree with itself. It asks the live
 * catalogue the four questions above and nothing else, so a human's wording
 * typed into Admin passes exactly like a generated one.
 *
 * Usage:
 *   node scripts/audit-alt-text.mjs              exit 1 on any finding
 *   node scripts/audit-alt-text.mjs --json       machine readable, exit 0
 *   node scripts/audit-alt-text.mjs --self-test  feed it known-bad input
 */
import fs from 'node:fs';

/** Alt longer than this is cut off by screen readers and ignored by search. */
const MAX_ALT = 125;

/** Looks like a file, not a description. */
const FILENAME_RE = /\.(jpe?g|png|webp|gif|zip|mp4|svg)\b/i;

/** Banned in every piece of SWS copy. */
const DASH_RE = /[—–]/;

/** Shopify's own placeholder, and the Hydrogen component default. */
const PLACEHOLDER = new Set(['product image', 'image', 'default title', 'photo']);

/**
 * Every finding for one product's media set.
 *
 * @param {{handle: string, media: Array<{alt: string | null | undefined, type: string}>}} product
 * @returns {Array<{handle: string, kind: string, detail: string}>}
 */
export function findingsFor(product) {
  const out = [];
  const media = product.media ?? [];
  const add = (kind, detail) => out.push({handle: product.handle, kind, detail});

  media.forEach((item, index) => {
    const alt = (item.alt ?? '').trim();
    if (!alt) {
      add('empty', `media ${index + 1} has no alt`);
      return;
    }
    if (FILENAME_RE.test(alt)) add('filename', `media ${index + 1}: "${alt}"`);
    if (DASH_RE.test(alt)) add('dashes', `media ${index + 1}: "${alt}"`);
    if (PLACEHOLDER.has(alt.toLowerCase())) {
      add('placeholder', `media ${index + 1}: "${alt}"`);
    }
    if (alt.length > MAX_ALT) {
      add('too long', `media ${index + 1}: ${alt.length} chars`);
    }
  });

  // Uniform alt across a whole gallery. One image cannot be uniform with
  // itself, and two identical images are a real product decision often
  // enough that the bar is three.
  const filled = media.map((m) => (m.alt ?? '').trim()).filter(Boolean);
  if (filled.length >= 3 && new Set(filled).size === 1) {
    add('uniform', `${filled.length} images all read "${filled[0]}"`);
  }

  return out;
}

const SELF_TEST_CASES = [
  {
    name: 'all good',
    product: {
      handle: 'ok',
      media: [
        {alt: 'Boba Drink Goal Widget, animated stream overlay for Twitch'},
        {alt: 'Boba Drink Goal Widget, preview 2 of 3'},
        {alt: 'Boba Drink Goal Widget, preview 3 of 3'},
      ],
    },
    expect: 0,
  },
  {name: 'empty alt', product: {handle: 'a', media: [{alt: ''}]}, expect: 1},
  {name: 'null alt', product: {handle: 'a', media: [{alt: null}]}, expect: 1},
  {
    name: 'whitespace only',
    product: {handle: 'a', media: [{alt: '   '}]},
    expect: 1,
  },
  {
    name: 'filename as alt',
    product: {handle: 'a', media: [{alt: 'il_fullxfull.5969201652.jpg'}]},
    expect: 1,
  },
  {
    name: 'em dash',
    product: {handle: 'a', media: [{alt: 'Boba Drink — goal widget'}]},
    expect: 1,
  },
  {
    name: 'en dash',
    product: {handle: 'a', media: [{alt: 'Boba Drink – goal widget'}]},
    expect: 1,
  },
  {
    name: 'placeholder',
    product: {handle: 'a', media: [{alt: 'Product Image'}]},
    expect: 1,
  },
  {
    name: 'over the length cap',
    product: {handle: 'a', media: [{alt: `x${'y'.repeat(MAX_ALT)}`}]},
    expect: 1,
  },
  {
    name: 'the title stamped on nine images',
    product: {
      handle: 'a',
      media: Array.from({length: 9}, () => ({alt: 'Rabbit Goal Widget'})),
    },
    expect: 1,
  },
  {
    name: 'two identical is not a uniform finding',
    product: {handle: 'a', media: [{alt: 'Rabbit'}, {alt: 'Rabbit'}]},
    expect: 0,
  },
  {
    name: 'a product with no media at all cannot fail',
    product: {handle: 'a', media: []},
    expect: 0,
  },
  {
    name: 'a human wording that matches no generator still passes',
    product: {
      handle: 'a',
      media: [
        {alt: 'A green frog fills with slime as tips come in'},
        {alt: 'The same frog at full, mid celebration'},
        {alt: 'Install screen showing the browser source URL'},
      ],
    },
    expect: 0,
  },
];

if (process.argv.includes('--self-test')) {
  let failed = 0;
  for (const testCase of SELF_TEST_CASES) {
    const got = findingsFor(testCase.product).length;
    const pass = testCase.expect === 0 ? got === 0 : got >= testCase.expect;
    if (!pass) {
      failed += 1;
      console.error(
        `FAIL ${testCase.name}: expected ${
          testCase.expect === 0 ? 'no findings' : 'at least 1 finding'
        }, got ${got}`,
      );
    }
  }
  console.log(
    failed
      ? `self-test: ${failed} of ${SELF_TEST_CASES.length} cases failed`
      : `self-test: ${SELF_TEST_CASES.length} cases pass`,
  );
  process.exit(failed ? 1 : 0);
}

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
  console.error('Missing PUBLIC_STORE_DOMAIN or PUBLIC_STOREFRONT_API_TOKEN');
  process.exit(1);
}

const QUERY = `#graphql
  query AltTextAudit($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        handle
        media(first: 30) {
          nodes {
            __typename
            ... on MediaImage { image { altText } }
            ... on Video { previewImage { altText } }
          }
        }
      }
    }
  }
`;

/**
 * @param {string | null} cursor
 */
async function page(cursor) {
  const res = await fetch(`https://${domain}/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({query: QUERY, variables: {cursor}}),
  });
  const json = await res.json();
  if (json.errors) {
    console.error(JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }
  return json.data.products;
}

const findings = [];
let products = 0;
let mediaCount = 0;
let cursor = null;
do {
  const chunk = await page(cursor);
  for (const node of chunk.nodes) {
    products += 1;
    const media = (node.media?.nodes ?? []).map((m) => ({
      type: m.__typename,
      alt:
        m.__typename === 'Video'
          ? m.previewImage?.altText
          : m.image?.altText,
    }));
    mediaCount += media.length;
    findings.push(...findingsFor({handle: node.handle, media}));
  }
  cursor = chunk.pageInfo.hasNextPage ? chunk.pageInfo.endCursor : null;
} while (cursor);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({products, mediaCount, findings}, null, 2));
  process.exit(0);
}

console.log(`${products} storefront products, ${mediaCount} media checked`);
if (!findings.length) {
  console.log('0 issues');
  process.exit(0);
}

const byKind = {};
for (const f of findings) (byKind[f.kind] ||= []).push(f);
for (const [kind, list] of Object.entries(byKind)) {
  console.log(`\n${kind}: ${list.length}`);
  for (const f of list.slice(0, 10)) console.log(`  ${f.handle}: ${f.detail}`);
  if (list.length > 10) console.log(`  ... and ${list.length - 10} more`);
}
console.log(`\n${findings.length} issue(s)`);
process.exit(1);
