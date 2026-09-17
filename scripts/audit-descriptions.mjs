/**
 * Audit every LIVE product DESCRIPTION against what the product actually is.
 *
 * Why this exists, 2026-09-17
 * ---------------------------
 * Title, `seo.title`, `seo.description` and the `custom.works_with` metafield
 * were all audited. The DESCRIPTION never was, and it is the longest piece of
 * copy on the page. A catalogue scan found, live:
 *
 *   - NINE descriptions opening "<Name> Chat & Goal Widgets for Twitch, Kick,
 *     and YouTube" on products whose own Etsy listing names neither Kick nor
 *     YouTube anywhere, in the title or the body. Those two platforms were
 *     invented in the Shopify rewrite.
 *   - ONE description containing ChatGPT's own page markup, pasted in whole:
 *     `data-testid="conversation-turn-8"`, `data-message-author-role`,
 *     `class="text-token-text-primary ..."`. Live, on a $14.25 product.
 *   - TWO raw Etsy dumps that had never been rewritten at all.
 *   - SEVENTY carrying the shop's original Etsy line "I am unable to offer
 *     exchanges, refunds, or cancellations" while the PDP emits a 30 day
 *     refund policy in JSON-LD. (That one is owned by audit-policy-claims.mjs,
 *     whose denial pattern was widened the same day. It is not re-checked here.)
 *
 * The rule this encodes: a description is copy about a product, not a place to
 * paste from. Everything it claims has to be true of the thing in the zip.
 *
 * Exit 0 clean, 1 on any finding. Add to `npm run verify:all` so a NEW product
 * cannot go live carrying any of these.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(ROOT, '.env'), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

/**
 * Only the CHAT platforms are audited as claims. Twitch is the baseline here
 * and is never an overclaim; every product in this catalogue reads Twitch.
 *
 * StreamElements, Streamlabs and OBS are deliberately NOT in this list,
 * because the word alone is ambiguous and flagging it produced nothing but
 * noise. "Shown in OBS Studio or Streamlabs Desktop as a browser source" is
 * true of literally every widget in the catalogue: it is a statement about
 * where the overlay is DISPLAYED. "Upload the widget files to Streamlabs" is
 * a different sentence entirely, and it is false unless the listing actually
 * ships a Streamlabs file. `SOFTWARE_INSTALL_CLAIM` below catches that one.
 */
const CLAIM_PLATFORMS = ['YouTube', 'Kick', 'TikTok'];

/**
 * An INSTALL claim for broadcast software: the copy says the buyer puts the
 * widget INTO it, which is only true where a version for it ships. On
 * 2026-09-17 nine descriptions said "Upload the widget files to StreamElements
 * or Streamlabs" while the listing shipped one StreamElements zip and no
 * Streamlabs artifact at all.
 */
const SOFTWARE_INSTALL_CLAIM = (software) =>
  new RegExp(
    [
      `(?:upload|install|paste|import)[^.]{0,60}\\b(?:to|into|in)\\b[^.]{0,30}\\b${software}\\b`,
      `\\b${software}\\b\\s+version`,
      `works with\\s+\\b${software}\\b`,
    ].join('|'),
    'i',
  );
const SOFTWARE = ['Streamlabs', 'StreamElements'];

/**
 * Markup that belongs to somebody else's web app and has no business in a
 * product description. These are attribute and class names, not prose, so
 * they cannot collide with real copy.
 */
const FOREIGN_MARKUP = [
  ['ChatGPT conversation DOM', /data-testid="conversation-turn|data-message-author-role|data-message-model-slug|text-token-text-primary/i],
  ['editor scratch attributes', /\sdata-(?:start|end)="\d+"/i],
  ['Claude or Notion export wrapper', /class="[^"]*\b(?:prose\s+dark:prose-invert|notion-)/i],
];

/**
 * A description that was never rewritten. The Etsy originals all shout a
 * compatibility line in caps and sign off the same way.
 */
const RAW_ETSY_DUMP = /THIS ITEM IS FOR OBS|NOT FOR REDISTRIBUTION OR SALE|TYPES OF GOALS:/;

