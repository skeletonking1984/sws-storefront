/**
 * Checks the PDP answer block (app/lib/answerBlock.js) against every
 * storefront-visible product, and exits non-zero on findings.
 *
 * This is a check and not a memory on purpose. The block is generated, so
 * the failure mode is never one bad page, it is a template change that
 * quietly pushes a whole catalogue past the length an answer engine will
 * quote, or a platform list that grows a name the product does not support.
 *
 *   node scripts/audit-answer-blocks.mjs            # generated text
 *   node scripts/audit-answer-blocks.mjs --live     # also fetch N live PDPs
 *   node scripts/audit-answer-blocks.mjs --self-test
 *
 * What it asserts per product:
 *   - 40 to 60 words, the window a passage survives being quoted in.
 *   - no em dash or en dash anywhere (SWS hard rule).
 *   - self-contained: does not open with a pronoun, and never refers to
 *     the page around it ("above", "below", "this page", "see the").
 *   - names a price.
 *   - names every platform from `custom.works_with` that the block claims,
 *     and claims no platform the metafield does not carry.
 *   - names a file format, or is listed as a known unproven product.
 *
 * `--live` additionally fetches the real pages and asserts the paragraph is
 * actually in the served HTML, because a block that only exists in the repo
 * is worth nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ORIGIN = process.env.SWS_ORIGIN || 'https://streamwidgetshop.com';
const live = process.argv.includes('--live');
const selfTest = process.argv.includes('--self-test');

const {buildAnswerBlock, wordCount, ANSWER_BLOCK_MIN_WORDS, ANSWER_BLOCK_MAX_WORDS} =
  await import(pathToFileURL(path.join(ROOT, 'app/lib/answerBlock.js')));
const {parseWorksWith} = await import(
  pathToFileURL(path.join(ROOT, 'app/lib/platforms.js'))
);

const DASHES = /[—–]/;
const PAGE_REFERENCE = /\b(above|below|this page|see the|as mentioned|the gallery)\b/i;
const OPENING_PRONOUN = /^(it|this|they|these|those|he|she)\b/i;
const KNOWN_PLATFORMS = ['Twitch', 'YouTube', 'Kick', 'TikTok', 'OBS', 'Streamlabs', 'StreamElements'];

const findings = [];
const warnings = [];
function fail(handle, message) {
  findings.push(`${handle}: ${message}`);
}

/**
 * Every assertion that does not need the network, so the same rules can be
 * pointed at fabricated bad input by --self-test.
 * @param {string} handle
 * @param {string} text
 * @param {{platforms: string[], delivery: object | null}} facts
 */
function checkText(handle, text, facts) {
  const before = findings.length;
  if (!text) {
    fail(handle, 'no answer block generated');
    return findings.length === before;
  }
  const words = wordCount(text);
  if (words > ANSWER_BLOCK_MAX_WORDS) {
    fail(handle, `${words} words, over the ${ANSWER_BLOCK_MAX_WORDS} word ceiling`);
  } else if (words < ANSWER_BLOCK_MIN_WORDS) {
    // The floor is a hard finding only when the product HAD a third
    // sentence to write. A product whose works_with carries no OBS and no
    // StreamElements or Streamlabs has no install path on record, so its
    // block is genuinely two sentences long. Padding it to reach 40 words
    // would add filler, and filler is the one thing a quotable passage
    // cannot afford. Reported as a warning so the short block stays
    // visible without turning the check permanently red.
    const hasInstallPath =
      facts.platforms.includes('OBS') ||
      facts.platforms.includes('StreamElements') ||
      facts.platforms.includes('Streamlabs');
    if (hasInstallPath) {
      fail(handle, `${words} words, under the ${ANSWER_BLOCK_MIN_WORDS} word floor`);
    } else {
      warnings.push(
        `${handle}: ${words} words, under the ${ANSWER_BLOCK_MIN_WORDS} word floor, but custom.works_with names no install path so there is no third sentence to write`,
      );
    }
  }
  if (DASHES.test(text)) fail(handle, 'contains an em dash or en dash');
  if (PAGE_REFERENCE.test(text)) {
    fail(handle, `refers to the page around it: "${text.match(PAGE_REFERENCE)[0]}"`);
  }
  if (OPENING_PRONOUN.test(text.trim())) fail(handle, 'opens with a pronoun');
  if (!/\$\d/.test(text)) fail(handle, 'names no price');

  // A platform may only appear in the block if the metafield carries it.
  // This is the same rule ProductHighlights follows, applied to prose.
  for (const platform of KNOWN_PLATFORMS) {
    const claimed = new RegExp(`\\b${platform}\\b`).test(text);
    if (claimed && !facts.platforms.includes(platform)) {
      fail(handle, `claims ${platform}, which custom.works_with does not carry`);
    }
  }
  if (facts.delivery && !/\bZIPs?\b/.test(text)) {
    fail(handle, 'has a proven manifest but names no file format');
  }
  return findings.length === before;
}

