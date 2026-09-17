/**
 * Does every page of the site actually work?
 *
 * Why, 2026-09-17. Todd: "please just make sure the site is fully functional,
 * that is highest priority, aesthetic is secondary."
 *
 * Every other check here asks a narrow question of a product: is it buyable,
 * is its markup complete, is its share card the right shape. **Nothing asked
 * whether the pages load at all**, and the site is not only products. It has
 * collections, policies, Shopify Pages, a blog, a cart, a search page and an
 * account area, and a dead one of those is invisible to every existing audit.
 *
 * What it does:
 *
 *   1. Walks the sitemap index and every sub-sitemap, and fetches every URL.
 *   2. Crawls the internal links found on a set of entry pages, which catches
 *      anything linked but not listed: policies, `/pages/*`, filtered
 *      collection URLs, the account area.
 *   3. Reports any status that is not 200, and separately reports redirects,
 *      because a 301 chain from a link in the site's own navigation is a bug
 *      even though the visitor arrives somewhere.
 *
 * Deliberately NOT here: anything about how a page looks. Todd ranked that
 * second and mixing the two would bury a 404 under a list of opinions.
 *
 * Usage:
 *   node scripts/audit-site-health.mjs [--origin https://...] [--limit n]
 *   node scripts/audit-site-health.mjs --self-test
 */
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

/**
 * The pure half.
 * @param {{url: string, status: number, redirectedTo: string|null, linkedFrom: string|null}} page
 */
export function auditPage(page) {
  const issues = [];
  const add = (severity, what) => issues.push({url: page.url, severity, what});

  if (page.status === 0) {
    add('error', `request failed entirely${page.linkedFrom ? `, linked from ${page.linkedFrom}` : ''}`);
    return issues;
  }
  if (page.status >= 500) {
    add('error', `${page.status} server error${page.linkedFrom ? `, linked from ${page.linkedFrom}` : ''}`);
    return issues;
  }
  if (page.status === 404) {
    add('error', `404${page.linkedFrom ? `, linked from ${page.linkedFrom}` : ' (listed in the sitemap)'}`);
    return issues;
  }
  if (page.status >= 400) {
    add('error', `${page.status}${page.linkedFrom ? `, linked from ${page.linkedFrom}` : ''}`);
    return issues;
  }
  /*
   * A redirect reached from the site's OWN navigation is a defect: the link
   * should point at the destination. A redirect on a sitemap URL is worse,
   * because the sitemap is telling Google to index a URL that is not final.
   * Neither is an outage, so both are warnings.
   */
  /*
   * `/account` redirects to Shopify's hosted login on shopify.com by design.
   * Reporting that as a defect every run would train everyone to skim the
   * redirect list, which is where a real one would then hide.
   */
  const EXPECTED_OFFSITE = /^https:\/\/(shopify\.com|shop\.app|accounts\.shopify\.com)\//;
  if (page.redirectedTo && EXPECTED_OFFSITE.test(page.redirectedTo)) return issues;

  if (page.redirectedTo && page.redirectedTo !== page.url) {
    add('warning', `redirects to ${page.redirectedTo}${page.linkedFrom ? `, linked from ${page.linkedFrom}` : ', and is in the sitemap'}`);
  }
  return issues;
}

if (process.argv.includes('--self-test')) {
  const p = (o) => ({url: 'https://x/a', status: 200, redirectedTo: null, linkedFrom: null, ...o});
  const cases = [
    ['a normal 200 passes', p({}), 0],
    ['a 404 in the sitemap is an error', p({status: 404}), 1],
    ['a 404 reached from a real link is an error', p({status: 404, linkedFrom: 'https://x/home'}), 1],
    ['a 500 is an error', p({status: 500}), 1],
    ['a network failure is an error, not a silent skip', p({status: 0}), 1],
    ['a 403 is an error too', p({status: 403}), 1],
    ['a redirect is a WARNING, the visitor still arrives', p({redirectedTo: 'https://x/b'}), 1],
    ['redirecting to itself is not a redirect', p({redirectedTo: 'https://x/a'}), 0],
    ['a 200 with no redirect and no link source passes', p({redirectedTo: null}), 0],
    [
      '/account redirecting to Shopify hosted login is EXPECTED, not a finding',
      p({redirectedTo: 'https://shopify.com/authentication/66589720766/login?x=1'}),
      0,
    ],
    [
      'checkout on shop.app is an expected offsite hop too',
      p({redirectedTo: 'https://shop.app/checkout/1'}),
      0,
    ],
    [
      'a redirect to some OTHER host is still reported',
      p({redirectedTo: 'https://example.com/elsewhere'}),
      1,
    ],
    [
      'a same-origin redirect is still a warning, the link should point at the destination',
      p({redirectedTo: 'https://x/b', linkedFrom: 'https://x/home'}),
      1,
    ],
  ];
  let pass = 0;
  for (const [name, input, expected] of cases) {
    const got = auditPage(input).length;
    const ok = got === expected;
    if (ok) pass++;
    console.log(`${ok ? 'pass' : 'FAIL'}  ${name}  (expected ${expected}, got ${got})`);
  }
  console.log(`\n${pass}/${cases.length} self-test cases pass.`);
  process.exit(pass === cases.length ? 0 : 1);
}

/*
 * Ask like a browser, because the question is "does this work for a visitor".
 *
 * Without these, `/account` reported 406. It is fine: it 302s to Shopify's
 * hosted OAuth login, and that host refuses `Accept: * / *`. The page works
 * perfectly in a browser. Same class of false alarm as the checkout 403 in
 * audit-buyable.mjs, and the same lesson: **a crawler that does not look like
 * a visitor cannot answer a question about visitors.**
 */
