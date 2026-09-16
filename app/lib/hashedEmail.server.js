/**
 * The visitor's email, as a SHA256 hash, carried in a first-party cookie so
 * SERVER-SIDE events can be matched to a person.
 *
 * WHY. X's Conversion API accepts exactly five identifier types: twclid,
 * ip_address, user_agent, hashed_email and hashed_phone_number. Our purchase
 * path sends four of them, because a Shopify order carries the buyer's email.
 * Every pre-purchase event sent three, because a page view carries nothing,
 * and twclid only exists if the visitor arrived from an X ad (X's own
 * diagnostics reported zero click ids across 191 events). So the funnel was
 * being matched on IP and user agent alone, which is the weakest pair X takes.
 *
 * And we already knew who many of these people were. A newsletter signup hands
 * us an email address and we used it once and threw it away. A logged-in
 * customer has one on the session. That is a real identifier discarded on
 * every event before checkout.
 *
 * Unlike Meta, X publishes no readable browser-identity cookie (no equivalent
 * of _fbp/_fbc), so the pixel's own identity cannot be forwarded server side.
 * A hashed email is the strongest bridge actually available.
 *
 * WHAT IS STORED, and what is deliberately not:
 *
 *   - The SHA256 hex of the lowercased, trimmed address. NEVER the address.
 *     The plaintext never enters a cookie, a URL, a query string or a log.
 *   - HttpOnly, so page JS cannot read it back. Secure and SameSite=Lax.
 *   - 90 days, matching the click-id cookies in clickIds.server.js, so a
 *     visitor's identifiers all age out together rather than leaving one
 *     behind.
 *
 * The hash is one-way but it is still an identifier for a person, so it is
 * treated like one: same flags as a click id, same lifetime, and it is only
 * ever set from an address the visitor themselves just gave us.
 */

export const HASHED_EMAIL_COOKIE = 'sws_he';
const MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

/**
 * SHA256 hex of a normalized address. Lowercased and trimmed first, unsalted,
 * which is the normalization every ad platform specifies. A different
 * normalization produces a different hash and matches nothing, so this is the
 * single place it happens: x.server.js's purchase path hashes the ORDER email
 * the same way, and the two must agree or the same person reads as two.
 *
 * @param {string} email
 * @returns {Promise<string|null>}
 */
export async function hashEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return null;
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(normalized),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * A Set-Cookie header value carrying the hash, or null when the address is
 * unusable. Overwrites rather than first-touch-wins: unlike an ad click id,
 * where the FIRST touch owns the credit, the CURRENT identity is the correct
 * one. Someone who signs up with a second address should be matched on the
 * one they just used.
 *
 * @param {string} email
 * @returns {Promise<string|null>}
 */
export async function buildHashedEmailCookie(email) {
  const hashed = await hashEmail(email);
  if (!hashed) return null;
  return [
    `${HASHED_EMAIL_COOKIE}=${hashed}`,
    'Path=/',
    `Max-Age=${MAX_AGE_SECONDS}`,
    'SameSite=Lax',
    'Secure',
    'HttpOnly',
  ].join('; ');
}

/**
 * Reads the hash back off a request. Validated as 64 hex characters, never
 * echoed through as-is: this value is attached to an outbound ad-platform
 * payload, and anything that is not a SHA256 hex digest did not come from
 * buildHashedEmailCookie and has no business being sent.
 *
 * @param {Request} request
 * @returns {string|null}
 */
export function readHashedEmail(request) {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name !== HASHED_EMAIL_COOKIE) continue;
    const value = rest.join('=').trim();
    return /^[0-9a-f]{64}$/.test(value) ? value : null;
  }
  return null;
}
