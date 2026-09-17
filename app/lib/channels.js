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
 */
export const DESTINATIONS = [
  {
    id: 'ga4',
    label: 'Google Analytics 4',
    adapter: 'app/lib/conversions/ga4.server.js',
    browser: 'app/lib/analytics/pixels/ga4.js',
    envKeys: ['PUBLIC_GA4_MEASUREMENT_ID', 'PRIVATE_GA4_API_SECRET'],
    expects: {pixel: true, events: true, purchase: true, feed: null, claim: false},
    note: 'Browser first; the relay only fires when gtag was blocked.',
  },
  {
    id: 'x',
    label: 'X (Twitter) Ads',
    adapter: 'app/lib/conversions/x.server.js',
    browser: 'app/lib/analytics/pixels/x.js',
    envKeys: ['PUBLIC_X_PIXEL_ID', 'PRIVATE_X_PURCHASE_EVENT_ID'],
    expects: {pixel: true, events: true, purchase: true, feed: '/feed.csv', claim: false},
    note: 'Base tag only in the browser, for audiences. ALL events server side.',
  },
  {
    id: 'meta',
    label: 'Meta (Facebook & Instagram)',
    adapter: 'app/lib/conversions/meta.server.js',
    browser: null,
    envKeys: ['PUBLIC_META_PIXEL_ID', 'PRIVATE_META_ACCESS_TOKEN'],
    expects: {pixel: false, events: false, purchase: true, feed: null, claim: false},
    note: 'NOT WIRED by choice, 2026-09-16: no Meta ads running. Adapter exists and is inert. '
        + 'To enable: set both env keys, add a browser adapter, add sendEvent, add a feed.',
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
