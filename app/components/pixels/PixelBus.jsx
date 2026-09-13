import {useEffect} from 'react';
import {useAnalytics, useNonce} from '@shopify/hydrogen';
import {pixels} from '~/lib/analytics/registry';
import {normalizeEvent} from '~/lib/analytics/events';

/**
 * Every raw Hydrogen (or custom) bus event this app maps to an ecommerce
 * event, see app/lib/analytics/events.js for what each becomes.
 */
const BUS_EVENTS = [
  'page_viewed',
  'product_viewed',
  'collection_viewed',
  'custom_select_item',
  'product_added_to_cart',
  'product_removed_from_cart',
  'cart_viewed',
  'custom_begin_checkout',
  'search_viewed',
];

// How long to wait, after loadScript() runs, before trusting a pixel's
// `didLoad()`. gtag.js's script tag onload/onerror (see
// app/lib/analytics/pixels/ga4.js) fires well inside this window on any
// normal connection; a genuinely blocked request usually fires onerror
// within milliseconds. Erring long here just delays the relay decision
// for the first event or two, never causes a double send.
const RELAY_DETECTION_DELAY_MS = 1500;

// Resource route the same-origin relay lives at, see app/routes/api.e.jsx.
const RELAY_ENDPOINT = '/api/e';

// Ceiling on events buffered while the pixel load state is still unknown
// (see the three-state comment in PixelBus below). A page load fires a
// handful of events, not dozens, so this only ever bounds a pathological
// case.
const MAX_PENDING_RELAY_EVENTS = 20;

/**
 * Single subscriber to Hydrogen's analytics bus, fanning normalized
 * ecommerce events out to every configured pixel (see
 * app/lib/analytics/registry.js). Replaces the old GA4.jsx/XPixel.jsx
 * pair, each of which used to subscribe to this same bus separately and
 * re-implement its own payload mapping -- see app/lib/analytics/events.js
 * for where that mapping now lives, once, for every platform.
 *
 * Renders no DOM. Fires nothing until Shopify's consent API allows it
 * (canTrack()), and never fires a purchase event for any platform:
 * checkout is Shopify hosted, so the order-complete event comes from the
 * orders/create webhook (see app/lib/conversions/), not the storefront.
 * If a pixel here also sent purchase, every order would double count.
 *
 * `config` comes from `buildAnalyticsConfig(env)` in app/root.jsx's
 * loader (see app/lib/analytics/registry.js) -- adding a platform never
 * requires touching app/root.jsx again, only writing the new adapter file
 * and adding it to the `pixels` array.
 *
 * Also decides whether to relay events to the same-origin fallback (see
 * app/routes/api.e.jsx) when GA4's own pixel did not load, a content
 * blocker being the usual reason. Relaying only happens when the real
 * pixel is confirmed absent, so a normal visitor never touches the relay
 * and nothing ever double counts -- see `relayEvent` below.
 *
 * @param {{config: Record<string, Record<string, string | undefined>>}} props
 */