const BROWSER_HEADERS = {
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
};

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const ORIGIN = arg('--origin', 'https://streamwidgetshop.com');
const LIMIT = Number(arg('--limit', 0)) || Infinity;

const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

async function sitemapUrls() {
  const index = await (await fetch(`${ORIGIN}/sitemap.xml`)).text();
  const children = locs(index);
  const urls = new Set();
  for (const child of children) {
    try {
      const body = await (await fetch(child)).text();
      for (const u of locs(body)) urls.add(u);
    } catch (err) {
      console.log(`  could not read sub-sitemap ${child}: ${err.message}`);
    }
  }
  return [...urls];
}

/** Entry pages whose internal links get crawled one level deep. These are the
 * places a visitor actually starts, so a dead link here is a dead link a
 * person hits. */
const ENTRY_PAGES = [
  '/',
  '/collections/all',
  '/pages/how-it-works',
  '/pages/faq-frequently-asked-questions',
  '/pages/contact',
  '/blogs/news',
  '/cart',
  '/search',
];

async function linksOn(pageUrl) {
  try {
    const res = await fetch(pageUrl, {redirect: 'follow', headers: BROWSER_HEADERS});
    if (!res.ok) return [];
    const html = await res.text();
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    const out = new Set();
    for (const h of hrefs) {
      if (!h || h.startsWith('#') || h.startsWith('mailto:') || h.startsWith('tel:')) continue;
      let abs;
      try {
        abs = new URL(h, pageUrl).toString();
      } catch {
        continue;
      }
      if (!abs.startsWith(ORIGIN)) continue;
      out.add(abs.split('#')[0]);
    }
    return [...out];
  } catch {
    return [];
  }
}

console.log(`Site health on ${ORIGIN}`);
console.log('Checking every sitemap URL, plus every internal link on the entry pages.\n');

const fromSitemap = await sitemapUrls();
console.log(`sitemap URLs: ${fromSitemap.length}`);

const linkedFrom = new Map();
for (const entry of ENTRY_PAGES) {
  const abs = `${ORIGIN}${entry}`;
  for (const link of await linksOn(abs)) {
    if (!linkedFrom.has(link)) linkedFrom.set(link, abs);
  }
}
console.log(`internal links found on ${ENTRY_PAGES.length} entry pages: ${linkedFrom.size}`);

const all = new Map();
for (const u of fromSitemap) all.set(u, null);
for (const [u, src] of linkedFrom) if (!all.has(u)) all.set(u, src);
// The entry pages themselves must be checked even if nothing links to them.
for (const e of ENTRY_PAGES) if (!all.has(`${ORIGIN}${e}`)) all.set(`${ORIGIN}${e}`, 'entry page');

const targets = [...all.entries()].slice(0, LIMIT === Infinity ? undefined : LIMIT);
console.log(`checking ${targets.length} unique URLs\n`);

const issues = [];
let done = 0;
const CONCURRENCY = 6;
const queue = [...targets];

async function worker() {
  while (queue.length) {
    const [url, src] = queue.shift();
    let status = 0;
    let redirectedTo = null;
    try {
      /*
       * `redirect: 'manual'`, so the SITE's own answer is what gets judged.
       *
       * Following redirects made this check wrong twice in a row on
       * 2026-09-17. `/account` 302s to Shopify's hosted OAuth login, and
       * following it reported first 406 (that host refuses `Accept: * / *`)
       * and then 429 (six workers hammering someone else's auth endpoint).
       * Both were the crawler, both times the page was fine. Chasing a
       * redirect off our own domain asks a question about Shopify's
       * infrastructure, not about this site, and it is rude besides.
       */
      const res = await fetch(url, {redirect: 'manual', headers: BROWSER_HEADERS});
      status = res.status;
      if (status >= 300 && status < 400) {
        const loc = res.headers.get('location');
        if (loc) {
          try {
            redirectedTo = new URL(loc, url).toString();
          } catch {
            redirectedTo = loc;
          }
        }
        // A redirect the site issued is a working page, not a failure. Whether
        // it is a DEFECT is auditPage's call, which knows about expected
        // offsite hops.
        status = 200;
      }
    } catch {
      status = 0;
    }
    const found = auditPage({url, status, redirectedTo, linkedFrom: src});
    issues.push(...found);
    done++;
    if (found.some((f) => f.severity === 'error')) {
      console.log(`  FAIL ${status || 'ERR'}  ${url.replace(ORIGIN, '')}`);
    } else if (done % 50 === 0) {
      console.log(`  ok   ${done}/${targets.length} ...`);
    }
  }
}
await Promise.all(Array.from({length: CONCURRENCY}, worker));

const errors = issues.filter((i) => i.severity === 'error');
const warnings = issues.filter((i) => i.severity === 'warning');
console.log(`\n${done} URLs checked. ${errors.length} error(s), ${warnings.length} redirect warning(s).`);

if (errors.length) {
  console.log('\nERRORS:');
  for (const i of errors) console.log(`  ${i.url.replace(ORIGIN, '')}\n    ${i.what}`);
}
if (warnings.length) {
  console.log('\nREDIRECTS (the visitor arrives, but the link or the sitemap points at a non-final URL):');
  for (const i of warnings.slice(0, 25)) console.log(`  ${i.url.replace(ORIGIN, '')}\n    ${i.what.replace(ORIGIN, '')}`);
  if (warnings.length > 25) console.log(`  ...and ${warnings.length - 25} more`);
}
if (!errors.length && !warnings.length) console.log('\nEvery page loads and nothing redirects.');

process.exit(errors.length ? 1 : 0);
