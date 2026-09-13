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
 *   export function didLoad() { ... }                    // optional, see below
 *
 * `config` here is this adapter's own slice of the app-wide analytics
 * config (see app/lib/analytics/registry.js), keyed by this file's own
 * envKeys names, not the raw env object.
 *
 * `didLoad` is optional on this shared interface (see
 * app/components/pixels/PixelBus.jsx and app/lib/conversions/index.server.js
 * for the other optional piece, `sendEvent`) and only implemented here.
 * It answers "did gtag.js actually execute", not just "did window.gtag
 * exist" -- `loadScript` above defines a stub `window.gtag` itself before
 * the real script even starts loading, so the stub existing proves
 * nothing about whether a blocker killed the request. What is checked
 * instead: the injected script tag's own `onload`/`onerror` (a blocked
 * request almost always fires `onerror`, not `onload`), combined with
 * `window.google_tag_manager` -- an object gtag.js's real body constructs
 * during initialization, which a blocker that answers the request with an
 * empty stub script (a pattern some filter engines use instead of
 * failing the request outright) would never create. Neither signal alone
 * is airtight; together they are the best available proof that gtag.js's
 * real code ran, not just that some HTTP response came back.
 *
 * Fires nothing until PixelBus.jsx has already checked Shopify's consent
 * API (canTrack()) -- this file does not check consent itself. Never
 * sends `purchase`: checkout is Shopify hosted, the only purchase event is
 * server side, from the orders/create webhook (see
 * app/lib/conversions/ga4.server.js). Sending purchase from here would
 * double count every order.
 *
 * Internal/QA traffic (see app/lib/analytics/internalTraffic.js) is tagged
 * with GA4's own `traffic_type` parameter here, never dropped -- that is
 * the mechanism GA4 Data Filters match on to exclude it later, see
 * docs/analytics-setup.md. Set in both places, the `gtag('config', ...)`
 * call in `loadScript` AND every event's params in `send`, because config
 * alone is not reliably applied to every event that follows it.
 */

export const id = 'ga4';

export const envKeys = {
  measurementId: 'PUBLIC_GA4_MEASUREMENT_ID',
};

// Module scoped, not component state: PixelBus.jsx checks this via
// `didLoad()` some time after `loadScript` runs, on a plain function call,
// not a React render, so there is nothing to subscribe to here.
let scriptOutcome = /** @type {'loaded' | 'failed' | null} */ (null);

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
 * @param {boolean} [internal] Whether this session is internal/QA traffic,
 *   see app/lib/analytics/internalTraffic.js. Passed through from
 *   PixelBus.jsx, not read by this file from anywhere else.
 */
export function loadScript(config, nonce, internal) {
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
  // See `didLoad` below for why both this and window.google_tag_manager
  // are checked: onload alone does not prove the real script executed,
  // some blockers answer with an empty 200 stub instead of failing the
  // request.
  loader.onload = () => {
    scriptOutcome = 'loaded';
  };
  loader.onerror = () => {
    scriptOutcome = 'failed';
  };
  document.head.appendChild(loader);

  window.gtag('js', new Date());
  // send_page_view is off, page_view is fired explicitly from the
  // normalized page_view event instead, otherwise a client side route
  // change never fires GA4's own automatic pageview and traffic undercounts.
  // traffic_type is only added when internal -- a normal visitor's config
  // call carries no such key, matching GA4's own default behavior.
  window.gtag('config', measurementId, {
    send_page_view: false,
    ...(internal ? {traffic_type: 'internal'} : null),
  });
}

/**
 * @param {object} event Normalized event, see app/lib/analytics/events.js.
 * @param {{measurementId?: string}} config
 */
export function send(event, config) {
  if (!isConfigured(config)) return;
  if (typeof window.gtag !== 'function') return;

  // Config-time traffic_type (see loadScript above) is not reliably
  // applied to every event that follows it, so it is also stamped on each
  // event's own params here. Omitted entirely when not internal, so a
  // normal visitor's payload shape never changes.
  const trafficTypeParams =
    event.trafficType === 'internal' ? {traffic_type: 'internal'} : null;

  switch (event.name) {
    case 'page_view':
      window.gtag('event', 'page_view', {
        page_location: event.pageLocation,
        page_path: event.pagePath,
        page_title: event.pageTitle,
        ...trafficTypeParams,
      });
      return;
    case 'search':
      window.gtag('event', 'search', {
        search_term: event.searchTerm,
        ...trafficTypeParams,
      });
      return;
    case 'view_item_list':
      window.gtag('event', 'view_item_list', {
        item_list_id: event.listId,
        item_list_name: event.listName,
        items: (event.items || []).map(toGa4Item),
        ...trafficTypeParams,
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
    ...trafficTypeParams,
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

/**
 * Whether gtag.js actually loaded and ran, checked by PixelBus.jsx a beat
 * after `loadScript` to decide whether to relay events to the same-origin
 * fallback (see app/routes/api.e.jsx). See the file header comment above
 * for exactly what this checks and why neither signal is trusted alone.
 * @returns {boolean}
 */
export function didLoad() {
  if (typeof window === 'undefined') return false;
  return (
    scriptOutcome === 'loaded' &&
    typeof window.google_tag_manager === 'object' &&
    window.google_tag_manager !== null
  );
}
