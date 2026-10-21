/**
 * One-time-use enforcement for the free-chat-widget confirm link.
 *
 * The signed token itself (freeChatConfirm.server.js) stays valid for its
 * full 48h TTL by design, that is what lets the mailed link keep working.
 * What has to become one-time is USING it: recording marketing consent and
 * minting a widget token. Before this, GET alone did both, so a mail
 * scanner or a forwarded link opted a stranger in and could re-mint a
 * widget token days after the real confirm.
 *
 * SERVER ONLY. Same Workers Cache API pattern as freeChatThrottle.server.js,
 * a separate named cache, keyed on the SHA-256 hash of the token string so
 * the raw token never sits in a cache key. Same per-colo caveat: best
 * effort, not a hard global guarantee.
 */

const CACHE_NAME = 'free-chat-confirm-used';

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function keyUrl(hash) {
  return `https://free-chat-confirm-used.internal/token/${hash}`;
}

/**
 * @param {string} token
 * @returns {Promise<null | {widgetToken: string|null}>} null when unused.
 *   A used record carries the widget token minted at confirm, so reopening
 *   the link (a refresh, the email clicked again) shows the same setup page
 *   instead of a dead end. Records written before 2026-09-27 hold '1' and
 *   come back with widgetToken null.
 */
export async function getUsedRecord(token) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(keyUrl(await sha256Hex(token)));
  if (!hit) return null;
  try {
    const body = await hit.json();
    return {
      widgetToken:
        typeof body?.widgetToken === 'string' ? body.widgetToken : null,
    };
  } catch {
    return {widgetToken: null};
  }
}

/**
 * @param {string} token
 * @returns {Promise<boolean>}
 */
export async function isTokenUsed(token) {
  return (await getUsedRecord(token)) !== null;
}

/**
 * @param {string} token
 * @param {number} remainingMs milliseconds left before the token's own 48h
 *   expiry -- no reason to remember a "used" mark past the point the token
 *   would have stopped verifying anyway.
 * @param {string|null} [widgetToken] the widget token minted at confirm.
 */
export async function markTokenUsed(token, remainingMs, widgetToken = null) {
  const cache = await caches.open(CACHE_NAME);
  const seconds = Math.max(1, Math.ceil(remainingMs / 1000));
  await cache.put(
    keyUrl(await sha256Hex(token)),
    new Response(JSON.stringify({widgetToken}), {
      headers: {
        'Cache-Control': `max-age=${seconds}`,
        'Content-Type': 'application/json',
      },
    }),
  );
}
