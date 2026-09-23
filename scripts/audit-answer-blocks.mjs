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
const {parseWorksWith, shipsChat} = await import(
  pathToFileURL(path.join(ROOT, 'app/lib/platforms.js'))
);

/**
 * A product that ships no chat widget may not say it reads chat, however
 * many platforms it works on. Matches the verb, not the word "chat": a chat
 * widget's own NAME contains "Chat" and a goal widget's title can too, so a
 * bare /chat/ test is both noisy and blind.
 */
const CHAT_CLAIM = /\b(reads?|read|reading|merges?|merging|pulls?|shows?|displays?)\b[^.]{0,60}\bchat\b/i;

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
 * @param {{platforms: string[], delivery: object | null, productType?: string | null}} facts
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
  // The defect this check exists for: `isMultistream` was read as a chat
  // claim, so every multistream GOAL widget's block said it reads chat. The
  // platform loop above could not see it, because every platform named was
  // genuinely in the metafield. The lie was the verb.
  if (!shipsChat({productType: facts.productType}) && CHAT_CLAIM.test(text)) {
    fail(
      handle,
      `productType ${facts.productType} ships no chat widget, but the block claims it reads chat: "${text.match(CHAT_CLAIM)[0]}"`,
    );
  }
  return findings.length === before;
}

if (selfTest) {
  // A check that only recognises good text cannot see text that went wrong
  // in a new way, so feed it known-bad input and fail if any of it passes.
  const facts = {
    platforms: ['Twitch', 'OBS', 'StreamElements'],
    delivery: {archives: 1},
    productType: 'Goal Widget',
  };
  // The multistream goal widget the chat-claim rule exists for. Every
  // platform it names IS in its metafield, so the platform loop passes it.
  const msGoal = {
    platforms: ['Twitch', 'YouTube', 'Kick', 'StreamElements', 'Streamlabs', 'OBS'],
    delivery: {archives: 1},
    productType: 'Goal Widget',
  };
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
    // The live defect, verbatim from production on 2026-09-23.
    [
      'goal-widget-reads-chat',
      'Moon Jar Goal Widget, Falling Physics Tracker is a multistream animated goal widget from Stream Widget Shop that reads Twitch, YouTube and Kick chat at once. A ZIP of widget code downloads instantly after checkout, for a one-time $18.99, with no subscription. Setup needs a free StreamElements or Streamlabs account, and the overlay loads into OBS as a browser source.',
      msGoal,
    ],
    // Same lie, different verb, so the rule cannot be satisfied by banning
    // one word.
    [
      'goal-widget-merges-chat',
      'Padding Goal Widget is an animated goal widget from Stream Widget Shop that merges your Twitch and Kick chat into one overlay. A ZIP of widget code downloads instantly after checkout, for a one-time $9.99, with no subscription. Setup needs a free StreamElements account and OBS.',
      {...msGoal, platforms: ['Twitch', 'Kick', 'StreamElements', 'OBS']},
    ],
    // An Emotes pack is the other chatless type.
    [
      'emotes-reads-chat',
      'Padding Emote Pack is a pack of stream emotes from Stream Widget Shop that reads Twitch and Kick chat at once. A ZIP of emote files downloads instantly after checkout, for a one-time $9.99, with no subscription. Setup needs a free StreamElements account and OBS.',
      {...msGoal, productType: 'Emotes', platforms: ['Twitch', 'Kick', 'StreamElements', 'OBS']},
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
  // And blocks that MUST pass, so the checks cannot be "fixed" by rejecting
  // everything. All three are generated by the real builder, not hand typed,
  // so a wording change that breaks one is caught here rather than live.
  const goodCases = [
    [
      'known-good',
      {
        name: 'Padding Goal Widget for Twitch',
        productType: 'Goal Widget',
        platforms: ['Twitch', 'OBS', 'StreamElements'],
        price: {amount: '9.99', currencyCode: 'USD'},
        delivery: {archives: 1, setupDoc: 'PDF'},
      },
      facts,
    ],
    // The fix's own output: a multistream goal widget, which must still say
    // multistream and must not say chat.
    [
      'known-good-multistream-goal',
      {
        name: 'Moon Jar Goal Widget, Falling Physics Tracker',
        productType: 'Goal Widget',
        platforms: ['Twitch', 'YouTube', 'Kick', 'StreamElements', 'Streamlabs', 'OBS'],
        price: {amount: '18.99', currencyCode: 'USD'},
        delivery: {archives: 1, setupDoc: null},
      },
      msGoal,
    ],
    // A product that genuinely reads chat must keep saying so, or the rule
    // has cost the catalogue its one true multistream claim.
    [
      'known-good-multistream-chat',
      {
        name: 'Multistream Chat Widget for Twitch, YouTube and Kick',
        productType: 'Chat Widget',
        platforms: ['Twitch', 'YouTube', 'Kick', 'StreamElements', 'OBS'],
        price: {amount: '16.79', currencyCode: 'USD'},
        delivery: {archives: 1, setupDoc: null},
      },
      {...msGoal, productType: 'Chat Widget', platforms: ['Twitch', 'YouTube', 'Kick', 'StreamElements', 'OBS']},
    ],
  ];
  for (const [label, input, f] of goodCases) {
    findings.length = 0;
    const good = buildAnswerBlock(input);
    if (!checkText(label, good, f)) {
      console.error(`SELF-TEST FAILURE: the ${label} block was rejected:`);
      for (const finding of findings) console.error(`  ${finding}`);
      escaped++;
    }
    if (label === 'known-good-multistream-chat' && !CHAT_CLAIM.test(good)) {
      console.error('SELF-TEST FAILURE: a real multistream chat widget stopped saying it reads chat:');
      console.error(`  ${good}`);
      escaped++;
    }
  }
  findings.length = 0;
  console.log(
    `self-test: ${cases.length} bad cases + ${goodCases.length} good cases, ${escaped} failures`,
  );
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
  checkText(product.handle, text, {platforms, delivery, productType: product.productType});
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
  // Three fixed anchors plus three that rotate by day of year. The fixed
  // three are the bundles, whose blocks are the most complex to assemble.
  // The rotation exists because the tail used to be `slice(0, 2)`, the same
  // two handles every run: on 2026-09-23 the answer block fix changed the
  // Moon Jar and Froggy goal widgets and this check passed without looking
  // at either of them. A fixed sample cannot see a product it never fetches.
  const handles = [...blocks.keys()];
  const dayOfYear = Math.floor(
    (Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 0)) / 86400000,
  );
  const rotating = handles.length
    ? [0, 1, 2].map((i) => handles[(dayOfYear * 3 + i) % handles.length])
    : [];
  const sample = [
    'celestial-stream-kit',
    'multistream-chat-widget-pack',
    'spooky-stream-kit',
    ...rotating,
  ].filter((h, i, a) => blocks.has(h) && a.indexOf(h) === i);
  console.log(`live sample (day ${dayOfYear}): ${sample.join(', ')}`);
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
