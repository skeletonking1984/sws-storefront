# Edge cache (Oxygen full-page cache)

Owner of the policy: `app/lib/edgeCache.server.js`. This file explains it; the code is the rule.

## What is stored

Anonymous `GET`/`HEAD` of public content with an EMPTY query string:
`/`, `/pages/*`, `/products/*`, `/collections/*`, `/blogs/*`, `/policies/*`,
`/robots.txt`, `/sitemap.xml`, `/sitemap/*`, `/llms.txt`.

Header sent: `Oxygen-Cache-Control: public, max-age=120, stale-while-revalidate=1800` for pages,
`max-age=3600, stale-while-revalidate=86400` for the machine files, plus `Vary: Accept-Encoding`.
(Oxygen reads `Oxygen-Cache-Control`, not `Cache-Control`.
Docs: https://shopify.dev/docs/storefronts/headless/hydrogen/caching/full-page-cache)
The PDP also varies on `Sec-CH-UA-Mobile` and `User-Agent` (entry.server.jsx, video rendition), so its hit rate is per UA string.

## What is never stored

Anything with a query string (every click id, `utm_*`, filters, search, `?variant=`), any non-GET,
`.data` client navigations, `/cart`, `/account`, `/api/*`, `/discount/*`, downloads, webhooks.
A response is also refused if it carries Set-Cookie or the Shopify visitor tokens (`_y`, `_s`, `_cmp`) in `Server-Timing`.

## How a stored page stays visitor free

1. `server.js` decides candidacy from the RAW request and passes `edgeCacheable` into the load context.
2. Root loader (`app/root.jsx`) returns `cart: null`, `isLoggedIn: false`, `liveBanner: null`, `visitorPending: true` for those requests.
3. After hydration the browser calls `/api/v` (`app/routes/api.v.jsx`, never cached) for the real cart, login state and
   "We're live" banner (`useVisitor` in `app/root.jsx`). It also gets `sws_cid` / `sws_ses` set there, because a stored page
   cannot set cookies.
4. `collectTrackingInformation: false` for candidates, so Hydrogen does not copy `_shopify_essential/_analytics/_marketing`
   or the `_y`/`_s` tokens onto the page. Hydrogen's own client fallback (`useShopifyCookies` fetchTrackingValues through
   the same-origin `/api/unstable/graphql.json` proxy) sets them in the browser. Those cookies come from the Storefront API,
   not from Oxygen itself. The fallback only runs when the page carries `Server-Timing: _sfapi_proxy;desc=1`
   (`isSfapiProxyEnabled` looks for a navigation `serverTiming` entry named `_sfapi_proxy`). Hydrogen adds that only when the
   request has `Accept: text/html` or `Sec-Fetch-Dest: document`, and neither header is in Oxygen's cache key, so a crawler
   or curl fill (`Accept: */*`) would store a page without it for every browser. `applyEdgeCacheHeaders` therefore
   appends `_sfapi_proxy;desc=1` to every stored HTML page when it is absent, and never duplicates it. Text files are untouched.
5. A mutating request (the cart POST) gets the first-party cookies injected into the request it runs with, so a cart created
   before the beacon lands still carries `_ga_client_id` and the session.

## Click ids

Any URL with a click id has a query string, so it is never a candidate: the worker runs, `buildFirstTouchSetCookieHeaders`
sets `sws_twclid` etc., first touch wins. Later cached pages do not touch those cookies. See `conversion-tracking.md`.

## Known tradeoffs

- The CSP nonce in a stored page is the nonce of the render that filled the cache, shared by every visitor for up to
  `max-age + stale-while-revalidate`. A nonce no longer proves "this response was made for me". Nothing attacker controlled is
  rendered into a stored page (no query string, 200 only), so the residual risk is an injection from content Shopify serves.
- Price or description edits show within about 2 minutes plus one stale view. A deploy empties the cache.
- Header shows "Sign in" and an empty cart badge until `/api/v` returns (one request after hydration).
- The "We're live" banner is never in a stored page. It would outlive the stream by up to `max-age +
  stale-while-revalidate` (about 32 minutes). It arrives from `/api/v` after hydration, so on a cached page it appears one
  request late and pushes the header down when it does. Uncached pages (any query string, `.data`) still render it server side.
  See `LIVE-BANNER.md`.

## Check it

```bash
npm run verify:edge-cache                      # production, no cache-status assertions
node scripts/verify-edge-cache.mjs --expect-hit   # production, also requires Oxygen Hit/Stale on a repeat
node scripts/verify-edge-cache.mjs http://localhost:3199   # local preview
npm run verify:edge-cache:self-test            # offline rows only (eligibility, header policy), no env or network
```
It asserts eligibility rows, the `_sfapi_proxy` marker policy, no Set-Cookie, no visitor markup and no live banner markup on
stored pages, a crawler fill (`Accept: */*`, unique User-Agent) followed by a browser read both carrying the marker, click id
landing to cart attributes, a cold visitor via `/api/v` (including the `liveBanner` key), and a cart created before the beacon. Section 6 was proven to fail with the injection removed.