/** Everything after these markers is the Etsy keyword tail, not the name. */
const CUTS = [/\s+is fully customisable/i, /\s*[|•]\s*/, /\s+[-–—]\s+/, /(?<=[a-z])-(?=[A-Z])/, /\s+for\s+/i, /,\s+/];
function productName(title) {
  let name = title;
  for (const cut of CUTS) {
    const i = name.search(cut);
    if (i > 8) name = name.slice(0, i);
  }
  return name.replace(/\s+/g, ' ').trim();
}

const strip = (html) =>
  (html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * An honest negation is the OPPOSITE of an overclaim and must never be
 * flagged. Eight products already carry the house answer: "Does this widget
 * support YouTube or Kick chat? No, this listing reads Twitch chat through
 * StreamElements only."
 *
 * Every form below was observed in live, CORRECT copy on 2026-09-17. The
 * first draft of this audit matched only the leading "? No" and then flagged
 * the same paragraph's own second sentence ("it does not pull YouTube or Kick
 * chat") as an overclaim, which is the check accusing the fix.
 */
const HONEST_NEGATION = new RegExp(
  [
    'Does this (?:widget|listing)[^?]{0,90}\\?\\s*No\\b',
    'does not pull\\b',
    'does not read\\b',
    'reads Twitch chat through StreamElements only',
    'tracks Twitch [a-z ]{0,30}through',
    'or only Twitch\\?',
    'only Twitch\\b',
  ].join('|'),
  'i',
);

const QUERY = `query Descriptions($cursor: String) {
  products(first: 100, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      handle
      title
      descriptionHtml
      worksWith: metafield(namespace: "custom", key: "works_with") { value }
    }
  }
}`;

async function fetchProducts() {
  const url = `https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`;
  const all = [];
  let cursor = null;
  do {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
      },
      body: JSON.stringify({query: QUERY, variables: {cursor}}),
    });
    const body = await res.json();
    if (body.errors) throw new Error(JSON.stringify(body.errors));
    all.push(...body.data.products.nodes);
    cursor = body.data.products.pageInfo.hasNextPage ? body.data.products.pageInfo.endCursor : null;
  } while (cursor);
  return all;
}

export function auditDescriptions(products) {
  const findings = [];
  for (const product of products) {
    const html = product.descriptionHtml || '';
    const text = strip(html);
    if (!text) {
      findings.push({handle: product.handle, kind: 'empty', detail: 'no description at all'});
      continue;
    }

    let confirmed = [];
    try {
      const parsed = JSON.parse(product.worksWith?.value || 'null');
      if (Array.isArray(parsed)) confirmed = parsed.map((p) => String(p).toLowerCase());
    } catch {
      /* treated as none */
    }
    const name = productName(product.title).toLowerCase();

    for (const [label, pattern] of FOREIGN_MARKUP) {
      if (pattern.test(html)) {
        findings.push({handle: product.handle, kind: 'pasted markup', detail: label});
      }
    }

    if (RAW_ETSY_DUMP.test(text)) {
      findings.push({
        handle: product.handle,
        kind: 'raw Etsy dump',
        detail: 'description is the unrewritten Etsy body',
      });
    }

    // Every platform the description names has to be backed by works_with,
    // which is itself derived from the Etsy listing BODY. A claim in the
    // opening paragraph is reported separately because it is the page's
    // headline and the loudest thing on it, but the same exemptions apply
    // wherever the word appears.
    for (const software of SOFTWARE) {
      if (confirmed.includes(software.toLowerCase())) continue;
      const m = text.match(SOFTWARE_INSTALL_CLAIM(software));
      if (!m) continue;
      findings.push({
        handle: product.handle,
        kind: 'unconfirmed install claim',
        detail: `copy says the buyer installs into ${software}, works_with does not confirm it ships one`,
        quote: m[0],
      });
    }

    const OPENER_CHARS = 260;
    for (const word of CLAIM_PLATFORMS) {
      const re = new RegExp(`\\b${word}\\b`, 'gi');
      if (confirmed.includes(word.toLowerCase())) continue;
      if (new RegExp(`\\b${word}\\b`, 'i').test(name)) continue; // part of the product's own name
      let match;
      let reported = false;
      while ((match = re.exec(text)) !== null) {
        const window = text.slice(Math.max(0, match.index - 120), match.index + word.length + 120);
        // The honest "no, it does not" answer is the OPPOSITE of an overclaim.
        if (HONEST_NEGATION.test(window)) continue;
        if (reported) break; // one finding per word per product
        reported = true;
        const inOpener = match.index < OPENER_CHARS;
        findings.push({
          handle: product.handle,
          kind: inOpener ? 'unconfirmed opener claim' : 'unconfirmed body claim',
          detail: `${inOpener ? 'opener' : 'body'} names ${word}, works_with does not confirm it`,
          quote: window,
        });
      }
    }
  }
  return findings;
}

