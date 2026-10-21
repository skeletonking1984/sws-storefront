/**
 * Is a phone correctly detected as a phone when it never sends a Client Hint?
 *
 * Why, 2026-09-27. `app/lib/smallScreen.js` decides which video rendition a
 * PDP request gets. Until this fix it trusted `Sec-CH-UA-Mobile` alone and
 * treated its absence as "desktop". That header is Chromium-only: WebKit has
 * never implemented Client Hints, and iOS forces every browser engine on the
 * platform to be WebKit, so Safari, Chrome for iOS, Firefox for iOS, and
 * every in-app WebKit browser (X's own in-app browser included) all sent no
 * hint and were served the same 1080p/2.5Mbps rendition as a real desktop
 * visitor. Measured live 2026-09-27 with a "Twitter for iPhone" WKWebView
 * UA on a throttled connection: the 4.46MB 1080p file alone pushed the Add
 * to cart button's ready-to-tap time to ~12.5s.
 *
 * This script proves the fallback discriminates correctly rather than just
 * asserting it: it fails on the OLD behaviour (hint present wins is fine,
 * but hint absent must not silently mean desktop for a phone-shaped UA).
 *
 * Usage: node scripts/verify-small-screen.mjs --self-test
 */

import {isSmallScreenRequest} from '../app/lib/smallScreen.js';

const req = (headers) => new Request('https://x/products/y', {headers});

const X_IN_APP_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone';
const SAFARI_IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_SAFARI_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const DESKTOP_CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const cases = [
  [
    'X in-app browser on iOS: no hint, UA fallback fires',
    req({'User-Agent': X_IN_APP_IOS_UA}),
    true,
  ],
  [
    'plain Safari on iOS: no hint, UA fallback fires',
    req({'User-Agent': SAFARI_IOS_UA}),
    true,
  ],
  [
    'iPad Safari: no hint, excluded from the fallback on purpose (iPad gets the desktop rendition, same as before this fix)',
    req({'User-Agent': IPAD_SAFARI_UA}),
    false,
  ],
  [
    'Android Chrome: hint present and true, fallback never consulted',
    req({'User-Agent': ANDROID_CHROME_UA, 'Sec-CH-UA-Mobile': '?1'}),
    true,
  ],
  [
    'Desktop Chrome: hint present and false',
    req({'User-Agent': DESKTOP_CHROME_UA, 'Sec-CH-UA-Mobile': '?0'}),
    false,
  ],
  [
    // The case that would break if the hint were ever ignored in favour of
    // the UA: a phone UA string that explicitly says ?0 must not be
    // overridden by the fallback. The hint, when present, is authoritative.
    'explicit Sec-CH-UA-Mobile: ?0 wins over a phone-looking UA',
    req({'User-Agent': ANDROID_CHROME_UA, 'Sec-CH-UA-Mobile': '?0'}),
    false,
  ],
  [
    'no hint, no recognizable mobile UA at all: falls through to desktop',
    req({'User-Agent': 'curl/8.0'}),
    false,
  ],
];

function selfTest() {
  let failed = 0;
  for (const [name, request, expected] of cases) {
    const got = isSmallScreenRequest(request);
    const ok = got === expected;
    if (!ok) failed++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}${ok ? '' : `: expected ${expected}, got ${got}`}`);
  }
  console.log(`\n${cases.length - failed}/${cases.length} self-test cases passed`);
  return failed === 0;
}

if (process.argv.includes('--self-test')) {
  process.exit(selfTest() ? 0 : 1);
} else {
  console.log('Usage: node scripts/verify-small-screen.mjs --self-test');
  process.exit(1);
}