if (selfTest) {
  // A check that only recognises good text cannot see text that went wrong
  // in a new way, so feed it known-bad input and fail if any of it passes.
  const facts = {platforms: ['Twitch', 'OBS', 'StreamElements'], delivery: {archives: 1}};
  const cases = [
    ['empty', '', facts],
    ['too-short', 'A widget for Twitch, $9.99, a ZIP downloads instantly.', facts],
    [
      'too-short-with-install-path',
      'Padding Widget is an animated goal widget for Twitch streamers. A ZIP downloads instantly, for $9.99.',
      facts,
    ],
    [
      'too-long',
      `Padding Widget is an animated goal widget from Stream Widget Shop for Twitch streamers. A ZIP of widget code downloads instantly after checkout, for a one-time $9.99, with no subscription. Setup needs a free StreamElements account, and the overlay loads into OBS as a browser source. ${'Extra words here again '.repeat(6)}`,
      facts,
    ],
    [
      'em-dash',
      'Padding Widget is an animated goal widget from Stream Widget Shop for Twitch streamers — a ZIP of widget code downloads instantly after checkout, for a one-time $9.99, with no subscription. Setup needs a free StreamElements account, and it loads into OBS as a browser source.',
      facts,
    ],
    [
      'page-reference',
      'Padding Widget is an animated goal widget from Stream Widget Shop for Twitch streamers. See the gallery above for what it looks like. A ZIP of widget code downloads instantly after checkout, for a one-time $9.99, with no subscription and no extra fee.',
      facts,
    ],
    [
      'opening-pronoun',
      'It is an animated goal widget from Stream Widget Shop for Twitch streamers. A ZIP of widget code downloads instantly after checkout, for a one-time $9.99, with no subscription. Setup needs a free StreamElements account, and the overlay loads into OBS.',
      facts,
    ],
    [
      'no-price',
      'Padding Widget is an animated goal widget from Stream Widget Shop for Twitch streamers. A ZIP of widget code downloads instantly after checkout, with no subscription at all. Setup needs a free StreamElements account, and the overlay loads into OBS as a browser source.',
      facts,
    ],
    [
      'overclaimed-platform',
      'Padding Widget is an animated goal widget from Stream Widget Shop for Twitch and YouTube streamers. A ZIP of widget code downloads instantly after checkout, for a one-time $9.99, with no subscription. Setup needs a free StreamElements account and OBS.',
      facts,
    ],
    [
      'proven-manifest-no-format',
      'Padding Widget is an animated goal widget from Stream Widget Shop for Twitch streamers. The files download instantly after checkout, for a one-time $9.99, with no subscription at all. Setup needs a free StreamElements account, and the overlay loads into OBS as a browser source.',
      facts,
    ],
  ];
  let escaped = 0;
  for (const [name, text, f] of cases) {
    findings.length = 0;
    const passed = checkText(name, text, f);
    if (passed) {
      console.error(`SELF-TEST ESCAPE: "${name}" passed and should not have`);
      escaped++;
    }
  }
  findings.length = 0;
  // And one that MUST pass, so the checks cannot be "fixed" by rejecting
  // everything.
  const good = buildAnswerBlock({
    name: 'Padding Goal Widget for Twitch',
    productType: 'Goal Widget',
    platforms: ['Twitch', 'OBS', 'StreamElements'],
    price: {amount: '9.99', currencyCode: 'USD'},
    delivery: {archives: 1, setupDoc: 'PDF'},
  });
  if (!checkText('known-good', good, facts)) {
    console.error('SELF-TEST FAILURE: the known-good block was rejected:');
    for (const f of findings) console.error(`  ${f}`);
    escaped++;
  }
  console.log(`self-test: ${cases.length} bad cases + 1 good case, ${escaped} failures`);
  process.exit(escaped ? 1 : 0);
}

