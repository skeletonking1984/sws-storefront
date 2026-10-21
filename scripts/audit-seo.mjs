/**
 * Title + meta description drift guard over every active product and
 * collection.
 *
 * Why this exists, 2026-09-23
 * ---------------------------
 * `scripts/build-seo-fields.mjs` wrote real `seo.title` / `seo.description`
 * onto every product on 2026-09-17, and the SEO checklist called
 * this script "the last unchecked SEO item," noting the five highest-traffic
 * PDPs measured clean on 2026-09-19 (titles 31-51 chars, meta 127-152).
 * Nothing has checked the other ~120 products, or a single collection,
 * since. Its first run found two, both on the `halloween` collection, which
 * nobody had ever measured: title 65 over the 60 cap and meta description
 * 173 over the 155 cap, confirmed in the served HTML and trimmed the same
 * day. The 123 products were clean, which is a familiar pattern:
 * the suspected defect was in the products and the real one was in the
 * surface nobody sampled. It stays in `verify:all` so the next one (a bulk
 * copy edit that pushes a title past 60, a duplicate template collision, a
 * hand edit in Admin that drops a period mid-sentence) gets caught by a
 * command instead of by Search Console days later, the same lesson
 * `audit-structured-data.mjs` already encodes for JSON-LD.
 *
 * This audits the RENDERED value, not the raw field. `seo.title` and
 * `seo.description` are allowed to be empty in Shopify Admin because both
 * PDP and collection routes fall back to a generated string when they are.
 * An empty `seo.title` with a working fallback is not a finding; a fallback
 * that itself renders empty is. The two fallback chains below are copied
 * verbatim from the route meta functions, because neither repo exports them
 * as a shared helper:
 *   - app/routes/products.$handle.jsx:90-95
 *   - app/routes/collections.$handle.jsx:16-23
 * A change to either fallback has to be mirrored here by hand; there is
 * nothing importable to drift-proof that link, so treat a route change to
 * either meta function as a reason to re-read this file.
 *
 * 2026-09-28: extended with three more checks, added alongside the SEO
 * landing page work (see app/routes/collections.$handle.jsx and the
 * PDP breadcrumb in app/routes/products.$handle.jsx):
 *   - a money collection's H1 is not a single generic word ONCE
 *     `custom.h1` exists on it (isGenericH1 below);
 *   - every collection and product page served carries a BreadcrumbList
 *     JSON-LD block (hasBreadcrumbListJsonLd below);
 *   - the two legacy-theme URL redirect classes answer 301 (see
 *     app/lib/legacyRedirects.js).
 * These three fetch rendered HTML/response status over --origin, unlike
 * the title/description checks above which read straight off the
 * Storefront API.
 *
 * Usage:
 *   node scripts/audit-seo.mjs [--limit n] [--origin https://...]
 *   node scripts/audit-seo.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

// A fresh worktree has no .env, and --self-test needs none of its values
// (same fix as audit-structured-data.mjs, applied here 2026-09-28: this
// file used to read .env unconditionally, which crashed --self-test with
// ENOENT in any worktree that never had one, instead of running its 15
// pure self-test cases).
const readEnvFile = () => {
  try {
    return fs.readFileSync(`${ROOT}/.env`, 'utf8');
  } catch {
    return '';
  }
};

const env = Object.fromEntries(
  readEnvFile()
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
// --limit exists for a quick spot check; the bare command runs the whole
// catalogue on purpose, see the header.
const LIMIT = Number(arg('--limit', 0)) || Infinity;
// --origin: added 2026-09-28 alongside the BreadcrumbList/H1/redirect
// checks below, which DO fetch rendered pages (title/description still
// come straight off the Storefront API, unaffected by this).
const ORIGIN = arg('--origin', 'https://streamwidgetshop.com');

const TITLE_MAX = 60;
const DESC_MAX = 155;

/**
 * Vocabulary this catalogue's titles and descriptions actually draw from:
 * platform names, product-type words, and the small set of phrases
 * `build-seo-fields.mjs` generates from (`BENEFIT`, `TYPE_WORD`, "instant
 * digital download", "set up through"). A raw `.slice(0, N)` truncation bug
 * cuts one of these words in half far more often than it cuts an arbitrary
 * English word, because these words make up most of the copy. Kept
 * deliberately narrow: a narrow list catches the failure this catalogue
 * actually has (see build-seo-fields.mjs's own CUTS/PLATFORM_WORDS) without
 * flagging ordinary prose that happens to end without punctuation.
 */
