# Conversion tracking: the standard

How purchase attribution works on this storefront, and how to add the next
ad platform. GA4 is the only destination actually sending today; everything
else in this doc is the standard that makes adding X, Meta, TikTok, Google
Ads, Microsoft or Pinterest a small, obvious change instead of a rebuild.

For where every ID comes from and where to paste it in production, see
`docs/analytics-setup.md`. This doc covers the architecture; that one
covers the config surface.

The browser half (page_view, view_item, add_to_cart, ... -- everything
except purchase) is a matching registry on the client side:
`app/lib/analytics/registry.js` lists every browser pixel adapter under
`app/lib/analytics/pixels/`, `app/lib/analytics/events.js` normalizes
Hydrogen's analytics bus into one ecommerce event shape so every adapter
maps from it instead of each re-reading the raw bus, and
`app/components/pixels/PixelBus.jsx` is the single subscriber that fans a
normalized event out to every configured adapter. Adding a platform's
browser pixel is the same shape as adding its server destination: one file,
one array entry.

## The rule: purchase is always server side

Checkout is Shopify hosted, not this app. A browser pixel on the
`checkout_completed` event (an Admin custom pixel, see
`docs/checkout-purchase-pixel.md`) misses Shop Pay's guest/fast-path
checkout entirely, and this audience runs ad blockers heavily. Neither of
those is a corner case here, both are measured.

The one purchase event that is never optional is the **server-side one**:
Shopify's `orders/create` webhook, received at
`app/routes/webhooks.orders.jsx`, verified in production. Every destination
in this doc is driven off that webhook. A browser pixel can exist alongside
it for other events (page_view, add_to_cart, ...) but must never also send
`purchase` to the same destination, or every order counts twice -- see the
"do not run both" note in `docs/checkout-purchase-pixel.md`.

## The three layers

```
1. CAPTURE   -- a click id arrives on the landing URL, once
2. CARRY     -- persisted through a cookie, then a cart attribute, then an order
3. FAN OUT   -- the orders/create webhook sends to every configured destination
```

### 1. Capture

`app/lib/clickIds.server.js` is the single registry of every click id worth
capturing. Capture **all** of these now, even for a platform with no send
wired up yet:

| Attribute key | URL param | Cookie | Platform |
|---|---|---|---|
| `_ga_client_id` | none | `_ga` (Google's own), falls back to `sws_cid` (this app's own) | GA4 |
| `_twclid` | `twclid` | `sws_twclid` | X |
| `_fbclid` | `fbclid` | `sws_fbclid` | Meta |
| `_gclid` | `gclid` | `sws_gclid` | Google Ads |
| `_ttclid` | `ttclid` | `sws_ttclid` | TikTok |
| `_msclkid` | `msclkid` | `sws_msclkid` | Microsoft |
| `_epik` | `epik` | `sws_epik` | Pinterest |

**Why capture everything now:** a click id that was not captured on the
landing request cannot be recovered later. There is no "go back and get
it" once that request is gone. Sending a captured id to a new destination
is cheap and can be added any time; capturing a new id retroactively is
not possible. Capture is nearly free, so it happens for every platform
plausible, not only the one being sent today.

First touch is captured in `server.js` (the Oxygen fetch handler, wraps
every request), via `buildFirstTouchSetCookieHeaders()`: when a request's
URL carries a known param and no cookie for that id exists yet, a
first-party cookie is set (`SameSite=Lax`, `Secure` on https, ~90 day
`Max-Age`, `Path=/`). An existing cookie is never overwritten -- first
touch wins, so a later ad click does not steal credit from whichever
campaign brought the visitor the first time.

