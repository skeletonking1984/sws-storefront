/**
 * Does Oxygen's full-page cache serve public pages WITHOUT leaking a visitor,
 * and does ad attribution still work now that those pages carry no cookies?
 *
 * Why this exists (2026-10-03). Every HTML response was `uncacheable` because
 * every response set cookies, so each visit paid a full worker render. The fix
 * (app/lib/edgeCache.server.js) stores public pages, which means one visitor's
 * response is handed to the next. A mistake here is not a slow page, it is
 * somebody else's cart or session, and a silent loss of the click ids that pay
 * for ads. So this drives the real server over HTTP and asserts on what it
 * actually sent, never on what the code says.
 *
 *   node scripts/verify-edge-cache.mjs                         # production
 *   node scripts/verify-edge-cache.mjs http://localhost:3199   # local preview
 *   node scripts/verify-edge-cache.mjs --expect-hit            # production, after deploy
 *
 * `--self-test` runs only the offline rows (eligibility and header policy,
 * no network, no env) and exits.
 *
 * `--expect-hit` additionally requires `oxygen-full-page-cache: Hit` (or
 * Stale) on a repeat request. That header only exists on Oxygen, so a local
 * preview never passes it.
 *
 * Reads PUBLIC_STORE_DOMAIN and PUBLIC_STOREFRONT_API_TOKEN (public values)
 * from the environment, falling back to .env. Creates carts on the live shop;
 * never checks out.
 *
 * Exits 1 on any failure.
 */
import fs from 'node:fs';
import {applyEdgeCacheHeaders, isEdgeCacheCandidate} from '../app/lib/edgeCache.server.js';

const args = process.argv.slice(2);
const EXPECT_HIT = args.includes('--expect-hit');
const SELF_TEST = args.includes('--self-test');
const ORIGIN = (args.find((a) => a.startsWith('http')) || 'https://streamwidgetshop.com').replace(/\/$/, '');
const bypass = process.env.OXYGEN_BYPASS_TOKEN;
const edgeHeaders = bypass ? {'oxygen-auth-bypass-token': bypass} : {};

let env = {
  PUBLIC_STORE_DOMAIN: process.env.PUBLIC_STORE_DOMAIN,
  PUBLIC_STOREFRONT_API_TOKEN: process.env.PUBLIC_STOREFRONT_API_TOKEN,
};
if (!SELF_TEST && (!env.PUBLIC_STORE_DOMAIN || !env.PUBLIC_STOREFRONT_API_TOKEN)) {
  try {
    env = {
      ...env,
      ...Object.fromEntries(
        fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
          .split('\n').filter((l) => l.includes('='))
          .map((l) => {
            const i = l.indexOf('=');
            return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')];
          }),
      ),
    };
  } catch {
    console.log('Set PUBLIC_STORE_DOMAIN and PUBLIC_STOREFRONT_API_TOKEN, or provide .env');
    process.exit(1);
  }
}

const pass = [];
const fail = [];
function check(name, ok, detail) {
  (ok ? pass : fail).push(name);
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  [${detail}]` : ''}`);
}
const section = (t) => console.log(`\n${t}`);
function finish() {
  console.log(`\n${pass.length} passed, ${fail.length} failed`);
  if (fail.length) {
    console.log('FAILED:\n  ' + fail.join('\n  '));
    process.exit(1);
  }
  console.log(SELF_TEST
    ? 'Edge cache header policy holds (offline rows only).'
    : 'Edge cache is safe: cacheable pages carry no visitor, attribution intact.');
  process.exit(0);
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

/** A tiny cookie jar, one per simulated visitor. */
function jar() {
  const store = new Map();
  return {
    store,
    header: () => [...store].map(([k, v]) => `${k}=${v}`).join('; '),
    remember(res) {
      for (const c of res.headers.getSetCookie?.() || []) {
        const [kv] = c.split(';');
        const i = kv.indexOf('=');
        store.set(kv.slice(0, i), kv.slice(i + 1));
      }
    },
  };
}

async function get(path, visitor, extra = {}) {
  const res = await fetch(ORIGIN + path, {
    redirect: 'manual',
    headers: {
      'User-Agent': UA,
      'Accept-Encoding': 'identity',
      ...edgeHeaders,
      ...(visitor && visitor.store.size ? {Cookie: visitor.header()} : {}),
      ...extra,
    },
  });
  if (visitor) visitor.remember(res);
  return res;
}

const SF = `https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`;
async function sf(query, variables) {
  const r = await fetch(SF, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
    },
    body: JSON.stringify({query, variables}),
  });
  return r.json();
}