export function PixelBus({config}) {
  const {subscribe, canTrack, shop} = useAnalytics();
  const nonce = useNonce();

  useEffect(() => {
    const configuredPixels = pixels.filter((pixel) =>
      pixel.isConfigured(config?.[pixel.id]),
    );
    if (!configuredPixels.length) return;

    for (const pixel of configuredPixels) {
      pixel.loadScript(config[pixel.id], nonce);
    }

    // Whether GA4's own pixel actually loaded, decided a beat after
    // loadScript() so the injected script tag's onload/onerror (see
    // app/lib/analytics/pixels/ga4.js) has time to settle. GA4 is
    // checked specifically, not "any pixel", because it is the only
    // destination with a server-side `sendEvent` today (see
    // app/lib/conversions/ga4.server.js) -- relaying for a pixel with no
    // server destination behind it would just be wasted requests.
    //
    // Three states, and the unknown one is the whole point. `null` means
    // the detection window has not closed yet, and page_view and view_item
    // both fire inside that window on a normal page load. Relaying during
    // it would double count EVERY visitor's first events, and assuming
    // "loaded" during it would silently drop a blocked visitor's first
    // events, which are the ones that carry the landing page and the
    // campaign. So events that arrive while the answer is unknown are
    // buffered, and flushed to the relay only if the pixel turns out to be
    // absent. Buffer is capped: a page that somehow fires more events than
    // this inside 1.5s is not a case worth holding memory for.
    let ga4Loaded = null;
    /** @type {object[]} */
    let pendingRelay = [];
    const ga4Pixel = configuredPixels.find((pixel) => pixel.id === 'ga4');
    let detectionTimer;
    if (ga4Pixel && typeof ga4Pixel.didLoad === 'function') {
      detectionTimer = setTimeout(() => {
        ga4Loaded = ga4Pixel.didLoad(config.ga4);
        if (!ga4Loaded) {
          for (const buffered of pendingRelay) relayEvent(buffered);
        }
        pendingRelay = [];
      }, RELAY_DETECTION_DELAY_MS);
    } else {
      // Either GA4 is not configured at all, or its adapter has no
      // didLoad. Both mean there is nothing to relay FOR: the server side
      // destination keys off the same PUBLIC_GA4_MEASUREMENT_ID, so with
      // GA4 unconfigured every relayed event would be dropped server side
      // as not_configured. Treat as loaded so nothing relays.
      ga4Loaded = true;
    }

    for (const hydrogenEventName of BUS_EVENTS) {
      // subscribe() keys its listener map first by event name, then by
      // the callback's own source text within that event's map (see
      // Hydrogen's AnalyticsProvider), so re-running this on every
      // config/shop/canTrack change replaces the old listener for each
      // event instead of stacking a duplicate one. Identical source text
      // across different BUS_EVENTS entries is safe, each event name has
      // its own listener map.
      subscribe(hydrogenEventName, (payload) => {
        if (!canTrack()) return;
        const event = normalizeEvent(hydrogenEventName, payload, shop);
        if (!event) return;
        for (const pixel of configuredPixels) {
          pixel.send(event, config[pixel.id]);
        }
        // Relay only when GA4's own pixel did not load, so nothing ever
        // double counts, and never for purchase, though normalizeEvent
        // never produces one (see app/lib/analytics/events.js) -- this is
        // a belt-and-suspenders assertion, not a real branch.
        if (ga4Loaded === true || event.name === 'purchase') return;
        if (ga4Loaded === null) {
          if (pendingRelay.length < MAX_PENDING_RELAY_EVENTS) {
            pendingRelay.push(event);
          }
          return;
        }
        relayEvent(event);
      });
    }

    return () => {
      clearTimeout(detectionTimer);
      pendingRelay = [];
    };
  }, [config, nonce, subscribe, canTrack, shop]);

  return null;
}

/**
 * POSTs one normalized event (see app/lib/analytics/events.js) to the
 * same-origin relay (app/routes/api.e.jsx), for a visitor whose pixel
 * script did not load. Uses `sendBeacon` so the request survives a page
 * navigation the event itself may be racing against (e.g. begin_checkout,
 * fired right as the browser leaves for Shopify hosted checkout), falling
 * back to a keepalive `fetch` on the rare browser without `sendBeacon`.
 *
 * Fire-and-forget: this must never throw into the caller, and the relay
 * route itself never responds with anything the browser needs to act on.
 *
 * @param {object} event Normalized event.
 */
function relayEvent(event) {
  if (typeof navigator === 'undefined') return;

  const body = JSON.stringify({name: event.name, params: event});

  if (typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], {type: 'application/json'});
    navigator.sendBeacon(RELAY_ENDPOINT, blob);
    return;
  }

  fetch(RELAY_ENDPOINT, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
    keepalive: true,
  }).catch(() => {});
}
