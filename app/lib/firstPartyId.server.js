/**
 * First-party GA4-shaped client id this app mints and owns itself,
 * independent of gtag.js.
 *
 * app/lib/clickIds.server.js's `_ga_client_id` prefers Google's own `_ga`
 * cookie when it exists, but a content blocker that stops gtag.js from
 * ever running means `_ga` never exists, `readClickIds` returns nothing
 * for that key, and app/lib/conversions/ga4.server.js falls back to a
 * `webhook.<orderId>` client id that carries the revenue with no session
 * or campaign attached to it. Safari ITP also caps a JS-written cookie
 * (like `_ga`) at 7 days, so even an unblocked visitor loses attribution
 * on a slow-considering purchase.
 *
 * This file is the fix: a cookie this app itself sets, from server.js, on
 * every request, in the same `<random>.<seconds>` shape GA4's own
 * client_id uses, so it is indistinguishable from a gtag-minted one to
 * everything downstream (ga4.server.js just reads it as `_ga_client_id`
 * the same as it always has).
 *
 * `HttpOnly` matters here: no page JS ever reads this cookie, so a
 * content blocker (which acts on requests and on scripts, not on
 * Set-Cookie headers from the site's own first-party responses) has
 * nothing to strip, and Safari's 7-day cap on JS-written cookies does not
 * apply to a cookie JS never wrote. This is a server-set first-party
 * cookie on the storefront's own domain, not a tracker cookie from a
 * third-party host, so nothing on any blocklist has a reason to touch it.
 */

import {readCookieValue} from '~/lib/gaCookie.server';

export const FIRST_PARTY_ID_COOKIE = 'sws_cid';

// 2 years, matching the lifetime GA4's own `_ga` cookie targets when it is
// not capped by ITP. Long enough that this id almost never rotates under
// a returning visitor.
const FIRST_PARTY_ID_COOKIE_MAX_AGE_SECONDS = 63072000;

/**
 * Reads the cookie this app minted, if present and well formed. Same
 * defensive style as `parseGaClientId` in app/lib/gaCookie.server.js: any
 * value that does not match the expected shape returns undefined rather
 * than a partial or malformed id.
 *
 * @param {string | null | undefined} cookieHeader Raw `Cookie` request header.
 * @returns {string | undefined}
 */
export function readFirstPartyClientId(cookieHeader) {
  const value = readCookieValue(cookieHeader, FIRST_PARTY_ID_COOKIE);
  if (!value) return undefined;
  if (!/^\d+\.\d+$/.test(value)) return undefined;

  return value;
}

/**
 * Mints a new client id in GA4's own client_id shape: a random part and a
 * unix-seconds timestamp part, joined by a dot. Uses Web Crypto, not
 * `node:crypto` -- this runs on Oxygen (a Workers-like runtime), which has
 * no Node crypto module, only the standard `crypto.getRandomValues`.
 *
 * @returns {string}
 */
export function mintFirstPartyClientId() {
  const random = crypto.getRandomValues(new Uint32Array(1))[0];
  const seconds = Math.floor(Date.now() / 1000);
  return `${random}.${seconds}`;
}

/**
 * Ensures a first-party client id exists for this request, minting and
 * building its Set-Cookie header when one is not already present. Called
 * from server.js on every request, the same place
 * `buildFirstTouchSetCookieHeaders` runs (see app/lib/clickIds.server.js).
 *
 * Returns `setCookie: null` when a valid cookie already exists, so the
 * caller only ever appends a header when one is actually needed -- the id
 * is minted once per visitor, never reissued on every request.
 *
 * @param {Request} request
 * @returns {{value: string, setCookie: string | null}}
 */
export function ensureFirstPartyClientId(request) {
  const cookieHeader = request.headers.get('Cookie');
  const existing = readFirstPartyClientId(cookieHeader);
  if (existing) return {value: existing, setCookie: null};

  const value = mintFirstPartyClientId();
  // Secure is invalid on a plain-http local dev request; only set it when
  // the request itself came in over https (production/Oxygen always
  // does), same conditional app/lib/clickIds.server.js already uses.
  const isSecureRequest = new URL(request.url).protocol === 'https:';
  const attrs = [
    `${FIRST_PARTY_ID_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${FIRST_PARTY_ID_COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
    'HttpOnly',
  ];
  if (isSecureRequest) attrs.push('Secure');

  return {value, setCookie: attrs.join('; ')};
}
