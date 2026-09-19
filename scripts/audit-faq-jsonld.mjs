/**
 * Audit the FAQPage JSON-LD that FaqAccordion emits on the FAQ page and on
 * every product page.
 *
 * Why this exists, 2026-09-19
 * ---------------------------
 * There was zero FAQPage markup on this site until today, so an answer engine
 * reading the FAQ had eleven questions rendered as <details> elements and no
 * machine-readable claim about which text answered which question.
 *
 * The failure mode this guards is not "the markup is missing". It is "the
 * markup and the page disagree". The FAQ body lives in Shopify and Todd can
 * edit it without touching this repo, so the only safe construction is the
 * one used here: parse the same body the accordion renders, and assert the
 * counts still match. A hand-kept copy of the questions would pass on the day
 * it was written and lie every day after.
 *
 * Without --live it checks the real FAQ body still holds Q&A pairs at all, and
 * --self-test runs the builder and every rule against fabricated bad input. --live fetches the FAQ page and a product page and asserts the
 * served HTML carries a FAQPage block with one Question per rendered <details>.
 *
 * Usage:
 *   node scripts/audit-faq-jsonld.mjs [--live] [--origin https://...]
 *   node scripts/audit-faq-jsonld.mjs --self-test
 */
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const ORIGIN = arg('--origin', process.env.SWS_ORIGIN || 'https://streamwidgetshop.com');
const live = process.argv.includes('--live');
const selfTest = process.argv.includes('--self-test');

const FAQ_PATH = '/pages/faq-frequently-asked-questions';
// One product page is enough to prove the shared component carries the markup
// onto the PDP: it is the same component, deferred behind the same Await.
const SAMPLE_PRODUCT = arg('--product', 'celestial-stream-kit');

const {buildFaqJsonLd} = await import(
  pathToFileURL(path.join(ROOT, 'app/lib/faqJsonLd.js'))
);

const DASHES = /[—–]/;

const findings = [];
const fail = (where, message) => findings.push(`${where}: ${message}`);

/**
 * Every assertion about a built FAQPage object that needs no network, so the
 * same rules can be pointed at fabricated bad input by --self-test.
 * @param {string} where
 * @param {object | null} jsonLd
 * @param {number} expectedQuestions how many Q&A pairs the source body holds
 */
function checkJsonLd(where, jsonLd, expectedQuestions) {
  if (expectedQuestions === 0) {
    if (jsonLd) fail(where, 'built a FAQPage from a body with no Q&A pairs');
    return;
  }
  if (!jsonLd) {
    fail(where, `no FAQPage built, but the body holds ${expectedQuestions} Q&A pairs`);
    return;
  }
  if (jsonLd['@type'] !== 'FAQPage') fail(where, `@type is ${jsonLd['@type']}, not FAQPage`);
  if (jsonLd['@context'] !== 'https://schema.org') fail(where, '@context is not https://schema.org');

  const entities = jsonLd.mainEntity ?? [];
  if (entities.length !== expectedQuestions) {
    fail(
      where,
      `${entities.length} Question entries for ${expectedQuestions} Q&A pairs on the page, so the markup and the page disagree`,
    );
  }

  const seen = new Set();
  for (const entity of entities) {
    const name = entity?.name ?? '';
    const answer = entity?.acceptedAnswer?.text ?? '';
    const label = name ? `"${name.slice(0, 40)}"` : '(unnamed)';
    if (entity?.['@type'] !== 'Question') fail(where, `${label} is @type ${entity?.['@type']}`);
    if (!name.trim()) fail(where, 'a Question has an empty name');
    if (entity?.acceptedAnswer?.['@type'] !== 'Answer') {
      fail(where, `${label} acceptedAnswer is not @type Answer`);
    }
    if (!answer.trim()) fail(where, `${label} has an empty acceptedAnswer.text`);
    // Todd's hard rule, and it applies to anything quotable.
    if (DASHES.test(name) || DASHES.test(answer)) fail(where, `${label} contains an em dash or en dash`);
    if (/\s{2,}/.test(name) || /\s{2,}/.test(answer)) {
      fail(where, `${label} carries collapsed-out whitespace, so the builder stopped collapsing`);
    }
    if (/<[a-z/]/i.test(name) || /<[a-z/]/i.test(answer)) fail(where, `${label} still carries HTML tags`);
    const key = name.trim().toLowerCase();
    if (seen.has(key)) fail(where, `duplicate question ${label}`);
    seen.add(key);
  }
}

/** Counts the <details class="faq-item"> blocks the accordion actually rendered. */
function renderedQaCount(html) {
  return (html.match(/<details class="faq-item">/g) ?? []).length;
}

/** Every application/ld+json block on a page, parsed. Throws nothing: a bad block is a finding. */
function jsonLdBlocks(where, html) {
  const raw = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  const parsed = [];
  for (const [, body] of raw) {
    try {
      parsed.push(JSON.parse(body));
    } catch (error) {
      // Worse than a missing block: one unparseable block can cost the whole
      // page its rich results, including the Product markup next to it.
      fail(where, `an application/ld+json block does not parse (${error.message})`);
    }
  }
  return parsed;
}

