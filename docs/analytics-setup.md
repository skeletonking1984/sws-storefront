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

Pending from Auny, tracked on Linear BAT-145. Every value below is blank
until she supplies it.

| Variable | Where to get it |
|---|---|
| `PUBLIC_X_PIXEL_ID` | X Ads Manager > Tools > Events Manager > (this pixel) > pixel id. |
| `PUBLIC_X_EVENT_ID_PAGE_VIEW` | X Ads Events Manager > the pixel's configured PageView event > Event ID. |
| `PUBLIC_X_EVENT_ID_VIEW_CONTENT` | X Ads Events Manager > the pixel's configured ViewContent event > Event ID. |
| `PUBLIC_X_EVENT_ID_ADD_TO_CART` | X Ads Events Manager > the pixel's configured AddToCart event > Event ID. |
| `PRIVATE_X_CAPI_TOKEN` | developer.x.com app credentials for the Ads API. Auth scheme is UNCONFIRMED, see the TODO comments in `app/lib/conversions/x.server.js` before relying on this. |
| `PRIVATE_X_PURCHASE_EVENT_ID` | X Ads Events Manager > the pixel's configured Purchase event > Event ID (separate from the pixel id above). |

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
