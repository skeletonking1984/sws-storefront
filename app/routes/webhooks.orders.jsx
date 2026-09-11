/**
 * Server-side purchase tracking, independent of any browser pixel.
 *
 * Shop Pay (shop.app checkout) is documented to not reliably fire
 * `checkout_completed` for guest/Shop Pay fast-path checkouts, and even
 * when it does fire, the Admin custom pixel described in
 * docs/checkout-purchase-pixel.md can lose attribution if the buyer ends up
 * on a host that cannot see the storefront's `_ga` cookie. This route
 * receives Shopify's `orders/create` webhook and sends a GA4 Measurement
 * Protocol `purchase` event directly, so revenue lands in GA4 regardless of
 * what happened in the browser.
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

const GA4_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
// Same hard ceiling app/lib/notify.server.js uses on its own outbound
// fetches: a slow third party must never hang this handler, and Shopify
// must always get its 200 quickly regardless of how GA4 is behaving.
const SEND_TIMEOUT_MS = 8000;

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

  const measurementId = context.env?.PUBLIC_GA4_MEASUREMENT_ID;
  const apiSecret = context.env?.PRIVATE_GA4_API_SECRET;
  if (!measurementId || !apiSecret) {
    // GA4 not configured. Ack the webhook, send nothing.
    return new Response('OK', {status: 200});
  }

  const orderId = String(order.id);
  const noteAttributes = Array.isArray(order.note_attributes)
    ? order.note_attributes
    : [];
  const relayedClientId = noteAttributes.find(
    (attr) => attr && attr.name === '_ga_client_id',
  )?.value;

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
          // Same field the Admin custom pixel uses (see
          // docs/checkout-purchase-pixel.md), so if both ever run at once
          // the two hits at least collide on this for manual cleanup.
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

  let sendOk = false;
  try {
    const response = await fetch(
      `${GA4_ENDPOINT}?measurement_id=${encodeURIComponent(
        measurementId,
      )}&api_secret=${encodeURIComponent(apiSecret)}`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      },
    );
    sendOk = response.ok;
  } catch {
    sendOk = false;
  }

  // Never log the order body, customer data, or the API secret. Order id
  // and a success boolean is enough to debug delivery.
  console.error(`webhooks.orders: order ${orderId} GA4 send ${sendOk ? 'ok' : 'failed'}`);

  // Always 200 on a verified receive, even when the GA4 send itself
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
