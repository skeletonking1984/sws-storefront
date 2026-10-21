/**
 * Does the sitemap tell search engines the truth?
 *
 * Why, 2026-10-05. The live product sitemap carried `<lastmod>2026-10-05` on
 * all 141 product URLs while Shopify Admin said only 125 had changed that day.
 * Cause: `sitemap(type: PRODUCT)` on the Storefront API returns the REQUEST
 * TIME as each item's `updatedAt` (141 identical timestamps, a different one
 * 20 seconds later), not the product's last change. Nothing here looked at the
 * sitemap's CONTENT: site-health fetches every listed URL, which proves the
 * URLs load and says nothing about whether the sitemap lists the right ones
 * or dates them honestly. A lastmod that is always "today" teaches Google to
 * ignore the tag for the whole site.
 *
 * What it does, against `--origin` (default production):
 *
 *   1. Fetches /sitemap.xml and every child it lists.
 *   2. Membership. Every published product, collection, page (minus the
 *      deliberate exclusions in app/lib/sitemap.js), blog and blog article
 *      on the Storefront API is in the sitemap, and nothing else is. Counts,
 *      missing handles, extra handles, duplicates.
 *   3. Every listed URL answers 200 on `--origin` (redirects count as a
 *      failure: the sitemap must list the final URL).
 *   4. Lastmod. Present on every resource section, a real calendar date,
 *      not in the future, and NOT identical across a whole section.
 *   5. Lastmod vs the truth. A product, collection or page whose lastmod
 *      is NEWER than the API's own `updatedAt` is an error (the sitemap is
 *      claiming a change that did not happen). Older by up to 2 days is a
 *      warning (the 1h edge cache plus 24h stale-while-revalidate), more
 *      than that is an error. Articles are skipped: the Storefront API has
 *      `publishedAt` only, so there is no truth to compare to.
 *
 * Exit 1 on any error. Warnings never fail the run.
 *
 * Credentials: the public Storefront token. Taken from the environment
 * (PUBLIC_STORE_DOMAIN + PUBLIC_STOREFRONT_API_TOKEN), then this repo's .env,
 * then read out of the served HTML of `--origin`, which carries it by design.
 *
 * Usage:
 *   node scripts/audit-sitemap.mjs                      # production
 *   node scripts/audit-sitemap.mjs --origin http://localhost:3111
 *   node scripts/audit-sitemap.mjs --no-fetch           # skip the per-URL 200 check
 *   node scripts/audit-sitemap.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

// ---- Pure half ---------------------------------------------------------------

/** `<url>` blocks of a urlset: loc, lastmod, and the video publication date if any. */
export function parseUrlset(xml) {
  const entries = [];
  for (const block of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const body = block[1];
    entries.push({
      loc: body.match(/<loc>([^<]*)<\/loc>/)?.[1]?.trim() ?? '',
      lastmod: body.match(/<lastmod>([^<]*)<\/lastmod>/)?.[1]?.trim() ?? null,
      videoDate:
        body.match(/<video:publication_date>([^<]*)<\/video:publication_date>/)?.[1]?.trim() ?? null,
    });
  }
  return entries;
}

