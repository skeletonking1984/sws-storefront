/**
 * Meta (Facebook/Instagram) Conversions API destination.
 *
 * Implements the shared destination interface documented in
 * app/lib/conversions/index.server.js -- keep any change to that shape in
 * sync with app/lib/conversions/ga4.server.js, x.server.js, and
 * docs/conversion-tracking.md.
 *
 * Meta credentials do not exist yet (Meta ads have not launched). Until
 * PRIVATE_META_ACCESS_TOKEN and PUBLIC_META_PIXEL_ID are both set,
 * isConfigured() returns false and this never sends or throws.
 *
 * Docs: https://developers.facebook.com/docs/marketing-api/conversions-api
 */

const META_API_VERSION = 'v21.0';

export const id = 'meta';

/**
 * @param {Record<string, string | undefined>} env
 * @returns {boolean}
 */
export function isConfigured(env) {
  return Boolean(env?.PRIVATE_META_ACCESS_TOKEN && env?.PUBLIC_META_PIXEL_ID);
}

/**
 * @param {object} args
 * @param {Record<string, string | undefined>} args.env
 * @param {object} args.order Raw Shopify order payload from the webhook body.
 * @param {Record<string, string>} args.clickIds Click ids captured for this
 *   order, keyed by the cart attribute key (see app/lib/clickIds.server.js).
 *   Uses `_fbclid` to build the `fbc` parameter; every other key is
 *   ignored here.
 * @param {string} args.eventId Shared dedup id, same for every destination
 *   on this order. Sent as Meta's `event_id`, the field Meta's docs
 *   describe as the one used to dedupe a server event against a browser
 *   pixel event for the same conversion.
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function sendPurchase({env, order, clickIds, eventId}) {
  if (!isConfigured(env)) {
    return {ok: false, reason: 'not_configured'};
  }

  const orderId = String(order.id);
  const eventTimeSeconds = Math.floor(
    new Date(order.processed_at || order.created_at || Date.now()).getTime() /
      1000,
  );

  const lineItems = Array.isArray(order.line_items) ? order.line_items : [];
  const contents = lineItems.map((lineItem) => ({
    id:
      lineItem.product_id !== undefined
        ? String(lineItem.product_id)
        : undefined,
    quantity: lineItem.quantity,
    item_price:
      lineItem.price !== undefined ? Number(lineItem.price) : undefined,
  }));

  const userData = {};
  const fbc = buildFbc(clickIds?._fbclid, eventTimeSeconds);
  if (fbc) userData.fbc = fbc;

  const payload = {
    data: [
      {
        event_name: 'Purchase',
        event_time: eventTimeSeconds,
        // Same field used everywhere purchase is reported (the webhook,
        // eventually other destinations), so if a future browser pixel
        // ever also fires for this order the hits at least collide on
        // this for manual cleanup. See docs/conversion-tracking.md,
        // "eventId for deduplication".
        event_id: eventId,
        action_source: 'website',
        user_data: userData,
        custom_data: {
          currency: order.currency,
          value:
            order.total_price !== undefined
              ? Number(order.total_price)
              : undefined,
          content_type: 'product',
          contents,
          order_id: orderId,
        },
      },
    ],
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${encodeURIComponent(
        env.PUBLIC_META_PIXEL_ID,
      )}/events?access_token=${encodeURIComponent(
        env.PRIVATE_META_ACCESS_TOKEN,
      )}`,
      {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      },
    );
    return response.ok ? {ok: true} : {ok: false, reason: 'send_failed'};
  } catch {
    return {ok: false, reason: 'send_failed'};
  }
}

/**
 * Builds Meta's `fbc` (Facebook click id) parameter from the raw fbclid
 * this app captured on the landing URL (see app/lib/clickIds.server.js,
 * `_fbclid`). Meta's required format is
 * `fb.{subdomainIndex}.{creationTime}.{fbclid}` -- subdomainIndex is
 * always 1 for a standard eTLD+1 domain (streamwidgetshop.com has no
 * extra subdomain level in front of the registrable domain), and
 * creationTime is the click id's own capture time in epoch milliseconds.
 * That capture time is not persisted separately from the click id today,
 * so this uses the order's own event time as a close approximation --
 * Meta's docs say fbc only needs to be a well-formed value the click id
 * appears in, not a byte-exact original timestamp, for attribution to work.
 * @param {string | undefined} fbclid
 * @param {number} eventTimeSeconds
 * @returns {string | null}
 */
function buildFbc(fbclid, eventTimeSeconds) {
  if (!fbclid) return null;
  return `fb.1.${eventTimeSeconds * 1000}.${fbclid}`;
}