GA4 has no query param of its own: `_ga` is Google's cookie, written by
`gtag.js`, and is only ever read (via `parseGaClientId` in
`app/lib/gaCookie.server.js`), never set by this app. But `_ga` only
exists when gtag.js actually ran, so this app also owns a fallback: a
`sws_cid` cookie it mints and sets itself, in GA4's own client_id shape,
from `app/lib/firstPartyId.server.js`, set on every request from
`server.js`. `readClickIds` prefers `_ga` when present (staying joined to
GA4's own idea of the session) and only falls back to `sws_cid` when it is
not. See "Surviving ad blockers" below for why this exists.

### 2. Carry

A click id is captured several pages before the cart that becomes an order
exists, so it has to ride on the cart as an attribute, then survive onto
the order as a Shopify `note_attribute` of the same name.

`app/routes/cart.jsx` calls `readClickIds(request)` on **every** cart
mutation (not only creation) and attaches whatever is missing. Two rules,
both load-bearing:

- **Never overwrite.** An id already on the cart is left alone.
- **Never clobber.** Shopify's `cartAttributesUpdate` mutation replaces the
  entire attributes array, it does not merge. Every write here always
  includes the cart's existing attributes (tracking or otherwise) plus
  only the ones still missing.

Running on every mutation, not only cart creation, is the fix for a real
gap found on 2026-09-11: order #1040 arrived with empty
`customAttributes` because the previous version of this relay only wrote
at cart creation, so a cart that already existed before the relay code
shipped never got backfilled. A missing `_ga` cookie (tracker blocker) is
the other, unavoidable cause of an empty attribute -- that one is a
capture-side gap, not a carry-side one, and has no fix beyond a working
cookie.

### 3. Fan out

`app/routes/webhooks.orders.jsx` receives the verified `orders/create`
webhook, reads every captured click id back out of `order.note_attributes`
into one `clickIds` map, builds one shared `eventId`, and calls every
registered destination in parallel via `Promise.allSettled`. A destination
that throws, times out, or was never configured is isolated: it cannot
stop another destination from sending, and can never fail the webhook
response Shopify is waiting on. Every destination's own outbound `fetch`
has an 8 second `AbortSignal.timeout`, the same ceiling
`app/lib/notify.server.js` uses.

## Destinations: the interface

`app/lib/conversions/index.server.js` exports the array of registered
destinations. Every destination module exports exactly this shape:

```js
export const id = 'ga4';
export function isConfigured(env) { ... }          // sync, no network call
export async function sendPurchase({env, order, clickIds, eventId}) { ... }
export async function sendEvent({env, name, params, clickIds}) { ... } // optional
// sendPurchase/sendEvent return {ok: true} or {ok: false, reason: '...'}, never throw
```

- `isConfigured(env)` is a pure check of env vars. The webhook (and the
  event relay, see below) skips a destination entirely (no call, no log
  noise) when this is false.
- `sendPurchase` must never throw. Every destination catches its own
  network/parse errors and returns `{ok: false, reason}` instead, so one
  destination's failure is just a log line, never an outage for the others.
- `sendEvent` is optional: it covers the pre-purchase funnel events
  (page_view, view_item, add_to_cart, ...) relayed by
  `app/routes/api.e.jsx` for a visitor whose browser pixel did not load
  (see "Surviving ad blockers" below). A destination that omits it is
  simply filtered out of the relay's fan-out, same never-throw contract as
  `sendPurchase`. GA4 is the only destination that implements it today.

Registered today:

| Destination | File | Configured by |
|---|---|---|
| GA4 | `app/lib/conversions/ga4.server.js` | `PUBLIC_GA4_MEASUREMENT_ID`, `PRIVATE_GA4_API_SECRET` |
| X | `app/lib/conversions/x.server.js` | `PRIVATE_X_CAPI_TOKEN`, `PUBLIC_X_PIXEL_ID`, `PRIVATE_X_PURCHASE_EVENT_ID` |
| Meta | `app/lib/conversions/meta.server.js` | `PRIVATE_META_ACCESS_TOKEN`, `PUBLIC_META_PIXEL_ID` |

X and Meta are wired structurally but **inert**: no credentials exist yet
for either (X tracked on Linear BAT-145, Meta has no pixel created yet).
`isConfigured` returns false with those vars unset, so neither ever runs
or throws. X's request shape is built from X's own public docs and has
three unconfirmed details flagged with `TODO` comments directly in the
file (auth scheme, API version number, and the need for a separate
Purchase event id) -- read those before flipping it on.

## eventId, for deduplication

Every destination receives the same `eventId` for a given order:
`` `order_${orderId}` ``, derived from the Shopify order id. If a browser
pixel for the same platform is ever added and fires for the same order
(it should not, per the server-side-always rule above, but a future
platform's tooling might make that hard to avoid), the platform can use
this shared id to dedupe the two hits into one conversion instead of
double counting. GA4's own dedup key is `transaction_id`, already sent as
the order id; X's is `conversion_id`, sent as this `eventId`. When wiring
a future platform, check what field it uses for dedup and pass `eventId`
into it.

## Surviving ad blockers

A content blocker acts on three things: the third-party script host
(`googletagmanager.com`, `ads-twitter.com`, `connect.facebook.net`), the
collect endpoint those scripts talk to, and sometimes the cookies those
scripts set. This storefront's tracking is now immune to two of those and
partially immune to the third:

- **Purchase/revenue is fully immune.** It never depends on a browser
  script at all -- Shopify's own `orders/create` webhook fires
  server-to-server, verified by HMAC, regardless of what ran (or was
  blocked) in the buyer's browser. This has been true since before this
  section was written; see "The rule: purchase is always server side"
  above.
- **The GA4 client id is now immune.** `app/lib/firstPartyId.server.js`
  mints and sets a `sws_cid` cookie from this app's own server, on this
  app's own domain, `HttpOnly` so no page script (blocked or not) ever
  touches it. A blocker acts on requests and on scripts; it has no
  mechanism for stripping a Set-Cookie header from a first-party response
  it did not block from a host it has no reason to block. This closes the
  gap where a blocked `gtag.js` meant `_ga` never existed and a purchase
  landed under a bare `webhook.<orderId>` id with no session attached.
- **The pre-purchase funnel events are partially immune.** `/api/e` (see
  `app/routes/api.e.jsx`) is a same-origin path, not a third-party host,
  and PixelBus.jsx only sends to it when it has confirmed GA4's own pixel
  did not load (`app/lib/analytics/pixels/ga4.js`'s `didLoad`), so a
  normal visitor never touches it and nothing double counts. This is
  genuinely harder for a blocker to target than a third-party host: there
  is no vendor domain to put on a list, and the path itself
  (`/api/e`) was chosen specifically to avoid the generic analytics-path
  rules (`/track`, `/collect`, `/analytics`, `/pixel`) that some filter
  lists ship independent of any vendor.

**What is still lost, honestly:** a blocked visitor's relayed events carry
none of gtag.js's own automatic enrichment (referrer parsing,
session/engagement metrics, source/medium heuristics gtag derives from the
landing context) -- the relay's attribution rests entirely on whatever
click id this app captured itself (see "Capture" above), which is solid
for a paid click with a `twclid`/`gclid`/etc. on the URL but weaker for
organic or direct traffic. And no method here is claimed to be 100 percent
blocker-proof: `/api/e` is obscure today, not secret, and a blocker
popular enough to justify writing a bespoke rule for one storefront's own
same-origin path could still add one. This narrows the gap, it does not
close it.

## Internal and QA traffic

Automated browser QA and Todd's own manual testing fire real events into
GA4 same as a buyer would. This is tagged with GA4's `traffic_type`
parameter, never dropped, so tracking can still be verified in a real
browser. See `docs/analytics-setup.md`, "Excluding internal and QA
traffic", for detection rules, the manual `?sws_qa=1` switch, and the
exact GA4 Data Filter steps (it defaults to Testing, which excludes
nothing, until switched to Active).

## Measured facts behind this design

- **Checkout is Shopify hosted and can land on a different host than the
  storefront.** Verified 2026-09-11: after the domain cutover, checkout
  fell back to serving from `72470e-33.myshopify.com` (the raw myshopify
  host) rather than a brand subdomain, because retargeting the apex left
  the Online Store with no brand domain of its own. A buyer can complete a
  purchase on a host that shares no cookies with the storefront that sold
  them.
- **Ad blockers are heavy in this audience.** Assumed from the shop's own
  traffic profile (streaming/OBS/widget buyers), not separately measured,
  but treated as a given: any tracking design that depends entirely on a
  browser-side pixel firing is a design that will silently undercount.
- **Order #1040 arrived with `customAttributes: []`.** The direct evidence
  that the pre-2026-09-11 cart-attribute relay had a real gap: it only
  wrote `_ga_client_id` once, at cart creation, so any cart that already
  existed before that code shipped never got the attribute, and the order
  it became carried nothing. Fixed by backfilling on every cart mutation
  (see "Carry" above).

## How to add a new platform

1. **Confirm the send API.** Find the platform's server-side conversion
   API (not its browser pixel API) and its exact request shape: endpoint,
   auth, required fields, and what field it uses for event-level dedup.
   Do not guess a payload shape from memory -- if any part is unconfirmed,
   write the adapter structurally and mark the unconfirmed part with a
   `TODO` comment naming exactly what needs checking, the way
   `app/lib/conversions/x.server.js` does.
2. **Check the click id table above.** If the platform's own click id
   (like `twclid` or `gclid`) is already in `CLICK_ID_REGISTRY` in
   `app/lib/clickIds.server.js`, nothing changes there -- it is already
   being captured, carried onto the cart, and read back out of the order's
   `note_attributes` by the webhook. If it is a genuinely new id not in
   that table, add one entry with its attribute key, URL param, and cookie
   name; that one addition gets it captured everywhere automatically.
3. **Write `app/lib/conversions/<platform>.server.js`** implementing the
   three-export interface above: `id`, `isConfigured(env)`, and
   `sendPurchase({env, order, clickIds, eventId})`. Copy the structure of
   `ga4.server.js` (a configured, sending example) or `x.server.js` (a
   gated, not-yet-sending example) as the starting template. Use the
   relevant `clickIds` key for attribution and pass `eventId` through as
   whatever field the platform uses for dedup.
4. **Add it to `app/lib/conversions/index.server.js`**: one new import,
   one new entry in the `destinations` array. Nothing in
   `app/routes/webhooks.orders.jsx` needs to change -- the fan-out loop
   already calls whatever is in that array.
5. **Set the env vars** (see the table above for the pattern: one
   `PUBLIC_*` id/pixel and one `PRIVATE_*` secret/token is typical) and
   confirm with a real test order: place one, check the platform's own
   real-time/debug view for the event, and confirm the other destinations
   still fire normally alongside it.