const KNOWN_TERMS = [
  'Twitch', 'YouTube', 'Kick', 'TikTok', 'OBS', 'Streamlabs', 'StreamElements', 'Studio',
  'Stream', 'Streamer', 'Streamers', 'Widget', 'Widgets', 'Chat', 'Goal', 'Overlay', 'Overlays',
  'Pack', 'Bundle', 'Kit', 'Emote', 'Emotes', 'Multistream',
  'download', 'downloads', 'instant', 'digital', 'customizable', 'animated', 'subscription',
  'account', 'browser', 'source', 'refund', 'refunds', 'setup', 'install', 'free', 'code',
  'files', 'file', 'ZIP', 'ZIPs', 'progress', 'live',
];

/**
 * A raw source value (never the fallback text, which is a hardcoded
 * template and cannot be cut) reads as cut mid-word when it does not end in
 * whitespace or terminal punctuation, and its final token is a genuine
 * prefix of one of this catalogue's own recurring words. "Ends without
 * punctuation" alone is explicitly not enough, most of this catalogue's
 * hand written copy ends that way and is complete.
 * @param {string | null | undefined} raw
 */
export function isTruncatedMidWord(raw) {
  if (!raw) return false;
  if (/\s$/.test(raw)) return false;
  if (/[.!?)\]'"]$/.test(raw)) return false;
  const tail = raw.split(/\s+/).pop();
  if (!tail) return false;
  const tailLower = tail.toLowerCase();
  // A tail that IS one of these words, complete, is not a fragment just
  // because a longer word in the list also starts with it ("Widget" is a
  // real word on its own even though "Widgets" also starts with "Widget";
  // "Stream" is a real word on its own even though "Streamlabs" does too).
  if (KNOWN_TERMS.some((word) => word.toLowerCase() === tailLower)) return false;
  return KNOWN_TERMS.some(
    (word) => word.length > tail.length && word.toLowerCase().startsWith(tailLower),
  );
}

const DASHES = /[\u2014–]/;

/**
 * app/routes/products.$handle.jsx:90-95, copied verbatim.
 * @param {{seo?: {title?: string, description?: string}, title?: string}} product
 */
function productFallback(product) {
  const title = product.title ?? '';
  return {
    renderedTitle: product.seo?.title || `${title} | Stream Widget Shop`,
    renderedDescription:
      product.seo?.description ||
      `${title}: animated stream widget, instant digital download for Twitch, YouTube, and multistream.`,
  };
}

/**
 * app/routes/collections.$handle.jsx:16-23, copied verbatim.
 * @param {{seo?: {title?: string, description?: string}, title?: string, description?: string}} collection
 */
function collectionFallback(collection) {
  const title = collection.title ?? '';
  return {
    renderedTitle: collection.seo?.title || `${title} | Stream Widget Shop`,
    renderedDescription:
      collection.seo?.description ||
      collection.description ||
      `Animated ${title} widgets for Twitch, YouTube, and multistream. Instant digital download.`,
  };
}

/**
 * The pure, per-entity half: given the values the page would actually
 * serve, what is wrong with them. Duplicate detection is deliberately not
 * in here, it is a property of the whole set, not of one entity, and lives
 * in findDuplicates below.
 * @param {{
 *   handle: string,
 *   kind: 'product' | 'collection',
 *   renderedTitle: string,
 *   renderedDescription: string,
 *   rawSeoTitle?: string,
 *   rawSeoDescription?: string,
 * }} entity
 */
export function auditEntity({handle, kind, renderedTitle, renderedDescription, rawSeoTitle, rawSeoDescription}) {
  const findings = [];
  const add = (what) => findings.push({handle, kind, what});

  const titleLength = renderedTitle ? renderedTitle.length : 0;
  const descriptionLength = renderedDescription ? renderedDescription.length : 0;

  if (!renderedTitle) {
    add('title is empty even after fallback');
  } else if (titleLength > TITLE_MAX) {
    add(`title is ${titleLength} chars, over the ${TITLE_MAX} char cap`);
  }

  if (!renderedDescription) {
    add('meta description is empty even after fallback');
  } else if (descriptionLength > DESC_MAX) {
    add(`meta description is ${descriptionLength} chars, over the ${DESC_MAX} char cap`);
  }

  if (isTruncatedMidWord(rawSeoTitle)) {
    add(`title looks cut mid-word: "${rawSeoTitle}"`);
  }
  if (isTruncatedMidWord(rawSeoDescription)) {
    add(`meta description looks cut mid-word: "${rawSeoDescription}"`);
  }

  if (DASHES.test(renderedTitle || '')) add('title contains an em dash or en dash');
  if (DASHES.test(renderedDescription || '')) add('meta description contains an em dash or en dash');

  return {findings, titleLength, descriptionLength};
}

