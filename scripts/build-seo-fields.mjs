/**
 * Generate `seo.title` and `seo.description` for every storefront product
 * that is missing one or is over Google's rendered length.
 *
 * Why this exists: the PDP title tag was the product's raw catalog title,
 * which on this catalog is the Etsy title (median 122 characters of stuffed
 * platform names), plus " | Stream Widget Shop". Google renders about 60,
 * so the differentiator and the brand were both cut off. 78 products also
 * had no `seo.description` at all and therefore shared one identical
 * generic fallback line across 78 pages.
 *
 * The one rule that shapes everything here: **a platform is only ever named
 * from the `custom.works_with` metafield.** Titles and descriptions in this
 * catalog name YouTube, Kick and TikTok on products that do not support
 * them (measured 2026-09-10: 116 of 131 products carried at least one badge
 * their own copy contradicted; only 8 of 99 products with the metafield
 * actually list YouTube). Deriving meta copy from the title would have
 * published those false claims straight into Google's snippet. See
 * `worksWithPlatforms` in app/lib/platforms.js for the same lesson.
 *
 * This script only READS (the repo holds a read-only Storefront token). It
 * writes a proposal file; the Admin `productUpdate` calls are made
 * separately through the Admin API with the proposal as input.
 *
 * Usage:
 *   node scripts/build-seo-fields.mjs          write data/seo-proposed.json
 *   node scripts/build-seo-fields.mjs --check  report only, exit 1 if any
 *                                              product still needs fields
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

const TITLE_MAX = 60;
const DESC_MAX = 155;
const PLATFORM_WORDS = ['Twitch', 'YouTube', 'TikTok', 'Kick', 'OBS', 'Streamlabs', 'StreamElements'];
const CHAT = ['Twitch', 'YouTube', 'Kick', 'TikTok'];
const SOFT = ['StreamElements', 'Streamlabs', 'OBS'];
const ORDER = [...CHAT, ...SOFT];

/**
 * Everything after these markers is the Etsy keyword tail, not the product
 * name: "... is fully customisable for Twitch Streamlabs, TikTok Studio,
 * and Streamelements". Cuts are only taken past character 8 so a product
 * genuinely named "Boba | Goal" is not reduced to nothing.
 */
const CUTS = [/\s+is fully customisable/i, /\s*[|•]\s*/, /\s+[-–—]\s+/, /(?<=[a-z])-(?=[A-Z])/, /\s+for\s+/i, /,\s+/];

/** Benefit clauses exist only per product TYPE, where the benefit IS the
 * definition of the type. Anything narrower (what a goal counts, which chat
 * a widget reads) varies per product and is not knowable from catalog data. */
const BENEFIT = {
  'Goal Widget': ' Shows your goal progress live on stream.',
  'Chat Widget': ' Puts your live chat on stream.',
};
const TYPE_WORD = {
  'Goal Widget': 'goal widget',
  'Chat Widget': 'chat widget',
  'Overlay Pack': 'stream overlay pack',
  Bundle: 'stream widget bundle',
  Emotes: 'emote pack',
};

const PRODUCTS_QUERY = `
  query SeoAudit($cursor: String) {
    products(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        handle
        title
        productType
        seo { title description }
        worksWith: metafield(namespace: "custom", key: "works_with") { value }
      }
    }
  }
`;

async function fetchAllProducts() {
  const url = `https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`;
  const all = [];
  let cursor = null;
  do {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
      },
      body: JSON.stringify({query: PRODUCTS_QUERY, variables: {cursor}}),
    });
    const body = await response.json();
    if (body.errors) throw new Error(JSON.stringify(body.errors));
    all.push(...body.data.products.nodes);
    cursor = body.data.products.pageInfo.hasNextPage
      ? body.data.products.pageInfo.endCursor
      : null;
  } while (cursor);
  return all;
}

function productName(title) {
  let name = title;
  for (const cut of CUTS) {
    const i = name.search(cut);
    if (i > 8) name = name.slice(0, i);
  }
  return name.replace(/\s+/g, ' ').trim();
}

