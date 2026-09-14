/**
 * Canonical registry of ad-platform click ids this storefront captures.
 *
 * A click id arrives once, on the landing URL (`?twclid=...`), but the cart
 * that eventually becomes an order is often created several pages later,
 * with no click id in sight. This file is the single place that knows,
 * for every platform, which URL param to look for, which first-party
 * cookie carries it once captured, and which cart attribute key carries it
 * from cart to order.
 *
 * CAPTURE EVERYTHING HERE NOW, even for platforms with no send wired up
 * yet (see app/lib/conversions/ for who actually sends). A click id that
 * was not captured on the landing request cannot be recovered later --
 * there is no "go back and get it" once that request is gone. Sending a
 * captured id to a new ad platform is a small, obvious addition (a new
 * app/lib/conversions/<platform>.server.js). Capturing a NEW id retroactively
 * is not possible. Capture is nearly free; do it for everything plausible.
 *
 * GA4 is the one entry with no query param: Google's own `_ga` cookie
 * already carries the client id (written by gtag.js on the storefront),
 * so the first choice is to read it, not capture it. But `_ga` only
 * exists when gtag.js actually ran, and a content blocker that stops
 * gtag.js stops `_ga` from ever being set. For that case this app does
 * own a fallback: a first-party `sws_cid` cookie it mints and sets itself
 * (see app/lib/firstPartyId.server.js), in GA4's own client_id shape, so
 * a blocked visitor's purchase still joins a session instead of arriving
 * as a bare, unattributed order. See app/lib/gaCookie.server.js for the
 * `_ga` parser and app/lib/firstPartyId.server.js for the fallback.
 */

import {parseGaClientId, parseGaSession, readCookieValue} from '~/lib/gaCookie.server';
import {readFirstPartyClientId} from '~/lib/firstPartyId.server';

// SameSite=Lax (not None) because these cookies only ever need to be read
// on first-party requests to this storefront, never cross-site. ~90 days:
// long enough to cover a slow-considering buyer, short enough that stale
// attribution ages out on its own.
const FIRST_TOUCH_COOKIE_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

/**
 * @typedef {object} ClickIdEntry
 * @property {string} attributeKey Cart attribute key this id is carried in
 *   (and, on the order, the note_attributes name the purchase webhook reads).
 * @property {string | null} param URL query param this id arrives on, or
 *   null for an id this app never sets a cookie for itself (GA4).
 * @property {string} cookie First-party cookie name storing the captured
 *   value. For GA4 this is `_ga` itself, a cookie gtag.js owns, not one
 *   this app writes -- though GA4 also has a second, app-owned fallback
 *   cookie (`sws_cid`) not represented in this field, see `readClickIds`.
 * @property {string} platform Human label, for the docs table / comments.
 * @property {boolean} ownedCookie Whether this app is responsible for
 *   setting the cookie (false for GA4's `_ga`, whose cookie gtag.js
 *   writes; GA4's own `sws_cid` fallback cookie is app-owned, but that is
 *   handled outside this registry, see app/lib/firstPartyId.server.js).
 */

/** @type {ClickIdEntry[]} */
export const CLICK_ID_REGISTRY = [
  {
    attributeKey: '_ga_client_id',
    param: null,
    cookie: '_ga',
    platform: 'GA4',
    ownedCookie: false,
  },
  {
    attributeKey: '_twclid',
    param: 'twclid',
    cookie: 'sws_twclid',
    platform: 'X',
    ownedCookie: true,
  },
  {
    attributeKey: '_fbclid',
    param: 'fbclid',
    cookie: 'sws_fbclid',
    platform: 'Meta',
    ownedCookie: true,
  },
  {
    attributeKey: '_gclid',
    param: 'gclid',
    cookie: 'sws_gclid',
    platform: 'Google Ads',
    ownedCookie: true,
  },
  {
    attributeKey: '_ttclid',
    param: 'ttclid',
    cookie: 'sws_ttclid',
    platform: 'TikTok',
    ownedCookie: true,
  },
  {
    attributeKey: '_msclkid',
    param: 'msclkid',
    cookie: 'sws_msclkid',
    platform: 'Microsoft',
    ownedCookie: true,
  },
  {
    attributeKey: '_epik',
    param: 'epik',
    cookie: 'sws_epik',
    platform: 'Pinterest',
    ownedCookie: true,
  },
];

/**
 * Reads every click id present on a Request right now and returns them
 * keyed by cart attribute key, ready to hand to `cart.updateAttributes()`.
 *
 * For each registry entry, prefers a fresh URL query param (the exact
 * landing request) and falls back to the first-party cookie set on an
 * earlier request. GA4 has no query param at all: its value always comes
 * from parsing the `_ga` cookie via `parseGaClientId`.
 *
 * Only present, non-empty values are included in the returned object, so
 * callers can safely spread the result without checking each key.
 *
 * `_ga_client_id` prefers Google's own `_ga` cookie over this app's
 * `sws_cid` fallback, deliberately: when gtag.js did run, `_ga` is GA4's
 * own idea of the session, and staying on it keeps a purchase joined to
 * whatever GA4 already knows about that visitor. `sws_cid` only ever
 * fills in when `_ga` is missing (blocked, or aged out under Safari's
 * 7-day cap on JS-written cookies) -- see app/lib/firstPartyId.server.js.
 *
 * `_ga_session_id` and `_ga_session_number` (GA4's current session, see
 * `parseGaSession` in app/lib/gaCookie.server.js) are read the same way,
 * but are deliberately NOT a `CLICK_ID_REGISTRY` entry -- see that
 * function's own comment below for why.
 *
 * @param {Request} request
 * @param {Record<string, string | undefined> | string} [measurementIdOrEnv]
 *   Either the GA4 measurement id directly, or an env object carrying
 *   `PUBLIC_GA4_MEASUREMENT_ID`. Optional, so the one existing caller
 *   (app/routes/cart.jsx) keeps working with no change until it opts in.
 *   Passed as an argument rather than importing env into this module
 *   directly, so this file's only GA4-specific dependency stays the same
 *   parser it already had.
 * @returns {Record<string, string>}
 */