/**
 * Groups entities that render an identical title, and separately an
 * identical meta description. Only groups of 2+ are findings.
 * @param {Array<{handle: string, kind: string, renderedTitle: string, renderedDescription: string}>} entities
 */
export function findDuplicates(entities) {
  const byTitle = new Map();
  const byDescription = new Map();
  for (const e of entities) {
    if (e.renderedTitle) {
      if (!byTitle.has(e.renderedTitle)) byTitle.set(e.renderedTitle, []);
      byTitle.get(e.renderedTitle).push(`${e.kind}:${e.handle}`);
    }
    if (e.renderedDescription) {
      if (!byDescription.has(e.renderedDescription)) byDescription.set(e.renderedDescription, []);
      byDescription.get(e.renderedDescription).push(`${e.kind}:${e.handle}`);
    }
  }
  const titleGroups = [...byTitle.entries()].filter(([, members]) => members.length > 1);
  const descriptionGroups = [...byDescription.entries()].filter(([, members]) => members.length > 1);
  return {titleGroups, descriptionGroups};
}

/**
 * Single common words a money collection's H1 should never be ONCE
 * `custom.h1` exists on that collection (see app/routes/collections.$handle.jsx,
 * added 2026-09-28). Before that metafield is set, the fallback H1 is the
 * plain Shopify collection title, and today that IS a bare "Widgets",
 * "Overlays" or "Bundles" on several money collections, which is expected,
 * undone SEO work, not a bug worth failing the build over. Once a
 * real `custom.h1` is written, landing on one of these same generic words
 * means the new copy did not actually improve on the fallback it replaced.
 */
const GENERIC_H1_WORDS = new Set([
  'widgets', 'widget', 'overlays', 'overlay', 'bundles', 'bundle', 'kits', 'kit',
  'collection', 'collections', 'products', 'product', 'shop', 'store', 'home',
  'chat', 'goal', 'all',
]);

/**
 * @param {string | null | undefined} h1
 * @returns {boolean} true when `h1` is a single word from GENERIC_H1_WORDS.
 */
export function isGenericH1(h1) {
  if (!h1) return false;
  const words = h1.trim().split(/\s+/);
  if (words.length !== 1) return false;
  return GENERIC_H1_WORDS.has(words[0].toLowerCase());
}

/**
 * Whether `html` (a fetched page's served markup) carries a BreadcrumbList
 * JSON-LD block. Same block-extraction regex as audit-structured-data.mjs's
 * productJsonLd(), reused here rather than re-derived so the two scripts
 * can never disagree about what counts as a JSON-LD script tag.
 * @param {string} html
 * @returns {boolean}
 */
export function hasBreadcrumbListJsonLd(html) {
  const blocks = [...(html || '').matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)];
  for (const [, raw] of blocks) {
    try {
      const parsed = JSON.parse(raw);
      const nodes = Array.isArray(parsed) ? parsed : [parsed];
      if (nodes.some((n) => n?.['@type'] === 'BreadcrumbList')) return true;
    } catch {
      /* a block that will not parse is not a match */
    }
  }
  return false;
}

