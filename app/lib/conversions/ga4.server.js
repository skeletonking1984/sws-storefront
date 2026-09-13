/**
 * GA4 Measurement Protocol destination.
 *
 * Server-side purchase send, independent of any browser pixel. Shop Pay
 * (shop.app checkout) is documented to not reliably fire `checkout_completed`
 * for guest/Shop Pay fast-path checkouts, and even when a browser pixel does
 * fire, it can land on a host that cannot see the storefront's `_ga`
 * cookie. This destination is called from the `orders/create` webhook (see
 * app/routes/webhooks.orders.jsx) so revenue lands in GA4 regardless of what
 * happened in the browser.
 *
 * Implements the shared destination interface documented in
 * app/lib/conversions/index.server.js -- keep any change to that shape in
 * sync with app/lib/conversions/x.server.js and docs/conversion-tracking.md.
 *
 * Also implements the optional `sendEvent`, called from
 * app/routes/api.e.jsx (the same-origin relay for the pre-purchase funnel
 * events a blocked browser pixel never sent). GA4 is the only destination
 * that gets it today -- x.server.js and meta.server.js are left alone for
 * now, their CAPI auth is still unconfirmed (see the TODOs in
 * x.server.js), and wiring an event relay on top of an unconfirmed
 * purchase auth scheme is not worth doing twice.
 */

const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

export const id = 'ga4';

/**
 * @param {Record<string, string | undefined>} env
 * @returns {boolean}
 */
export function isConfigured(env) {
  return Boolean(env?.PUBLIC_GA4_MEASUREMENT_ID && env?.PRIVATE_GA4_API_SECRET);
}

