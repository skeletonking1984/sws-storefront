/**
 * Is the Now Playing beta download actually gated on the rendered page?
 *
 * Why, 2026-10-04. The Now Playing beta is capped at 10 slots, and each slot
 * is a signed link minted by the sws-downloads Worker (2eb495f). The page body
 * lives in Shopify Admin and had carried a direct "Download the free beta" zip
 * link, which bypasses the cap entirely: anyone with the URL gets the file and
 * the slot count means nothing. The route now strips it server side
 * (app/lib/nowPlayingBeta.js), but that is code reading an Admin field. A
 * future body edit, a changed filename, or a route refactor can put the link
 * back and nothing would say so, so this reads the HTML a visitor receives.
 *
 * Two hosts serve this page, and both are checked. The Hydrogen host
 * (streamwidgetshop.com) renders the body from the Shopify Admin page, and the
 * Shopify Online Store host (shop.streamwidgetshop.com) serves that same Admin
 * body raw. The 2026-10-04 leak was on the second one:
 * shop.streamwidgetshop.com/pages/now-playing.json `page.body_html` carried a
 * direct cdn.shopify.com .zip link, so a stripped Hydrogen page proved
 * nothing about the file being gated.
 *
 * 1. Shop host: GET <shop origin>/pages/now-playing.json, then page.body_html
 *    must contain no .zip URL and neither SWS-Now-Playing-BETA nor
 *    SWS-Now-Playing-Early-Access.
 *
 * 2. Hydrogen host: GET /pages/now-playing, then it must contain:
 *   1. zero occurrences of SWS-Now-Playing-BETA (the public zip filename)
 *   2. zero cdn.shopify.com links to any .zip
 *   3. the rendered gate FORM: a <form> with class sws-beta-gate, outside any
 *      <script> or comment, that posts to /api/newsletter and carries a hidden
 *      source=now-playing-beta. (The old check looked for the marker
 *      data-sws-beta-gate, which also sits in the serialized loader JSON, so a
 *      page whose form had been deleted still passed.)
 *   4. no "free beta" (case-insensitive): the program is limited, not free
 *   5. (2026-10-05) the word "beta" appears nowhere a visitor can read
 *      it: not in the title, meta/OG text, the page copy, or alt/placeholder/
 *      aria text. The program is "Early access". The internal marker, class
 *      names, the hidden source field and the worker slug may keep the word.
 *   6. the word "free" does not appear in the page content block
 *
 * READ ONLY. It never calls /api/newsletter and never claims a slot: slots are
 * real and capped at 10, and a check that spends one is a bug.
 *
 * Stale cache vs real. Production HTML is cached at the edge
 * (max-age=120, stale-while-revalidate=1800), so right after a deploy a
 * visitor can still get the previous page. With --expect-commit it compares
 * /api/version to the commit just deployed and retries for about 3 minutes.
 * On a bad page it re-fetches with a throwaway query string (the edge never
 * stores those) to tell the two apart:
 *   fresh copy clean, cached copy bad  => STALE CACHE, keep retrying
 *   fresh copy bad too                 => REAL, fail now, retrying cannot help
 * The output says which, and a final failure is labelled the same way.
 *
 * Usage:
 *   node scripts/verify-beta-gate.mjs                                # production, one attempt
 *   node scripts/verify-beta-gate.mjs --origin http://localhost:3199 # pre-deploy local build
 *   node scripts/verify-beta-gate.mjs --expect-commit <sha>          # post-deploy: retry ~3 min
 *   node scripts/verify-beta-gate.mjs --file scripts/fixtures/now-playing-old-zip.html
 *   node scripts/verify-beta-gate.mjs --shop-origin <url>            # shop host override
 *                                                                    # (default https://shop.streamwidgetshop.com,
 *                                                                    # independent of --origin, so local runs still
 *                                                                    # read the real shop body)
 *   node scripts/verify-beta-gate.mjs --shop-file <json>             # read the shop JSON from disk
 *   node scripts/verify-beta-gate.mjs --skip-shop-check              # explicit opt-out: prints SKIPPED, and the
 *                                                                    # final line says the shop host was NOT checked
 *   node scripts/verify-beta-gate.mjs --self-test                    # must catch the old page
 *
 * Exits 1 on any failure, so it gates `npm run deploy:prod`.
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const argVal = (k) => {
  const i = args.indexOf(k);
  return i === -1 ? null : args[i + 1];
};
const ORIGIN = (argVal('--origin') || 'https://streamwidgetshop.com').replace(/\/$/, '');
const EXPECT = argVal('--expect-commit');
const FILE = argVal('--file');
/* The Shopify Online Store host, not the Hydrogen one. It does not derive from
   --origin (a local build has no shop host of its own), so it has a fixed
   default and a flag. */
