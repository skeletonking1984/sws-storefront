import {useEffect} from 'react';
import {useAnalytics, useNonce} from '@shopify/hydrogen';

/**
 * Google Analytics 4, wired to Hydrogen's analytics bus.
 *
 * Renders no DOM. On mount it injects gtag.js (nonce'd for this app's CSP,
 * see app/entry.server.jsx) and subscribes to Hydrogen's page_viewed,
 * product_viewed and product_added_to_cart events, mapping each to the
 * matching GA4 event (page_view, view_item, add_to_cart) with real product
 * id, name, price and currency.
 *
 * Fires nothing until Shopify's consent API allows it (canTrack()), and
 * fires nothing at all, ever, for purchase. Checkout is Shopify hosted, so
 * the order-complete event comes from a separate Shopify Admin custom pixel,
 * not from this storefront. If this component also sent a purchase event,
 * every order would double count.
 *
 * measurementId comes from PUBLIC_GA4_MEASUREMENT_ID (see app/root.jsx),
 * never hardcode a real ID here.
 *
 * @param {{measurementId?: string}} props
 */
export function GA4({measurementId}) {
  const {subscribe, canTrack, shop} = useAnalytics();
  const nonce = useNonce();

  useEffect(() => {
    if (!measurementId) return;

    loadGtag(measurementId, nonce);

    // subscribe() keys its listener map by the callback's own source text,
    // so re-running this on every shop/canTrack change replaces the old
    // listener instead of stacking a duplicate one. That is what keeps
    // the shop currency and consent state below from ever going stale.
    subscribe('page_viewed', () => {
      if (!canTrack() || typeof window.gtag !== 'function') return;
      window.gtag('event', 'page_view', {
        page_location: window.location.href,
        page_path: window.location.pathname + window.location.search,
        page_title: document.title,
      });
    });

    subscribe('product_viewed', (payload) => {
      if (!canTrack() || typeof window.gtag !== 'function') return;
      const product = payload?.products?.[0];
      if (!product) return;

      const price = Number(product.price) || 0;
      const quantity = product.quantity || 1;

      window.gtag('event', 'view_item', {
        // product_viewed does not carry a currency code on its own payload,
        // only the shop-level analytics context does, read it from there.
        currency: shop?.currency || 'USD',
        value: price * quantity,
        items: [
          {
            item_id: product.id,
            item_name: product.title,
            item_variant: product.variantTitle,
            price,
            quantity,
          },
        ],
      });
    });

    subscribe('product_added_to_cart', (payload) => {
      if (!canTrack() || typeof window.gtag !== 'function') return;
      const line = payload?.currentLine;
      const merchandise = line?.merchandise;
      if (!merchandise) return;

      const price = Number(merchandise.price?.amount) || 0;
      const quantity = line.quantity || 1;
      const currency =
        merchandise.price?.currencyCode || shop?.currency || 'USD';

      window.gtag('event', 'add_to_cart', {
        currency,
        value: price * quantity,
        items: [
          {
            item_id: merchandise.product?.id,
            item_name: merchandise.product?.title,
            item_variant: merchandise.title,
            price,
            quantity,
          },
        ],
      });
    });
  }, [measurementId, nonce, subscribe, canTrack, shop]);

  return null;
}

/**
 * Injects the gtag.js loader script and the inline bootstrap once per
 * page load. Both get the request nonce so this app's CSP allows them,
 * see app/entry.server.jsx for the matching allowlist entries.
 *
 * @param {string} measurementId
 * @param {string} nonce
 */
function loadGtag(measurementId, nonce) {
  if (typeof document === 'undefined') return;
  if (document.getElementById('ga4-gtag-js')) return;

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
  // send_page_view is off, page_view is fired explicitly on the
  // page_viewed subscription above instead, otherwise a client side route
  // change never fires GA4's own automatic pageview and traffic undercounts.
  window.gtag('config', measurementId, {send_page_view: false});
}
