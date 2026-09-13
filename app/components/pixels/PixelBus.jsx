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
      });
    }
  }, [config, nonce, subscribe, canTrack, shop]);

  return null;
}