/** `<loc>`s of a sitemap index. */
export function parseIndex(xml) {
  return [...xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

/** W3C date or datetime, and a real calendar day. Returns the YYYY-MM-DD or null. */
export function validDay(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(value ?? '');
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
  const same =
    date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(mo) - 1 &&
    date.getUTCDate() === Number(d);
  return same ? `${y}-${mo}-${d}` : null;
}

const dayNumber = (day) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 86_400_000);

/** The `/products/<handle>` style key of a URL, or the raw loc when it will not parse. */
export function keyOf(loc) {
  try {
    return decodeURI(new URL(loc).pathname).replace(/\/$/, '') || '/';
  } catch {
    return loc;
  }
}

/**
 * Findings for one section's entries.
 * @param {object} o
 * @param {string} o.section            label used in messages
 * @param {{loc: string, lastmod: string|null}[]} o.entries
 * @param {Set<string>|null} o.expected expected path keys, null = no membership check
 * @param {boolean} o.lastmodRequired
 * @param {string} o.today              YYYY-MM-DD, UTC
 * @param {Map<string, string>|null} o.truth path key -> API updatedAt (ISO)
 */
export function auditSection({section, entries, expected, lastmodRequired, today, truth}) {
  const errors = [];
  const warnings = [];
  const err = (m) => errors.push(`${section}: ${m}`);
  const warn = (m) => warnings.push(`${section}: ${m}`);

  const keys = entries.map((e) => keyOf(e.loc));
  const seen = new Set();
  for (const k of keys) {
    if (seen.has(k)) err(`duplicate URL ${k}`);
    seen.add(k);
  }

  if (expected) {
    const missing = [...expected].filter((k) => !seen.has(k));
    const extra = [...seen].filter((k) => !expected.has(k));
    if (entries.length !== expected.size) {
      err(`${entries.length} URLs listed, ${expected.size} published to the storefront`);
    }
    for (const k of missing.slice(0, 20)) err(`published but missing from the sitemap: ${k}`);
    if (missing.length > 20) err(`...and ${missing.length - 20} more missing`);
    for (const k of extra.slice(0, 20)) err(`in the sitemap but not published: ${k}`);
    if (extra.length > 20) err(`...and ${extra.length - 20} more extra`);
  }

  if (lastmodRequired) {
    const days = [];
    for (const e of entries) {
      const key = keyOf(e.loc);
      if (!e.lastmod) {
        err(`no <lastmod> on ${key}`);
        continue;
      }
      const day = validDay(e.lastmod);
      if (!day) {
        err(`invalid <lastmod> "${e.lastmod}" on ${key}`);
        continue;
      }
      // One day of slack: the origin may be ahead of UTC.
      if (dayNumber(day) > dayNumber(today) + 1) err(`<lastmod> ${day} is in the future on ${key}`);
      days.push(day);
    }
    if (days.length >= 3 && new Set(days).size === 1) {
      err(`all ${days.length} <lastmod> values are identical (${days[0]}); a date that never varies carries no information`);
    }

    if (truth) {
      for (const e of entries) {
        const key = keyOf(e.loc);
        const day = validDay(e.lastmod);
        const real = validDay(truth.get(key)?.slice(0, 10));
        if (!day || !real) continue;
        const gap = dayNumber(day) - dayNumber(real);
        if (gap > 0) err(`${key} lastmod ${day} is newer than its real updatedAt ${real}`);
        else if (gap < -2) err(`${key} lastmod ${day} is ${-gap} days older than its real updatedAt ${real}`);
        else if (gap < 0) warn(`${key} lastmod ${day} is behind its real updatedAt ${real} (cache lag)`);
      }
    }
  }
  return {errors, warnings};
}

/** Video entries: only the publication date is checkable. */
export function auditVideoDates({entries, today}) {
  const errors = [];
  for (const e of entries) {
    if (!e.videoDate) continue;
    const day = validDay(e.videoDate);
    if (!day) errors.push(`video: invalid publication_date "${e.videoDate}" on ${keyOf(e.loc)}`);
    else if (dayNumber(day) > dayNumber(today) + 1) {
      errors.push(`video: publication_date ${day} is in the future on ${keyOf(e.loc)}`);
    }
  }
  return {errors, warnings: []};
}

// ---- Self-test ---------------------------------------------------------------

function selfTest() {
  const today = '2026-10-05';
  const mk = (h, lastmod, p = 'products') => ({loc: `https://x/${p}/${h}`, lastmod});
  const set = (...hs) => new Set(hs.map((h) => `/products/${h}`));
  const run = (o) => auditSection({section: 'products', lastmodRequired: true, today, truth: null, ...o});
  const truth = (o) => new Map(Object.entries(o).map(([h, v]) => [`/products/${h}`, v]));

  const good = [mk('a', '2026-10-05'), mk('b', '2026-09-26'), mk('c', '2026-09-01')];
  const cases = [
    ['varied, complete, valid passes', run({entries: good, expected: set('a', 'b', 'c')}), 0],
    ['THE 2026-10-05 BUG: every lastmod identical',
      run({entries: [mk('a', '2026-10-05'), mk('b', '2026-10-05'), mk('c', '2026-10-05')], expected: set('a', 'b', 'c')}), 1],
    ['two entries sharing a date is not suspicious', run({entries: [mk('a', '2026-10-05'), mk('b', '2026-10-05')], expected: set('a', 'b')}), 0],
    ['a missing product is reported (count + handle)', run({entries: good.slice(0, 2), expected: set('a', 'b', 'c')}), 2],
    ['an extra product is reported (count + handle)', run({entries: [...good, mk('d', '2026-09-02')], expected: set('a', 'b', 'c')}), 2],
    ['a duplicate URL is reported', run({entries: [...good, mk('a', '2026-09-30')], expected: set('a', 'b', 'c')}), 2],
    ['a missing lastmod is reported', run({entries: [good[0], good[1], {loc: 'https://x/products/c', lastmod: null}], expected: set('a', 'b', 'c')}), 1],
    ['a non date lastmod is reported', run({entries: [good[0], good[1], mk('c', 'yesterday')], expected: set('a', 'b', 'c')}), 1],
    ['an impossible date (Feb 30) is reported', run({entries: [good[0], good[1], mk('c', '2026-02-30')], expected: set('a', 'b', 'c')}), 1],
    ['a future lastmod is reported', run({entries: [good[0], good[1], mk('c', '2026-12-01')], expected: set('a', 'b', 'c')}), 1],
    ['a full datetime lastmod is valid', run({entries: [mk('a', '2026-10-05T12:00:00Z'), good[1], good[2]], expected: set('a', 'b', 'c')}), 0],
    ['lastmod NEWER than the real updatedAt is an error',
      run({entries: good, expected: set('a', 'b', 'c'), truth: truth({a: '2026-10-05T01:00:00Z', b: '2026-09-20T00:00:00Z', c: '2026-09-01T00:00:00Z'})}), 1],
    ['lastmod matching the real updatedAt passes',
      run({entries: good, expected: set('a', 'b', 'c'), truth: truth({a: '2026-10-05T01:00:00Z', b: '2026-09-26T00:00:00Z', c: '2026-09-01T00:00:00Z'})}), 0],
    ['lastmod one day behind is a warning, not an error',
      (() => { const r = run({entries: good, expected: set('a', 'b', 'c'), truth: truth({a: '2026-10-06T00:00:00Z', b: '2026-09-26T00:00:00Z', c: '2026-09-01T00:00:00Z'})}); return {errors: r.errors, warnings: r.warnings, expectWarn: 1}; })(), 0],
    ['lastmod 5 days behind the real updatedAt is an error',
      run({entries: good, expected: set('a', 'b', 'c'), truth: truth({a: '2026-10-05T01:00:00Z', b: '2026-10-01T00:00:00Z', c: '2026-09-01T00:00:00Z'})}), 1],
    ['a section with no lastmod requirement (static) passes without dates',
      auditSection({section: 'static', entries: [{loc: 'https://x/', lastmod: null}], expected: null, lastmodRequired: false, today, truth: null}), 0],
    ['a video publication_date in the future is reported',
      auditVideoDates({entries: [{loc: 'https://x/videos/a', videoDate: '2027-01-01'}], today}), 1],
  ];
  let pass = 0;
  for (const [name, r, want] of cases) {
    const ok = r.errors.length === want && (r.expectWarn === undefined || r.warnings.length === r.expectWarn);
    if (ok) pass++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  want ${want} error(s), got ${r.errors.length}${ok ? '' : ` ${JSON.stringify(r.errors)}`}`);
  }
  // parseUrlset on the real shape
  const xml = '<urlset><url>\n<loc>https://x/products/a%20b</loc>\n<lastmod>2026-10-05</lastmod></url><url><loc>https://x/</loc></url></urlset>';
  const parsed = parseUrlset(xml);
  const parseOk = parsed.length === 2 && parsed[0].lastmod === '2026-10-05' && parsed[1].lastmod === null && keyOf(parsed[0].loc) === '/products/a b';
  console.log(`  ${parseOk ? 'PASS' : 'FAIL'}  parseUrlset reads loc and lastmod, null when absent`);
  if (parseOk) pass++;
  console.log(`\n${pass}/${cases.length + 1} self-test cases`);
  process.exit(pass === cases.length + 1 ? 0 : 1);
}

if (process.argv.includes('--self-test')) selfTest();

// ---- Live half ---------------------------------------------------------------

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const ORIGIN = String(arg('--origin', 'https://streamwidgetshop.com')).replace(/\/$/, '');
const FETCH_URLS = !process.argv.includes('--no-fetch');
const TODAY = new Date().toISOString().slice(0, 10);
const HEADERS = {
  Accept: 'application/xml,text/html;q=0.9,*/*;q=0.8',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
};

async function credentials() {
  let domain = process.env.PUBLIC_STORE_DOMAIN;
  let token = process.env.PUBLIC_STOREFRONT_API_TOKEN;
  let source = 'environment';
  const envPath = path.join(ROOT, '.env');
  if ((!domain || !token) && fs.existsSync(envPath)) {
    const env = Object.fromEntries(
      fs
        .readFileSync(envPath, 'utf8')
        .split('\n')
        .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
        .map((l) => [
          l.slice(0, l.indexOf('=')).trim(),
          l.slice(l.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, ''),
        ]),
    );
    domain ||= env.PUBLIC_STORE_DOMAIN;
    token ||= env.PUBLIC_STOREFRONT_API_TOKEN;
    source = '.env';
  }
  if (!domain || !token) {
    const html = await (await fetch(`${ORIGIN}/`, {headers: HEADERS})).text();
    token ||= html.match(/storefrontAccessToken\\?",\\?"([0-9a-f]{32})/)?.[1];
    domain ||= html.match(/([a-z0-9-]+\.myshopify\.com)/)?.[1];
    source = `${ORIGIN} page source`;
  }
  if (!domain || !token) {
    console.error('Could not find PUBLIC_STORE_DOMAIN / PUBLIC_STOREFRONT_API_TOKEN (env, .env, or page source).');
    process.exit(1);
  }
  return {domain, token, source};
}

const creds = await credentials();

async function storefront(query, variables = {}) {
  const res = await fetch(`https://${creds.domain}/api/2025-01/graphql.json`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': creds.token},
    body: JSON.stringify({query, variables}),
  });
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
}