if (process.argv.includes('--self-test')) {
  let pass = 0;
  let total = 0;
  const check = (name, ok, detail) => {
    total++;
    if (ok) pass++;
    console.log(`${ok ? 'pass' : 'FAIL'}  ${name}` + (ok ? '' : detail ? `\n        ${detail}` : ''));
  };

  const clean = {
    handle: 'moon-jar-goal-widget',
    kind: 'product',
    renderedTitle: 'Moon Jar Goal Widget for Twitch and OBS',
    renderedDescription:
      'Moon Jar Goal Widget: animated goal widget for Twitch. Shows your goal progress live on stream. Instant digital download.',
    rawSeoTitle: 'Moon Jar Goal Widget for Twitch and OBS',
    rawSeoDescription:
      'Moon Jar Goal Widget: animated goal widget for Twitch. Shows your goal progress live on stream. Instant digital download.',
  };

  // 1. A fully clean entity passes with zero findings.
  {
    const {findings} = auditEntity(clean);
    check('the shipped shape passes clean', findings.length === 0, JSON.stringify(findings));
  }

  // 2. Over-length title.
  {
    const longTitle = 'A'.repeat(TITLE_MAX + 10);
    const {findings} = auditEntity({...clean, renderedTitle: longTitle, rawSeoTitle: longTitle});
    check(
      'over-length title',
      findings.some((f) => f.what.includes('over the 60 char cap')),
      JSON.stringify(findings),
    );
  }

  // 3. Over-length meta.
  {
    const longDesc = 'A'.repeat(DESC_MAX + 10);
    const {findings} = auditEntity({...clean, renderedDescription: longDesc, rawSeoDescription: longDesc});
    check(
      'over-length meta description',
      findings.some((f) => f.what.includes('over the 155 char cap')),
      JSON.stringify(findings),
    );
  }

  // 4. Empty seo.title with a working fallback: the fallback (rendered by
  // productFallback/collectionFallback, not this function directly) always
  // appends " | Stream Widget Shop", so the RENDERED title this function
  // receives is never empty as long as a catalog title exists.
  {
    const {renderedTitle} = productFallback({title: 'Padding Widget', seo: {}});
    const {findings} = auditEntity({
      ...clean,
      renderedTitle,
      rawSeoTitle: '',
      renderedDescription: clean.renderedDescription,
    });
    check(
      'empty seo.title with a working fallback is not a finding',
      renderedTitle === 'Padding Widget | Stream Widget Shop' &&
        !findings.some((f) => f.what.includes('empty')),
      `rendered "${renderedTitle}"; findings ${JSON.stringify(findings)}`,
    );
  }

  // 5. Empty title with genuinely no fallback: the one shape the real
  // fallback template can never produce (it always appends the brand
  // suffix), but the worst case this function still has to catch, a
  // product or collection with no title anywhere.
  {
    const {findings} = auditEntity({...clean, renderedTitle: '', rawSeoTitle: ''});
    check(
      'empty title with no fallback is a finding',
      findings.some((f) => f.what.includes('title is empty')),
      JSON.stringify(findings),
    );
  }

  // 6 & 7. Duplicate title / duplicate meta description, both across two
  // named handles.
  {
    const entities = [
      {handle: 'moon-jar-goal-widget', kind: 'product', renderedTitle: 'Same Title', renderedDescription: 'Desc A'},
      {handle: 'froggy-goal-widget', kind: 'product', renderedTitle: 'Same Title', renderedDescription: 'Desc B'},
    ];
    const {titleGroups} = findDuplicates(entities);
    const group = titleGroups.find(([title]) => title === 'Same Title');
    check(
      'two products sharing a title are grouped and both named',
      !!group && group[1].includes('product:moon-jar-goal-widget') && group[1].includes('product:froggy-goal-widget'),
      JSON.stringify(titleGroups),
    );
  }
  {
    const entities = [
      {handle: 'celestial-stream-kit', kind: 'collection', renderedTitle: 'Title A', renderedDescription: 'Same Meta'},
      {handle: 'spooky-stream-kit', kind: 'collection', renderedTitle: 'Title B', renderedDescription: 'Same Meta'},
    ];
    const {descriptionGroups} = findDuplicates(entities);
    const group = descriptionGroups.find(([desc]) => desc === 'Same Meta');
    check(
      'two collections sharing a meta description are grouped and both named',
      !!group &&
        group[1].includes('collection:celestial-stream-kit') &&
        group[1].includes('collection:spooky-stream-kit'),
      JSON.stringify(descriptionGroups),
    );
  }

  // 8. Em dash in a title.
  {
    const {findings} = auditEntity({...clean, renderedTitle: 'Moon Jar Goal Widget \u2014 for Twitch'});
    check(
      'an em dash in a title is caught',
      findings.some((f) => f.what.includes('title contains an em dash')),
      JSON.stringify(findings),
    );
  }

  // 9. En dash in a meta description.
  {
    const {findings} = auditEntity({...clean, renderedDescription: 'Goal widget for Twitch–OBS setups.'});
    check(
      'an en dash in a meta description is caught',
      findings.some((f) => f.what.includes('meta description contains an em dash')),
      JSON.stringify(findings),
    );
  }

  // 10. Mid-word truncation: a real source value cut inside "StreamElements".
  {
    const cutTitle = 'Moon Jar Goal Widget for Twitch, OBS and StreamEl';
    const {findings} = auditEntity({...clean, renderedTitle: cutTitle, rawSeoTitle: cutTitle});
    check(
      'a mid-word truncation is caught',
      findings.some((f) => f.what.includes('cut mid-word')),
      JSON.stringify(findings),
    );
  }
  // Sanity: the same detector must not fire on ordinary copy that simply
  // ends without punctuation. Without this, case 10 could pass by having
  // isTruncatedMidWord fire on everything.
  {
    check(
      'ordinary copy with no trailing punctuation is not flagged as truncated',
      !isTruncatedMidWord('Moon Jar Goal Widget for Twitch and OBS'),
    );
  }

  // 11. Title at exactly 60 chars passes.
  {
    const exact60 = 'Moon Jar Goal Widget for Twitch, OBS and StreamElements Pros'; // 60 chars
    if (exact60.length !== TITLE_MAX) throw new Error(`fixture is ${exact60.length} chars, expected ${TITLE_MAX}`);
    const {findings} = auditEntity({...clean, renderedTitle: exact60, rawSeoTitle: exact60});
    check(
      'a title at exactly 60 chars passes',
      !findings.some((f) => f.what.includes('title')),
      JSON.stringify(findings),
    );
  }

  // 12. Meta description at exactly 155 chars passes.
  {
    const base =
      'Moon Jar Goal Widget: animated goal widget for Twitch and OBS. Shows your goal progress live on stream. Instant digital download, no subscription at all whatsoever';
    const exact155 = base.slice(0, DESC_MAX);
    if (exact155.length !== DESC_MAX) throw new Error(`fixture is ${exact155.length} chars, expected ${DESC_MAX}`);
    const {findings} = auditEntity({...clean, renderedDescription: exact155, rawSeoDescription: exact155});
    check(
      'a meta description at exactly 155 chars passes',
      !findings.some((f) => f.what.includes('meta description')),
      JSON.stringify(findings),
    );
  }

  // 13. A single generic word is caught.
  {
    check('a bare "Widgets" H1 is generic', isGenericH1('Widgets'));
    check('a bare "Overlays" H1 is generic', isGenericH1('Overlays'));
  }
  // 14. Real landing-page copy is not caught.
  {
    check(
      'a real multi-word H1 is not generic',
      !isGenericH1('Best Twitch Chat Widgets for OBS and Streamlabs'),
    );
  }
  // 15. Two words that happen to both be on the list, together, are not generic.
  {
    check('"Chat Widgets" (plural, two words) is not generic', !isGenericH1('Chat Widgets'));
  }
  // 16. Empty/missing H1 is not itself a "generic" finding (that is a
  // separate, more serious problem the collection route's own fallback
  // already prevents).
  {
    check('an empty H1 is not reported as generic', !isGenericH1(''));
    check('a null H1 is not reported as generic', !isGenericH1(null));
  }
  // 17. BreadcrumbList detection: present.
  {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [],
    })}</script>`;
    check('a page with a BreadcrumbList block is detected', hasBreadcrumbListJsonLd(html));
  }
  // 18. BreadcrumbList detection: absent (only a Product block, the
  // pre-2026-09-28 collection page shape).
  {
    const html = `<script type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: 'x',
    })}</script>`;
    check(
      'a page with only a Product block has no BreadcrumbList',
      !hasBreadcrumbListJsonLd(html),
    );
  }
  // 19. BreadcrumbList detection: an unparseable script block is not a
  // false positive.
  {
    const html = `<script type="application/ld+json">{not valid json</script>`;
    check('an unparseable JSON-LD block is not read as a BreadcrumbList', !hasBreadcrumbListJsonLd(html));
  }
  // 20. BreadcrumbList detection: array-wrapped JSON-LD (multiple `@graph`-
  // style nodes in one script tag) is still found.
  {
    const html = `<script type="application/ld+json">${JSON.stringify([
      {'@context': 'https://schema.org', '@type': 'Product', name: 'x'},
      {'@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: []},
    ])}</script>`;
    check('a BreadcrumbList inside an array-wrapped block is found', hasBreadcrumbListJsonLd(html));
  }

  console.log(`\n${pass}/${total}`);
  process.exit(pass === total ? 0 : 1);
}

// ---- Live catalogue --------------------------------------------------------

const QUERY_URL = `https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`;
const HEADERS = {
  'Content-Type': 'application/json',
  'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
};

async function fetchAllPaginated(query, dataPath) {
  const all = [];
  let cursor = null;
  do {
    const res = await fetch(QUERY_URL, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({query, variables: {cursor}}),
    });
    const body = await res.json();
    if (body.errors) throw new Error(JSON.stringify(body.errors));
    const page = dataPath.split('.').reduce((node, key) => node[key], body.data);
    all.push(...page.nodes);
    cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    if (all.length >= LIMIT) break;
  } while (cursor);
  return all.slice(0, LIMIT);
}

const PRODUCTS_QUERY = `
  query SeoAuditProducts($cursor: String) {
    products(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes { handle title seo { title description } }
    }
  }
`;

const COLLECTIONS_QUERY = `
  query SeoAuditCollections($cursor: String) {
    collections(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        handle
        title
        description
        seo { title description }
        h1: metafield(namespace: "custom", key: "h1") { value }
      }
    }
  }
`;

const [products, collections] = await Promise.all([
  fetchAllPaginated(PRODUCTS_QUERY, 'products'),
  fetchAllPaginated(COLLECTIONS_QUERY, 'collections'),
]);

console.log(`${products.length} storefront products, ${collections.length} storefront collections.\n`);

const entities = [];
let usedFallbackTitle = 0;
let usedFallbackDescription = 0;

for (const product of products) {
  const {renderedTitle, renderedDescription} = productFallback(product);
  if (!product.seo?.title) usedFallbackTitle++;
  if (!product.seo?.description) usedFallbackDescription++;
  entities.push({
    handle: product.handle,
    kind: 'product',
    renderedTitle,
    renderedDescription,
    rawSeoTitle: product.seo?.title || '',
    rawSeoDescription: product.seo?.description || '',
  });
}
for (const collection of collections) {
  const {renderedTitle, renderedDescription} = collectionFallback(collection);
  if (!collection.seo?.title) usedFallbackTitle++;
  if (!collection.seo?.description) usedFallbackDescription++;
  entities.push({
    handle: collection.handle,
    kind: 'collection',
    renderedTitle,
    renderedDescription,
    rawSeoTitle: collection.seo?.title || '',
    rawSeoDescription: collection.seo?.description || '',
  });
}

const findings = [];
let minTitle = Infinity;
let maxTitle = 0;
let minDesc = Infinity;
let maxDesc = 0;

for (const entity of entities) {
  const {findings: entityFindings, titleLength, descriptionLength} = auditEntity(entity);
  findings.push(...entityFindings);
  if (titleLength) {
    minTitle = Math.min(minTitle, titleLength);
    maxTitle = Math.max(maxTitle, titleLength);
  }
  if (descriptionLength) {
    minDesc = Math.min(minDesc, descriptionLength);
    maxDesc = Math.max(maxDesc, descriptionLength);
  }
}

const {titleGroups, descriptionGroups} = findDuplicates(entities);
for (const [title, members] of titleGroups) {
  findings.push({handle: members.join(', '), kind: 'duplicate', what: `identical title "${title}"`});
}
for (const [description, members] of descriptionGroups) {
  findings.push({
    handle: members.join(', '),
    kind: 'duplicate',
    what: `identical meta description "${description}"`,
  });
}

console.log(`title length: ${minTitle === Infinity ? 'n/a' : minTitle} to ${maxTitle}`);
console.log(`meta description length: ${minDesc === Infinity ? 'n/a' : minDesc} to ${maxDesc}`);
console.log(`entities on the generated title fallback: ${usedFallbackTitle}`);
console.log(`entities on the generated description fallback: ${usedFallbackDescription}`);

console.log(`\nnotes:`);
console.log(`  ${usedFallbackTitle} title(s) and ${usedFallbackDescription} description(s) are the generated fallback, not hand written seo fields. Not a failure, the fallback is the documented behaviour.`);

// ---- BreadcrumbList / H1 / legacy redirect checks, added 2026-09-28 -------
// Fetches rendered pages and real HTTP responses over ORIGIN, unlike
// everything above which reads straight off the Storefront API.

// Every collection page money actually runs through: the two renamed
// collections (see app/lib/collectionHandles.js) under BOTH their current
// and legacy handle (only one is ever live at once, checking both costs
// nothing and means this never has to be updated the day they are renamed),
// plus the always-live catch-alls. Handles are literal here, not
// imported from collectionHandles.js: this script runs standalone with
// plain node, and keeping it free of a runtime dependency on another
// module (which itself pulls in a JSON import Node's ESM loader is picky
// about, confirmed 2026-09-28) keeps this diagnostic script self-contained.
// If either handle ever changes, mirror it here too.
const MONEY_COLLECTION_HANDLES = [
  'twitch-chat-widgets',
  'frontpage',
  'twitch-goal-widgets',
  'stream-widgets-templates',
  'widgets',
  'top-widgets',
  'overlays',
  'bundles',
];

for (const handle of MONEY_COLLECTION_HANDLES) {
  const res = await fetch(`${ORIGIN}/collections/${handle}`);
  if (!res.ok) {
    // Expected for whichever of the current/legacy pair is not live right
    // now, see the comment above. Not a finding.
    continue;
  }
  const html = await res.text();
  if (!hasBreadcrumbListJsonLd(html)) {
    findings.push({
      handle,
      kind: 'collection-jsonld',
      what: 'no BreadcrumbList JSON-LD on the served collection page',
    });
  }
  const collectionData = collections.find((c) => c.handle === handle);
  if (collectionData?.h1?.value && isGenericH1(collectionData.h1.value)) {
    findings.push({
      handle,
      kind: 'collection-h1',
      what: `custom.h1 is set but renders as the single generic word "${collectionData.h1.value}"`,
    });
  }
}

// A small PDP sample, not the whole catalogue: BreadcrumbList is a
// per-request render, not per-product copy, so one page proves the
// component works the same way audit-structured-data.mjs samples products
// for its own live check.
const PDP_SAMPLE = products.slice(0, 5);
for (const product of PDP_SAMPLE) {
  const res = await fetch(`${ORIGIN}/products/${product.handle}`);
  if (!res.ok) continue;
  const html = await res.text();
  if (!hasBreadcrumbListJsonLd(html)) {
    findings.push({
      handle: product.handle,
      kind: 'product-jsonld',
      what: 'no BreadcrumbList JSON-LD on the served product page',
    });
  }
}

// The two legacy-theme URL redirect classes (see
// app/routes/collections.$handle.products.$productHandle.jsx and
// app/routes/blogs.news.tagged.$tag.jsx). `redirect: 'manual'` so fetch
// reports the 301 itself instead of silently following it to a 200.
if (products.length) {
  const sampleHandle = products[0].handle;
  const nestedUrl = `${ORIGIN}/collections/any-collection/products/${sampleHandle}?utm_test=1`;
  const nestedRes = await fetch(nestedUrl, {redirect: 'manual'});
  // The handle sampled here comes straight off the live product feed, so it
  // is never one of the 75 renamed handles app/lib/handleAliases.js knows
  // about (an already-current handle has no forward alias); the target for
  // it is always the plain `/products/<handle><search>` shape.
  const expectedTarget = `/products/${sampleHandle}?utm_test=1`;
  const nestedLocation = nestedRes.headers.get('location') || '';
  if (nestedRes.status !== 301 || !nestedLocation.endsWith(expectedTarget)) {
    findings.push({
      handle: sampleHandle,
      kind: 'legacy-redirect',
      what: `/collections/*/products/${sampleHandle} answered ${nestedRes.status} -> "${nestedLocation}", expected 301 -> a path ending "${expectedTarget}"`,
    });
  }
}

const taggedUrl = `${ORIGIN}/blogs/news/tagged/twitch`;
const taggedRes = await fetch(taggedUrl, {redirect: 'manual'});
const taggedLocation = taggedRes.headers.get('location') || '';
if (taggedRes.status !== 301 || !taggedLocation.endsWith('/blogs/news')) {
  findings.push({
    handle: 'blogs/news/tagged/twitch',
    kind: 'legacy-redirect',
    what: `/blogs/news/tagged/twitch answered ${taggedRes.status} -> "${taggedLocation}", expected 301 -> /blogs/news`,
  });
}

if (findings.length) {
  console.log(`\nFINDINGS (${findings.length}):`);
  for (const f of findings) console.log(`  [${f.kind}] ${f.handle}\n    ${f.what}`);
} else {
  console.log('\nno findings');
}

process.exit(findings.length ? 1 : 0);
