/**
 * Per-email and per-IP send cooldown for the free-chat-widget confirm email
 *. Turnstile is the real bot gate; this stops a script that
 * clears Turnstile once from then hammering one address, or fanning out
 * across many addresses from one IP.
 *
 * SERVER ONLY. Built on the Workers Cache API, the same mechanism
 * server.js already uses for Hydrogen's own cache (`caches.open('hydrogen')`
 * in app/lib/context.js), but a separate named cache so an unrelated
 * eviction policy never touches these entries.
 *
 * Best effort only: Cloudflare's Cache API is per-colo, not global, so a
 * second request landing on a different colo inside the window is not
 * caught. That is an accepted gap, not a bug -- a real global limiter would
 * need Durable Objects or KV, and Turnstile is the layer actually meant to
 * stop a determined script.
 *
 * Keys are SHA-256 hashes of the normalized email / IP. The Cache API keys
 * on a Request/URL, so the hash goes in the path -- the raw address or IP
 * never appears in a cache key.
 */

export const THROTTLE_CACHE_NAME = 'free-chat-throttle';
const EMAIL_WINDOW_SECONDS = 10 * 60;
const IP_WINDOW_SECONDS = 10 * 60;
const IP_MAX_PER_WINDOW = 5;

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function keyUrl(kind, hash) {
  return `https://free-chat-throttle.internal/${kind}/${hash}`;
}

/**
 * @param {{match: Function}} cache a Cache instance, or anything shaped like one
 * @param {string} normalizedEmail lowercased, trimmed
 * @returns {Promise<boolean>} true when this address already got a confirm mail this window
 */
export async function isEmailThrottled(cache, normalizedEmail) {
  const hit = await cache.match(
    keyUrl('email', await sha256Hex(normalizedEmail)),
  );
  return Boolean(hit);
}

/**
 * Call only after a confirm email actually sends. Marking on attempt
 * instead would lock out a real send that failed on a transient error.
 * @param {{put: Function}} cache
 * @param {string} normalizedEmail
 */
export async function markEmailSent(cache, normalizedEmail) {
  await cache.put(
    keyUrl('email', await sha256Hex(normalizedEmail)),
    new Response('1', {
      headers: {'Cache-Control': `max-age=${EMAIL_WINDOW_SECONDS}`},
    }),
  );
}

/**
 * @param {{match: Function}} cache
 * @param {string} ip
 * @returns {Promise<boolean>} true when this IP already hit IP_MAX_PER_WINDOW sends this window
 */
export async function isIpThrottled(cache, ip) {
  const hit = await cache.match(keyUrl('ip', await sha256Hex(ip)));
  if (!hit) return false;
  const count = Number(await hit.text());
  return count >= IP_MAX_PER_WINDOW;
}

/**
 * Call only after a confirm email actually sends, same reasoning as
 * markEmailSent. Rolling count within the window, capped, never reset
 * early: a full cache write per send is the cost of the counter being
 * accurate for the window it is in.
 * @param {{match: Function, put: Function}} cache
 * @param {string} ip
 */
export async function recordIpSend(cache, ip) {
  const key = keyUrl('ip', await sha256Hex(ip));
  const hit = await cache.match(key);
  const count = hit ? Number(await hit.text()) : 0;
  await cache.put(
    key,
    new Response(String(count + 1), {
      headers: {'Cache-Control': `max-age=${IP_WINDOW_SECONDS}`},
    }),
  );
}