const SHOP_ORIGIN = (argVal('--shop-origin') || 'https://shop.streamwidgetshop.com').replace(/\/$/, '');
const SHOP_FILE = argVal('--shop-file');
const SKIP_SHOP = args.includes('--skip-shop-check');
const SELF_TEST = args.includes('--self-test');
/* 10 attempts, 20s apart = about 3 minutes, longer than the 120s edge max-age. */
const ATTEMPTS = Number(argVal('--attempts')) || (EXPECT ? 10 : 1);
const INTERVAL_MS = (Number(argVal('--interval')) || 20) * 1000;
const PATH = '/pages/now-playing';
const SHOP_PATH = '/pages/now-playing.json';
const HEADERS = {'user-agent': 'sws-verify-beta-gate/1.0', accept: 'text/html'};
/* The Online Store host can answer a non-browser agent differently. */
const SHOP_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  accept: 'application/json',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Text a visitor can read: tags, scripts and styles removed, plus the
   attributes that are shown (alt, title, placeholder, aria-label). */
function visibleText(html) {
  const attrs = [];
  html.replace(/\s(?:alt|title|placeholder|aria-label)="([^"]*)"/gi, (_, v) => attrs.push(v));
  const body = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ');
  return [body, ...attrs].join(' ');
}

/* Title and the meta/OG/Twitter text a link preview or search result shows. */
function metaText(html) {
  const out = [];
  html.replace(/<title\b[^>]*>([\s\S]*?)<\/title>/gi, (_, v) => out.push(v));
  html.replace(/<meta\b[^>]*>/gi, (tag) => {
    const key = (tag.match(/\b(?:name|property)="([^"]*)"/i) || [])[1] || '';
    const val = (tag.match(/\bcontent="([^"]*)"/i) || [])[1];
    if (val && /^(description|og:(title|description|image:alt)|twitter:(title|description|image:alt))$/i.test(key)) out.push(val);
  });
  return out.join(' | ');
}

/* The page body block only: from the .page wrapper to the last </main>. */
function contentBlock(html) {
  const a = html.indexOf('<div class="page">');
  const b = html.lastIndexOf('</main>');
  return a === -1 || b === -1 || b < a ? '' : html.slice(a, b);
}

/* Value of one attribute in an opening tag, either quote style. */
function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[1] ?? m[2]) : null;
}

/* The gate form as a visitor's browser would see it. Scripts and comments are
   removed first: the serialized loader JSON is a <script>, and a form string
   inside it (or inside a comment) is not a form. Returns failure strings. */
