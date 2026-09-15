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
  if (!isConfigured(config)) return;
  if (typeof window.twq !== 'function') return;

  // Internal/QA traffic (event.trafficType, see
  // app/lib/analytics/internalTraffic.js) is deliberately not added to
  // this payload -- X has no equivalent traffic-exclusion filter, and this
  // adapter is not configured yet anyway (see file header).

  if (event.name === 'page_view') {
    if (!config.pageViewEventId) return;
    window.twq('event', config.pageViewEventId, {});
    return;
  }

  if (event.name === 'view_item') {
    if (!config.viewContentEventId) return;
    const item = event.items?.[0];
    if (!item) return;
    window.twq('event', config.viewContentEventId, {
      value: event.value,
      currency: event.currency || 'USD',
      contents: [
        {
          content_id: item.id,
          content_name: item.name,
          content_type: 'product',
          num_items: item.quantity || 1,
        },
      ],
    });
    return;
  }

  // Checkout is Shopify hosted, so this fires on the click that leaves for
  // checkout, not on the checkout page itself. CartSummary.jsx publishes
  // custom_begin_checkout and holds the navigation until the event is
  // confirmed sent, so this is not a fire-and-hope on an unloading page.
  //
  // Cart-level, so it sums the whole cart rather than reading items[0] the
  // way view_item and add_to_cart do. Sending only the first line would
  // under-report the value of every multi-item checkout, which is exactly
  // the step where value matters most.
  if (event.name === 'begin_checkout') {
    if (!config.beginCheckoutEventId) return;
    const items = Array.isArray(event.items) ? event.items : [];
    window.twq('event', config.beginCheckoutEventId, {
      value: event.value,
      currency: event.currency || 'USD',
      num_items: items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0),
      contents: items.map((i) => ({
        content_id: i.id,
        content_name: i.name,
        content_type: 'product',
        num_items: i.quantity || 1,
      })),
    });
    return;
  }

  if (event.name === 'add_to_cart') {
    if (!config.addToCartEventId) return;
    const item = event.items?.[0];
    if (!item) return;
    window.twq('event', config.addToCartEventId, {
      value: event.value,
      currency: event.currency || 'USD',
      contents: [
        {
          content_id: item.id,
          content_name: item.name,
          content_type: 'product',
          num_items: item.quantity || 1,
        },
      ],
    });
  }
}
