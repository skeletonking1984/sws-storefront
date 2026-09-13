/**
 * Google Analytics 4 browser pixel adapter.
 *
 * Mirrors the server conversions registry's interface (see
 * app/lib/conversions/ga4.server.js and index.server.js) so both halves of
 * this app's analytics feel the same:
 *
 *   export const id = 'ga4';
 *   export const envKeys = {configKey: 'ENV_VAR_NAME', ...};
 *   export function isConfigured(config) { ... }        // sync, no network
 *   export function loadScript(config, nonce) { ... }    // inject once
 *   export function send(event, config) { ... }          // fire one event
 *
 * `config` here is this adapter's own slice of the app-wide analytics
 * config (see app/lib/analytics/registry.js), keyed by this file's own
 * envKeys names, not the raw env object.
 *
 * Fires nothing until PixelBus.jsx has already checked Shopify's consent
 * API (canTrack()) -- this file does not check consent itself. Never
 * sends `purchase`: checkout is Shopify hosted, the only purchase event is
 * server side, from the orders/create webhook (see
 * app/lib/conversions/ga4.server.js). Sending purchase from here would
 * double count every order.
 */

export const id = 'ga4';

export const envKeys = {
  measurementId: 'PUBLIC_GA4_MEASUREMENT_ID',
};

/**
 * @param {{measurementId?: string}} config
 * @returns {boolean}
 */
export function isConfigured(config) {
  return Boolean(config?.measurementId);
}

/**
 * Injects the gtag.js loader script and the inline bootstrap once per
 * page load. Gets the request nonce so this app's CSP allows it, see
 * app/entry.server.jsx for the matching allowlist entries.
 *
 * @param {{measurementId?: string}} config
 * @param {string} nonce
 */
export function loadScript(config, nonce) {
  if (!isConfigured(config)) return;
  if (typeof document === 'undefined') return;
  if (document.getElementById('ga4-gtag-js')) return;

  const measurementId = config.measurementId;

  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };

  const loader = document.createElement('script');
  loader.id = 'ga4-gtag-js';
  loader.async = true;
  loader.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
    measurementId,
  )}`;
  if (nonce) loader.nonce = nonce;
  document.head.appendChild(loader);

  window.gtag('js', new Date());
  // send_page_view is off, page_view is fired explicitly from the
  // normalized page_view event instead, otherwise a client side route
  // change never fires GA4's own automatic pageview and traffic undercounts.
  window.gtag('config', measurementId, {send_page_view: false});
}

/**
 * @param {object} event Normalized event, see app/lib/analytics/events.js.
 * @param {{measurementId?: string}} config
 */
export function send(event, config) {
  if (!isConfigured(config)) return;
  if (typeof window.gtag !== 'function') return;

  switch (event.name) {
    case 'page_view':
      window.gtag('event', 'page_view', {
        page_location: event.pageLocation,
        page_path: event.pagePath,
        page_title: event.pageTitle,
      });
      return;
    case 'search':
      window.gtag('event', 'search', {search_term: event.searchTerm});
      return;
    case 'view_item_list':
      window.gtag('event', 'view_item_list', {
        item_list_id: event.listId,
        item_list_name: event.listName,
        items: (event.items || []).map(toGa4Item),
      });
      return;
    default:
      break;
  }

  if (!event.items?.length) return;

  window.gtag('event', event.name, {
    currency: event.currency,
    value: event.value,
    items: event.items.map(toGa4Item),
  });
}

/**
 * @param {object} item Normalized item, see app/lib/analytics/events.js.
 */
function toGa4Item(item) {
  return {
    item_id: item.id,
    item_name: item.name,
    item_variant: item.variant,
    item_category: item.category,
    price: item.price,
    quantity: item.quantity,
    index: item.index,
    item_list_id: item.listId,
    item_list_name: item.listName,
  };
}
