/**
 * Audit every multistream claim in the catalogue against what the product
 * actually ships.
 *
 * Why this exists, 2026-09-22
 * ---------------------------
 * Todd: "we need better info on widgets that are multistream vs. not, e.g.
 * product must be multistream enabled or its not multistream."
 *
 * The defect behind that: the Froggy Goal Widget and the Moon Jar Goal Widget
 * both wore a card ribbon whose own aria-label read "reads chat from more
 * than one platform". Neither reads chat from anywhere. Their `works_with`
 * lists Twitch, YouTube and Kick because the STREAMER can be live on any of
 * those while the widget counts events through StreamElements, and the old
 * `isMultistream` read that list as a chat claim.
 *
 * So a platform name means two different things depending on the product, and
 * this is the check that keeps the two apart:
 *
 *   chat widget   a platform is a chat source the widget reads
 *   goal widget   a platform is somewhere the streamer can be live
 *
 * It fails on a claim the product cannot back, in either direction: a ribbon
 * on something chatless, and the word "multistream" in a title or description
 * on something that is not.
 *
 * Usage:
 *   node scripts/audit-multistream.mjs [--json]
 *   node scripts/audit-multistream.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const selfTest = process.argv.includes('--self-test');

const {isMultistream, shipsChat, chatPlatforms, parseWorksWith} = await import(
  pathToFileURL(path.join(ROOT, 'app/lib/platforms.js'))
);

const MULTISTREAM_WORD = /multi\s?-?stream/i;
// Filenames named in "What You Get" are not claims about the product. The
// Neon Glow chat widget ships `MultistreamNeonChatCode.zip` while its own FAQ
// says "No. This listing reads Twitch chat through StreamElements only", and
// matching the raw description flagged it on the strength of a zip name. The
// filename is still worth knowing about, so it becomes a note below rather
// than disappearing.
const FILENAME = /\S+\.(zip|html|pdf|txt|json|png|jpe?g)\b/gi;
const withoutFilenames = (text) => (text ?? '').replace(FILENAME, ' ');

const findings = [];
const notes = [];
const fail = (handle, message) => findings.push(`${handle}: ${message}`);

/**
 * Every rule that needs no network, so --self-test can point the same rules
 * at fabricated products.
 * @param {{handle: string, title: string, productType: string|null, worksWith: string|null, description: string}} product
 */
export function auditProduct(product) {
  const {handle, title, description} = product;
  const ribbon = isMultistream(product);
  const platforms = parseWorksWith(product.worksWith) ?? [];
  const sources = chatPlatforms(product);

  // 1. The ribbon must never appear on something that ships no chat. This is
  //    the defect that was live: the label says "reads chat from more than
  //    one platform" and a goal widget reads none.
  if (ribbon && !shipsChat(product)) {
    fail(handle, `ribbon on a chatless product type "${product.productType}"`);
  }

  // 2. The word in the copy must match the product. A title saying
  //    "multistream" on a widget that reads one platform is the claim a buyer
  //    refunds over, and Etsy keyword titles here are full of platform names
  //    the widget does not support.
  const saysMultistream =
    MULTISTREAM_WORD.test(withoutFilenames(title)) ||
    MULTISTREAM_WORD.test(withoutFilenames(description));
  if (saysMultistream && !ribbon) {
    const why = !shipsChat(product)
      ? `it ships no chat (type "${product.productType}")`
      : `its chat reads ${sources.length ? sources.join(' + ') : 'nothing'}`;
    fail(handle, `copy says multistream but ${why}`);
  }

  // 2b. A file the buyer unzips that is named "multistream" on a product that
  //     is not. Not a page claim, so not a finding, but it is the first thing
  //     they see after paying and it contradicts the listing they read.
  const filenames = (description ?? '').match(FILENAME) ?? [];
  const misleadingFile = filenames.find((name) => MULTISTREAM_WORD.test(name));
  if (misleadingFile && !ribbon) {
    notes.push(`${handle}: ships a file named ${misleadingFile} but is not multistream`);
  }

  // 3. A chat widget reading two or more platforms that is NOT badged means
  //    the definition and the data have drifted apart. Reported as a note,
  //    not a failure: reading Twitch and TikTok is genuinely multistream but
  //    the ribbon deliberately requires YouTube and Kick, which is a product
  //    decision rather than a defect.
  if (!ribbon && shipsChat(product) && sources.length > 1) {
    notes.push(
      `${handle}: reads ${sources.join(' + ')} but earns no ribbon, which needs YouTube and Kick`,
    );
  }

  // 4. A chat widget with no chat source at all cannot say anything useful.
  if (shipsChat(product) && platforms.length && sources.length === 0) {
    fail(handle, 'a chat-carrying product whose works_with names no chat platform');
  }
}