async function addToCart(visitor, variantId) {
  const body = new URLSearchParams();
  body.append('cartFormInput', JSON.stringify({
    action: 'LinesAdd',
    inputs: {lines: [{merchandiseId: variantId, quantity: 1}]},
  }));
  const res = await fetch(`${ORIGIN}/cart`, {
    method: 'POST',
    body,
    redirect: 'manual',
    headers: {
      'User-Agent': UA,
      ...edgeHeaders,
      ...(visitor.store.size ? {Cookie: visitor.header()} : {}),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  visitor.remember(res);
  return res;
}

async function cartAttributes(visitor) {
  const raw = visitor.store.get('cart');
  if (!raw) return null;
  const id = `gid://shopify/Cart/${decodeURIComponent(raw)}`;
  // Cart reads can lag a write by a few seconds.
  for (let i = 0; i < 6; i++) {
    const j = await sf(`query($id:ID!){cart(id:$id){attributes{key value}}}`, {id});
    const attrs = j.data?.cart?.attributes;
    if (attrs?.length) return Object.fromEntries(attrs.map((a) => [a.key, a.value]));
    await new Promise((r) => setTimeout(r, 1500));
  }
  return {};
}


console.log(`Target: ${ORIGIN}${EXPECT_HIT ? '  (expecting Oxygen cache hits)' : ''}`);

// ---------------------------------------------------------------- 1
section('1. Eligibility rules (pure function, every row must hold)');
{
  const cand = (path, method = 'GET') => isEdgeCacheCandidate(new Request(`https://x.test${path}`, {method}));
  const yes = ['/', '/pages/now-playing', '/products/celestial-stream-kit', '/collections/all', '/blogs/news', '/blogs/news/some-post', '/policies/refund-policy', '/robots.txt', '/sitemap.xml', '/sitemap/products/1.xml', '/llms.txt'];
  for (const p of yes) check(`cacheable: GET ${p}`, cand(p) !== null);
  check('cacheable: HEAD /', cand('/', 'HEAD') !== null);
  const no = [
    '/cart', '/cart/abc:1', '/account', '/account/orders', '/account/authorize', '/search', '/api/v', '/api/e', '/api/agent',
    '/discount/CODE', '/products_preview', '/downloads/tok/file', '/free-chat-widget', '/webhooks/orders', '/admin/config', '/api/version',
    '/pages/now-playing.data', '/_root.data', '/products/x.data',
    '/?twclid=test123', '/?gclid=a', '/?fbclid=a', '/?ttclid=a', '/?msclkid=a', '/?utm_source=x', '/?epik=a', '/?x=1', '/products/a?variant=1', '/collections/all?sort_by=price', '/pages/a?', 
  ];
  for (const p of no) check(`NOT cacheable: GET ${p}`, cand(p) === null);
  for (const m of ['POST', 'PUT', 'DELETE', 'PATCH']) check(`NOT cacheable: ${m} /`, cand('/', m) === null);
}

// ---------------------------------------------------------------- 1b
section('1b. Header policy (pure function): a stored page always carries the _sfapi_proxy marker');
{
  const MARKER = /(^|[\s,])_sfapi_proxy\s*;\s*desc=1/;
  const html = (headers = {}) => new Response('<html></html>', {status: 200, headers: {'Content-Type': 'text/html; charset=utf-8', ...headers}});
  // Hydrogen adds the marker only for `Accept: text/html` or `Sec-Fetch-Dest:
  // document`, so a crawler fill (`Accept: */*`) reaches us without it.
  const bare = html();
  check('html without the marker is accepted', applyEdgeCacheHeaders(bare, 'html') === true);
  check('html without the marker gets it added', MARKER.test(bare.headers.get('Server-Timing') || ''), bare.headers.get('Server-Timing'));

  const withOther = html({'Server-Timing': 'ipv6;desc=1'});
  applyEdgeCacheHeaders(withOther, 'html');
  const t = withOther.headers.get('Server-Timing') || '';
  check('an existing Server-Timing entry is kept and the marker appended', /^ipv6;desc=1, _sfapi_proxy;desc=1$/.test(t), t);

  const already = html({'Server-Timing': '_sfapi_proxy;desc=1'});
  applyEdgeCacheHeaders(already, 'html');
  check('a marker Hydrogen already added is not duplicated', (already.headers.get('Server-Timing').match(/_sfapi_proxy/g) || []).length === 1, already.headers.get('Server-Timing'));

  const mid = html({'Server-Timing': 'ipv6;desc=1, _sfapi_proxy;desc=1'});
  applyEdgeCacheHeaders(mid, 'html');
  check('a marker in the middle of a combined value is recognised', (mid.headers.get('Server-Timing').match(/_sfapi_proxy/g) || []).length === 1, mid.headers.get('Server-Timing'));

  const lookalike = html({'Server-Timing': 'x_sfapi_proxy;desc=1'});
  applyEdgeCacheHeaders(lookalike, 'html');
  check('a lookalike name does not count as the marker', /(^|[\s,])_sfapi_proxy\s*;\s*desc=1/.test(lookalike.headers.get('Server-Timing')), lookalike.headers.get('Server-Timing'));

  const txt = new Response('User-agent: *', {status: 200, headers: {'Content-Type': 'text/plain'}});
  applyEdgeCacheHeaders(txt, 'text');
  check('text files do not get the marker', !txt.headers.has('Server-Timing'));

  const cookie = html();
  cookie.headers.append('Set-Cookie', 'a=b');
  check('a response with Set-Cookie is still refused', applyEdgeCacheHeaders(cookie, 'html') === false);
  check('a refused response is left untouched (no marker, no cache header)', !cookie.headers.has('Server-Timing') && !cookie.headers.has('Oxygen-Cache-Control'));

  const token = html({'Server-Timing': '_y;desc=abc, _s;desc=def'});
  check('a response with Shopify visitor tokens is still refused', applyEdgeCacheHeaders(token, 'html') === false);
}

if (SELF_TEST) finish();

// ---------------------------------------------------------------- 2
section('2. Public pages are cacheable and carry nothing about a visitor');
const PUBLIC = ['/', '/pages/now-playing', '/products/celestial-stream-kit', '/collections/all', '/robots.txt', '/sitemap.xml'];
for (const p of PUBLIC) {
  // A returning visitor with a live cart, session and ad cookies, and a
  // stranger with nothing. Both must get the same public response.
  const returning = jar();
  returning.store.set('cart', 'c1-FAKECARTTOKEN');
  returning.store.set('sws_cid', '1234567890.1700000000');
  returning.store.set('sws_ses', '1700000000.3.1700000100');
  returning.store.set('sws_twclid', 'secrettw123');
  returning.store.set('_ga', 'GA1.1.111.222');
  const stranger = jar();
  const a = await get(p, returning);
  const b = await get(p, stranger);
  const ocache = a.headers.get('oxygen-cache-control') || '';
  const cookies = [...a.headers.getSetCookie(), ...b.headers.getSetCookie()];
  const timing = `${a.headers.get('server-timing') || ''} ${b.headers.get('server-timing') || ''}`;
  check(`${p}: 200`, a.status === 200 && b.status === 200, `${a.status}/${b.status}`);
  check(`${p}: public Oxygen-Cache-Control with max-age and stale-while-revalidate`, /^public,\s*max-age=\d+,\s*stale-while-revalidate=\d+$/.test(ocache), ocache);
  check(`${p}: NO Set-Cookie`, cookies.length === 0, cookies.map((c) => c.split('=')[0]).join(',') || 'none');
  check(`${p}: no Shopify visitor tokens in Server-Timing`, !/(^|[\s,])(_y|_s|_cmp)\s*;/.test(timing), timing.trim().slice(0, 80));
  check(`${p}: Vary is set and is not *`, /accept-encoding/i.test(a.headers.get('vary') || '') && !/\*/.test(a.headers.get('vary') || ''), a.headers.get('vary'));
  if (p === '/' || p.startsWith('/pages/') || p.startsWith('/collections/')) {
    // Not a byte comparison: React streams deferred data in whatever order it
    // resolves, so two renders of the SAME page differ in chunk order (seen
    // locally, 303585 vs 303745 bytes with identical cookies). What matters is
    // that nothing of the visitor is in the markup.
    const ta = await a.text();
    const tb = await b.text();
    check(`${p}: no visitor cookie value appears in the body`, ![ta, tb].some((t) => t.includes('secrettw123') || t.includes('FAKECARTTOKEN') || t.includes('1234567890.1700000000') || t.includes('GA1.1.111.222')));
    check(`${p}: shows the signed out header and an empty cart badge to everyone`, [ta, tb].every((t) => t.includes('Sign in') && !t.includes('header-cart-count')));
    // The "We're live" bar flips within a minute, a stored page lives ~32.
    // It reaches cached pages through /api/v only.
    check(`${p}: no live banner markup in a stored page (it comes from /api/v)`, ![ta, tb].some((t) => t.includes('sws-live-banner')));
  } else {
    await a.arrayBuffer();
    await b.arrayBuffer();
  }
}

// ---------------------------------------------------------------- 2b
section('2b. A crawler fill must not store a page that browsers cannot set Shopify cookies from');
{
  // Hydrogen adds `Server-Timing: _sfapi_proxy;desc=1` only for `Accept:
  // text/html` or `Sec-Fetch-Dest: document`, and neither is in Oxygen's cache
  // key. A fill with `Accept: */*` used to store a page without the marker, so
  // every later browser skipped Hydrogen's fallback and never got
  // _shopify_analytics/_essential/_marketing. A unique User-Agent
  // gives a PDP cache entry nobody else has touched (the PDP varies on UA), so
  // the first request is a real fill and the second reads what it stored.
  const MARKER = /(^|[\s,])_sfapi_proxy\s*;\s*desc=1/;
  const unique = `${UA} sws-verify-edge-cache/${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const page = '/products/celestial-stream-kit';
  const fill = await get(page, null, {'User-Agent': unique, Accept: '*/*'});
  const fillTiming = fill.headers.get('server-timing') || '';
  await fill.arrayBuffer();
  const browser = await get(page, null, {
    'User-Agent': unique,
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
  });
  const browserTiming = browser.headers.get('server-timing') || '';
  await browser.arrayBuffer();
  const status = (r) => r.headers.get('oxygen-full-page-cache') || 'n/a';
  check('crawler fill (Accept: */*) response carries _sfapi_proxy', MARKER.test(fillTiming), `${status(fill)}; ${fillTiming.slice(0, 80)}`);
  check('browser read after that fill carries _sfapi_proxy', MARKER.test(browserTiming), `${status(browser)}; ${browserTiming.slice(0, 80)}`);
  check('the marker is present exactly once', (browserTiming.match(/_sfapi_proxy/g) || []).length === 1, browserTiming.slice(0, 80));
}

// ---------------------------------------------------------------- 3
section('3. Anything per visitor, mutating or carrying a click id stays uncached');
for (const p of ['/?twclid=test123', '/?gclid=abc', '/?fbclid=abc', '/?ttclid=abc', '/?msclkid=abc', '/?utm_source=x&utm_medium=y', '/cart', '/account', '/search?q=neon', '/api/v', '/api/version', '/pages/now-playing.data']) {
  const res = await get(p, null, p.endsWith('.data') ? {Accept: '*/*'} : {});
  const oc = res.headers.get('oxygen-cache-control');
  check(`${p}: no Oxygen-Cache-Control`, !oc, oc || 'absent');
  await res.arrayBuffer();
}
{
  const res = await fetch(`${ORIGIN}/cart`, {method: 'POST', redirect: 'manual', headers: {...edgeHeaders, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA}, body: 'cartFormInput=%7B%7D'});
  check('POST /cart: no Oxygen-Cache-Control', !res.headers.get('oxygen-cache-control'), res.headers.get('oxygen-cache-control') || 'absent');
  await res.arrayBuffer();
}
for (const p of ['/cart', '/api/v']) {
  const res = await get(p, null);
  const cc = res.headers.get('cache-control') || '';
  if (p === '/api/v') check('/api/v: Cache-Control is private, no-store', /private/.test(cc) && /no-store/.test(cc), cc);
  await res.arrayBuffer();
}

// ---------------------------------------------------------------- 4
section('4. Click id landing: captured server side, carried onto the cart');
const probe = await fetch(`${ORIGIN}/api/agent?op=search&q=neon&limit=1`, {headers: edgeHeaders});
if (!probe.headers.get('content-type')?.includes('json')) {
  console.log('  The target returned HTML, not JSON. A preview needs OXYGEN_BYPASS_TOKEN.');
  process.exit(1);
}
const variantId = (await probe.json()).results[0].variantId;
{
  const v = jar();
  const stamp = `test${Date.now()}`;
  const land = await get(`/?twclid=${stamp}`, v);
  const setNames = land.headers.getSetCookie().map((c) => c.split('=')[0]);
  check('landing with ?twclid sets sws_twclid', v.store.get('sws_twclid') === stamp, `${v.store.get('sws_twclid')}`);
  check('landing with ?twclid sets sws_cid and sws_ses', setNames.includes('sws_cid') && setNames.includes('sws_ses'), setNames.join(','));
  check('landing with ?twclid is not stored by the edge', !land.headers.get('oxygen-cache-control'));
  await land.arrayBuffer();
  // Navigate on to a cached page: the click id must survive, and a cached
  // response must not add or drop cookies.
  const next = await get('/pages/now-playing', v);
  check('later cached page does not touch the click id cookie', v.store.get('sws_twclid') === stamp);
  await next.arrayBuffer();
  const add = await addToCart(v, variantId);
  check('add to cart succeeds', add.status < 400, `${add.status}`);
  const attrs = await cartAttributes(v);
  check('cart carries _twclid = the landing value', attrs?._twclid === stamp, `${attrs?._twclid}`);
  check('cart carries _ga_client_id = sws_cid', attrs?._ga_client_id === v.store.get('sws_cid'), `${attrs?._ga_client_id}`);
  check('cart carries _ga_session_id', Boolean(attrs?._ga_session_id), `${attrs?._ga_session_id}`);
}

// ---------------------------------------------------------------- 5
section('5. Cold visitor whose first page came from the edge cache');
{
  const v = jar();
  const page = await get('/products/celestial-stream-kit', v);
  await page.arrayBuffer();
  check('first cached page leaves the visitor with no cookies yet', v.store.size === 0, [...v.store.keys()].join(',') || 'none');
  const beacon = await get('/api/v', v);
  const body = await beacon.json();
  check('/api/v sets sws_cid', Boolean(v.store.get('sws_cid')), v.store.get('sws_cid'));
  check('/api/v sets sws_ses', Boolean(v.store.get('sws_ses')), v.store.get('sws_ses'));
  check('/api/v returns an empty cart and signed out for a new visitor', body.cart === null && body.isLoggedIn === false, JSON.stringify(body).slice(0, 80));
  // The live banner rides on this response, never on a stored page. null when
  // the stream is off, an object when on; the key must exist either way.
  check('/api/v carries the liveBanner key (null or an object)', 'liveBanner' in body && (body.liveBanner === null || typeof body.liveBanner?.message === 'string'), JSON.stringify(body.liveBanner)?.slice(0, 60));
  const add = await addToCart(v, variantId);
  check('add to cart succeeds', add.status < 400, `${add.status}`);
  const after = await get('/api/v', v);
  const cartBody = await after.json();
  check('/api/v now returns THIS visitor\'s cart', cartBody.cart?.totalQuantity >= 1, `totalQuantity=${cartBody.cart?.totalQuantity}`);
  const other = jar();
  const otherBody = await (await get('/api/v', other)).json();
  check('a different visitor still sees an empty cart from /api/v', otherBody.cart === null, JSON.stringify(otherBody).slice(0, 60));
  const page2 = await get('/products/celestial-stream-kit', other);
  const html = await page2.text();
  check('the cached page never contains a cart id', !html.includes(decodeURIComponent(v.store.get('cart') || 'NOCART')));
  const mine = await (await get('/products/celestial-stream-kit', v)).text();
  check('a visitor WITH a live cart still gets the shared empty-cart markup', !mine.includes('header-cart-count') && !mine.includes(decodeURIComponent(v.store.get('cart') || 'NOCART')));
  const attrs = await cartAttributes(v);
  check('cart carries _ga_client_id = sws_cid', attrs?._ga_client_id === v.store.get('sws_cid'), `${attrs?._ga_client_id}`);
}

// ---------------------------------------------------------------- 6
section('6. Add to cart BEFORE the beacon lands (no cookies at all)');
{
  const v = jar();
  const add = await addToCart(v, variantId);
  check('add to cart succeeds', add.status < 400, `${add.status}`);
  const attrs = await cartAttributes(v);
  check('cart still carries _ga_client_id = the sws_cid set on that same response', Boolean(attrs?._ga_client_id) && attrs._ga_client_id === v.store.get('sws_cid'), `${attrs?._ga_client_id} vs ${v.store.get('sws_cid')}`);
  check('cart still carries _ga_session_id', Boolean(attrs?._ga_session_id), `${attrs?._ga_session_id}`);
}

// ---------------------------------------------------------------- 7
if (EXPECT_HIT) {
  section('7. Oxygen really serves the repeat from its cache');
  for (const p of ['/', '/pages/now-playing', '/products/celestial-stream-kit']) {
    const statuses = [];
    for (let i = 0; i < 3; i++) {
      const res = await get(p, null);
      statuses.push(res.headers.get('oxygen-full-page-cache'));
      await res.arrayBuffer();
    }
    check(`${p}: repeat is a Hit or Stale`, statuses.slice(1).some((s) => /^(hit|stale)$/i.test(s || '')), statuses.join(' > '));
  }
}

finish();
