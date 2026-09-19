/**
 * THE CHANNEL MANIFEST. One declaration of every place SWS sends data, what
 * each one is supposed to carry, and where that is implemented.
 *
 * Borrowed from how a CDP organises this (Segment's sources / destinations /
 * connections), because the vocabulary is good, not because we need the
 * product. We already have the moving parts: a normalized event spec, adapters
 * with a uniform interface, and a fan-out that isolates failures. What we did
 * NOT have was anything that knew when a channel was only half connected.
 *
 * WHY THIS FILE EXISTS, from one day's worth of evidence (2026-09-16):
 *
 *   X          had sendPurchase and NO sendEvent for weeks. CAPI carried
 *              purchase alone while the browser carried the funnel. Nothing
 *              flagged it; X's own dashboard did.
 *   Meta       has a complete server adapter, no pixel on the site, and no
 *              env. Fully built, fully disconnected, silently.
 *   Pinterest  had a correct feed and no domain claim, so all 122 items
 *              failed. Found by reading an error report.
 *   IP filter  lived in the FEEDS only. Products stayed published to seven
 *              Shopify channels, so every channel app shipped them anyway.
 *
 * Every one of those is the same shape: a channel that is partly wired, with
 * nothing asserting the rest. A manifest alone would not have caught them
 * either, which is why scripts/verify-channels.mjs checks each claim here
 * against the actual code and the live site. A manifest that is merely
 * DESCRIPTIVE becomes decoration the moment it drifts.
 *
 * ADDING A CHANNEL: add a row here, then run `npm run verify:channels`. It
 * tells you exactly which pieces are missing. That is the whole workflow.
 */

/**
 * SOURCES: where data originates. Two, and the split matters.
 *
 * The browser can be blocked, spoofed and replayed. The webhook is signed by
 * Shopify and cannot be forged, which is why money only ever comes from it:
 * a purchase accepted from the browser would let anyone POST revenue.
 */
export const SOURCES = {
  storefront: {
    label: 'Storefront (browser)',
    emits: ['page_view', 'view_item', 'view_item_list', 'select_item',
            'add_to_cart', 'remove_from_cart', 'view_cart', 'begin_checkout', 'search'],
    relay: '/api/e',
    note: 'Same-origin relay so a blocked pixel still reports. Never purchase.',
  },
  ordersWebhook: {
    label: 'Shopify orders/create webhook',
    emits: ['purchase'],
    route: 'app/routes/webhooks.orders.jsx',
    note: 'HMAC verified. The ONLY source of revenue. Test orders filtered by testOrders.js.',
  },
};

/**
 * DESTINATIONS. `expects` is the contract, and it is what gets verified.
 *
 *   pixel     a browser tag we install ourselves
 *   events    funnel events, server side, via the adapter's sendEvent
 *   purchase  revenue, server side, via the adapter's sendPurchase
 *   feed      a product feed route we serve
 *   claim     the channel requires a verified/claimed domain
 *
 * `publicId` is the pixel/measurement id the LIVE page must serve for that
 * destination, and it is required on every destination declaring a pixel.
 * It is not a secret: every one of these is rendered into the HTML of every
 * page, which is exactly why it can be asserted from outside.
 *
 * It is written here deliberately, and it is not a duplicate of the env var
 * it mirrors. The env var lives on Oxygen where nothing in this repo can read
 * it, so an adapter whose env var is unset is a complete no-op that injects no
 * script, throws nothing and logs nothing. Meta sat in exactly that state for
 * the seven days to 2026-09-18: zero ViewContent, zero AddToCart, a pixel
 * adapter that was finished and registered, and every offline check green,
 * because an unset var and a quiet day are the same bytes. Naming the expected
 * id here is what lets `--live` tell them apart, and it catches a WRONG id too,
 * which a presence check never would.
 */
export const DESTINATIONS = [
  {
    id: 'ga4',
    label: 'Google Analytics 4',
    adapter: 'app/lib/conversions/ga4.server.js',
    browser: 'app/lib/analytics/pixels/ga4.js',
    envKeys: ['PUBLIC_GA4_MEASUREMENT_ID', 'PRIVATE_GA4_API_SECRET'],
    publicId: 'G-X0978HDVTK',
    expects: {pixel: true, events: true, purchase: true, feed: null, claim: false},
    note: 'Browser first; the relay only fires when gtag was blocked.',
  },
  {
    id: 'x',
    label: 'X (Twitter) Ads',
    adapter: 'app/lib/conversions/x.server.js',
    browser: 'app/lib/analytics/pixels/x.js',
    envKeys: ['PUBLIC_X_PIXEL_ID', 'PRIVATE_X_PURCHASE_EVENT_ID'],
    publicId: 'q7mwb',
    expects: {pixel: true, events: true, purchase: true, feed: '/feed.csv', claim: false},
    note: 'Base tag only in the browser, for audiences. ALL events server side.',
  },
  {
    id: 'meta',
    label: 'Meta (Facebook & Instagram)',
    adapter: 'app/lib/conversions/meta.server.js',
    browser: 'app/lib/analytics/pixels/meta.js',
    envKeys: ['PUBLIC_META_PIXEL_ID', 'PRIVATE_META_ACCESS_TOKEN'],
    publicId: '511838711286120',
    expects: {pixel: true, events: false, purchase: true, feed: null, claim: true},
    note: 'WIRED 2026-09-19, correcting a note that said "NOT WIRED by choice, no Meta ads '
        + 'running". Meta ads ARE running: 122 products published to Facebook & Instagram, a '
        + 'catalog in Commerce Manager, and CAPI purchases already being sent. The browser '
        + 'adapter (PageView, ViewContent, AddToCart, InitiateCheckout, Search, keyed on the '
        + 'bare numeric variant id) is written, registered in analytics/registry.js and '
        + 'allowlisted in the CSP. `events` stays false and that is correct: it means SERVER '
        + 'side sendEvent, which meta.server.js does not have and does not need, because the '
        + 'browser adapter carries the funnel and the webhook carries purchase. '
        + 'STILL OFF ON PRODUCTION: PUBLIC_META_PIXEL_ID is not set on Oxygen, so the adapter '
        + 'no-ops and the served page carries no Meta pixel. Todd sets that var. '
        + '`claim` is true because Meta attributes no conversion until streamwidgetshop.com is '
        + 'verified in Business Manager, so the CAPI purchases being sent today land nowhere.',
  },
  {
    id: 'google-merchant',
    label: 'Google Merchant Center',
    adapter: null,
    browser: null,
    envKeys: [],
    expects: {pixel: false, events: false, purchase: false, feed: '/feed.xml', claim: false},
    note: 'Catalogue only. Conversions go through GA4 and Google Ads separately.',
  },
  {
    id: 'pinterest',
    label: 'Pinterest',
    adapter: null,
    browser: null,
    envKeys: [],
    expects: {pixel: false, events: false, purchase: false, feed: '/feed.pinterest.csv', claim: true},
    note: 'BLOCKED: streamwidgetshop.com is claimed by a Pinterest account deactivated for '
        + 'spam in Apr 2024, appeal window closed. Feed links point at the claimed '
        + 'shop.streamwidgetshop.com instead. Revert to the apex if the claim is ever released.',
  },
];

/** Every event name the tracking plan allows. Anything else is a bug. */
export const TRACKING_PLAN = [
  ...SOURCES.storefront.emits,
  ...SOURCES.ordersWebhook.emits,
];
