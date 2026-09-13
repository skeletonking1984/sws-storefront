/**
 * Meta (Facebook/Instagram) browser pixel adapter.
 *
 * New platform, wired the same day X ads are getting standardized (Todd is
 * about to run paid ads on both). Mirrors the server conversions
 * registry's interface (see app/lib/conversions/meta.server.js and
 * index.server.js) so both halves of this app's analytics feel the same:
 *
 *   export const id = 'meta';
 *   export const envKeys = {configKey: 'ENV_VAR_NAME', ...};
 *   export function isConfigured(config) { ... }        // sync, no network
 *   export function loadScript(config, nonce) { ... }    // inject once
 *   export function send(event, config) { ... }          // fire one event
 *
 * `config` here is this adapter's own slice of the app-wide analytics
 * config (see app/lib/analytics/registry.js), keyed by this file's own
 * envKeys names, not the raw env object.
 *
 * PUBLIC_META_PIXEL_ID does not exist yet (Meta ads have not launched).
 * Until it is set this adapter is a complete no-op: isConfigured() is
 * false, so PixelBus.jsx never calls loadScript or send -- no script
 * injected, no subscription, nothing thrown.
 *
 * Fires nothing until PixelBus.jsx has already checked Shopify's consent
 * API (canTrack()) -- this file does not check consent itself. There is
 * deliberately no purchase mapping here and this adapter never fires one.
 * Checkout is Shopify hosted, so the order-complete event comes from the
 * orders/create webhook (see app/lib/conversions/meta.server.js). A
 * storefront-side Purchase event would double count every real order.
 */

export const id = 'meta';

export const envKeys = {
  pixelId: 'PUBLIC_META_PIXEL_ID',
};

/**
 * @param {{pixelId?: string}} config
 * @returns {boolean}
 */
export function isConfigured(config) {
  return Boolean(config?.pixelId);
}

/**
 * Injects the Meta pixel loader (fbevents.js) and initializes it once per
 * page load. Gets the request nonce so this app's CSP allows it, see
 * app/entry.server.jsx for the matching allowlist entries.
 *
 * Same queue-then-flush pattern as ga4.js/x.js: a stub `fbq` function
 * queues calls until the real script loads and replaces it.
 *
 * @param {{pixelId?: string}} config
 * @param {string} nonce
 */
export function loadScript(config, nonce) {
  if (!isConfigured(config)) return;
  if (typeof document === 'undefined') return;

  const pixelId = config.pixelId;

  if (window.fbq) {
    window.fbq('init', pixelId);
    return;
  }

  const fbq = function fbq(...args) {
    if (fbq.callMethod) {
      fbq.callMethod.apply(fbq, args);
    } else {
      fbq.queue.push(args);
    }
  };
  window.fbq = fbq;
  window._fbq = window._fbq || fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];

  const loader = document.createElement('script');
  loader.id = 'meta-fbevents-js';
  loader.async = true;
  loader.src = 'https://connect.facebook.net/en_US/fbevents.js';
  if (nonce) loader.nonce = nonce;
  document.head.appendChild(loader);

  // No automatic PageView track call here (unlike Meta's own standard
  // snippet) -- page_view is fired explicitly from the normalized
  // page_view event below instead, same reasoning as GA4's
  // send_page_view: false, otherwise a client side route change never
  // fires a second PageView and traffic undercounts.
  window.fbq('init', pixelId);
}

/**
 * Standard events per Meta's pixel docs: PageView, ViewContent, AddToCart,
 * InitiateCheckout, Search. No Purchase mapping -- see file header.
 *
 * @param {object} event Normalized event, see app/lib/analytics/events.js.
 * @param {{pixelId?: string}} config
 */
export function send(event, config) {
  if (!isConfigured(config)) return;
  if (typeof window.fbq !== 'function') return;

  switch (event.name) {
    case 'page_view':
      window.fbq('track', 'PageView');
      return;
    case 'view_item':
      sendContentEvent('ViewContent', event);
      return;
    case 'add_to_cart':
      sendContentEvent('AddToCart', event);
      return;
    case 'begin_checkout':
      sendCheckoutEvent(event);
      return;
    case 'search':
      if (!event.searchTerm) return;
      window.fbq('track', 'Search', {search_string: event.searchTerm});
      return;
    default:
      break;
  }
}

/**
 * ViewContent and AddToCart share the same single-item shape.
 * @param {'ViewContent' | 'AddToCart'} metaEventName
 * @param {object} event
 */
function sendContentEvent(metaEventName, event) {
  const item = event.items?.[0];
  if (!item) return;

  window.fbq('track', metaEventName, {
    content_ids: [item.id].filter(Boolean),
    content_name: item.name,
    content_type: 'product',
    value: event.value,
    currency: event.currency || 'USD',
  });
}

/**
 * InitiateCheckout carries every line in the cart, not just one item.
 * @param {object} event
 */
function sendCheckoutEvent(event) {
  const items = event.items || [];
  if (!items.length) return;

  window.fbq('track', 'InitiateCheckout', {
    content_ids: items.map((item) => item.id).filter(Boolean),
    contents: items.map((item) => ({
      id: item.id,
      quantity: item.quantity || 1,
    })),
    content_type: 'product',
    num_items: items.reduce((sum, item) => sum + (item.quantity || 1), 0),
    value: event.value,
    currency: event.currency || 'USD',
  });
}