function worksWith(product) {
  try {
    const parsed = JSON.parse(product.worksWith?.value || 'null');
    return Array.isArray(parsed) && parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

/** Clamp on a word boundary and never leave a trailing separator. */
function clamp(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const space = cut.lastIndexOf(' ');
  return (space > 20 ? cut.slice(0, space) : cut.slice(0, max)).replace(/[,\s|-]+$/, '');
}

function readableList(items) {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

export function buildFields(product) {
  const currentTitle = product.seo?.title || '';
  const currentDescription = product.seo?.description || '';
  const needsTitle = !currentTitle || currentTitle.length > TITLE_MAX;
  const needsDescription = !currentDescription || currentDescription.length > DESC_MAX;
  if (!needsTitle && !needsDescription) return null;

  const name = productName(product.title);
  const confirmed = worksWith(product);
  const platforms = confirmed
    ? ORDER.filter((p) => confirmed.some((c) => c.toLowerCase() === p.toLowerCase()))
    : [];
  const chat = platforms.filter((p) => CHAT.includes(p));
  const software = platforms.filter((p) => SOFT.includes(p));
  const type = TYPE_WORD[product.productType] || 'stream widget';

  // Matches the convention already used by the 46 hand written seo titles:
  // "<Name> <Type> for <Platforms>", no shop name (the route no longer
  // appends one when seo.title is set).
  let title = name;
  if (chat.length) {
    const withPlatforms = `${name} for ${readableList(chat)}`;
    if (withPlatforms.length <= TITLE_MAX) title = withPlatforms;
  }
  title = clamp(title, TITLE_MAX);
  if (title.length < 15) title = clamp(product.title, TITLE_MAX);

  // Clauses are appended only if they fit WHOLE, so clamping can never leave
  // a description ending on a dangling "or".
  const where = chat.length ? ` for ${readableList(chat)}` : '';
  let description = `${name}: animated ${type}${where}.`;
  const clauses = [
    BENEFIT[product.productType] || '',
    ' Instant digital download.',
    software.length ? ` Set up through ${readableList(software)}.` : '',
  ];
  for (const clause of clauses) {
    if (clause && description.length + clause.length <= DESC_MAX) description += clause;
  }
  description = clamp(description, DESC_MAX);

  // Guard. A platform word already inside the product's own name is its
  // identity, not a new claim, so the check runs on the generated text with
  // the name removed. Anything left that works_with does not confirm is a
  // fabricated platform claim and must never ship.
  const allowed = new Set((confirmed || []).map((p) => p.toLowerCase()));
  const withoutName = (text) => text.split(name).join(' ');
  const violations = PLATFORM_WORDS.filter(
    (word) =>
      (new RegExp(word, 'i').test(withoutName(title)) ||
        new RegExp(word, 'i').test(withoutName(description))) &&
      !allowed.has(word.toLowerCase()),
  );

  return {
    id: product.id,
    handle: product.handle,
    productType: product.productType,
    catalogTitle: product.title,
    reason: !currentTitle && !currentDescription ? 'missing' : 'too-long',
    worksWith: confirmed,
    previous: {title: currentTitle, description: currentDescription},
    seoTitle: title,
    seoDescription: description,
    violations,
  };
}

const products = await fetchAllProducts();
const proposals = products.map(buildFields).filter(Boolean);
const violating = proposals.filter((p) => p.violations.length);
const dashed = proposals.filter((p) => /[—–]/.test(p.seoTitle + p.seoDescription));

console.log(`${products.length} storefront products`);
console.log(`${proposals.length} need seo fields written`);
console.log(`  missing:  ${proposals.filter((p) => p.reason === 'missing').length}`);
console.log(`  too long: ${proposals.filter((p) => p.reason === 'too-long').length}`);
console.log(`platform claims not confirmed by works_with: ${violating.length}`);
console.log(`em or en dashes: ${dashed.length}`);

for (const bad of violating) {
  console.log(`  ! ${bad.handle}: ${bad.violations.join(', ')}`);
}

if (process.argv.includes('--check')) {
  process.exit(proposals.length || violating.length ? 1 : 0);
}

if (violating.length || dashed.length) {
  console.error('Refusing to write a proposal containing an unconfirmed claim.');
  process.exit(1);
}

const out = new URL('../data/seo-proposed.json', import.meta.url);
fs.writeFileSync(out, `${JSON.stringify(proposals, null, 2)}\n`);
console.log(`wrote ${proposals.length} proposals to data/seo-proposed.json`);
