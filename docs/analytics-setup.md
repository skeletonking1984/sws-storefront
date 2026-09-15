# Analytics setup: where every ID comes from

One page, per platform, listing every ID this storefront's analytics uses,
where to get it in that platform's own UI, and where to paste it in
production. See `docs/conversion-tracking.md` for how the browser and
server halves fit together and how to add a new platform.

**Where to paste in production:** Shopify Admin > Hydrogen > SWS
Storefront > Environments and variables. Match the variable name exactly,
`PUBLIC_*` vars are safe to expose to the browser, `PRIVATE_*` vars are
server only and must never be added with a `PUBLIC_` prefix by mistake.

Local dev uses `.env` (gitignored, copy `.env.example` and fill in real
values). Every adapter no-ops cleanly while its own keys are unset, so a
platform with no credentials yet (X, Meta) does not break the site.

## GA4

Live today. Property "SpaceLabs - Shopify" (451083860), stream 8496264324.

Also backs the ad-blocker-survival pieces in
`docs/conversion-tracking.md` ("Surviving ad blockers"): the app-owned
`sws_cid` client id cookie (`app/lib/firstPartyId.server.js`) and the
same-origin event relay (`app/routes/api.e.jsx`, GA4's `sendEvent` in
`app/lib/conversions/ga4.server.js`). Neither needs a new env var -- both
reuse the two below.

| Variable | Where to get it |
|---|---|
| `PUBLIC_GA4_MEASUREMENT_ID` | GA4 Admin > Data Streams > SpaceLabs - Shopify stream > Measurement ID (top of the stream detail page, `G-XXXXXXXXXX`). |
| `PRIVATE_GA4_API_SECRET` | GA4 Admin > Data Streams > SpaceLabs - Shopify stream > Measurement Protocol API secrets > Create. |

Browser adapter: `app/lib/analytics/pixels/ga4.js`. Server adapter:
`app/lib/conversions/ga4.server.js`.

## X (Twitter)

Pixel is live: **`q7mwb`**, account `18ce55rea5b`.

### Use the `SWS` prefixed events, not the `Shopify:` ones

Events Manager lists two families. The `SWS ...` events (SWS Purchase, SWS
PageView, SWS AddToCart, SWS ViewContent) are ours. The
`Shopify:72470e-33:...` events come from Shopify's own X sales channel app.

**Todd, 2026-09-15: "SWS prepended ones until I hear differently."** Every
event id in this file means the `SWS` one.

**Watch for double counting, but note the source is UNIDENTIFIED.**
`Shopify:72470e-33:CHECKOUT_INITIATED` is ACTIVE and recorded as recently as
2026-09-15 10:19, so something is firing into this pixel that is not this
storefront: our browser adapter only sends page_view, view_item and
add_to_cart, and never a checkout event.

It is **not** a Shopify X sales channel app. `appInstallations` returns
exactly five apps and none of them is an X or Twitter channel: Bill Pay
(Melio), Store Migration, Shopify Claude Connector App, SWS Hydrogen
Storefront, Digital Products. An earlier version of this note asserted the
sales channel as the cause and was wrong.

The remaining likely source is a **custom pixel under Settings > Customer
events**, which is the one screen no agent here can read (`webPixel`
requires the `read_pixels` scope this connector lacks). Todd needs to look.

The risk itself stands regardless of source: `Shopify:72470e-33:PURCHASE`
exists and is currently Inactive, and that is the only thing keeping it from
colliding with our CAPI purchase on the same pixel. If it is ever switched
on while CAPI is live, one order is counted against two events. Same shape
as the GA4 double count on 2026-09-13.

### Values

