# Live banner ("We're live")

Slim strip above the header (sitewide, wired in `app/root.jsx`): pulsing LIVE
dot, message, primary CTA button, platform link pills. Controlled by one shop
metafield, so on/off needs NO redeploy (the Storefront query is cached about
1s, flips land in seconds).

## Live gate (2026-10-03)

The banner renders only when BOTH are true:

1. Metafield `on` is exactly `true` (master switch; `on: false` always hides,
   and no live check is made at all).
2. The channel is verified live right now, server-side (see "Where it renders" below).

This exists because the metafield alone left "We're live" up after the stream
ended. Forgetting to flip `off` is now harmless.

- Check: `GET https://decapi.me/twitch/uptime/<login>` (public, no creds).
  Offline answers `<login> is offline`; live answers an uptime string like
  `1 day, 17 hours, 43 minutes, 39 seconds`. No Twitch Helix creds exist in this
  repo or the Oxygen env. If Helix creds are ever added, swap `probeTwitchLive`
  in `app/lib/liveBanner.js`; nothing else changes.
- `<login>` comes from the first `twitch.tv` link in the metafield `links`
  (written by the operator tooling from the stream overlay app's config,
  `links.twitch`). No Twitch link in the metafield means it cannot be verified,
  so the banner stays hidden.
- Fails closed: 1.5s timeout, HTTP error, network error, or any body that is not
  exactly an uptime string or `<login> is offline` means hidden.
- Cached 60s fresh plus 30s stale-while-revalidate (`withCache`, built in
  `app/lib/context.js`). Only definite answers (live/offline) are cached; an
  unknown result is retried on the next request. Lag: the banner reflects the
  60s probe cache on each page load, regardless of the page edge cache. It
  appears within about a minute of going live and disappears within about 1.5
  minutes of the stream ending, as of the next page load. A tab that is already
  open keeps what it has until it reloads (the root loader does not revalidate
  on navigation, see `shouldRevalidate` in `app/root.jsx`).
- Only checks Twitch. A stream that is live only on YouTube/Kick will NOT show
  the banner.
- Test: `npm run verify:live-banner` (mocked fetch; `-- --live` also probes the
  real checker once). Also runs in `npm run verify:all`. It includes the edge
  cache rows (a candidate render has no banner). `npm run verify:edge-cache`
  asserts the same on real HTML and that `/api/v` carries the `liveBanner` key.

- Metafield: shop owner, namespace `sws`, key `live_banner`, type `json`.
- Storefront API access: `PUBLIC_READ`, set on the metafield definition
  (`metafieldDefinitionCreate`, `access: {storefront: PUBLIC_READ}`). Without the
  definition the Storefront API returns null and the banner stays hidden.
- Code: `app/lib/liveBanner.js` (query, validation, live gate),
  `app/components/LiveBanner.jsx`, `.sws-live-*` in `app/styles/app.css`, wired in
  `app/root.jsx` + `app/components/PageLayout.jsx`, and `app/routes/api.v.jsx` for
  cached pages.
- Fails closed: missing, unparseable, `on` not exactly `true`, empty message,
  or channel not verified live renders nothing. Link URLs must be https; the CTA may be a `/path` or https.
- Platform links come from the stream overlay app's config `links`
  (twitch, youtube + `/live`, kick, x). Never hardcode them elsewhere.

## Where it renders (edge cache, 2026-10-04)

Public pages are stored by Oxygen's full-page cache for `max-age=120` plus
`stale-while-revalidate=1800` (`docs/edge-cache.md`). A banner baked into that
HTML would outlive the stream by about 32 minutes, so:

- Cache candidate request (`context.edgeCacheable`): the root loader returns
  `liveBanner: null`, no query and no probe (`loadLiveBannerForPage` in
  `app/lib/liveBanner.js`). The stored HTML never contains `sws-live-banner`.
  After hydration the browser calls `/api/v` (never cached), which returns
  `liveBanner` next to `cart` and `isLoggedIn`, and `useVisitor` in
  `app/root.jsx` renders it. Server and first client render both have no
  banner, so hydration matches. The banner then pushes the header down, once.
- Uncached request (query string, `.data`, cart, account, and so on): rendered
  server side by the root loader, as before.
- `/api/v` runs `loadLiveBanner` in parallel with the cart read. Metafield off
  costs one `CacheShort` query and no probe. Metafield on and the probe cache
  cold, a hung checker holds `/api/v` (cart badge included) up to the 1.5s
  timeout.
- Fails closed on both paths: any error, a failed `/api/v` fetch, or a missing
  `liveBanner` key means no banner.

## Value shape

```json
{"on": true, "message": "We're live now: Now Playing widgets showcase",
 "cta_label": "Get early access", "cta_url": "/pages/now-playing",
 "links": [{"label": "Twitch", "url": "https://twitch.tv/StreamWidget"}]}
```

## Setting it

The metafield definition is created once with `PUBLIC_READ` storefront
access (namespace `sws`, key `live_banner`, type `json`), then the value is
written with the Admin API. The operator tooling that does this is not part of
this public copy.

## Turn it OFF by hand

Normally unnecessary now (the live gate hides it when the stream ends), but to
force it off immediately: Shopify Admin > Settings > Custom data > Shop >
"Live banner": set `"on": false`.
Or Admin GraphQL (get the shop id with `{ shop { id } }`):

```graphql
mutation {
  metafieldsSet(metafields: [{
    ownerId: "gid://shopify/Shop/<ID>", namespace: "sws", key: "live_banner",
    type: "json", value: "{\"on\":false}"
  }]) { userErrors { field message } }
}
```

Deleting the metafield also hides it.