async function auditLivePage(where, url) {
  const response = await fetch(url);
  if (!response.ok) {
    fail(where, `HTTP ${response.status}`);
    return;
  }
  const html = await response.text();
  const blocks = jsonLdBlocks(where, html);
  const faq = blocks.find((b) => b?.['@type'] === 'FAQPage');
  const rendered = renderedQaCount(html);
  if (rendered === 0) {
    fail(where, 'no FAQ accordion rendered at all, so this page cannot be checked');
    return;
  }
  checkJsonLd(where, faq ?? null, rendered);
  console.log(
    `  ${where}: ${rendered} rendered questions, ${faq?.mainEntity?.length ?? 0} in FAQPage, ${blocks.length} JSON-LD blocks all parsed`,
  );
}

if (selfTest) {
  const body = (pairs, categories = []) =>
    [...categories.map((c) => `<p>${c}</p>`), ...pairs.map(([q, a]) => `<p>${q}<br>${a}</p>`)].join('');

  const cases = [
    ['a real pair builds one Question', () => {
      const out = buildFaqJsonLd(body([['How long does delivery take?', 'Instantly.']]));
      return out?.mainEntity?.length === 1 && out.mainEntity[0].acceptedAnswer.text === 'Instantly.';
    }],
    ['category headers are not questions', () => {
      const out = buildFaqJsonLd(body([['Q?', 'A.']], ['GETTING STARTED']));
      return out.mainEntity.length === 1;
    }],
    ['an empty body builds nothing', () => buildFaqJsonLd('') === null],
    ['a body of only categories builds nothing', () => buildFaqJsonLd(body([], ['ORDERS'])) === null],
    ['a pair with no answer is dropped', () => buildFaqJsonLd(body([['Q?', '']])) === null],
    ['runs of whitespace are collapsed', () => {
      const out = buildFaqJsonLd(body([['Q?', 'One   two    three.']]));
      return out.mainEntity[0].acceptedAnswer.text === 'One two three.';
    }],
    ['HTML inside an answer is stripped', () => {
      const out = buildFaqJsonLd(body([['Q?', 'Email <strong>us</strong>.']]));
      return !/<[a-z/]/i.test(out.mainEntity[0].acceptedAnswer.text);
    }],
    ['entities are decoded, not left raw', () => {
      const out = buildFaqJsonLd(body([['Chat &amp; goal?', 'Yes &amp; yes.']]));
      return out.mainEntity[0].name === 'Chat & goal?';
    }],
    ['checkJsonLd catches a count mismatch', () => {
      const before = findings.length;
      checkJsonLd('self-test', buildFaqJsonLd(body([['Q?', 'A.']])), 2);
      const caught = findings.length > before;
      findings.length = before;
      return caught;
    }],
    ['checkJsonLd catches an em dash', () => {
      const before = findings.length;
      checkJsonLd('self-test', buildFaqJsonLd(body([['Q?', 'A — yes.']])), 1);
      const caught = findings.length > before;
      findings.length = before;
      return caught;
    }],
    ['checkJsonLd catches a duplicate question', () => {
      const before = findings.length;
      checkJsonLd('self-test', buildFaqJsonLd(body([['Q?', 'A.'], ['Q?', 'B.']])), 2);
      const caught = findings.length > before;
      findings.length = before;
      return caught;
    }],
    ['checkJsonLd catches a missing FAQPage', () => {
      const before = findings.length;
      checkJsonLd('self-test', null, 3);
      const caught = findings.length > before;
      findings.length = before;
      return caught;
    }],
    ['jsonLdBlocks catches an unparseable block', () => {
      const before = findings.length;
      jsonLdBlocks('self-test', '<script type="application/ld+json">{nope}</script>');
      const caught = findings.length > before;
      findings.length = before;
      return caught;
    }],
  ];

  let pass = 0;
  for (const [name, run] of cases) {
    let ok = false;
    try {
      ok = run() === true;
    } catch (error) {
      ok = false;
      console.log(`  threw: ${error.message}`);
    }
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (ok) pass += 1;
  }
  console.log(`\n${pass}/${cases.length} self-test cases pass.`);
  process.exit(pass === cases.length ? 0 : 1);
}

// Text run: the real FAQ body, fetched once, and checked for the Q&A pairs the
// markup is built from. This is the form that runs in verify:all, so it asserts
// nothing about a deploy having happened; --live is what checks the served HTML.
console.log(`FAQPage JSON-LD audit (${ORIGIN})`);
const faqResponse = await fetch(`${ORIGIN}${FAQ_PATH}`);
if (!faqResponse.ok) {
  fail('faq page', `HTTP ${faqResponse.status} fetching the FAQ body`);
} else {
  const html = await faqResponse.text();
  const rendered = renderedQaCount(html);
  console.log(`  source: ${rendered} Q&A pairs rendered on ${FAQ_PATH}`);
  if (rendered === 0) fail('faq page', 'the FAQ page renders no Q&A pairs at all');
}

if (live) {
  await auditLivePage('faq page', `${ORIGIN}${FAQ_PATH}`);
  await auditLivePage(`pdp ${SAMPLE_PRODUCT}`, `${ORIGIN}/products/${SAMPLE_PRODUCT}`);
}

if (findings.length) {
  console.log(`\n${findings.length} finding${findings.length === 1 ? '' : 's'}:`);
  for (const f of findings) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('\nNo findings.');