| Variable | Where to get it |
|---|---|
| `PUBLIC_X_PIXEL_ID` | `q7mwb`. Ads Manager > Tools > Events manager, shown beside "Event source". |
| `PRIVATE_X_PURCHASE_EVENT_ID` | Events manager > the **SWS Purchase** row > pencil (edit) > Event ID. Not the pixel id. |
| `PUBLIC_X_EVENT_ID_PAGE_VIEW` | Same, the **SWS PageView** row. |
| `PUBLIC_X_EVENT_ID_VIEW_CONTENT` | Same, the **SWS ViewContent** row. |
| `PUBLIC_X_EVENT_ID_ADD_TO_CART` | Same, the **SWS AddToCart** row. |

### Conversion API auth, two paths

`app/lib/conversions/x.server.js` supports both and prefers A. Run
`npm run verify:x-capi` to see which one the current environment satisfies.

| Path | Variables | Cost |
|---|---|---|
| **A, preferred** | `PRIVATE_X_PIXEL_TOKEN` | A static token generated in the Ads UI, sent as an `X-Pixel-Token` header. No developer account, no approval. Referenced in X's developer forum but not on the web-conversions docs page, so treated as likely rather than confirmed. |
| **B, fallback** | `PRIVATE_X_CONSUMER_KEY`, `PRIVATE_X_CONSUMER_SECRET`, `PRIVATE_X_ACCESS_TOKEN`, `PRIVATE_X_ACCESS_TOKEN_SECRET` | OAuth 1.0a request signing, which is what the official docs describe. Needs a developer account at developer.x.com **plus a separate Ads API access application**, which is an approval and not instant. |

`PRIVATE_X_CAPI_TOKEN` is **dead** and no longer read by anything. The old
adapter sent it as `Authorization: Bearer`, which is neither of the two
schemes above and would always have failed.

Signing is proved independently of any credential by
`npm run verify:oauth1`, against the RFC 5849 worked example.

**The browser pixel is confirmed LIVE on production**, verified in a real
browser 2026-09-15: `uwt.js` loads, `window.twq` is a function, and two
`adsct` beacons fire carrying `txn_id=tw-q7mwb-rf9ym`. So
`PUBLIC_X_PIXEL_ID` and at least `PUBLIC_X_EVENT_ID_PAGE_VIEW` are already
set on Oxygen, and the `SWS PageView` event recording in Events Manager is
ours. Only the server side (CAPI) is missing.

Browser adapter: `app/lib/analytics/pixels/x.js`, wired for page_view,
view_item and add_to_cart only, the three X has a configured event id for
today. Server adapter: `app/lib/conversions/x.server.js`.

## Meta (Facebook/Instagram)

Does not exist yet, Meta ads have not launched. Every value below is
blank until Todd creates the pixel.

| Variable | Where to get it |
|---|---|
| `PUBLIC_META_PIXEL_ID` | Meta Events Manager > Data Sources > (this pixel) > pixel id, shown at the top of the pixel's Settings tab. |
| `PRIVATE_META_ACCESS_TOKEN` | Meta Events Manager > (this pixel) > Settings > Conversions API > Generate access token. |

Browser adapter: `app/lib/analytics/pixels/meta.js`, standard events
PageView, ViewContent, AddToCart, InitiateCheckout, Search. Server
adapter: `app/lib/conversions/meta.server.js`.

## Excluding internal and QA traffic

Automated browser QA (agent sessions driving the live site) and Todd's own
manual testing fire real `add_to_cart` / `view_item` / `page_view` events
into GA4, same as a real buyer. Measured 2026-09-13: the Multistream Chat
Widget showed 10 items viewed and 8 added to cart over 28 days, with zero
of those carts ever starting checkout, because they were our own test
runs. Left alone, this contaminates every conversion number once ads are
running.

**Why tagged, not dropped.** This traffic is marked with GA4's own
`traffic_type` parameter, never suppressed. Suppressing it would make it
impossible to verify tracking works at all in a real browser, which is
exactly how the double-count bug and the `/api/e` relay (see
`docs/conversion-tracking.md`) were both proven out in the first place.
Tagging keeps every event flowing and visible in GA4's real-time/debug
views, and lets it be excluded from reports with one Data Filter, set up
below.