function checkGateForm(html) {
  const live = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<script\b[\s\S]*?<\/script>/gi, ' ');
  const forms = (live.match(/<form\b[^>]*>[\s\S]*?<\/form>/gi) || []).filter((f) => {
    const cls = attr(f.match(/^<form\b[^>]*>/i)[0], 'class') || '';
    return cls.split(/\s+/).includes('sws-beta-gate');
  });
  if (!forms.length) {
    return ['no rendered <form class="sws-beta-gate"> outside <script> tags (the marker data-sws-beta-gate alone does not count, it also sits in the loader JSON)'];
  }
  const fails = [];
  const form = forms[0];
  const open = form.match(/^<form\b[^>]*>/i)[0];
  const action = attr(open, 'action');
  if (action !== '/api/newsletter') fails.push(`gate form action is ${action === null ? 'missing' : JSON.stringify(action)}, expected /api/newsletter`);
  const method = (attr(open, 'method') || '').toLowerCase();
  if (method !== 'post') fails.push(`gate form method is ${method ? JSON.stringify(method) : 'missing'}, expected post`);
  const hiddenSource = (form.match(/<input\b[^>]*>/gi) || []).some(
    (t) =>
      (attr(t, 'type') || '').toLowerCase() === 'hidden' &&
      attr(t, 'name') === 'source' &&
      attr(t, 'value') === 'now-playing-beta',
  );
  if (!hiddenSource) fails.push('gate form has no hidden input name="source" value="now-playing-beta"');
  return fails;
}

/* Pure: the Online Store's /pages/now-playing.json text in, list of failure
   strings out. Only page.body_html matters: that is the raw Admin body, the
   place the direct download link lived. */
