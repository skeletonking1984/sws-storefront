/**
 * Server-side purchase tracking, independent of any browser pixel.
 *
 * Shop Pay (shop.app checkout) is documented to not reliably fire
 * `checkout_completed` for guest/Shop Pay fast-path checkouts, and even
 * when it does fire, an Admin custom pixel can lose attribution if the
 * buyer ends up on a host that cannot see the storefront's `_ga` cookie.
 * This route receives Shopify's `orders/create` webhook and fans the order
 * out to every registered conversion destination (see
 * app/lib/conversions/index.server.js) so revenue lands wherever it needs
 * to regardless of what happened in the browser. See
 * docs/conversion-tracking.md for the full standard this implements.
 *
 * Resource route: no default export (see app/routes/[robots.txt].jsx for
 * the same pattern). Everything happens in `action`; `loader` exists only
 * to return an explicit 405 for GET, because React Router's own "no loader
 * for this route" fallback surfaced as a 400 in testing here, not the 405
 * the framework docs describe.
 *
 * Registering this webhook in Shopify Admin (orders/create -> this route on
 * the production domain) is a manual step Todd does separately. See the
 * dedup note appended to docs/checkout-purchase-pixel.md before turning
 * both this and the Admin custom pixel on at once.
 */

import {destinations} from '~/lib/conversions/index.server';

export function loader() {
  return new Response('Method Not Allowed', {status: 405});
}

/**
 * @param {Route.ActionArgs} args
 */
export async function action({request, context}) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {status: 405});
  }

  const secret = context.env?.PRIVATE_SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    // Never accept an unverified webhook. No secret configured means we
    // cannot tell a real order from a spoofed POST, so reject everything
    // rather than trust it.
    return new Response('Not configured', {status: 503});
  }

  // HMAC is computed over the raw body bytes. Parsing JSON first and
  // re-stringifying it would not reproduce Shopify's exact bytes and would
  // break the signature check, so read as text before anything else.
  const rawBody = await request.text();
  const providedHmac = request.headers.get('X-Shopify-Hmac-Sha256');

  const verified = providedHmac
    ? await verifyHmac(rawBody, providedHmac, secret)
    : false;
  if (!verified) {
    return new Response('Unauthorized', {status: 401});
  }

  let order;
  try {
    order = JSON.parse(rawBody);
  } catch {
    // HMAC verified but the body was not JSON. Still ack so Shopify does
    // not retry-storm this endpoint; there's nothing to send either way.
    console.error('webhooks.orders: HMAC verified but body was not valid JSON');
    return new Response('OK', {status: 200});
  }

  const orderId = String(order.id);
  const noteAttributes = Array.isArray(order.note_attributes)
    ? order.note_attributes
    : [];
  // Every click id captured on the storefront (see
  // app/lib/clickIds.server.js) that made it onto the cart as an attribute
  // rides along on the order as a note_attribute with the same key. Read
  // them all once here, keyed the same way, so every destination below
  // gets the same map rather than each re-parsing note_attributes itself.
  const clickIds = Object.fromEntries(
    noteAttributes
      .filter((attr) => attr && attr.name && attr.value)
      .map((attr) => [attr.name, attr.value]),
  );

  // Shared across every destination for this order. Lets a platform dedupe
  // a server-sent event against a browser pixel event for the same
  // purchase, should one ever also fire. See docs/conversion-tracking.md,
  // "eventId for deduplication".
  const eventId = `order_${orderId}`;

  // Fan out to every registered destination (see
  // app/lib/conversions/index.server.js), isolating each one: a
  // destination that throws, times out, or was never configured must never
  // stop another destination from sending, and must never fail this
  // webhook. Promise.allSettled, not a for-loop with try/catch per
  // iteration, so all sends race in parallel rather than queuing behind a
  // slow one.
  const results = await Promise.allSettled(
    destinations.map(async (destination) => {
      if (!destination.isConfigured(context.env)) {
        return {id: destination.id, ok: false, reason: 'not_configured'};
      }
      const result = await destination.sendPurchase({
        env: context.env,
        order,
        clickIds,
        eventId,
      });
      return {id: destination.id, ...result};
    }),
  );

  // Never log the order body, customer data, or any API secret. Order id
  // and a per-destination outcome is enough to debug delivery.
  for (const result of results) {
    if (result.status === 'fulfilled') {
      const {id: destinationId, ok, reason} = result.value;
      console.error(
        `webhooks.orders: order ${orderId} ${destinationId} ${
          ok ? 'ok' : `failed${reason ? ` (${reason})` : ''}`
        }`,
      );
    } else {
      // A destination is only supposed to reach here if it threw instead
      // of returning {ok: false}, which every destination's own interface
      // contract says it must not do -- logged loudly because it means a
      // destination module has a bug, not that a third party is down.
      console.error(
        `webhooks.orders: order ${orderId} a destination threw unexpectedly`,
        result.reason,
      );
    }
  }

  // Always 200 on a verified receive, even when every destination send
  // failed, so Shopify never retry-storms this endpoint over an upstream
  // analytics outage.
  return new Response('OK', {status: 200});
}

/**
 * Verifies Shopify's webhook signature: base64(HMAC-SHA256(rawBody, secret)),
 * compared in constant time. Uses Web Crypto because this runs on Oxygen (a
 * Workers-like runtime), not Node, so `require('crypto')` / Node's
 * `crypto.createHmac` are not available here.
 * @param {string} rawBody
 * @param {string} providedHmacBase64
 * @param {string} secret
 * @returns {Promise<boolean>}
 */
async function verifyHmac(rawBody, providedHmacBase64, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(rawBody),
  );
  const computedBase64 = base64Encode(new Uint8Array(signatureBytes));

  return timingSafeEqual(computedBase64, providedHmacBase64);
}

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function base64Encode(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Constant-time string compare. A plain `===` on a signature short
 * circuits on the first mismatched byte, which leaks timing information
 * about how many leading bytes were correct.
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function timingSafeEqual(a, b) {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const length = Math.max(aBytes.length, bBytes.length);

  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }

  return diff === 0;
}

/** @typedef {import('./+types/webhooks.orders').Route} Route */