**What is auto-detected**, by `app/lib/analytics/internalTraffic.js`:
- `navigator.webdriver === true`, set by Puppeteer, Playwright, or any
  other CDP-driven script.
- `navigator.userAgent` containing `Claude/`, the in-app browser used by
  Claude Code / agent sessions. Its `navigator.webdriver` is FALSE, so
  this is the signal that actually catches it, not a backup.

**Manual switch**, for Todd's own testing on his own devices:
- `https://streamwidgetshop.com/?sws_qa=1` marks this browser as internal
  (sets a `sws_qa` cookie, 2 year lifetime).
- `https://streamwidgetshop.com/?sws_qa=0` clears it.

**The GA4 steps, exact, because the tag does nothing until these are
done:**

1. GA4 Admin > Data Streams > SpaceLabs - Shopify stream > Configure tag
   settings > Show all > Define internal traffic. (This step lets GA4
   recognize the parameter; the filter below is what actually excludes it.)
2. GA4 Admin > Data settings > Data filters > create (or enable) a filter
   of type "Internal Traffic" matching `traffic_type` equals `internal`.
3. Set that filter to **Active**. It defaults to **Testing**, which does
   NOT exclude anything from reports, it only lets you preview the effect.
   This is the usual reason a traffic filter silently does nothing: it
   was left on Testing.

**Filters are not retroactive.** The 28 days of contaminated data behind
the Multistream Chat Widget numbers above stay contaminated. Only traffic
tagged after the filter is Active gets excluded going forward.

## Adding a platform Todd is not already tracking

1. Write `app/lib/analytics/pixels/<platform>.js` (browser) and, if the
   platform also does server-side purchase send,
   `app/lib/conversions/<platform>.server.js`. Copy the shape of an
   existing adapter, both interfaces are documented at the top of
   `app/lib/analytics/registry.js` and `app/lib/conversions/index.server.js`.
2. Add the browser adapter to the `pixels` array in
   `app/lib/analytics/registry.js`, and the server adapter to the
   `destinations` array in `app/lib/conversions/index.server.js`.
3. Add every env var the new adapter's `envKeys` (browser) or
   `isConfigured` (server) declares to `.env.example`, grouped under that
   platform's own heading, and add a row to this file.
4. Nothing in `app/root.jsx`, `app/components/pixels/PixelBus.jsx`, or
   `app/routes/webhooks.orders.jsx` needs to change.

## Before enabling ANY server side purchase destination, check Shopify's own pixel apps

Shopify Admin > Settings > Customer events lists first party pixel apps, and several of them already send purchases **server side** on their own. Observed 2026-09-13: Facebook & Instagram, Google & YouTube and Pinterest all read **Server + Web, Optimized**. TikTok is present but not connected.

If one of those is connected for a platform, setting this repo's env vars for that same platform creates **two senders for one order**.

This is not theoretical. On 2026-09-13 a single real $19.10 Shopify order appeared in GA4 as **2 purchases, $38.20**, because the Admin custom pixel "GA4 Purchases" and the `orders/create` webhook were both live. Both carried the same `transaction_id` and GA4 counted both anyway, so a shared event id is not a dedup guarantee. Todd deleted the custom pixel; the webhook is the keeper.

Safe order of operations for a new platform:
1. Look at Customer events and see whether Shopify already covers it.
2. If it does, decide which sender wins. This repo's webhook usually should: Shop Pay checkout on `shop.app` does not reliably fire `checkout_completed`, ad blockers kill browser pixels, and the webhook carries the click ids captured in `app/lib/clickIds.server.js`.
3. Remove or disable the loser FIRST and confirm the platform stops receiving from it.
4. Only then set the env vars.

Catch a duplicate by comparing the platform's purchase count against **Shopify's own order count for the same day**, never against itself. One healthy looking report in isolation is what hid this for a day.
