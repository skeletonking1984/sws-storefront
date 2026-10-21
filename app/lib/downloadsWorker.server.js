/**
 * Server-only client for the sws-downloads Worker (a separate service).
 *
 * Two kinds of call live behind one module:
 *
 *   * Token calls (`/api/entitlement/:token`, `/api/sign`) need no caller
 *     auth. The order-status token in the URL IS the capability, the same
 *     token Shopify puts in order_status_url, and only the buyer has it.
 *
 *   * Customer calls (`/api/customer/downloads`, `/api/customer/sign`) have
 *     no capability in the request. They simply assert "this is who is
 *     logged in", so the CALLER has to be proven to be us, or anyone could
 *     enumerate customer ids and harvest the catalogue. Those go out with
 *     a bearer secret AND a timestamped HMAC over the exact body, matching
 *     src/lib/serviceAuth.js in the Worker.
 *
 * Reuses the existing PRIVATE_DOWNLOADS_SERVICE_SECRET (already shared with
 * the Worker as DL_SERVICE_SECRET for the order-token lookup), so there is
 * no new secret to provision and no new deploy step.
 *
 * `.server.js` so none of this, and nothing it reads out of context.env,
 * can be pulled into a browser bundle.
 */

// If the Worker hangs (not down, just slow), don't ride Oxygen's platform
// timeout -- fail fast and let the route show its own fallback.
export const WORKER_FETCH_TIMEOUT_MS = 6000;

function toHex(buffer) {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * HMAC-SHA256 over "<timestamp>.<body>", hex. Must stay byte-identical to
 * signServiceRequest() in the Worker's src/lib/serviceAuth.js.
 */
async function signBody(secret, rawBody, timestamp) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  return toHex(sig);
}

export function downloadsConfig(context) {
  return {
    url: context?.env?.SWS_DOWNLOADS_URL ?? null,
    secret: context?.env?.PRIVATE_DOWNLOADS_SERVICE_SECRET ?? null,
  };
}

/**
 * One authenticated service POST. Returns the parsed body, or null on any
 * failure -- every caller here renders a working fallback rather than an
 * error page, because a Worker blip must not take the account area down.
 */
async function servicePost(context, path, payload) {
  const {url, secret} = downloadsConfig(context);
  if (!url || !secret) return null;

  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  let signature;
  try {
    signature = await signBody(secret, rawBody, timestamp);
  } catch (err) {
    console.error(`sws-downloads ${path}: could not sign request:`, err);
    return null;
  }

  try {
    const res = await fetch(`${url}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
        'X-SWS-Timestamp': timestamp,
        'X-SWS-Signature': signature,
      },
      body: rawBody,
      signal: AbortSignal.timeout(WORKER_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      // Deliberately logs the status and the Worker's own error code, never
      // the request body: that body carries the customer's email.
      const reason = await res.json().catch(() => ({}));
      console.error(
        `sws-downloads ${path} ${res.status}:`,
        reason?.error ?? '(no error field)',
      );
      return {ok: false, status: res.status, error: reason?.error ?? null};
    }
    return {ok: true, status: res.status, data: await res.json()};
  } catch (err) {
    console.error(`sws-downloads ${path} fetch failed:`, err);
    return null;
  }
}

/**
 * Every file one customer owns, across every order, newest order first.
 * Shape: [{entitlement_id, order_name, ordered_at, products: [{title, files: [...]}]}]
 *
 * Returns {orders} on success, or {orders: [], unavailable: true} when the
 * Worker could not be reached or is not configured, so the page can say
 * something honest instead of claiming the buyer owns nothing.
 */
export async function fetchCustomerDownloads(context, {customerId, email}) {
  const result = await servicePost(context, '/api/customer/downloads', {
    customer_id: customerId ?? null,
    email: email ?? null,
  });
  if (!result?.ok) return {orders: [], unavailable: true};
  return {orders: result.data?.orders ?? [], unavailable: false};
}

/**
 * A fresh, short-lived signed URL for one file of one order, after the
 * Worker re-checks from D1 that this customer really owns it.
 */
export async function signCustomerFile(
  context,
  {customerId, email, entitlementId, fileId},
) {
  const result = await servicePost(context, '/api/customer/sign', {
    customer_id: customerId ?? null,
    email: email ?? null,
    entitlement_id: entitlementId,
    file_id: fileId,
  });
  if (!result?.ok) {
    return {
      url: null,
      error: result?.error ?? 'unavailable',
      status: result?.status ?? 503,
    };
  }
  return {url: result.data?.url ?? null, error: null, status: 200};
}

/**
 * The token page's data. Public endpoint -- the token is the capability --
 * so no signing, no secret, and it works for a logged-out buyer clicking
 * from their order email.
 */
export async function fetchTokenEntitlement(context, token) {
  const {url} = downloadsConfig(context);
  if (!url) return {status: 'unconfigured'};
  try {
    const res = await fetch(
      `${url}/api/entitlement/${encodeURIComponent(token)}`,
      {
        headers: {'Cache-Control': 'no-cache'},
        signal: AbortSignal.timeout(WORKER_FETCH_TIMEOUT_MS),
      },
    );
    return await res.json();
  } catch (err) {
    console.error('sws-downloads /api/entitlement fetch failed:', err);
    return {status: 'error'};
  }
}

/** The Shopify numeric customer id out of a gid. */
export function numericCustomerId(gid) {
  if (!gid) return null;
  const tail = String(gid).split('/').pop();
  const n = Number(tail);
  return Number.isFinite(n) ? n : null;
}
