/**
 * X (Twitter) Conversion API destination.
 *
 * Implements the shared destination interface documented in
 * app/lib/conversions/index.server.js -- keep any change to that shape in
 * sync with app/lib/conversions/ga4.server.js and
 * docs/conversion-tracking.md.
 *
 * Todd does not have X CAPI credentials yet (tracked on Linear BAT-145,
 * same ticket the commented-out browser-pixel X block in
 * docs/checkout-purchase-pixel.md is waiting on). Structure only, built
 * from X's own public docs, NOT verified against a real account:
 * https://docs.x.com/x-ads-api/measurement/web-conversions
 *
 * ============================ TODO before enabling ============================
 * 1. AUTH SCHEME IS UNCONFIRMED. X's Ads API has historically required
 *    OAuth 1.0a REQUEST SIGNING (consumer key + consumer secret + access
 *    token + access token secret, all four, per request), not a single
 *    bearer token. `PRIVATE_X_CAPI_TOKEN` as one string, sent as a plain
 *    `Authorization: Bearer <token>` header below, is a structural
 *    placeholder and is very likely wrong. Confirm the current auth
 *    requirement in X's docs (or with Auny/BAT-145) before this can ever
 *    send a real event, and change the request-building code accordingly
 *    if OAuth 1.0a signing turns out to be required.
 * 2. API VERSION NUMBER in the URL path (`X_CAPI_VERSION` below) is a
 *    placeholder copied from an example in X's docs, not verified as the
 *    current version. Confirm before enabling.
 * 3. `event_id` is a required field (the Purchase event's id from X Ads
 *    Events Manager), separate from the pixel id. Gated here on
 *    `PRIVATE_X_PURCHASE_EVENT_ID`; get the real value from Auny alongside
 *    the pixel id and token.
 * ================================================================================
 */

// Placeholder pending confirmation -- see TODO 2 above.
const X_CAPI_VERSION = '12';

export const id = 'x';

/**
 * Per the build spec, gated specifically on these two. (See TODO 3 above
 * for a third value `sendPurchase` also needs and checks for itself, so a
 * missing event id still no-ops rather than sending a malformed request.)
 * @param {Record<string, string | undefined>} env
 * @returns {boolean}
 */
export function isConfigured(env) {
  return Boolean(env?.PRIVATE_X_CAPI_TOKEN && env?.PUBLIC_X_PIXEL_ID);
}

/**
 * @param {object} args
 * @param {Record<string, string | undefined>} args.env
 * @param {object} args.order Raw Shopify order payload from the webhook body.
 * @param {Record<string, string>} args.clickIds Click ids captured for this
 *   order, keyed by cart attribute key (see app/lib/clickIds.server.js).
 *   Uses `_twclid` for attribution; every other key is ignored here.
 * @param {string} args.eventId Shared dedup id, same for every destination
 *   on this order. Sent as X's `conversion_id`, which X's docs describe as
 *   the field it uses to dedupe a server-sent event against a browser
 *   pixel event for the same conversion.
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function sendPurchase({env, order, clickIds, eventId}) {
  if (!isConfigured(env)) {
    return {ok: false, reason: 'not_configured'};
  }

  const purchaseEventId = env?.PRIVATE_X_PURCHASE_EVENT_ID;
  const twclid = clickIds?._twclid;
  if (!purchaseEventId || !twclid) {
    // Never send an event X cannot attribute. No `event_id` is a
    // misconfiguration (see TODO 3); no `twclid` just means this order's
    // buyer never clicked an X ad, which is the common case and not an
    // error -- X requires at least one identifier per its docs, and
    // `twclid` is the only one this app captures.
    return {ok: false, reason: 'not_configured'};
  }

  const items = Array.isArray(order.line_items) ? order.line_items : [];

  const body = {
    conversions: [
      {
        event_id: purchaseEventId,
        conversion_time: new Date(
          order.processed_at || order.created_at || Date.now(),
        ).toISOString(),
        identifiers: [{twclid}],
        value: order.total_price !== undefined ? String(order.total_price) : undefined,
        number_items: items.reduce(
          (sum, item) => sum + (Number(item.quantity) || 0),
          0,
        ),
        // Dedup key shared across every destination for this order (see
        // docs/conversion-tracking.md, "eventId for deduplication"), used
        // by X to reconcile this server-sent event against a browser
        // pixel event for the same purchase, per X's own docs.
        conversion_id: eventId,
        contents: items.map((item) => ({
          content_id:
            item.product_id !== undefined ? String(item.product_id) : undefined,
          content_name: item.title,
          content_price: item.price !== undefined ? String(item.price) : undefined,
          num_items: item.quantity,
        })),
      },
    ],
  };

  try {
    const response = await fetch(
      `https://ads-api.x.com/${X_CAPI_VERSION}/measurement/conversions/${encodeURIComponent(
        env.PUBLIC_X_PIXEL_ID,
      )}`,
      {
        method: 'POST',
        headers: {
          // See TODO 1 above -- unconfirmed auth scheme.
          Authorization: `Bearer ${env.PRIVATE_X_CAPI_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      },
    );
    return response.ok ? {ok: true} : {ok: false, reason: 'send_failed'};
  } catch {
    return {ok: false, reason: 'send_failed'};
  }
}
