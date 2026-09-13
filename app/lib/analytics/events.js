/**
 * Normalizes Hydrogen's analytics bus into ONE platform-neutral ecommerce
 * event shape, so payload mapping happens once here instead of being
 * re-implemented per platform (that used to be GA4.jsx and XPixel.jsx each
 * separately reading Hydrogen's raw payloads -- see git history on this
 * file's predecessor for the old shape).
 *
 * Normalized shape:
 *   {
 *     name,        // page_view | view_item | view_item_list | select_item |
 *                  // add_to_cart | remove_from_cart | view_cart |
 *                  // begin_checkout | search
 *     currency,
 *     value,
 *     items: [{id, name, variant, category, price, quantity, index?, listId?, listName?}],
 *     searchTerm?,
 *     listId?, listName?,       // top-level list context for view_item_list / select_item
 *     pageLocation?, pagePath?, pageTitle?, // page_view only, read from window
 *   }
 *
 * Two of these are not native Hydrogen events, Hydrogen has nothing to
 * publish for them:
 * - select_item comes from `custom_select_item`, published by
 *   ProductItem.jsx on click, before the browser navigates to the PDP, so
 *   list-to-detail attribution survives the navigation.
 * - begin_checkout comes from `custom_begin_checkout`, published by
 *   CartSummary.jsx on click of the checkout link, since checkout is
 *   Shopify hosted and never routes through this app.
 *
 * Currency: most Hydrogen payloads (product_viewed, collection_viewed)
 * carry no currency of their own, only the shop-level analytics context
 * does (useAnalytics().shop, passed in here as `shop`). Money-bearing
 * payloads (cart lines, merchandise) carry their own currencyCode and
 * that always wins over the shop fallback.
 *
 * NEVER add a "purchase" mapping here. Checkout is Shopify hosted, the
 * only purchase event this app ever sends is server side, from the
 * orders/create webhook (see app/lib/conversions/). A browser purchase
 * event here would double count every order.
 *
 * @param {string} hydrogenEventName Raw bus event name, e.g. 'page_viewed'.
 * @param {object} payload Raw event payload from Hydrogen's bus.
 * @param {{currency?: string} | null | undefined} shop Shop analytics
 *   context from useAnalytics(), used only as a currency fallback.
 * @returns {object | null} Normalized event, or null when the payload has
 *   nothing worth sending (empty cart, missing product, blank search, ...).
 */
export function normalizeEvent(hydrogenEventName, payload, shop) {
  switch (hydrogenEventName) {
    case 'page_viewed':
      return normalizePageView();
    case 'product_viewed':
      return normalizeViewItem(payload, shop);
    case 'collection_viewed':
      return normalizeViewItemList(payload);
    case 'custom_select_item':
      return normalizeSelectItem(payload);
    case 'product_added_to_cart':
      return normalizeAddToCart(payload, shop);
    case 'product_removed_from_cart':
      return normalizeRemoveFromCart(payload, shop);
    case 'cart_viewed':
      return normalizeViewCart(payload, shop);
    case 'custom_begin_checkout':
      return normalizeBeginCheckout(payload, shop);
    case 'search_viewed':
      return normalizeSearch(payload);
    default:
      return null;
  }
}

/**
 * page_view reads straight from window/document, same as GA4.jsx did
 * before this file existed -- Hydrogen's page_viewed payload carries
 * nothing else worth sending.
 */
function normalizePageView() {
  if (typeof window === 'undefined') return null;
  return {
    name: 'page_view',
    pageLocation: window.location.href,
    pagePath: window.location.pathname + window.location.search,
    pageTitle: typeof document !== 'undefined' ? document.title : undefined,
  };
}

/**
 * @param {{products?: Array<object>}} payload
 * @param {{currency?: string} | null | undefined} shop
 */
function normalizeViewItem(payload, shop) {
  const product = payload?.products?.[0];
  if (!product) return null;

  const price = Number(product.price) || 0;
  const quantity = product.quantity || 1;

  return {
    name: 'view_item',
    // product_viewed does not carry a currency code on its own payload,
    // only the shop-level analytics context does, read it from there.
    currency: shop?.currency || 'USD',
    value: price * quantity,
    items: [
      {
        id: product.id,
        name: product.title,
        variant: product.variantTitle,
        category: product.productType,
        price,
        quantity,
      },
    ],
  };
}

/**
 * Collection pages (see collections.$handle.jsx) extend Hydrogen's
 * CollectionPayload (normally just {collection: {id, handle}}) with a
 * `products` array. The generic view component spreads whatever `data`
 * it is given straight into the published payload, so that extra field
 * survives here even though Hydrogen's own type for this event doesn't
 * declare it.
 * @param {{collection?: {handle?: string; title?: string}; products?: Array<object>}} payload
 */
function normalizeViewItemList(payload) {
  const products = payload?.products;
  if (!products?.length) return null;

  const listId = payload?.collection?.handle;
  const listName = payload?.collection?.title || listId;

  return {
    name: 'view_item_list',
    listId,
    listName,
    items: products.map((product, i) => ({
      id: product.id,
      name: product.title,
      category: product.productType,
      price: Number(product.price) || 0,
      index: typeof product.index === 'number' ? product.index : i,
      listId,
      listName,
    })),
  };
}