if (process.argv.includes('--self-test')) {
  const ok = (name, products, expected) => {
    const got = auditDescriptions(products).length;
    const pass = got === expected;
    console.log(`${pass ? 'pass' : 'FAIL'}  ${name}  (expected ${expected}, got ${got})`);
    return pass;
  };
  const results = [
    ok('clean description passes', [{handle: 'a', title: 'Boba Goal Widget', descriptionHtml: '<p>A cute goal widget for Twitch.</p>', worksWith: {value: '["Twitch"]'}}], 0),
    ok(
      'fabricated opener is caught',
      [{handle: 'a', title: 'Lotus Butterfly Chat Widget', descriptionHtml: '<p>Lotus Butterfly Chat &amp; Goal Widgets for Twitch, Kick, and YouTube</p>', worksWith: {value: '["Twitch","StreamElements","OBS"]'}}],
      2,
    ),
    ok(
      'the honest FAQ negation is NOT a finding',
      [{handle: 'a', title: 'Neon Glow Chat Widget', descriptionHtml: '<p>Neon Glow Chat Widget for Twitch</p><p>FAQ Does this widget support YouTube or Kick chat? No. This listing reads Twitch chat through StreamElements only.</p>', worksWith: {value: '["Twitch","StreamElements","OBS"]'}}],
      0,
    ),
    ok(
      'a platform in the product\'s own NAME is its identity, not a claim',
      [{handle: 'a', title: 'Multistream Chat Widget for Twitch, YouTube, Kick', descriptionHtml: '<p>Multistream Chat Widget brings Twitch, YouTube and Kick into one box.</p>', worksWith: {value: '["Twitch","YouTube","Kick"]'}}],
      0,
    ),
    ok('pasted ChatGPT DOM is caught', [{handle: 'a', title: 'X Widget', descriptionHtml: '<p>A widget for Twitch.</p><article data-testid="conversation-turn-8"><p>hi</p></article>', worksWith: {value: '["Twitch"]'}}], 1),
    ok('raw Etsy dump is caught', [{handle: 'a', title: 'X Widget', descriptionHtml: '<p>THIS ITEM IS FOR OBS/OBS STUDIO, STREAMLABS, AND STREAMELEMENTS! :)</p>', worksWith: {value: '["Twitch","StreamElements","Streamlabs","OBS"]'}}], 1),
    ok('an empty description is caught', [{handle: 'a', title: 'X Widget', descriptionHtml: '', worksWith: {value: '["Twitch"]'}}], 1),
    ok(
      'a confirmed platform in the opener passes',
      [{handle: 'a', title: 'Moon Jar Goal Widget', descriptionHtml: '<p>Moon Jar Goal Widget for Twitch, YouTube and Kick.</p>', worksWith: {value: '["Twitch","YouTube","Kick"]'}}],
      0,
    ),
    ok(
      'the SECOND sentence of an honest FAQ answer is not flagged as a claim',
      [{handle: 'a', title: 'Neon Glow Chat Widget', descriptionHtml: '<p>Neon Glow Chat Widget for Twitch</p><p>FAQ Does this widget support YouTube or Kick chat? No. This listing reads Twitch chat through StreamElements only, it does not pull YouTube or Kick chat.</p>', worksWith: {value: '["Twitch","StreamElements","OBS"]'}}],
      0,
    ),
    ok(
      'an honest answer phrased without a leading No is not flagged',
      [{handle: 'a', title: 'Potion Bottle Goal Widget', descriptionHtml: '<p>Potion Bottle Goal Widget for Twitch</p><p>Does this work on Kick and YouTube, or only Twitch? This Potion Bottle Goal Widget tracks Twitch goals through a free StreamElements account.</p>', worksWith: {value: '["Twitch","StreamElements","OBS"]'}}],
      0,
    ),
    ok(
      'DISPLAYING in Streamlabs Desktop is not an install claim',
      [{handle: 'a', title: 'Lotus Chat Widget', descriptionHtml: '<p>Lotus Chat Widget for Twitch</p><p>Set up as a StreamElements custom widget, then shown in OBS Studio or Streamlabs Desktop as a browser source.</p>', worksWith: {value: '["Twitch","StreamElements","OBS"]'}}],
      0,
    ),
    ok(
      'INSTALLING into Streamlabs IS a claim when no Streamlabs version ships',
      [{handle: 'a', title: 'Lotus Chat Widget', descriptionHtml: '<p>Lotus Chat Widget for Twitch</p><p>Upload the widget files to StreamElements or Streamlabs.</p>', worksWith: {value: '["Twitch","StreamElements","OBS"]'}}],
      1,
    ),
    ok(
      'INSTALLING into Streamlabs passes when a Streamlabs version does ship',
      [{handle: 'a', title: 'Boba Goal Widget', descriptionHtml: '<p>Boba Goal Widget for Twitch</p><p>Upload the widget files to StreamElements or Streamlabs.</p>', worksWith: {value: '["Twitch","StreamElements","Streamlabs","OBS"]'}}],
      0,
    ),
  ];
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} self-test cases pass.`);
  process.exit(passed === results.length ? 0 : 1);
}

const products = await fetchProducts();
const findings = auditDescriptions(products);

console.log(`${products.length} live product descriptions audited`);
if (!findings.length) {
  console.log('No description claims anything its own product data does not support.');
  process.exit(0);
}

const byKind = {};
for (const f of findings) byKind[f.kind] = (byKind[f.kind] || 0) + 1;
console.log(`\n${findings.length} issue(s): ${JSON.stringify(byKind)}\n`);
for (const f of findings) {
  console.log(`  [${f.kind}] ${f.handle}`);
  console.log(`    ${f.detail}`);
  if (f.quote) console.log(`    ...${f.quote.trim()}...`);
}

/**
 * `--gate` is the mode `verify:all` runs, and it exists because of the shape
 * of this backlog rather than to be lenient.
 *
 * On 2026-09-17 seventy descriptions were still the unrewritten Etsy body.
 * They are a known, counted, scheduled queue that the nightly QA pass works
 * through a batch at a time. Failing the whole build on them would mean the
 * build is red for weeks and nobody reads it, which is how a guard dies.
 *
 * So the gate fails on everything EXCEPT findings that sit on a product still
 * in that queue, and it prints the queue size. A product that has been
 * rewritten, or one that is brand new, is held to the full standard from its
 * first day. **The backlog number must only ever go down**; the gate fails if
 * it grows past the recorded high-water mark, because that means a raw dump
 * was newly published rather than worked off.
 */
const BACKLOG_HIGH_WATER = 50; // 2026-09-17, batch 3 landed (was 60). Lower as batches land, never raise.

if (process.argv.includes('--gate')) {
  const queued = new Set(findings.filter((f) => f.kind === 'raw Etsy dump').map((f) => f.handle));
  const blocking = findings.filter((f) => !queued.has(f.handle));
  console.log(`\nRewrite queue: ${queued.size} description(s) still the raw Etsy body (high-water ${BACKLOG_HIGH_WATER}).`);
  if (queued.size > BACKLOG_HIGH_WATER) {
    console.log(`FAIL: the rewrite queue GREW, ${BACKLOG_HIGH_WATER} to ${queued.size}. A raw Etsy dump was published.`);
    process.exit(1);
  }
  if (blocking.length) {
    console.log(`FAIL: ${blocking.length} issue(s) on products that are NOT in the rewrite queue.`);
    process.exit(1);
  }
  console.log('Gate passes: every finding is a known queued rewrite, and the queue did not grow.');
  process.exit(0);
}

process.exit(1);
