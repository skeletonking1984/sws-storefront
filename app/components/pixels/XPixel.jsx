import {useEffect} from 'react';
import {useAnalytics, useNonce} from '@shopify/hydrogen';

/**
 * X (Twitter) conversion pixel, wired to Hydrogen's analytics bus the same
 * way GA4.jsx is.
 *
 * Renders no DOM. On mount it injects uwt.js (nonce'd for this app's CSP,
 * see app/entry.server.jsx) and subscribes to Hydrogen's page_viewed,
 * product_viewed and product_added_to_cart events, mapping each to X's
 * PageView, ViewContent and AddToCart standard events.
 *
 * Every ID here (pixelId, pageViewEventId, viewContentEventId,
 * addToCartEventId) is pending from Auny on Linear BAT-145 as of
 * 2026-09-10 and comes from config/env, never hardcoded. Until all four
 * are set this component is a complete no-op: it renders nothing, injects
 * no script, subscribes to nothing, and throws nothing. Once the real IDs
 * land, wiring them into the config that feeds these props (see
 * app/root.jsx) is the only change needed, no code edit here.
 *
 * There is deliberately no purchaseEventId prop and this component never
 * fires a Purchase event. Checkout is Shopify hosted, so the order-complete
 * event has to come from a separate Shopify Admin custom pixel on
 * checkout_completed, not from the storefront. A storefront-side Purchase
 * event would double count every real order.
 *
 * @param {{
 *   pixelId?: string;
 *   pageViewEventId?: string;
 *   viewContentEventId?: string;
 *   addToCartEventId?: string;
 * }} props
 */
export function XPixel({
  pixelId,
  pageViewEventId,
  viewContentEventId,
  addToCartEventId,
}) {
  const {subscribe, canTrack} = useAnalytics();
  const nonce = useNonce();

  useEffect(() => {
    if (!pixelId) return;

    loadUwt(pixelId, nonce);

    // subscribe() keys its listener map by the callback's own source text,
    // so re-running this on every canTrack/event-id change replaces the
    // old listener instead of stacking a duplicate one.
    subscribe('page_viewed', () => {
      if (!canTrack() || !pageViewEventId || typeof window.twq !== 'function')
        return;
      window.twq('event', pageViewEventId, {});
    });

    subscribe('product_viewed', (payload) => {
      if (
        !canTrack() ||
        !viewContentEventId ||
        typeof window.twq !== 'function'
      )
        return;
      const product = payload?.products?.[0];
      if (!product) return;

      window.twq('event', viewContentEventId, {
        value: Number(product.price) || 0,
        currency: 'USD',
        contents: [
          {
            content_id: product.id,
            content_name: product.title,
            content_type: 'product',
            num_items: product.quantity || 1,
          },
        ],
      });
    });

    subscribe('product_added_to_cart', (payload) => {
      if (
        !canTrack() ||
        !addToCartEventId ||
        typeof window.twq !== 'function'
      )
        return;
      const line = payload?.currentLine;
      const merchandise = line?.merchandise;
      if (!merchandise) return;

      const price = Number(merchandise.price?.amount) || 0;
      const quantity = line.quantity || 1;

      window.twq('event', addToCartEventId, {
        value: price * quantity,
        currency: merchandise.price?.currencyCode || 'USD',
        contents: [
          {
            content_id: merchandise.product?.id,
            content_name: merchandise.product?.title,
            content_type: 'product',
            num_items: quantity,
          },
        ],
      });
    });
  }, [
    pixelId,
    pageViewEventId,
    viewContentEventId,
    addToCartEventId,
    nonce,
    subscribe,
    canTrack,
  ]);

  return null;
}

/**
 * Injects the X universal website tag (uwt.js) and configures the base
 * pixel once per page load. Gets the request nonce so this app's CSP
 * allows it, see app/entry.server.jsx for the matching allowlist entries.
 *
 * @param {string} pixelId
 * @param {string} nonce
 */
function loadUwt(pixelId, nonce) {
  if (typeof document === 'undefined') return;
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