/**
 * Not a native Hydrogen event. ProductItem.jsx publishes this on click of
 * a product card, before the browser navigates to the product page.
 * @param {{product?: object; listId?: string; listName?: string; index?: number}} payload
 */
function normalizeSelectItem(payload) {
  const product = payload?.product;
  if (!product) return null;

  return {
    name: 'select_item',
    listId: payload?.listId,
    listName: payload?.listName,
    items: [
      {
        id: product.id,
        name: product.title,
        category: product.productType,
        price: Number(product.price) || 0,
        index: payload?.index,
        listId: payload?.listId,
        listName: payload?.listName,
      },
    ],
  };
}

/**
 * @param {{currentLine?: object}} payload
 * @param {{currency?: string} | null | undefined} shop
 */
function normalizeAddToCart(payload, shop) {
  const line = payload?.currentLine;
  const merchandise = line?.merchandise;
  if (!merchandise) return null;

  const price = Number(merchandise.price?.amount) || 0;
  const quantity = line.quantity || 1;
  const currency = merchandise.price?.currencyCode || shop?.currency || 'USD';

  return {
    name: 'add_to_cart',
    currency,
    value: price * quantity,
    items: [
      {
        id: merchandise.product?.id,
        name: merchandise.product?.title,
        variant: merchandise.title,
        category: merchandise.product?.productType,
        price,
        quantity,
      },
    ],
  };
}

/**
 * Hydrogen's AnalyticsProvider diffs the cart on every change and fires
 * this both for a full line removal (only prevLine is set) and for a
 * quantity decrease (both prevLine and currentLine are set, the line just
 * did not disappear). Read whichever line still describes the product and
 * use the quantity delta as the removed amount.
 * @param {{prevLine?: object; currentLine?: object}} payload
 * @param {{currency?: string} | null | undefined} shop
 */
function normalizeRemoveFromCart(payload, shop) {
  const prevLine = payload?.prevLine;
  const currentLine = payload?.currentLine;
  const merchandise = currentLine?.merchandise || prevLine?.merchandise;
  if (!merchandise) return null;

  const price = Number(merchandise.price?.amount) || 0;
  const removedQuantity = currentLine
    ? Math.max(0, (prevLine?.quantity || 0) - currentLine.quantity)
    : prevLine?.quantity || 1;
  if (removedQuantity <= 0) return null;
  const currency = merchandise.price?.currencyCode || shop?.currency || 'USD';

  return {
    name: 'remove_from_cart',
    currency,
    value: price * removedQuantity,
    items: [
      {
        id: merchandise.product?.id,
        name: merchandise.product?.title,
        variant: merchandise.title,
        category: merchandise.product?.productType,
        price,
        quantity: removedQuantity,
      },
    ],
  };
}

/**
 * CartMain.jsx renders <Analytics.CartView /> with no data prop: the
 * generic view component always merges in the AnalyticsProvider's own
 * current cart regardless, so payload.cart is already the real cart.
 * @param {{cart?: object}} payload
 * @param {{currency?: string} | null | undefined} shop
 */
function normalizeViewCart(payload, shop) {
  const cart = payload?.cart;
  const items = cartLineItems(cart);
  if (!items.length) return null;

  return {
    name: 'view_cart',
    currency: cartCurrency(cart, shop),
    value: Number(cart?.cost?.totalAmount?.amount) || 0,
    items,
  };
}

/**
 * Not a native Hydrogen event. CartSummary.jsx publishes this on click of
 * the checkout link, at the moment the browser is about to leave for
 * Shopify hosted checkout.
 * @param {{cart?: object}} payload
 * @param {{currency?: string} | null | undefined} shop
 */
function normalizeBeginCheckout(payload, shop) {
  const cart = payload?.cart;
  const items = cartLineItems(cart);
  if (!items.length) return null;

  return {
    name: 'begin_checkout',
    currency: cartCurrency(cart, shop),
    value: Number(cart?.cost?.totalAmount?.amount) || 0,
    items,
  };
}

/**
 * search.jsx's regular /search route already publishes this via
 * <Analytics.SearchView> with the real query term. The predictive search
 * palette (SearchResultsPredictive.jsx) deliberately is not wired here, it
 * re-fetches on every keystroke and would fire a search event per
 * character typed.
 * @param {{searchString?: string}} payload
 */
function normalizeSearch(payload) {
  const searchTerm = payload?.searchString;
  if (!searchTerm) return null;

  return {name: 'search', searchTerm};
}

/**
 * Flattens a cart's line items into normalized items for view_cart and
 * begin_checkout, both of which need the same shape. Returns an empty
 * array (never throws) for a cart with no lines or missing merchandise.
 * @param {object | null | undefined} cart
 */
function cartLineItems(cart) {
  const nodes = cart?.lines?.nodes || [];
  return nodes
    .map((line) => {
      const merchandise = line?.merchandise;
      if (!merchandise) return null;
      return {
        id: merchandise.product?.id,
        name: merchandise.product?.title,
        variant: merchandise.title,
        category: merchandise.product?.productType,
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
 * @param {object | null | undefined} cart
 * @param {{currency?: string} | null | undefined} shop
 */
function cartCurrency(cart, shop) {
  return cart?.cost?.totalAmount?.currencyCode || shop?.currency || 'USD';
}