async function connection(field, nodeFields) {
  const nodes = [];
  let cursor = null;
  do {
    const data = await storefront(
      `query($cursor: String) { ${field}(first: 250, after: $cursor) { pageInfo { hasNextPage endCursor } nodes { ${nodeFields} } } }`,
      {cursor},
    );
    nodes.push(...data[field].nodes);
    cursor = data[field].pageInfo.hasNextPage ? data[field].pageInfo.endCursor : null;
  } while (cursor);
  return nodes;
}

/** Pages the sitemap deliberately leaves out, read from the one owner of that list. */
function excludedPageHandles() {
  const src = fs.readFileSync(path.join(ROOT, 'app/lib/sitemap.js'), 'utf8');
  const block = src.match(/EXCLUDED_PAGE_HANDLES\s*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? '';
  return new Set(
    [...block.matchAll(/^\s*['"]?([\w-]+)['"]?\s*:/gm)].map((m) => m[1]),
  );
}

/** One GET, no redirect following. Retries a thrown fetch or a 5xx twice: a busy origin is not a missing page. */
async function get(url) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        redirect: 'manual',
        headers: HEADERS,
        signal: AbortSignal.timeout(60_000),
      });
      if (res.status < 500) return res;
      last = res;
    } catch (error) {
      last = error;
    }
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  if (last instanceof Error) throw last;
  return last;
}