if (selfTest) {
  const p = (over) => ({
    handle: 'test',
    title: 'Test Widget',
    productType: 'Chat Widget',
    worksWith: JSON.stringify(['Twitch', 'YouTube', 'Kick']),
    description: '',
    ...over,
  });
  const caught = (product) => {
    const before = findings.length;
    auditProduct(product);
    const did = findings.length > before;
    findings.length = before;
    return did;
  };

  const cases = [
    ['a goal widget with YouTube and Kick earns no ribbon', () =>
      isMultistream(p({productType: 'Goal Widget'})) === false],
    ['a chat widget with YouTube and Kick does', () => isMultistream(p()) === true],
    ['a chat widget on Twitch alone does not', () =>
      isMultistream(p({worksWith: JSON.stringify(['Twitch', 'OBS'])})) === false],
    ['an emotes pack never does', () =>
      isMultistream(p({productType: 'Emotes'})) === false],
    ['a missing product type never does', () =>
      isMultistream(p({productType: null})) === false],
    ['a bundle can', () => isMultistream(p({productType: 'Bundle'})) === true],
    ['StreamElements is not a chat source', () =>
      chatPlatforms(p({worksWith: JSON.stringify(['Twitch', 'StreamElements', 'OBS'])}))
        .join() === 'Twitch'],
    ['a goal widget reports no chat sources at all', () =>
      chatPlatforms(p({productType: 'Goal Widget'})).length === 0],
    ['a title claiming multistream on a goal widget is a finding', () =>
      caught(p({productType: 'Goal Widget', title: 'Multistream Goal Widget'}))],
    ['a description claiming multistream on a Twitch-only chat widget is a finding', () =>
      caught(
        p({
          worksWith: JSON.stringify(['Twitch', 'OBS']),
          description: 'A multistream chat overlay.',
        }),
      )],
    ['a real multistream chat widget saying so is NOT a finding', () =>
      !caught(p({title: 'Multistream Chat Widget'}))],
    ['a chat product whose works_with names no chat platform is a finding', () =>
      caught(p({worksWith: JSON.stringify(['StreamElements', 'OBS'])}))],
    ['a goal widget saying nothing about multistream is NOT a finding', () =>
      !caught(p({productType: 'Goal Widget'}))],
  ];

  let pass = 0;
  for (const [name, run] of cases) {
    let ok = false;
    try {
      ok = run() === true;
    } catch (error) {
      console.log(`  threw: ${error.message}`);
    }
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (ok) pass += 1;
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

const QUERY = `query($cursor: String) {
  products(first: 100, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      handle
      title
      description
      productType
      metafield(namespace: "custom", key: "works_with") { value }
    }
  }
}`;

const products = [];
let cursor = null;
do {
  const response = await fetch(
    `https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
      },
      body: JSON.stringify({query: QUERY, variables: {cursor}}),
    },
  );
  const data = await response.json();
  const page = data?.data?.products;
  if (!page) {
    console.error('Storefront API returned no products:', JSON.stringify(data).slice(0, 300));
    process.exit(1);
  }
  products.push(...page.nodes);
  cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
} while (cursor);

console.log(`Multistream claims audit: ${products.length} products`);

for (const node of products) {
  auditProduct({
    handle: node.handle,
    title: node.title,
    description: node.description ?? '',
    productType: node.productType,
    worksWith: node.metafield?.value ?? null,
  });
}

const badged = products.filter((node) =>
  isMultistream({productType: node.productType, worksWith: node.metafield?.value}),
);
const chatCarrying = products.filter((node) => shipsChat({productType: node.productType}));
console.log(
  `  ${badged.length} multistream, ${chatCarrying.length} ship chat, ${products.length - chatCarrying.length} ship none`,
);

if (notes.length) {
  console.log(`\n${notes.length} note${notes.length === 1 ? '' : 's'}:`);
  for (const note of notes) console.log(`  - ${note}`);
}

if (findings.length) {
  console.log(`\n${findings.length} finding${findings.length === 1 ? '' : 's'}:`);
  for (const f of findings) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('\nNo findings.');
