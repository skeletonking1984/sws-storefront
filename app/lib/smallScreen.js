/**
 * Is this request from a small (phone-class) screen?
 *
 * `Sec-CH-UA-Mobile` is the fast path: Chromium sends it on every request
 * from a phone, no opt-in, no extra round trip. But it is a Chromium-only
 * feature. WebKit has never implemented Client Hints, and iOS requires every
 * browser engine on the platform to be WebKit, Safari, Chrome for iOS,
 * Firefox for iOS, and every in-app WebKit browser (X's own in-app browser
 * included) all send NO `Sec-CH-UA-Mobile` header, ever. Treating "no hint"
 * as "not a phone" silently classified all iOS traffic as desktop.
 *
 * So: trust the hint when it is present (it is authoritative for the browser
 * that sent it, and must never be second-guessed by a UA regex). Only fall
 * back to a User-Agent check when the hint is ABSENT, and only for the exact
 * browsers that can never send it.
 *
 * @param {Request} request
 * @returns {boolean}
 */
export function isSmallScreenRequest(request) {
  const hint = request.headers.get('Sec-CH-UA-Mobile');
  if (hint !== null) return hint === '?1';
  const ua = request.headers.get('User-Agent') || '';
  return isMobileUserAgent(ua);
}

/**
 * A phone-class User-Agent, iPad excluded on purpose: an iPad's viewport is
 * closer to the desktop rendition's target size than a phone's, and iPadOS
 * Safari's UA string does not reliably say "iPad" at all (it can present as
 * a Mac), so there is no separate iPad-detection risk being traded away here.
 *
 * @param {string} ua
 * @returns {boolean}
 */
export function isMobileUserAgent(ua) {
  if (/iPad/.test(ua)) return false;
  return /iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|IEMobile|Opera Mini/.test(
    ua,
  );
}

// See `npm run verify:small-screen -- --self-test` (scripts/verify-small-screen.mjs).
