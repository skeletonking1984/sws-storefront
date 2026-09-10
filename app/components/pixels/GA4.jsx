import {useEffect} from 'react';
import {useAnalytics, useNonce} from '@shopify/hydrogen';

/**
 * Google Analytics 4, wired to Hydrogen's analytics bus.
 *
 * Renders no DOM. On mount it injects gtag.js (nonce'd for this app's CSP,
 * see app/entry.server.jsx) and subscribes to Hydrogen's analytics events,
 * mapping each to GA4's enhanced ecommerce events (page_view, view_item,
 * view_item_list, select_item, add_to_cart, remove_from_cart, view_cart,
 * begin_checkout, search) with real product id, name, price, category and
 * currency.
 *
 * Two of these are not native Hydrogen events, since Hydrogen has nothing
 * to publish for them:
 * - select_item comes from a `custom_select_item` event that
 *   ProductItem.jsx publishes on click, before the browser navigates to
 *   the product page.
 * - begin_checkout comes from a `custom_begin_checkout` event that
 *   CartSummary.jsx publishes on click of the checkout link, since
 *   checkout itself is Shopify hosted and never routes through this app.
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
            item_category: product.productType,
            price,
            quantity,
          },
        ],
      });
    });

    // Collection pages (see collections.$handle.jsx) extend Hydrogen's
    // CollectionPayload (normally just {collection: {id, handle}}) with a
    // `products` array. The generic view component spreads whatever `data`
    // it is given straight into the published payload, so that extra field
    // survives here even though Hydrogen's own type for this event doesn't
    // declare it.
    subscribe('collection_viewed', (payload) => {
      if (!canTrack() || typeof window.gtag !== 'function') return;
      const products = payload?.products;
      if (!products?.length) return;

      const itemListId = payload?.collection?.handle;
      const itemListName = payload?.collection?.title || itemListId;

      window.gtag('event', 'view_item_list', {
        item_list_id: itemListId,
        item_list_name: itemListName,
        items: products.map((product, i) => ({
          item_id: product.id,
          item_name: product.title,
          item_category: product.productType,
          price: Number(product.price) || 0,
          index: typeof product.index === 'number' ? product.index : i,
          item_list_id: itemListId,
          item_list_name: itemListName,
        })),
      });
    });

    // Not a native Hydrogen event. ProductItem.jsx publishes this on click
    // of a product card, before the browser navigates to the product page,
    // so list-to-detail attribution survives the navigation.
    subscribe('custom_select_item', (payload) => {
      if (!canTrack() || typeof window.gtag !== 'function') return;
      const product = payload?.product;
      if (!product) return;

      window.gtag('event', 'select_item', {
        item_list_id: payload?.listId,
        item_list_name: payload?.listName,
        items: [
          {
            item_id: product.id,
            item_name: product.title,
            item_category: product.productType,
            price: Number(product.price) || 0,
            index: payload?.index,
            item_list_id: payload?.listId,
            item_list_name: payload?.listName,
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
            item_category: merchandise.product?.productType,
            price,
            quantity,
          },
        ],
      });
    });

    // Hydrogen's AnalyticsProvider diffs the cart on every change and
    // fires this both for a full line removal (only prevLine is set) and
    // for a quantity decrease (both prevLine and currentLine are set, the
    // line just did not disappear). Read whichever line still describes
    // the product and use the quantity delta as the removed amount.
    subscribe('product_removed_from_cart', (payload) => {
      if (!canTrack() || typeof window.gtag !== 'function') return;
      const prevLine = payload?.prevLine;
      const currentLine = payload?.currentLine;
      const merchandise = currentLine?.merchandise || prevLine?.merchandise;
      if (!merchandise) return;

      const price = Number(merchandise.price?.amount) || 0;
      const removedQuantity = currentLine
        ? Math.max(0, (prevLine?.quantity || 0) - currentLine.quantity)
        : prevLine?.quantity || 1;
      if (removedQuantity <= 0) return;
      const currency =
        merchandise.price?.currencyCode || shop?.currency || 'USD';

      window.gtag('event', 'remove_from_cart', {
        currency,
        value: price * removedQuantity,
        items: [
          {
            item_id: merchandise.product?.id,
            item_name: merchandise.product?.title,
            item_variant: merchandise.title,
            item_category: merchandise.product?.productType,
            price,
            quantity: removedQuantity,
          },
        ],
      });
    });

    // CartMain.jsx renders <Analytics.CartView /> with no data prop: the
    // generic view component always merges in the AnalyticsProvider's own
    // current cart regardless, so payload.cart is already the real cart.
    subscribe('cart_viewed', (payload) => {
      if (!canTrack() || typeof window.gtag !== 'function') return;
      const cart = payload?.cart;
      const items = cartLineItems(cart);
      if (!items.length) return;

      window.gtag('event', 'view_cart', {
        currency: cartCurrency(cart, shop),
        value: Number(cart?.cost?.totalAmount?.amount) || 0,
        items,
      });
    });

    // Not a native Hydrogen event. CartSummary.jsx publishes this on click
    // of the checkout link, at the moment the browser is about to leave
    // for Shopify hosted checkout.
    subscribe('custom_begin_checkout', (payload) => {
      if (!canTrack() || typeof window.gtag !== 'function') return;
      const cart = payload?.cart;
      const items = cartLineItems(cart);
      if (!items.length) return;

      window.gtag('event', 'begin_checkout', {
        currency: cartCurrency(cart, shop),
        value: Number(cart?.cost?.totalAmount?.amount) || 0,
        items,
      });
    });

    // search.jsx's regular /search route already publishes this via
    // <Analytics.SearchView> with the real query term. The predictive
    // search palette (SearchResultsPredictive.jsx) deliberately is not
    // wired here, it re-fetches on every keystroke and would fire a
    // search event per character typed.
    subscribe('search_viewed', (payload) => {
      if (!canTrack() || typeof window.gtag !== 'function') return;
      const searchTerm = payload?.searchString;
      if (!searchTerm) return;

      window.gtag('event', 'search', {
        search_term: searchTerm,
      });
    });
  }, [measurementId, nonce, subscribe, canTrack, shop]);

  return null;
}

/**
 * Flattens a cart's line items into GA4 item objects for view_cart and
 * begin_checkout, both of which need the same shape. Returns an empty
 * array (never throws) for a cart with no lines or missing merchandise.
 * @param {import('@shopify/hydrogen').CartReturn | null | undefined} cart
 */
function cartLineItems(cart) {
  const nodes = cart?.lines?.nodes || [];
  return nodes
    .map((line) => {
      const merchandise = line?.merchandise;
      if (!merchandise) return null;
      return {
        item_id: merchandise.product?.id,
        item_name: merchandise.product?.title,
        item_variant: merchandise.title,
        item_category: merchandise.product?.productType,
        price: Number(merchandise.price?.amount) || 0,
        quantity: line.quantity || 1,
      };
    })
    .filter(Boolean);
}

/**
 * Same currency fallback used everywhere else in this file: prefer the
 * real money value on the object being reported, then the shop-level
 * analytics context, then USD.
 * @param {import('@shopify/hydrogen').CartReturn | null | undefined} cart
 * @param {{currency?: string} | null | undefined} shop
 */
function cartCurrency(cart, shop) {
  return cart?.cost?.totalAmount?.currencyCode || shop?.currency || 'USD';
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