console.log(`Sitemap audit on ${ORIGIN}`);
console.log(`Storefront API: ${creds.domain} (credentials from ${creds.source})\n`);

const failures = [];
const notes = [];
const fail = (m) => failures.push(m);

// 1. Index and children.
const indexRes = await get(`${ORIGIN}/sitemap.xml`);
if (indexRes.status !== 200) {
  console.log(`FAIL  /sitemap.xml answered ${indexRes.status}`);
  process.exit(1);
}
const children = parseIndex(await indexRes.text());
if (new Set(children).size !== children.length) fail('index: a child sitemap is listed twice');
const typeOf = (u) => u.match(/\/sitemap\/([a-z]+)\/\d+\.xml/)?.[1];
const sections = new Map(); // type -> entries
for (const child of children) {
  const type = typeOf(child);
  if (!type) {
    fail(`index: unrecognised child ${child}`);
    continue;
  }
  // The index advertises its own origin; fetch it from --origin so a local run audits local.
  const url = `${ORIGIN}${new URL(child).pathname}`;
  const res = await get(url);
  if (res.status !== 200) {
    fail(`index: ${url} answered ${res.status}`);
    continue;
  }
  const body = await res.text();
  if (!body.includes('<urlset')) {
    fail(`index: ${url} is not a urlset`);
    continue;
  }
  sections.set(type, [...(sections.get(type) ?? []), ...parseUrlset(body)]);
}
for (const t of ['static', 'video', 'products', 'collections', 'pages', 'blogs', 'articles']) {
  if (!sections.has(t)) fail(`index: no "${t}" sitemap listed`);
}

// 2. What is published.
const [products, collections, pages, blogs] = await Promise.all([
  connection('products', 'handle updatedAt'),
  connection('collections', 'handle updatedAt'),
  connection('pages', 'handle updatedAt'),
  connection('blogs', 'handle articles(first: 250) { nodes { handle } }'),
]);
const excluded = excludedPageHandles();
const truthOf = (prefix, nodes) =>
  new Map(nodes.map((n) => [`/${prefix}/${n.handle}`, n.updatedAt]));