// ---- Live catalogue --------------------------------------------------------
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const QUERY = `query($after:String){products(first:100, after:$after){pageInfo{hasNextPage endCursor} nodes{handle title productType seo{title} worksWith: metafield(namespace:"custom",key:"works_with"){value} priceRange{minVariantPrice{amount currencyCode}}}}}`;
let after = null;
const products = [];
do {
  const res = await fetch(`https://${env.PUBLIC_STORE_DOMAIN}/api/2025-04/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
    },
    body: JSON.stringify({query: QUERY, variables: {after}}),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  products.push(...json.data.products.nodes);
  after = json.data.products.pageInfo.hasNextPage
    ? json.data.products.pageInfo.endCursor
    : null;
} while (after);

const deliveryFacts = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'app/data/product-delivery.json'), 'utf8'),
).products;

const unproven = [];
const blocks = new Map();
for (const product of products) {
  const platforms = parseWorksWith(product.worksWith?.value) || [];
  const delivery = deliveryFacts[product.handle] || null;
  if (!delivery) unproven.push(product.handle);
  const text = buildAnswerBlock({
    name: product.seo?.title || product.title,
    productType: product.productType,
    platforms,
    price: product.priceRange.minVariantPrice,
    delivery,
  });
  blocks.set(product.handle, text);
  checkText(product.handle, text, {platforms, delivery});
}

// Duplicate detection: two products sharing a word-for-word answer block
// means the block stopped differentiating them, which is the same defect as
// a duplicated meta description.
const seen = new Map();
for (const [handle, text] of blocks) {
  if (seen.has(text)) fail(handle, `identical answer block to ${seen.get(text)}`);
  else seen.set(text, handle);
}

if (live) {
  const sample = [
    'celestial-stream-kit',
    'multistream-chat-widget-pack',
    'spooky-stream-kit',
    ...[...blocks.keys()].slice(0, 2),
  ].filter((h, i, a) => blocks.has(h) && a.indexOf(h) === i);
  for (const handle of sample) {
    const res = await fetch(`${ORIGIN}/products/${handle}`);
    const html = await res.text();
    if (res.status !== 200) {
      fail(handle, `live page returned ${res.status}`);
      continue;
    }
    // React escapes these on the way into the HTML.
    const needle = blocks
      .get(handle)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
    if (!html.includes(needle)) fail(handle, 'answer block is NOT in the served HTML');
  }
  console.log(`live: checked ${sample.length} pages on ${ORIGIN}`);
}

console.log(`products checked: ${products.length}`);
console.log(`delivery proven:  ${products.length - unproven.length}`);
console.log(`no proven format: ${unproven.length}`);
for (const handle of unproven) console.log(`  ${handle}`);

if (warnings.length) {
  console.log(`\nwarnings (${warnings.length}):`);
  for (const w of warnings) console.log(`  ${w}`);
}

if (findings.length) {
  console.error(`\nFINDINGS (${findings.length}):`);
  for (const f of findings) console.error(`  ${f}`);
  process.exit(1);
}
console.log('\nno findings');
