/**
 * X (Twitter) browser pixel adapter.
 *
 * Mirrors the server conversions registry's interface (see
 * app/lib/conversions/x.server.js and index.server.js) so both halves of
 * this app's analytics feel the same:
 *
 *   export const id = 'x';
 *   export const envKeys = {configKey: 'ENV_VAR_NAME', ...};
 *   export function isConfigured(config) { ... }        // sync, no network
 *   export function loadScript(config, nonce) { ... }    // inject once
 *   export function send(event, config) { ... }          // fire one event
 *
 * `config` here is this adapter's own slice of the app-wide analytics
 * config (see app/lib/analytics/registry.js), keyed by this file's own
 * envKeys names, not the raw env object.
 *
 * Every ID here (pixelId, pageViewEventId, viewContentEventId,
 * addToCartEventId) is pending from Auny on Linear BAT-145 as of
 * 2026-09-10 and comes from config/env, never hardcoded. Until all four
 * are set this adapter is a complete no-op: isConfigured() is false, so
 * PixelBus.jsx never calls loadScript or send -- no script injected, no
 * subscription, nothing thrown. Once the real IDs land, setting the env
 * vars is the only change needed, no code edit here.
 *
 * Four events are wired here: page_view, view_item, add_to_cart and
 * begin_checkout. X's Ads Events Manager needs one configured Event ID per
 * event type; adding more (Search, ...) needs a new event id created there
 * first, see meta.js for how a platform with a full standard-event set is
 * wired.
 *
 * begin_checkout was added 2026-09-15. X's create-event dialog offers no
 * "Checkout initiated" type, so the event is type Custom, the same as
 * ViewContent. Shopify's X sales channel publishes its own
 * Shopify:<shop>:CHECKOUT_INITIATED on this same pixel; ours exists so that
 * one can be switched off, because the sales channel's pixel is browser-only
 * (no Server badge in Shopify's Customer events list), has no internal-test
 * filter, and so counts Todd's own SWSTEST checkouts as real ones.
 *
 * Fires nothing until PixelBus.jsx has already checked Shopify's consent
 * API (canTrack()) -- this file does not check consent itself. There is
 * deliberately no purchase mapping here and this adapter never fires one.
 * Checkout is Shopify hosted, so the order-complete event comes from the
 * orders/create webhook (see app/lib/conversions/x.server.js). A
 * storefront-side Purchase event would double count every real order.
 */

export const id = 'x';

export const envKeys = {
  pixelId: 'PUBLIC_X_PIXEL_ID',
  pageViewEventId: 'PUBLIC_X_EVENT_ID_PAGE_VIEW',
  viewContentEventId: 'PUBLIC_X_EVENT_ID_VIEW_CONTENT',
  addToCartEventId: 'PUBLIC_X_EVENT_ID_ADD_TO_CART',
  beginCheckoutEventId: 'PUBLIC_X_EVENT_ID_BEGIN_CHECKOUT',
};

/**
 * @param {{pixelId?: string}} config
 * @returns {boolean}
 */
export function isConfigured(config) {
  return Boolean(config?.pixelId);
}

/**
 * Injects the X universal website tag (uwt.js) and configures the base
 * pixel once per page load. Gets the request nonce so this app's CSP
 * allows it, see app/entry.server.jsx for the matching allowlist entries.
 *
 * @param {{pixelId?: string}} config
 * @param {string} nonce
 */
export function loadScript(config, nonce) {
  if (!isConfigured(config)) return;
  if (typeof document === 'undefined') return;

  const pixelId = config.pixelId;

  if (window.twq) {
    window.twq('config', pixelId);
    return;
  }

  window.twq = function twq(...args) {
    if (twq.exe) {
      twq.exe.apply(twq, args);
    } else {
      twq.queue.push(args);
    }
  };
  window.twq.version = '1.1';
  window.twq.queue = [];

  const loader = document.createElement('script');
  loader.id = 'x-uwt-js';
  loader.async = true;
  loader.src = 'https://static.ads-twitter.com/uwt.js';
  if (nonce) loader.nonce = nonce;
  document.head.appendChild(loader);

  window.twq('config', pixelId);
}

/**
 * @param {object} event Normalized event, see app/lib/analytics/events.js.
 * @param {{
 *   pixelId?: string;
 *   pageViewEventId?: string;
 *   viewContentEventId?: string;
 *   addToCartEventId?: string;
 * }} config
 */
export function send(event, config) {
  /*
   * DELIBERATELY A NO-OP. X's events are server side only now.
   *
   * This used to fire twq('event', ...) for page_view, view_item,
   * add_to_cart and begin_checkout. It no longer fires anything, and that
   * is the point rather than a regression.
   *
   * X Events Manager reported CAPI as "Partially set up: working, but it
   * only covers a tiny fraction of your conversions", because CAPI carried
   * purchase alone while the browser carried the whole funnel. The obvious
   * fix, send both ways, needs a shared conversion_id on both sides or X
   * counts every event twice, and this adapter never sent one. Sending
   * everything twice with nothing to reconcile on is worse than the banner.
   *
   * So the events moved server side entirely: PixelBus relays every event
   * to /api/e for EVERY visitor, not only ad-blocked ones, and
   * app/lib/conversions/x.server.js sends it through the Conversion API.
   * Exactly one system sends each event, so there is nothing to dedupe.
   *
   * loadScript() above is UNTOUCHED on purpose, and that distinction is the
   * whole design: the BASE TAG stays, only OUR EVENTS go. twq('config',
   * pixelId) still installs uwt.js, which sets X's own cookie and keeps X's
   * auto-created "Site visits" and "Landing page views" firing. Those are
   * what website audiences are built from. Pulling the tag would have
   * traded a cosmetic banner for a real loss of retargeting, and X's docs
   * do not say CAPI alone can build an audience.
   *
   * The export stays: PixelBus calls send() on every configured pixel and a
   * missing one throws.
   */
}
