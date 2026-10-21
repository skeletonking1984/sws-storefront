/**
 * Oxygen full-page cache policy for the public, anonymous part of the store.
 *
 * WHY. Every HTML response used to carry `oxygen-full-page-cache: uncacheable`
 * (measured 2026-10-03), because every response also carried Set-Cookie:
 * Hydrogen's `_shopify_essential/_analytics/_marketing` (collected off the
 * Storefront API subrequests), our first-party `sws_cid` and `sws_ses`, and
 * sometimes the session commit. Oxygen's documented rule is that a response
 * with Set-Cookie is never stored. So every visit paid a full worker render,
 * and a visitor far from the origin paid for it in TTFB.
 *
 * https://shopify.dev/docs/storefronts/headless/hydrogen/caching/full-page-cache
 * A response is stored only when ALL of these hold: GET, 2xx/3xx, a PUBLIC
 * `Oxygen-Cache-Control` with a non-zero max-age or s-maxage, a `Vary` header
 * (never `*`), and no Set-Cookie. Oxygen does not key on cookies, so whatever
 * is stored is handed to EVERY visitor of that URL.
 *
 * THE RULE THIS FILE ENFORCES: a stored response contains nothing about the
 * visitor. Three things make that true, and all three must hold:
 *   1. `isEdgeCacheCandidate` only admits anonymous GETs of public content
 *      routes with an EMPTY query string. Any query string (click ids such as
 *      gclid/fbclid/twclid/ttclid/msclkid/epik, utm_*, filters, search,
 *      variant) stays uncached, so first touch attribution is still captured
 *      by the worker on the landing request (server.js cookie layer).
 *   2. The root loader skips cart and login state for a candidate request
 *      (`visitorPending`), and the browser fetches them from /api/v, which is
 *      never cached. See app/root.jsx.
 *   3. `applyEdgeCacheHeaders` refuses to mark a response cacheable if it
 *      carries Set-Cookie or the Shopify per-visitor tokens in Server-Timing.
 *      Fail safe: a response that is not provably visitor free is left
 *      uncacheable, exactly as before this file existed.
 *
 * Cookies a cached response cannot set are set later by the browser: the
 * first-party `sws_cid`/`sws_ses` by /api/v (app/routes/api.v.jsx), the
 * Shopify consent and tracking cookies by Hydrogen's own client fallback
 * (useShopifyCookies fetchTrackingValues through the same-origin Storefront
 * API proxy). That fallback only runs when the page carries
 * `Server-Timing: _sfapi_proxy;desc=1`, which `applyEdgeCacheHeaders`
 * guarantees on every stored HTML page (see SFAPI_PROXY_TIMING).
 *
 * Relative imports only: scripts/verify-edge-cache.mjs loads this under plain
 * node, which cannot resolve the ~ alias.
 */

/** Pages: a fresh copy for 2 minutes, then one stale view while it refreshes. */
export const EDGE_CACHE_HTML =
  'public, max-age=120, stale-while-revalidate=1800';

/** robots, sitemaps and llms.txt change rarely. */
export const EDGE_CACHE_TEXT =
  'public, max-age=3600, stale-while-revalidate=86400';

const HTML_EXACT = new Set(['/']);
const HTML_PREFIXES = [
  '/pages/',
  '/products/',
  '/collections/',
  '/blogs/',
  '/policies/',
];
const TEXT_EXACT = new Set(['/robots.txt', '/sitemap.xml', '/llms.txt']);
const TEXT_PREFIXES = ['/sitemap/'];

/**
 * Which cache class, if any, this request is eligible for. This only decides
 * eligibility. The response still has to pass `applyEdgeCacheHeaders`.
 *
 * @param {Request} request
 * @returns {'html' | 'text' | null}
 */
export function isEdgeCacheCandidate(request) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null;

  const url = new URL(request.url);

  // Any query string at all: click ids, utm_*, filters, sort, search,
  // variant. Also stops cache fragmentation by junk query strings. The raw
  // URL is checked as well, because `new URL('/a?').search` is empty.
  if (url.search !== '' || request.url.includes('?')) return null;

  const path = url.pathname;

  // React Router single fetch data requests (client navigations) carry the
  // real cart and login state and must run the worker.
  if (path.endsWith('.data')) return null;

  if (TEXT_EXACT.has(path)) return 'text';
  if (TEXT_PREFIXES.some((p) => path.startsWith(p))) return 'text';
  if (HTML_EXACT.has(path)) return 'html';
  if (HTML_PREFIXES.some((p) => path.startsWith(p))) return 'html';
  return null;
}

/**
 * The Server-Timing entry Hydrogen's client reads to switch on its browser
 * side tracking fallback. `isSfapiProxyEnabled` looks for an entry NAMED
 * `_sfapi_proxy` in the navigation entry's serverTiming, so only the name has
 * to be present. The browser merges every Server-Timing header value, which
 * is why a separate appended value is read the same as a combined one.
 */
const SFAPI_PROXY_TIMING = '_sfapi_proxy;desc=1';
const SFAPI_PROXY_RE = /(^|[\s,])_sfapi_proxy\s*(;|,|$)/;

const CACHEABLE_TYPES = {
  html: ['text/html'],
  text: ['text/plain', 'text/xml', 'application/xml'],
};

/**
 * Marks a response edge cacheable when, and only when, it is provably free of
 * visitor data. Returns true when the headers were applied.
 *
 * @param {Response} response
 * @param {'html' | 'text'} kind
 * @returns {boolean}
 */
export function applyEdgeCacheHeaders(response, kind) {
  if (response.status !== 200) return false;

  const type = (response.headers.get('Content-Type') || '').toLowerCase();
  if (!CACHEABLE_TYPES[kind].some((t) => type.startsWith(t))) return false;

  // Set-Cookie: Oxygen would refuse to store it anyway, and a cookie in a
  // stored response would be a session handed to strangers.
  if (response.headers.getSetCookie().length > 0) return false;

  // Hydrogen puts the visitor's Shopify tokens (_y, _s, _cmp) in
  // Server-Timing when it collects tracking information. Stored, they would
  // give every visitor the same Shopify identity.
  const timing = response.headers.get('Server-Timing') || '';
  if (/(^|[\s,])(_y|_s|_cmp|_server_tracking)\s*(;|,|$)/.test(timing))
    return false;

  const vary = response.headers.get('Vary') || '';
  if (vary.split(',').some((v) => v.trim() === '*')) return false;

  // Hydrogen only adds the `_sfapi_proxy` marker when the request says
  // `Accept: text/html` or `Sec-Fetch-Dest: document`. Neither header is in
  // Oxygen's cache key, so a crawler or curl fill (`Accept: */*`) would store
  // a page WITHOUT the marker and hand it to every browser, whose Shopify
  // cookies (`_shopify_analytics/_essential/_marketing`) are only set by that
  // fallback because collectTrackingInformation is off for candidates. A
  // stored page is, by definition, an HTML page for a browser, so make the
  // marker unconditional. Never duplicated when Hydrogen already added it.
  if (kind === 'html' && !SFAPI_PROXY_RE.test(timing)) {
    response.headers.append('Server-Timing', SFAPI_PROXY_TIMING);
  }

  response.headers.set(
    'Oxygen-Cache-Control',
    kind === 'html' ? EDGE_CACHE_HTML : EDGE_CACHE_TEXT,
  );
  response.headers.append('Vary', 'Accept-Encoding');
  return true;
}
