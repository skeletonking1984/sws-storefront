/**
 * X (Twitter) Conversion API destination.
 *
 * Implements the shared destination interface documented in
 * app/lib/conversions/index.server.js. Built against
 * https://docs.x.com/x-ads-api/measurement/web-conversions
 *
 * Three things the first, unverified version of this file got wrong, all
 * three flagged in its own TODOs and all three now settled against the docs:
 *
 * 1. AUTH IS OAUTH 1.0a, NOT A BEARER TOKEN. Every request is signed with
 *    four credentials: the app's consumer key and secret, plus a user access
 *    token and secret for a user with AD_MANAGER or ACCOUNT_ADMIN on the ads
 *    account. Signing lives in app/lib/oauth1.server.js and is proved
 *    against the RFC 5849 worked example by scripts/verify-oauth1.mjs.
 * 2. The endpoint is `POST /{version}/measurement/conversions/{pixel_id}`,
 *    version 12.
 * 3. `event_id` is the conversion event's id from Ads Manager, not the pixel
 *    id, and is required.
 *
 * WHY hashed_email MATTERS MORE THAN twclid HERE. X requires at least one
 * identifier and the old code sent only `twclid`, returning early when it
 * was absent. `twclid` only exists if the buyer landed on THIS site from an
 * X ad. X's own Conversion Diagnostics reported "Click ID tracking: Not
 * detected, no conversions carried a click ID in the last 24 hours" across
 * 191 events, so twclid-only would have kept sending nothing. Email is on
 * every Shopify order, so it is sent as `hashed_email` (SHA256, lowercased
 * and trimmed, unsalted, per the docs) and twclid is added when present.
 * An order with neither is the only case that still no-ops.
 *
 * Rate limit, well clear of this shop's volume: 60,000 events per account
 * per 15 minutes.
 */

import {oauth1Header} from '../oauth1.server.js';

const X_CAPI_VERSION = '12';

export const id = 'x';

/**
 * TWO AUTH PATHS, because X appears to offer both and only one of them is
 * confirmed in the docs.
 *
 *   R. RELAY, and this is the one in use. POST to sws-x-connector, which
 *      already holds working Ads API credentials and already signs OAuth
 *      1.0a for the campaign reads behind the sws-x MCP. The storefront
 *      sends {pixel_id, conversions[]} with a bearer token and never sees an
 *      X secret. Two env vars here instead of four copied secrets, one place
 *      to rotate instead of two. Preferred whenever configured.
 *   A. Pixel token. A single static token generated in the Ads UI under
 *      Events Manager, sent as an `X-Pixel-Token` header. Needs no developer
 *      account and no Ads API approval. Referenced in X's developer forum
 *      but NOT in the web-conversions docs page, so it is
 *      likely-but-unconfirmed.
 *   B. OAuth 1.0a locally. Four credentials, signed per request by
 *      app/lib/oauth1.server.js. What the official docs describe. Kept as a
 *      fallback for a deployment with no relay.
 *
 * Whichever is configured is used, R first. Supporting both costs one branch and removes the need to guess
 * right, which a previous version of this file did not do: it sent a plain
 * bearer token, which is neither of these and would always have failed.
 * @param {Record<string, string | undefined>} env
 */
export function authMode(env) {
  if (!env?.PUBLIC_X_PIXEL_ID) return null;
  if (env?.PRIVATE_X_RELAY_URL && env?.PRIVATE_X_RELAY_TOKEN) return 'relay';
  if (env?.PRIVATE_X_PIXEL_TOKEN) return 'pixel_token';
  if (
    env?.PRIVATE_X_CONSUMER_KEY &&
    env?.PRIVATE_X_CONSUMER_SECRET &&
    env?.PRIVATE_X_ACCESS_TOKEN &&
    env?.PRIVATE_X_ACCESS_TOKEN_SECRET
  ) {
    return 'oauth1';
  }
  return null;
}

/** @param {Record<string, string | undefined>} env */
export function isConfigured(env) {
  return authMode(env) !== null;
}