const productTruth = truthOf('products', products);
const collectionTruth = truthOf('collections', collections);
const publishedPages = pages.filter((p) => !excluded.has(p.handle));
const pageTruth = truthOf('pages', publishedPages);
const articleKeys = new Set(
  blogs.flatMap((b) => b.articles.nodes.map((a) => `/blogs/${b.handle}/${a.handle}`)),
);
const blogKeys = new Set(blogs.map((b) => `/blogs/${b.handle}`));

const plan = [
  ['products', productTruth, true, productTruth],
  ['collections', collectionTruth, true, collectionTruth],
  ['pages', pageTruth, true, pageTruth],
  ['blogs', blogKeys, true, null],
  ['articles', articleKeys, true, null],
];

const rows = [];
for (const [type, expectedMapOrSet, lastmodRequired, truth] of plan) {
  const entries = sections.get(type) ?? [];
  const expected = expectedMapOrSet instanceof Map ? new Set(expectedMapOrSet.keys()) : expectedMapOrSet;
  const r = auditSection({section: type, entries, expected, lastmodRequired, today: TODAY, truth});
  failures.push(...r.errors);
  notes.push(...r.warnings);
  const days = entries.map((e) => validDay(e.lastmod)).filter(Boolean).sort();
  rows.push({
    type,
    listed: entries.length,
    published: expected.size,
    distinct: new Set(days).size,
    range: days.length ? `${days[0]} .. ${days.at(-1)}` : 'none',
  });
}
// static and video: no membership or lastmod requirement, but must exist and have sane dates.
const staticEntries = sections.get('static') ?? [];
for (const must of ['/', '/collections/all']) {
  if (!staticEntries.some((e) => keyOf(e.loc) === must)) fail(`static: ${must} is not listed`);
}
const videoEntries = sections.get('video') ?? [];
failures.push(...auditVideoDates({entries: videoEntries, today: TODAY}).errors);
rows.push({type: 'static', listed: staticEntries.length, published: '-', distinct: '-', range: '-'});
rows.push({type: 'video', listed: videoEntries.length, published: '-', distinct: '-', range: '-'});

console.log('section      listed  published  distinct lastmods  range');
for (const r of rows) {
  console.log(
    `${r.type.padEnd(12)} ${String(r.listed).padStart(6)}  ${String(r.published).padStart(9)}  ${String(r.distinct).padStart(17)}  ${r.range}`,
  );
}

// 3. Every listed URL answers 200 on --origin.
if (FETCH_URLS) {
  const urls = [...sections.values()].flat().map((e) => `${ORIGIN}${keyOf(e.loc).split('/').map(encodeURIComponent).join('/')}`);
  const unique = [...new Set(urls)];
  console.log(`\nFetching ${unique.length} listed URLs ...`);
  const queue = [...unique];
  const bad = [];
  await Promise.all(
    Array.from({length: 4}, async () => {
      while (queue.length) {
        const url = queue.shift();
        let status = 0;
        let to = '';
        try {
          const res = await get(url);
          status = res.status;
          to = res.headers.get('location') ?? '';
        } catch {
          status = 0;
        }
        if (status !== 200) bad.push(`${status || 'ERR'}  ${url.replace(ORIGIN, '')}${to ? ` -> ${to}` : ''}`);
      }
    }),
  );
  for (const b of bad.sort()) fail(`listed URL does not answer 200: ${b}`);
  console.log(`  ${unique.length - bad.length}/${unique.length} answered 200`);
} else {
  console.log('\n(--no-fetch: per-URL 200 check skipped)');
}

// Report.
const uniqueFailures = [...new Set(failures)];
if (notes.length) {
  console.log(`\nWARNINGS (${notes.length}):`);
  for (const n of notes.slice(0, 25)) console.log(`  ${n}`);
  if (notes.length > 25) console.log(`  ...and ${notes.length - 25} more`);
}
if (uniqueFailures.length) {
  console.log(`\nFAILED, ${uniqueFailures.length} problem(s):`);
  for (const f of uniqueFailures.slice(0, 60)) console.log(`  ${f}`);
  if (uniqueFailures.length > 60) console.log(`  ...and ${uniqueFailures.length - 60} more`);
  process.exit(1);
}
console.log('\nPASS  sitemap membership, URLs, and lastmod all check out.');