/**
 * @param {object} args
 * @param {Record<string, string | undefined>} args.env
 * @param {object} args.order Raw Shopify order payload from the webhook body.
 * @param {Record<string, string>} args.clickIds Click ids captured for this
 *   order, keyed by the cart attribute key (see app/lib/clickIds.server.js).
 *   GA4 only uses `_ga_client_id`; every other key is ignored here.
 * @param {string} args.eventId Shared dedup id, same for every destination
 *   on this order. Not sent to GA4 today -- gtag's own `transaction_id`
 *   field is GA4's real dedup key -- but threaded through the interface so
 *   a future GA4 field (or a different provider that wants it) has it
 *   without an interface change. See docs/conversion-tracking.md.
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function sendPurchase({env, order, clickIds, eventId}) {
  if (!isConfigured(env)) {
    return {ok: false, reason: 'not_configured'};
  }
  // Accepted for interface parity with every other destination (see the
  // jsdoc above) but not sent to GA4 today -- gtag's own transaction_id is
  // GA4's real dedup key. Referenced here only so lint does not flag an
  // interface parameter as unused.
  void eventId;

  const orderId = String(order.id);
  const relayedClientId = clickIds?._ga_client_id;

  // Deterministic fallback keyed on the order id, never random: Shopify
  // redelivers webhooks on retry, and a random client_id per delivery
  // would split one order across multiple GA4 users. This trades
  // attribution (the purchase will not join the buyer's earlier browsing
  // session) for at least counting the revenue.
  const clientId = relayedClientId || `webhook.${orderId}`;

  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
  const items = lineItems.map((lineItem) => ({
    item_id:
      lineItem.product_id !== undefined
        ? String(lineItem.product_id)
        : undefined,
    item_variant:
      lineItem.variant_id !== undefined
        ? String(lineItem.variant_id)
        : undefined,
    item_name: lineItem.title,
    price: lineItem.price !== undefined ? Number(lineItem.price) : undefined,
    quantity: lineItem.quantity,
  }));

  const discountCodes = Array.isArray(order.discount_codes)
    ? order.discount_codes
    : [];
  const coupon = discountCodes
    .map((discount) => discount?.code)
    .filter(Boolean)
    .join(', ');

  const payload = {
    client_id: clientId,
    events: [
      {
        name: 'purchase',
        params: {
          // Same field used everywhere purchase is reported (the Admin
          // custom pixel, this webhook, eventually other destinations), so
          // if two paths ever run at once the hits at least collide on
          // this for manual cleanup. See docs/conversion-tracking.md,
          // "eventId for deduplication".
          transaction_id: orderId,
          value:
            order.total_price !== undefined
              ? Number(order.total_price)
              : undefined,
          currency: order.currency,
          tax: order.total_tax !== undefined ? Number(order.total_tax) : 0,
          discount:
            order.total_discounts !== undefined
              ? Number(order.total_discounts)
              : 0,
          coupon: coupon || undefined,
          items,
        },
      },
    ],
  };

  try {
    const response = await fetch(
      `${GA4_ENDPOINT}?measurement_id=${encodeURIComponent(
        env.PUBLIC_GA4_MEASUREMENT_ID,
      )}&api_secret=${encodeURIComponent(env.PRIVATE_GA4_API_SECRET)}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(destinationTimeoutMs()),
      },
    );
    return response.ok ? {ok: true} : {ok: false, reason: 'send_failed'};
  } catch {
    return {ok: false, reason: 'send_failed'};
  }
}

/**
 * Server-side send for a single pre-purchase funnel event (page_view,
 * view_item, add_to_cart, ...), relayed from app/routes/api.e.jsx only
 * when the browser's own gtag.js did not load. Same endpoint, same env
 * vars, same client_id precedence as `sendPurchase` above.
 *
 * @param {object} args
 * @param {Record<string, string | undefined>} args.env
 * @param {string} args.name Normalized event name, see
 *   app/lib/analytics/events.js. Never `purchase` -- api.e.jsx rejects
 *   that before this is ever called.
 * @param {object} args.params Normalized event payload for `name`.
 * @param {Record<string, string>} args.clickIds Click ids for this
 *   request (see app/lib/clickIds.server.js). Only `_ga_client_id` is
 *   used here, same as `sendPurchase`.
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function sendEvent({env, name, params, clickIds}) {
  if (!isConfigured(env)) {
    return {ok: false, reason: 'not_configured'};
  }

  const clientId = clickIds?._ga_client_id;
  // Unlike sendPurchase there is no order id to fall back to here -- an
  // event with no client id at all (Part 1's `sws_cid` fallback should
  // make this rare) has nothing worth attaching it to, so it is skipped
  // rather than sent under a made-up id.
  if (!clientId) {
    return {ok: false, reason: 'no_client_id'};
  }

  const payload = {
    client_id: clientId,
    events: [{name, params: buildEventParams(name, params)}],
  };

  try {
    const response = await fetch(
      `${GA4_ENDPOINT}?measurement_id=${encodeURIComponent(
        env.PUBLIC_GA4_MEASUREMENT_ID,
      )}&api_secret=${encodeURIComponent(env.PRIVATE_GA4_API_SECRET)}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(destinationTimeoutMs()),
      },
    );
    return response.ok ? {ok: true} : {ok: false, reason: 'send_failed'};
  } catch {
    return {ok: false, reason: 'send_failed'};
  }
}

/**
 * Maps one normalized event's params (see app/lib/analytics/events.js)
 * onto GA4 Measurement Protocol's own params shape. GA4's standard
 * ecommerce event names already match the normalized names 1:1 (that is
 * where those names came from), so only the params shape changes here --
 * the same mapping app/lib/analytics/pixels/ga4.js does for the
 * browser-side gtag call, kept in sync with it by hand since one runs in
 * the browser and one on the server.
 * @param {string} name
 * @param {object} params
 * @returns {object}
 */
function buildEventParams(name, params) {
  if (name === 'page_view') {
    return {
      page_location: params.pageLocation,
      page_path: params.pagePath,
      page_title: params.pageTitle,
    };
  }

  if (name === 'search') {
    return {search_term: params.searchTerm};
  }

  if (name === 'view_item_list') {
    return {
      item_list_id: params.listId,
      item_list_name: params.listName,
      items: (params.items || []).map(toGa4EventItem),
    };
  }

  return {
    currency: params.currency,
    value: params.value,
    items: (params.items || []).map(toGa4EventItem),
  };
}

/**
 * @param {object} item Normalized item, see app/lib/analytics/events.js.
 */
function toGa4EventItem(item) {
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
 * Same hard ceiling app/lib/notify.server.js uses on its own outbound
 * fetches: a slow third party must never hang the webhook handler, and
 * Shopify must always get its 200 quickly regardless of how GA4 is
 * behaving. Kept as a function (not a shared constant import) so each
 * destination file stays a fully self-contained, copy-paste-able template
 * for the next platform -- see docs/conversion-tracking.md, "how to add a
 * new platform".
 * @returns {number}
 */
function destinationTimeoutMs() {
  return 8000;
}