/** SHA256 hex, lowercased and trimmed first, unsalted. Per X's docs. */
async function sha256Hex(value) {
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(normalized),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * @param {object} args
 * @param {Record<string, string | undefined>} args.env
 * @param {object} args.order Raw Shopify order payload from the webhook body.
 * @param {Record<string, string>} args.clickIds Click ids captured for this
 *   order, keyed by cart attribute (see app/lib/clickIds.server.js). Only
 *   `_twclid` is used here.
 * @param {string} args.eventId Shared dedup id, the same for every
 *   destination on this order. Sent as X's `conversion_id`, which is what X
 *   uses to reconcile a server event against a browser pixel event for the
 *   same purchase.
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function sendPurchase({env, order, clickIds, eventId}) {
  if (!isConfigured(env)) return {ok: false, reason: 'not_configured'};

  const purchaseEventId = env?.PRIVATE_X_PURCHASE_EVENT_ID;
  if (!purchaseEventId) return {ok: false, reason: 'not_configured'};

  /*
   * ONE identifier object, not one per signal. X validates each element of
   * `identifiers` as a complete identifier on its own, so
   * [{hashed_email}, {ip_address}, {user_agent}] is rejected outright with
   * "At least one user identifier must be provided" even though three were
   * supplied. Verified against the live API on 2026-09-15:
   *
   *   [{hashed_email, ip_address, user_agent}]  accepted
   *   [{hashed_email}]                          accepted
   *   [{ip_address, user_agent}]                accepted
   *   [{hashed_email}, {ip_address}, {user_agent}]  REJECTED
   *
   * Getting this wrong does not degrade matching, it stops every conversion
   * from being recorded at all. Do not split these back out.
   *
   * Why more than email: `hashed_email` only matches when the buyer's
   * checkout email is the one on their X account, which for most shoppers it
   * is not. X reported "CAPI events received, but none of your key
   * conversions could be matched to a user" on 2026-09-15 with email as the
   * only identifier, and the hashing was verified correct at the time, so the
   * gap was coverage rather than correctness. IP and user agent let X match
   * on the device that saw the ad.
   *
   * Only email and phone are hashed. Hashing IP or user agent would make them
   * unmatchable.
   */
  const identifier = {};

  const twclid = clickIds?._twclid;
  if (twclid) identifier.twclid = twclid;

  const email = order?.email || order?.contact_email || order?.customer?.email;
  if (email) {
    const hashed = await sha256Hex(email);
    if (hashed) identifier.hashed_email = hashed;
  }

  const ip = order?.browser_ip || order?.client_details?.browser_ip;
  if (ip) identifier.ip_address = String(ip);

  const userAgent = order?.client_details?.user_agent;
  if (userAgent) identifier.user_agent = String(userAgent);

  if (Object.keys(identifier).length === 0) {
    // Nothing to attribute on. Not an error, just an order X cannot match.
    return {ok: false, reason: 'no_identifier'};
  }

  const identifiers = [identifier];

  const items = Array.isArray(order.line_items) ? order.line_items : [];

  const body = {
    conversions: [
      {
        event_id: purchaseEventId,
        conversion_time: new Date(
          order.processed_at || order.created_at || Date.now(),
        ).toISOString(),
        identifiers,
        /*
         * value AND price_currency. Both, or X counts the conversion and
         * reports no revenue against it.
         *
         * Caught on the first real attributed sale, 2026-09-15: Ads Manager
         * showed Purchases 1 against the right ad, and "Purchases - sale
         * amount" empty. The conversion arrived, the money did not, so cost per
         * purchase was computable and ROAS was not. A bare `value` with nothing
         * to denominate it in is not revenue.
         *
         * Shopify's orders/create body carries `currency`; `presentment_currency`
         * is the fallback for a multi currency shop.
         */
        value:
          order.total_price !== undefined ? String(order.total_price) : undefined,
        price_currency:
          order.currency || order.presentment_currency || 'USD',
        number_items: items.reduce(
          (sum, item) => sum + (Number(item.quantity) || 0),
          0,
        ),
        conversion_id: eventId,
        contents: items.map((item) => ({
          content_id:
            item.product_id !== undefined ? String(item.product_id) : undefined,
          content_name: item.title,
          content_price:
            item.price !== undefined ? String(item.price) : undefined,
          num_items: item.quantity,
        })),
      },
    ],
  };

  const mode = authMode(env);

  // Relay: the connector signs, so this never builds an ads-api.x.com URL
  // and never touches a credential.
  if (mode === 'relay') {
    try {
      const res = await fetch(env.PRIVATE_X_RELAY_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.PRIVATE_X_RELAY_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pixel_id: env.PUBLIC_X_PIXEL_ID,
          conversions: body.conversions,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return {ok: false, reason: `relay_${res.status}`};
      const out = await res.json().catch(() => null);
      // The relay reports X's own status rather than its own, so a 200 from
      // the worker carrying a 401 from X is still a failure here.
      if (out && out.ok === false) {
        return {ok: false, reason: `x_${out.status || 'error'}`};
      }
      return {ok: true};
    } catch {
      return {ok: false, reason: 'relay_unreachable'};
    }
  }

  const url = `https://ads-api.x.com/${X_CAPI_VERSION}/measurement/conversions/${encodeURIComponent(
    env.PUBLIC_X_PIXEL_ID,
  )}`;

  try {
    const headers = {'Content-Type': 'application/json'};
    if (mode === 'pixel_token') {
      headers['X-Pixel-Token'] = env.PRIVATE_X_PIXEL_TOKEN;
    } else {
      headers.authorization = await oauth1Header({
        method: 'POST',
        url,
        credentials: {
          consumerKey: env.PRIVATE_X_CONSUMER_KEY,
          consumerSecret: env.PRIVATE_X_CONSUMER_SECRET,
          token: env.PRIVATE_X_ACCESS_TOKEN,
          tokenSecret: env.PRIVATE_X_ACCESS_TOKEN_SECRET,
        },
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) return {ok: true};
    // X reports per-conversion errors in the body with a 200 as well, but a
    // non-2xx is always a real failure. Carry the status so a bad credential
    // is distinguishable from a bad payload in the webhook's own logging.
    return {ok: false, reason: `send_failed_${response.status}`};
  } catch {
    return {ok: false, reason: 'send_failed'};
  }
}
