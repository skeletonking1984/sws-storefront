/**
 * Every product image in this catalogue carries an EMPTY alt in Shopify.
 *
 * Measured 2026-09-19 on the live PDP for the Boba Drink goal widget: 31 of
 * 55 <img> tags had alt="". Twelve of those are Twitter's own adsct pixels
 * and six are platform icons already marked aria-hidden, so the page's real
 * defect is the gallery, and the gallery is empty because the DATA is empty.
 * An Admin query of the first 30 active products returned alt "" on every
 * IMAGE node; only the videos carried one.
 *
 * That matters past accessibility. The featured image's alt is what Google
 * Images indexes, what the Merchant Center feed carries, and what every
 * collection card and search result renders.
 *
 * This script reads the live catalogue through the Storefront API (no Admin
 * token exists locally) and writes `data/alt-text-plan.json`: one entry per
 * image that needs an alt, with the text to set. Applying it is a separate
 * step through the Admin API's fileUpdate, which takes many files per call.
 *
 * WHAT IT WILL NOT DO
 *
 *   - Overwrite a non-empty alt. A human's wording in Admin beats anything
 *     generated here.
 *   - Take platform names from the title. Titles in this shop name YouTube,
 *     Kick and TikTok on widgets that support none of them (CLAUDE.md, and
 *     80 of 125 products measured on 2026-09-14). Platform claims come from
 *     the `custom.works_with` metafield or they do not appear.
 *   - Stamp one string on all nine images of a product. That is its own SEO
 *     finding, so image 1 gets the subject and the rest are numbered.
 *
 * Usage:
 *   node scripts/build-alt-text.mjs           write the plan, print a summary
 *   node scripts/build-alt-text.mjs --json    the plan on stdout
 */
import fs from 'node:fs';
import {subjectFromTitle} from '../app/lib/productName.js';

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

/**
 * Alt text longer than this is truncated by most screen readers and adds
 * nothing for search. Everything generated here sits well under it; the cap
 * exists so a pathological title cannot produce a paragraph.
 */
const MAX_ALT = 125;

/**
 * Platforms, in prose, from the metafield and nowhere else.
 *
 * @param {string | null | undefined} worksWith
 * @returns {string}
 */
export function platformPhrase(worksWith) {
  if (!worksWith) return '';
  let list;
  try {
    const parsed = JSON.parse(worksWith);
    list = Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    list = String(worksWith).split(/\s*[,;]\s*/);
  }
  list = list.map((p) => String(p).trim()).filter(Boolean);
  if (!list.length) return '';
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/**
 * The alt text for one image.
 *
 * Image 1 is the featured image: it is what Google Images indexes, what the
 * feed carries and what every card renders, so it gets the descriptive line
 * with the real platforms on it. The rest are numbered previews, which is
 * honest about being more views of the same product and keeps them distinct.
 *
 * @param {{subject: string, platforms: string, index: number, total: number, isVideo: boolean}} input
 * @returns {string}
 */
export function altFor({subject, platforms, index, total, isVideo}) {
  const name = subject || 'Stream widget';
  if (isVideo) return truncate(`${name} running live on stream`);
  if (index === 0) {
    // Truncating the platform list mid word produces "...Streamlabs and O…",
    // which reads as a broken claim rather than a short one. When the whole
    // line will not fit, drop the platform clause and keep the subject.
    const full = platforms
      ? `${name}, animated stream overlay for ${platforms}`
      : name;
    return truncate(full.length <= MAX_ALT ? full : name);
  }
  return truncate(`${name}, preview ${index + 1} of ${total}`);
}

/**
 * @param {string} s
 * @returns {string}
 */
function truncate(s) {
  return s.length <= MAX_ALT ? s : `${s.slice(0, MAX_ALT - 1).trimEnd()}…`;
}

const QUERY = `#graphql
  query AltTextAudit($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        handle
        title
        productType
        worksWith: metafield(namespace: "custom", key: "works_with") { value }
        media(first: 30) {
          nodes {
            __typename
            ... on MediaImage { id alt: image { altText } }
            ... on Video { id alt: previewImage { altText } }
          }
        }
      }
    }
  }
`;

/**
 * @param {string} query
 * @param {Record<string, unknown>} variables
 */
async function storefront(query, variables) {
  const res = await fetch(`https://${domain}/api/2025-01/graphql.json`, {
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

const products = [];
let cursor = null;
do {
  const data = await storefront(QUERY, {cursor});
  products.push(...data.products.nodes);
  cursor = data.products.pageInfo.hasNextPage
    ? data.products.pageInfo.endCursor
    : null;
} while (cursor);

const plan = [];
let alreadySet = 0;
let imagesSeen = 0;

for (const product of products) {
  const subject = subjectFromTitle(product.title);
  const platforms = platformPhrase(product.worksWith?.value);
  const media = product.media?.nodes ?? [];
  const total = media.length;

  media.forEach((item, index) => {
    const isVideo = item.__typename === 'Video';
    imagesSeen += 1;
    const existing = item.alt?.altText?.trim();
    if (existing) {
      alreadySet += 1;
      return;
    }
    plan.push({
      id: item.id,
      handle: product.handle,
      index,
      type: item.__typename,
      alt: altFor({subject, platforms, index, total, isVideo}),
    });
  });
}

const out = {
  generatedAt: new Date().toISOString(),
  products: products.length,
  mediaSeen: imagesSeen,
  alreadySet,
  toSet: plan.length,
  plan,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2));
} else {
  fs.writeFileSync(
    new URL('../data/alt-text-plan.json', import.meta.url),
    `${JSON.stringify(out, null, 2)}\n`,
  );
  console.log(
    `${products.length} storefront products, ${imagesSeen} media, ` +
      `${alreadySet} already have alt, ${plan.length} to set`,
  );
  const sample = plan.slice(0, 4);
  for (const row of sample) {
    console.log(`  ${row.handle} [${row.index}] -> ${row.alt}`);
  }
  console.log('  wrote data/alt-text-plan.json');
}