export function readClickIds(request, measurementIdOrEnv) {
  const url = new URL(request.url);
  const cookieHeader = request.headers.get('Cookie');
  /** @type {Record<string, string>} */
  const found = {};

  for (const entry of CLICK_ID_REGISTRY) {
    if (entry.attributeKey === '_ga_client_id') {
      const clientId = parseGaClientId(cookieHeader) || readFirstPartyClientId(cookieHeader);
      if (clientId) found[entry.attributeKey] = clientId;
      continue;
    }

    const fromParam = entry.param ? url.searchParams.get(entry.param) : null;
    const fromCookie = readCookieValue(cookieHeader, entry.cookie);
    const value = fromParam || fromCookie;
    if (value) found[entry.attributeKey] = value;
  }

  // GA4 session id/number. Deliberately handled outside the registry loop
  // above, not as a CLICK_ID_REGISTRY entry: that registry exists to drive
  // `buildFirstTouchSetCookieHeaders`, whose whole point is first-touch-wins
  // (never overwrite a captured value, so a later ad click cannot steal
  // credit from the campaign that brought the visitor the first time). That
  // is correct for an ad click id and wrong for a session id -- a purchase
  // has to join the buyer's CURRENT session, not whichever session happened
  // to be running the first time this app ever looked. Getting that wrong
  // would pin every purchase from a returning visitor's cart to their very
  // first-ever session. Reading it here, straight off GA4's own live
  // session cookie on every call (this app never sets or owns this
  // cookie), is what keeps it current.
  const measurementId =
    typeof measurementIdOrEnv === 'string'
      ? measurementIdOrEnv
      : measurementIdOrEnv?.PUBLIC_GA4_MEASUREMENT_ID;
  const session = parseGaSession(cookieHeader, measurementId);
  if (session) {
    found._ga_session_id = session.sessionId;
    found._ga_session_number = session.sessionNumber;
  }

  // Internal traffic, carried on the cart so the SERVER SIDE purchase can
  // be tagged too. app/lib/analytics/internalTraffic.js tags browser
  // events, but the orders/create webhook never runs in a browser, so a
  // test order still reached GA4 as real revenue. That is how Todd's own
  // $0 test orders were about to pollute the numbers right as ads start.
  //
  // Detected from the request, not from JavaScript: the `sws_qa` cookie
  // set by visiting ?sws_qa=1, or an automated browser's own user agent.
  // `navigator.webdriver` has no server side equivalent, so the cookie is
  // the reliable switch for a human tester.
  const userAgent = request.headers.get('User-Agent') || '';
  const isInternal =
    readCookieValue(cookieHeader, 'sws_qa') === '1' ||
    userAgent.includes('Claude/') ||
    /HeadlessChrome|Puppeteer|Playwright/i.test(userAgent);
  if (isInternal) found._traffic_type = 'internal';

  return found;
}

/**
 * Builds the `Set-Cookie` header strings needed to persist first-touch
 * click ids seen on this request, for every platform this app owns a
 * cookie for (everything except GA4).
 *
 * First touch wins: a cookie is only ever set here when the registry's
 * query param is present on the URL AND no cookie for that id already
 * exists on the request. An existing value is never overwritten, so a
 * later ad click landing on an already-attributed visitor does not steal
 * credit from whichever campaign brought them the first time.
 *
 * Callers append (never `.set()`) these onto the outgoing response so an
 * unrelated `Set-Cookie` already on the response (e.g. the session cookie
 * in server.js) is not clobbered.
 *
 * @param {Request} request
 * @returns {string[]}
 */
export function buildFirstTouchSetCookieHeaders(request) {
  const url = new URL(request.url);
  const cookieHeader = request.headers.get('Cookie');
  const isSecureRequest = url.protocol === 'https:';
  /** @type {string[]} */
  const headers = [];

  for (const entry of CLICK_ID_REGISTRY) {
    if (!entry.ownedCookie || !entry.param) continue;

    const paramValue = url.searchParams.get(entry.param);
    if (!paramValue) continue;

    const alreadySet = readCookieValue(cookieHeader, entry.cookie);
    if (alreadySet) continue; // first touch wins, never overwrite

    const attrs = [
      `${entry.cookie}=${encodeURIComponent(paramValue)}`,
      'Path=/',
      `Max-Age=${FIRST_TOUCH_COOKIE_MAX_AGE_SECONDS}`,
      'SameSite=Lax',
    ];
    // Secure is invalid on a plain-http local dev request; only set it when
    // the request itself came in over https (production/Oxygen always does).
    if (isSecureRequest) attrs.push('Secure');

    headers.push(attrs.join('; '));
  }

  return headers;
}

export {parseGaClientId};
