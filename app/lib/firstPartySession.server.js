/**
 * First-party GA4-shaped SESSION this app mints and owns itself, the
 * companion to app/lib/firstPartyId.server.js.
 *
 * WHY. `sws_cid` already fixes the CLIENT id for a visitor whose gtag.js was
 * blocked. Nothing fixed the SESSION id, and a client id without one is worse
 * than it sounds. Evidence from live orders on 2026-09-16:
 *
 *   order 7  client_id + session_id      attributed correctly
 *   order 6  client_id, NO session_id
 *   order 5  client_id, NO session_id    landed on a BLANK landing page
 *   order 4  client_id + session_id      attributed correctly
 *   order 3  client_id + session_id      attributed correctly
 *   order 2  client_id, NO session_id
 *   order 1  client_id, NO session_id    landed on /checkouts/cn/... !
 *
 * Four of seven. When the Measurement Protocol receives a purchase with no
 * session_id, GA4 attaches it to whatever session is currently open for that
 * client id. That is either:
 *
 *   - the session Shopify's own checkout tag opened on
 *     the shop.<domain> checkout subdomain (brand.config.js `domain`), so
 *     the order's landing page becomes
 *     /checkouts/cn/<token>/en-us, or
 *   - no session at all, so GA4 invents one with a blank landing page.
 *
 * Either way the revenue detaches from the page that actually earned it. The
 * GA4 Landing page report then credits sales to a checkout URL or a blank row
 * instead of the real landing page. That is not a reporting
 * quirk, it is every acquisition decision being made on the wrong page.
 *
 * `_ga_<measurement id>` is gtag's cookie. If gtag never runs it never exists,
 * so there is nothing to read and nothing to repair after the fact. The only
 * fix is to own one.
 *
 * SHAPE AND SEMANTICS, matched to GA4 so downstream code cannot tell the
 * difference:
 *
 *   session_id      unix SECONDS at session start. GA4 uses exactly this.
 *   session_number  1 on a visitor's first session, incrementing after.
 *   window          30 minutes of INACTIVITY, GA4's own default. Refreshed on
 *                   every request, so an active visitor never rolls over.
 *
 * Precedence is deliberate and lives in clickIds.server.js: GA4's real cookie
 * WINS whenever it exists. This is a fallback, not a replacement. Two systems
 * both claiming to define "the session" would disagree, and the one that is
 * actually driving GA4's own reports is gtag's.
 *
 * HttpOnly, for the same reason as `sws_cid`: page JS never reads it, so a
 * content blocker has nothing to strip, and Safari's 7-day cap on
 * JS-written cookies does not apply to a cookie JS never wrote.
 */

// Relative, not the ~ alias: this module is imported both by the Vite build
// and by scripts/verify-first-party-session.mjs under plain node, and node
// cannot resolve ~.
import {readCookieValue} from './gaCookie.server.js';

export const FIRST_PARTY_SESSION_COOKIE = 'sws_ses';

/** GA4's own default: a session ends after 30 minutes of inactivity. */
export const SESSION_TIMEOUT_SECONDS = 30 * 60;

// The cookie has to outlive the session window by a wide margin, because the
// SESSION NUMBER must survive between visits. Expiring it at 30 minutes would
// reset every returning visitor to session 1 and make "new vs returning"
// permanently wrong. 2 years, same as sws_cid.
const COOKIE_MAX_AGE_SECONDS = 63072000;

/**
 * Cookie value is `<sessionId>.<sessionNumber>.<lastSeenSeconds>`.
 *
 * lastSeen is stored rather than inferred, because the 30 minute window is
 * measured from the last REQUEST, not from session start. Without it a
 * visitor browsing for 45 minutes would be cut into two sessions mid-visit,
 * which is the opposite of what GA4 does.
 *
 * @param {string | null | undefined} cookieHeader
 * @returns {{sessionId: string, sessionNumber: string, lastSeen: number} | undefined}
 */
export function readFirstPartySession(cookieHeader) {
  const value = readCookieValue(cookieHeader, FIRST_PARTY_SESSION_COOKIE);
  if (!value) return undefined;
  const parts = value.split('.');
  if (parts.length !== 3) return undefined;
  const [sessionId, sessionNumber, lastSeen] = parts;
  if (!/^\d+$/.test(sessionId)) return undefined;
  if (!/^\d+$/.test(sessionNumber)) return undefined;
  if (!/^\d+$/.test(lastSeen)) return undefined;
  return {sessionId, sessionNumber, lastSeen: Number(lastSeen)};
}

/**
 * Returns the current session, starting a new one when the previous went
 * quiet for longer than the window, and a Set-Cookie whenever anything moved.
 *
 * Returns `setCookie: null` when nothing changed, so an active visitor does
 * not get a redundant header on every single request. `lastSeen` changes on
 * essentially every request though, so in practice this refreshes often, which
 * is exactly what keeps the window sliding.
 *
 * @param {Request} request
 * @param {number} [nowSeconds] Injectable for tests. Never call Date.now()
 *   twice in one decision: a second boundary crossing mid-function could
 *   expire a session that had not expired.
 * @returns {{sessionId: string, sessionNumber: string, setCookie: string|null}}
 */
export function ensureFirstPartySession(request, nowSeconds) {
  const now = Number.isFinite(nowSeconds)
    ? Math.floor(nowSeconds)
    : Math.floor(Date.now() / 1000);

  const existing = readFirstPartySession(request.headers.get('Cookie'));

  let sessionId;
  let sessionNumber;

  if (!existing) {
    sessionId = String(now);
    sessionNumber = '1';
  } else if (now - existing.lastSeen > SESSION_TIMEOUT_SECONDS) {
    // Went quiet past the window: a NEW session for the SAME visitor, so the
    // number increments rather than resetting.
    sessionId = String(now);
    sessionNumber = String(Number(existing.sessionNumber) + 1);
  } else {
    sessionId = existing.sessionId;
    sessionNumber = existing.sessionNumber;
  }

  const unchanged =
    existing &&
    existing.sessionId === sessionId &&
    existing.sessionNumber === sessionNumber &&
    existing.lastSeen === now;

  if (unchanged) return {sessionId, sessionNumber, setCookie: null};

  const isSecureRequest = new URL(request.url).protocol === 'https:';
  const attrs = [
    `${FIRST_PARTY_SESSION_COOKIE}=${sessionId}.${sessionNumber}.${now}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
    'HttpOnly',
  ];
  if (isSecureRequest) attrs.push('Secure');

  return {sessionId, sessionNumber, setCookie: attrs.join('; ')};
}
