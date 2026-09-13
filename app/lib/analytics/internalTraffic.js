/**
 * Detects internal/QA traffic (agent-driven browser sessions, automated
 * checks, Todd's own manual testing) so it can be TAGGED, not dropped.
 *
 * The distinction matters: dropping these events would make it impossible
 * to ever verify tracking works in a real browser, which is exactly how
 * the double-count bug and the /api/e relay were both proven out (see
 * docs/conversion-tracking.md). Tagging keeps every event flowing and
 * visible, and lets Todd exclude them later with one GA4 Data Filter (see
 * docs/analytics-setup.md, "Excluding internal and QA traffic").
 *
 * Browser-safe only, no server imports: this runs from
 * app/components/pixels/PixelBus.jsx, which mounts client side only.
 *
 * Three signals, any one of which marks a session internal:
 * - `navigator.webdriver === true`, set by every CDP-driven browser
 *   (Puppeteer, Playwright, raw DevTools Protocol scripts).
 * - `navigator.userAgent` containing `Claude/`, the in-app browser used by
 *   Claude Code / agent sessions driving this site. Verified 2026-09-13:
 *   this browser's real UA is
 *   `Mozilla/5.0 (Macintosh; ...) AppleWebKit/537.36 (KHTML, like Gecko)
 *   Claude/1.52386.3 Chrome/152.0.797`, and its `navigator.webdriver` is
 *   FALSE, so the webdriver check alone misses it entirely. The UA check
 *   is the one signal that actually catches this browser, it is not a
 *   belt-and-suspenders extra.
 * - The `sws_qa` cookie set to `1`, Todd's own manual override for testing
 *   on his own devices, see `markInternalTrafficFromUrl` below.
 *
 * Must never throw. Wrongly tagging real traffic as internal would
 * silently delete real conversions from every report that filters on this,
 * which is worse than missing a QA event, so any failure here returns
 * false rather than risk a false positive from a half-read global.
 */

export const INTERNAL_TRAFFIC_COOKIE = 'sws_qa';

/**
 * @returns {boolean}
 */
export function isInternalTraffic() {
  try {
    if (typeof navigator === 'undefined') return false;

    if (navigator.webdriver === true) return true;

    if (
      typeof navigator.userAgent === 'string' &&
      navigator.userAgent.includes('Claude/')
    ) {
      return true;
    }

    if (readCookie(INTERNAL_TRAFFIC_COOKIE) === '1') return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Todd's manual switch for testing on his own devices, since neither
 * automated signal above fires for a human clicking around in a normal
 * browser. Visiting `?sws_qa=1` writes the cookie for this browser,
 * `?sws_qa=0` clears it. See docs/analytics-setup.md for the exact URLs.
 *
 * Called once from PixelBus.jsx on mount, before anything else, so the
 * opt-in takes effect on the same request that carries it.
 */
export function markInternalTrafficFromUrl() {
  try {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    if (!params.has('sws_qa')) return;

    const isSecure = window.location.protocol === 'https:';
    const secureAttr = isSecure ? '; Secure' : '';

    if (params.get('sws_qa') === '1') {
      // 2 years, matching the app-owned sws_cid cookie's lifetime, see
      // app/lib/firstPartyId.server.js.
      document.cookie = `${INTERNAL_TRAFFIC_COOKIE}=1; Path=/; Max-Age=63072000; SameSite=Lax${secureAttr}`;
    } else if (params.get('sws_qa') === '0') {
      document.cookie = `${INTERNAL_TRAFFIC_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secureAttr}`;
    }
  } catch {
    // Never let a malformed URL or a blocked document.cookie write throw
    // into the caller, this is a convenience switch, not a load-bearing path.
  }
}

/**
 * Reads a single cookie value out of `document.cookie`. Same defensive,
 * dot-free style as app/lib/gaCookie.server.js's `readCookie`, just
 * against the browser's cookie jar instead of a request header.
 * @param {string} name
 * @returns {string | undefined}
 */
function readCookie(name) {
  if (typeof document === 'undefined') return undefined;
  const cookieHeader = document.cookie;
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;

    const key = part.slice(0, eq).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }

  return undefined;
}