export function checkShopJson(text) {
  let body;
  try {
    body = JSON.parse(text)?.page?.body_html;
  } catch {
    return ['shop host did not return JSON, so page.body_html was not checked'];
  }
  if (typeof body !== 'string') return ['shop host JSON has no page.body_html string, so it was not checked'];
  const fails = [];
  const zips = body.match(/[^\s"'<>=]+\.zip(?![a-z0-9])/gi) || [];
  if (zips.length) fails.push(`${zips.length} .zip URL(s) in shop page.body_html: ${zips.slice(0, 3).join(' , ')}`);
  const names = body.match(/SWS-Now-Playing-(?:BETA|Early-Access)/gi) || [];
  if (names.length) fails.push(`${names.length} occurrence(s) of SWS-Now-Playing-BETA or SWS-Now-Playing-Early-Access in shop page.body_html`);
  return fails;
}

/* Pure: HTML in, list of failure strings out. */
export function checkHtml(html) {
  const fails = [];
  if (!html || html.length < 500) {
    return [`page is ${html ? html.length : 0} bytes, not a real page`];
  }
  const names = html.match(/SWS-Now-Playing-(?:BETA|Early-Access)/gi) || [];
  if (names.length) fails.push(`${names.length} occurrence(s) of SWS-Now-Playing-BETA or SWS-Now-Playing-Early-Access, the public zip filename`);
  const zips = html.match(/cdn\.shopify\.com[^"'\s<>]*\.zip(?![a-z0-9])/gi) || [];
  if (zips.length) fails.push(`${zips.length} cdn.shopify.com zip link(s): ${zips.slice(0, 3).join(' , ')}`);
  fails.push(...checkGateForm(html));
  const free = html.match(/free(?:\s|&nbsp;|&#160;|\u00a0)+beta/gi) || [];
  if (free.length) fails.push(`${free.length} occurrence(s) of "free beta"`);
  const betaMeta = metaText(html).match(/\bbeta\b/gi) || [];
  if (betaMeta.length) fails.push(`${betaMeta.length} "beta" in the title or meta/OG text: ${metaText(html).slice(0, 160)}`);
  const betaVisible = visibleText(html).match(/\bbeta\b/gi) || [];
  if (betaVisible.length) fails.push(`${betaVisible.length} visible "beta" in the page copy (it is "Early access")`);
  const freeWord = visibleText(contentBlock(html)).match(/\bfree\b/gi) || [];
  if (freeWord.length) fails.push(`${freeWord.length} "free" in the page content block`);
  return fails;
}

async function get(url, init = {}) {
  const res = await fetch(url, {headers: HEADERS, redirect: 'follow', ...init});
  return {status: res.status, text: await res.text(), cache: res.headers.get('age')};
}

async function fetchPage(fresh) {
  const url = `${ORIGIN}${PATH}${fresh ? `?_bg=${Date.now()}` : ''}`;
  const r = await get(url);
  if (r.status !== 200) return {fails: [`${url} responded ${r.status}`], age: r.cache};
  return {fails: checkHtml(r.text), age: r.cache};
}

/* Shop host body. Skipped only when told to, and the skip is reported by the
   caller, never counted as a pass. */
async function fetchShop(fresh) {
  if (SKIP_SHOP) return {skipped: true, fails: []};
  if (SHOP_FILE) return {fails: checkShopJson(fs.readFileSync(path.resolve(SHOP_FILE), 'utf8'))};
  const url = `${SHOP_ORIGIN}${SHOP_PATH}${fresh ? `?_bg=${Date.now()}` : ''}`;
  const r = await get(url, {headers: SHOP_HEADERS});
  if (r.status !== 200) return {fails: [`${url} responded ${r.status}, so shop page.body_html was not checked`]};
  return {fails: checkShopJson(r.text)};
}

/* Both hosts, one list. Shop failures are prefixed so the output says which. */
async function checkLive(fresh) {
  const page = await fetchPage(fresh);
  const shop = await fetchShop(fresh);
  return {
    fails: [...page.fails, ...shop.fails.map((f) => `shop host: ${f}`)],
    age: page.age,
    shopSkipped: Boolean(shop.skipped),
  };
}

async function liveCommit() {
  try {
    const r = await get(`${ORIGIN}/api/version`);
    return JSON.parse(r.text).commit || null;
  } catch {
    return null;
  }
}

const sameCommit = (a, b) => a && b && (a.startsWith(b) || b.startsWith(a));

/* Returns {ok, kind: 'pass'|'stale cache'|'real', fails}. */
async function run() {
  if (FILE) {
    const shop = await fetchShop(false);
    const fails = [...checkHtml(fs.readFileSync(path.resolve(FILE), 'utf8')), ...shop.fails.map((f) => `shop host: ${f}`)];
    return {ok: !fails.length, kind: fails.length ? 'real' : 'pass', fails, shopSkipped: Boolean(shop.skipped)};
  }
  let last = {ok: false, kind: 'real', fails: ['never ran']};
  for (let n = 1; n <= ATTEMPTS; n++) {
    const tag = ATTEMPTS > 1 ? `[${n}/${ATTEMPTS}] ` : '';
    if (EXPECT) {
      const live = await liveCommit();
      if (!sameCommit(live, EXPECT)) {
        const why = live
          ? `/api/version says ${live.slice(0, 7)}, expected ${EXPECT.slice(0, 7)}`
          : '/api/version unreadable';
        console.log(`${tag}stale cache or deploy still rolling out: ${why}`);
        last = {ok: false, kind: 'stale cache', fails: [`production never reached ${EXPECT.slice(0, 7)}: ${why}`]};
        if (n < ATTEMPTS) await sleep(INTERVAL_MS);
        continue;
      }
    }
    const page = await checkLive(false);
    if (page.shopSkipped) console.log(`${tag}NOTE: shop host check SKIPPED (--skip-shop-check). ${SHOP_ORIGIN}${SHOP_PATH} was NOT read.`);
    if (!page.fails.length) {
      console.log(`${tag}page clean${page.age ? ` (edge age ${page.age}s)` : ''}${page.shopSkipped ? ', shop host NOT checked' : ''}`);
      return {ok: true, kind: 'pass', fails: [], shopSkipped: page.shopSkipped};
    }
    /* Page is bad. Is it the cached copy or the real one? Skip when the
       origin is not behind an edge cache we can sidestep (local, 4xx/5xx). */
    const fresh = await checkLive(true);
    if (fresh.fails.length) {
      console.log(`${tag}REAL failure: the uncached page is bad too, retrying will not help`);
      return {ok: false, kind: 'real', fails: fresh.fails};
    }
    console.log(`${tag}stale cache: cached copy is bad, uncached copy is clean (edge age ${page.age ?? '?'}s)`);
    last = {ok: false, kind: 'stale cache', fails: page.fails};
    if (n < ATTEMPTS) await sleep(INTERVAL_MS);
  }
  return last;
}

if (SELF_TEST) {
  const here = path.dirname(new URL(import.meta.url).pathname);
  const old = fs.readFileSync(path.join(here, 'fixtures/now-playing-old-zip.html'), 'utf8');
  const pad = '<p>padding so the fixture reads as a real page</p>'.repeat(12);
  /* What the Hydrogen page really contains: the SSR'd form, and the serialized
     loader JSON, which carries the marker (and, in a worst case, a form string)
     inside a <script>. */
  const GATE_FORM = '<form method="post" action="/api/newsletter" class="sws-beta-gate"><input type="hidden" name="source" value="now-playing-beta"/><input type="email" name="email"/></form>';
  const LOADER_JSON = '<script>window.__loader={"html":"<div data-sws-beta-gate></div>","form":"<form class=\\"sws-beta-gate\\" action=\\"/api/newsletter\\" method=\\"post\\"><input type=\\"hidden\\" name=\\"source\\" value=\\"now-playing-beta\\"></form>"};</script>';
  const good = `<!doctype html><html><head><title>Now Playing Widgets: Early Access | SWS</title><meta name="description" content="Now Playing Widgets: Early Access."></head><body><main><div class="page">${pad}<p>Early access &middot; 10 spots.</p>${GATE_FORM}</div></main>${LOADER_JSON}</body></html>`;
  const cases = [
    ['clean gated page', good, false],
    ['old page: zip link, free beta, no gate', old + pad, true],
    ['only the zip filename leaks', good.replace('</body>', '<span>SWS-Now-Playing-BETA.zip</span></body>'), true],
    ['only a cdn zip link leaks', good.replace('</body>', '<a href="https://cdn.shopify.com/s/files/x/files/other.zip?v=1">z</a></body>'), true],
    ['form deleted, marker and form text only in the loader JSON', good.replace(GATE_FORM, ''), true],
    ['form deleted, bare marker div left in the page', good.replace(GATE_FORM, '<div data-sws-beta-gate></div>'), true],
    ['form only inside an HTML comment', good.replace(GATE_FORM, `<!-- ${GATE_FORM} -->`), true],
    ['only the granted-state box (class sws-beta-gate-done), no form', good.replace(GATE_FORM, '<div class="sws-beta-gate sws-beta-gate-done"><p>You are in.</p></div>'), true],
    ['gate form posts to the wrong action', good.replace('action="/api/newsletter"', 'action="/api/other"'), true],
    ['gate form has no action', good.replace(' action="/api/newsletter"', ''), true],
    ['gate form method is get', good.replace('method="post"', 'method="get"'), true],
    ['hidden source is not now-playing-beta', good.replace('value="now-playing-beta"/>', 'value="newsletter"/>'), true],
    ['hidden source input removed', good.replace('<input type="hidden" name="source" value="now-playing-beta"/>', ''), true],
    ['attribute order and quote style do not matter', good.replace(GATE_FORM, "<form class='x sws-beta-gate' action='/api/newsletter' method='POST'><input value='now-playing-beta' name='source' type='hidden'></form>"), false],
    ['"Free Beta" framing back', good.replace('Early access', 'Free&nbsp;Beta'), true],
    ['visible "Beta" in the copy', good.replace('Early access &middot;', 'Beta:'), true],
    ['visible "beta" in an alt attribute', good.replace('<form', '<img alt="the beta deck"><form'), true],
    ['"Beta" back in the title', good.replace('Early Access | SWS', 'Beta | SWS'), true],
    ['"Beta" back in the meta description', good.replace('Widgets: Early Access."', 'Widgets: Beta."'), true],
    ['"free" in the content block', good.replace('10 spots.', '10 spots. Free download.'), true],
    ['internal markers keep the word (not a failure)', good.replace('</form>', '<input type="hidden" name="x" value="beta-slug"></form>'), false],
    ['empty body', '', true],
  ];
  let bad = false;
  for (const [name, html, shouldFail] of cases) {
    const f = checkHtml(html);
    const ok = shouldFail ? f.length > 0 : f.length === 0;
    if (!ok) bad = true;
    console.log(`${ok ? 'ok  ' : 'WRONG'}  ${name}: ${f.length ? 'caught' : 'pass'}`);
    f.forEach((x) => console.log('        ' + x));
  }

  /* The shop host JSON: the Admin body served raw. */
  const shopJson = (bodyHtml) => JSON.stringify({page: {id: 1, handle: 'now-playing', body_html: bodyHtml}});
  const shopBody =
    '<div class="how-it-works"><p><img src="https://cdn.shopify.com/s/files/1/0001/files/hero.jpg?v=1" alt="Now Playing"></p><div data-sws-beta-gate></div><p>Early access &middot; 10 spots.</p></div>';
  const shopCases = [
    ['shop: clean body (marker div and a cdn jpg are fine)', shopJson(shopBody), false],
    ['shop: direct cdn.shopify.com zip link (the beta zip leak)', shopJson(shopBody + '<a href="https://cdn.shopify.com/s/files/1/0001/files/SWS-Now-Playing-BETA-v0.2.zip?v=1">Download</a>'), true],
    ['shop: zip link to a file with another name', shopJson(shopBody + '<a href="https://cdn.shopify.com/s/files/1/0001/files/other.zip?v=1">z</a>'), true],
    ['shop: zip on a non-Shopify host', shopJson(shopBody + '<a href="https://example.com/a/b.zip">z</a>'), true],
    ['shop: protocol-relative zip link', shopJson(shopBody + '<a href="//cdn.shopify.com/x/y.zip">z</a>'), true],
    ['shop: only the BETA filename in text', shopJson(shopBody + '<p>SWS-Now-Playing-BETA</p>'), true],
    ['shop: only the Early-Access filename in text', shopJson(shopBody + '<p>sws-now-playing-early-access</p>'), true],
    ['shop: .zipper is not a zip', shopJson(shopBody + '<p>zipper.zippy</p>'), false],
    ['shop: not JSON', '<html>blocked</html>', true],
    ['shop: JSON without page.body_html', JSON.stringify({page: {}}), true],
    ['shop: empty text', '', true],
  ];
  for (const [name, text, shouldFail] of shopCases) {
    const f = checkShopJson(text);
    const ok = shouldFail ? f.length > 0 : f.length === 0;
    if (!ok) bad = true;
    console.log(`${ok ? 'ok  ' : 'WRONG'}  ${name}: ${f.length ? 'caught' : 'pass'}`);
    f.forEach((x) => console.log('        ' + x));
  }
  console.log(bad ? '\nBeta gate self-test FAILED.' : '\nBeta gate self-test passed.');
  process.exit(bad ? 1 : 0);
}

const result = await run();
console.log(`${result.ok ? 'pass' : 'FAIL'}  ${FILE || ORIGIN + PATH}${SKIP_SHOP ? '' : `  +  ${SHOP_FILE || SHOP_ORIGIN + SHOP_PATH}`}`);
result.fails.forEach((x) => console.log('  ' + x));
if (result.ok) {
  console.log(
    result.shopSkipped
      ? '\nNow Playing beta gate check passed for the Hydrogen page ONLY. The shop host (page.body_html) was NOT checked: --skip-shop-check.'
      : '\nNow Playing beta gate check passed (Hydrogen page and shop host).',
  );
  process.exit(0);
}
console.log(`\nNow Playing beta gate check FAILED (${result.kind === 'stale cache' ? 'STALE CACHE, not confirmed as a real leak' : 'REAL, the page itself is wrong'}).`);
process.exit(1);
