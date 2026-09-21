/**
 * Is the product page still a product page, on a phone and on a desktop?
 *
 * Why, 2026-09-21. The mobile conversion work moved the price above the name
 * on small screens, replaced the h1 text, and made the video rendition depend
 * on the `Sec-CH-UA-Mobile` request header. Todd, on being handed it: "look
 * checkout changes are risky, we need to be careful here."
 *
 * Nothing in that change touches the cart, the variant, the checkout or the
 * analytics payload. This script is what proves that on the real deployed
 * site rather than asserting it: alongside the four things that DID change it
 * asserts the things that must NOT have, because a layout change that quietly
 * drops the variant id from the add-to-cart form looks perfect in a
 * screenshot and cannot be bought.
 *
 * It reads served HTML only. It never adds to a cart and never starts a
 * checkout, so it is safe to run against production as often as you like.
 * The one thing it cannot prove is that money moves; that needs a real order
 * (see LAUNCH.md).
 *
 * Usage:
 *   node scripts/smoke-pdp-mobile.mjs                        # production
 *   node scripts/smoke-pdp-mobile.mjs --origin http://localhost:3111
 *   node scripts/smoke-pdp-mobile.mjs --handles a,b,c
 *   node scripts/smoke-pdp-mobile.mjs --self-test
 *
 * Exits 1 on any failure, so it can gate a deploy.
 */

const DEFAULT_ORIGIN = 'https://streamwidgetshop.com';

/**
 * The products checked by default: the three highest-revenue widgets plus the
 * premium anchor, because a break in those costs the most, and one product
 * with NO video so the video assertions have to be conditional rather than
 * assumed.
 */
const DEFAULT_HANDLES = [
  'celestial-stream-kit',
  'multistream-chat-widget-twitch-youtube-kick-overlay-digital-download-easy-setup-one-click-installation',
  'animated-star-goal-widget-for-twitch-kick-obs-celestial-stream-overlay-digital-download',
  'demon-samurai-stream-overlay-pack-animated-katana-goal-bar-multistream-chat-alerts-digital-download',
];

/** Chrome sends this on every request from a phone, no opt-in needed. */
const MOBILE_HEADERS = {
  'Sec-CH-UA-Mobile': '?1',
  'Sec-CH-UA-Platform': '"Android"',
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
};

const DESKTOP_HEADERS = {
  'Sec-CH-UA-Mobile': '?0',
  'Sec-CH-UA-Platform': '"macOS"',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
};

/* -------------------------------------------------------------------- *
 * The pure half. Everything below takes HTML and returns findings, so
 * the rules can be tested without a network.
 * -------------------------------------------------------------------- */

/**
 * The `<source src>` list of the first `<video>`, in document order. That
 * order IS the behaviour: a browser plays the first source it can decode.
 * @param {string} html
 * @returns {string[]}
 */
export function videoSourceOrder(html) {
  const video = html.match(/<video[\s\S]*?<\/video>/i);
  if (!video) return [];
  return [...video[0].matchAll(/<source[^>]+src="([^"]+)"/gi)].map((m) =>
    m[1].split('/').pop(),
  );
}

/** @param {string} filename */
export function renditionHeight(filename) {
  const m = filename.match(/(\d+)p-/);
  return m ? Number(m[1]) : null;
}

/**
 * @param {string} html
 * @returns {{h1: string|null, fullTitle: string|null}}
 */
export function headings(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const full = html.match(
    /<p[^>]*class="[^"]*product-title-full[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
  );
  const strip = (s) =>
    s
      ? s
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&#x27;|&#39;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, ' ')
          .trim()
      : null;
  return {h1: strip(h1?.[1]), fullTitle: strip(full?.[1])};
}

/**
 * Every rule, applied to one product's two responses.
 *
 * `mobile` and `desktop` are the served HTML for the same URL under the two
 * header sets. Returns a list of findings; empty means the page is fine.
 *
 * @param {{handle: string, mobile: string, desktop: string, status: number}} input
 */
export function checkProduct({handle, mobile, desktop, status}) {
  const findings = [];
  const fail = (what) => findings.push({handle, severity: 'fail', what});
  const warn = (what) => findings.push({handle, severity: 'warn', what});

  if (status !== 200) {
    fail(`responded ${status}, not 200`);
    return findings;
  }

  /* ---- the things that must NOT have changed ---- */

  // A page nobody can buy from is the expensive failure, and it is invisible
  // in a screenshot: the button renders whether or not the form behind it
  // carries a variant.
  //
  // The variant does NOT travel as its own `name="merchandiseId"` input.
  // Hydrogen's CartForm serialises the whole action into one hidden
  // `cartFormInput` field as HTML-escaped JSON, so the merchandise id sits
  // inside `&quot;merchandiseId&quot;:&quot;gid://...&quot;`. The first
  // version of this check looked for the input and reported all four live
  // products as unbuyable, which they are not. Checked against the served
  // HTML on 2026-09-21 before being written this way.
  const cartInput = /name="cartFormInput"/.test(mobile);
  if (!cartInput) fail('no cartFormInput field: the cart form carries no action');
  if (
    cartInput &&
    !/merchandiseId(&quot;|"):?(&quot;|")?gid:\/\/shopify\/ProductVariant\/\d+/.test(
      mobile,
    )
  ) {
    fail('cartFormInput carries no ProductVariant gid');
  }
  // Independent of the merchandiseId check above, on purpose: these two must
  // be able to fail separately, or a page that lost the whole form reports
  // one defect twice and a page that kept the form but lost the variant
  // looks identical to it.
  if (!/<form[^>]+method="post"[^>]+action="\/cart"/i.test(mobile)) {
    fail('no POST form to /cart on the page');
  }
  if (!/Add to cart/i.test(mobile)) fail('no "Add to cart" control');
  if (!/gid:\/\/shopify\/ProductVariant\/\d+/.test(mobile)) {
    fail('no product variant gid in the page');
  }

  // The price has to be IN the document, not merely somewhere on the screen.
  const priceOnMobile = /class="[^"]*product-price/.test(mobile);
  if (!priceOnMobile) fail('no .product-price block');
  if (!/\$\d/.test(mobile)) fail('no price amount rendered');

  // Structured data and the analytics payload both name the product. They
  // must keep the FULL title: shortening the h1 was a display decision, and
  // a shop whose feed, JSON-LD and ad events suddenly rename 123 products is
  // a different and much worse problem than a long heading.
  const jsonLdName = mobile.match(/"@type":"Product","name":"([^"]+)"/);
  const {h1, fullTitle} = headings(mobile);
  if (!jsonLdName) {
    warn('no Product JSON-LD name found (check audit:schema separately)');
  }
  if (h1 && fullTitle && fullTitle.length <= h1.length) {
    fail(
      `the full title (${fullTitle.length} chars) is not longer than the h1 ` +
        `(${h1.length}): the keyword title is not on the page`,
    );
  }
  if (!h1) fail('no h1');
  if (h1 && h1.length > 90) {
    warn(`h1 is ${h1.length} chars: the shortener did not fire`);
  }

  /* ---- the things that SHOULD have changed ---- */

  // Buy box before the name on a phone. Checked by DOM position of the two
  // blocks, which is what the CSS order property is expressed against.
  const buyboxAt = mobile.indexOf('product-buybox');
  const headingAt = mobile.indexOf('product-heading');
  if (buyboxAt === -1) fail('no .product-buybox wrapper');
  if (headingAt === -1) fail('no .product-heading wrapper');

  // Rendition. Only meaningful when the product HAS a video.
  const mobileSources = videoSourceOrder(mobile);
  const desktopSources = videoSourceOrder(desktop);
  if (mobileSources.length && desktopSources.length) {
    const firstMobile = renditionHeight(mobileSources[0]);
    const firstDesktop = renditionHeight(desktopSources[0]);
    // Compared against what this product ACTUALLY has, never against a
    // hardcoded 1080. Not every video in the catalog was uploaded at 1080p:
    // the Star Goal widget's tallest rendition is 720p, and asserting a
    // literal 1080 reported it as the blurry regression when it is simply a
    // smaller source file.
    const heights = desktopSources
      .map(renditionHeight)
      .filter((h) => typeof h === 'number');
    const tallest = heights.length ? Math.max(...heights) : null;
    const smallest = heights.length ? Math.min(...heights) : null;
    if (firstMobile && firstMobile > 720) {
      fail(`phone is offered ${firstMobile}p first, expected 720p or smaller`);
    }
    if (firstMobile && smallest && firstMobile === smallest && smallest < 720) {
      fail(
        `phone is offered ${firstMobile}p first, the SMALLEST rendition: ` +
          `this is the "video is blurry" failure from 2026-09-19`,
      );
    }
    if (firstDesktop && tallest && firstDesktop < tallest) {
      fail(
        `desktop is offered ${firstDesktop}p first but ${tallest}p exists: ` +
          `this is the "video is blurry" regression from 2026-09-19`,
      );
    }
    // The m3u8 stays last or Safari takes the adaptive stream and starts low.
    const last = mobileSources[mobileSources.length - 1];
    if (mobileSources.some((s) => /m3u8/.test(s)) && !/m3u8/.test(last)) {
      fail('the m3u8 is not last in the source list');
    }
    // Demoting the tallest rendition is the change; DROPPING it is a bug.
    // The phone and the desktop must be offered the same set of files in a
    // different order, so this compares the two sets rather than looking for
    // a literal 1080p that not every product has.
    const asSet = (list) => [...list].sort().join(',');
    if (asSet(mobileSources) !== asSet(desktopSources)) {
      fail(
        'the phone and the desktop are offered DIFFERENT files, not the same ' +
          'files in a different order',
      );
    }
    // autoplay is a deliberate 2026-09-15 decision, and losing it is silent.
    if (!/<video[^>]*\bautoplay\b/i.test(mobile)) {
      fail('the video lost its autoplay attribute');
    }
  }

  return findings;
}

/* -------------------------------------------------------------------- *
 * Self-test. Feeds known-bad HTML to the rules above and fails if any of
 * it passes, because a check that only ever sees good input is untested.
 * -------------------------------------------------------------------- */

const GOOD_MOBILE = `
<h1>Celestial Stream Kit</h1>
<p class="product-title-full">Celestial Stream Kit | 10 Moon and Star Twitch Overlays, 5 Chat Widgets</p>
<div class="product-buybox"><div class="product-price">$39.99</div></div>
<div class="product-heading"></div>
<script>{"@type":"Product","name":"Celestial Stream Kit | 10 Moon and Star Twitch Overlays"}</script>
<form method="post" action="/cart"><input type="hidden" name="cartFormInput" value="{&quot;lines&quot;:[{&quot;merchandiseId&quot;:&quot;gid://shopify/ProductVariant/123&quot;}]}"><button>Add to cart</button></form>
<video autoplay muted playsinline>
<source src="https://x/a.HD-720p-1.6Mbps-1.mp4"><source src="https://x/a.SD-480p-0.9Mbps-1.mp4">
<source src="https://x/a.HD-1080p-2.5Mbps-1.mp4"><source src="https://x/a.m3u8"></video>`;

const GOOD_DESKTOP = GOOD_MOBILE.replace(
  '<source src="https://x/a.HD-720p-1.6Mbps-1.mp4"><source src="https://x/a.SD-480p-0.9Mbps-1.mp4">\n<source src="https://x/a.HD-1080p-2.5Mbps-1.mp4">',
  '<source src="https://x/a.HD-1080p-2.5Mbps-1.mp4"><source src="https://x/a.HD-720p-1.6Mbps-1.mp4">\n<source src="https://x/a.SD-480p-0.9Mbps-1.mp4">',
);

function selfTest() {
  const cases = [
    ['a clean page passes', GOOD_MOBILE, GOOD_DESKTOP, 200, 0],
    [
      // Two findings, not one, and deliberately so: a page with no variant
      // gid anywhere breaks both the cart-form rule and the page-level rule.
      // Collapsing them would hide the case where the gid is on the page but
      // not in the form.
      'variant dropped from the cart form',
      GOOD_MOBILE.replace('gid://shopify/ProductVariant/123', ''),
      GOOD_DESKTOP,
      200,
      2,
    ],
    [
      'the whole cart form gone',
      GOOD_MOBILE.replace('method="post" action="/cart"', 'method="get"'),
      GOOD_DESKTOP,
      200,
      1,
    ],
    [
      'add to cart button gone',
      GOOD_MOBILE.replace('Add to cart', 'Coming soon'),
      GOOD_DESKTOP,
      200,
      1,
    ],
    [
      'price block gone',
      GOOD_MOBILE.replace('class="product-price"', 'class="nothing"').replace(
        '$39.99',
        'free',
      ),
      GOOD_DESKTOP,
      200,
      2,
    ],
    [
      'keyword title dropped from the page',
      GOOD_MOBILE.replace(
        '<p class="product-title-full">Celestial Stream Kit | 10 Moon and Star Twitch Overlays, 5 Chat Widgets</p>',
        '',
      ),
      GOOD_DESKTOP,
      200,
      0, // no full title element at all is not itself a fail, the h1 check covers it
    ],
    [
      'full title shorter than the h1',
      GOOD_MOBILE.replace(
        'Celestial Stream Kit | 10 Moon and Star Twitch Overlays, 5 Chat Widgets',
        'Kit',
      ),
      GOOD_DESKTOP,
      200,
      1,
    ],
    [
      'phone offered 1080p first',
      GOOD_DESKTOP,
      GOOD_DESKTOP,
      200,
      1,
    ],
    [
      'desktop offered 480p first: the blurry regression',
      GOOD_MOBILE,
      GOOD_MOBILE.replace(
        '<source src="https://x/a.HD-720p-1.6Mbps-1.mp4"><source src="https://x/a.SD-480p-0.9Mbps-1.mp4">',
        '<source src="https://x/a.SD-480p-0.9Mbps-1.mp4"><source src="https://x/a.HD-720p-1.6Mbps-1.mp4">',
      ),
      200,
      1,
    ],
    [
      'autoplay attribute lost',
      GOOD_MOBILE.replace('<video autoplay', '<video'),
      GOOD_DESKTOP,
      200,
      1,
    ],
    [
      'the tallest rendition dropped rather than demoted',
      GOOD_MOBILE.replace('<source src="https://x/a.HD-1080p-2.5Mbps-1.mp4">', ''),
      GOOD_DESKTOP,
      200,
      1,
    ],
    [
      // Pure REORDER, same four files: otherwise the fixture also trips the
      // set-comparison rule and the case stops testing what it is named for.
      'm3u8 promoted above the mp4s',
      GOOD_MOBILE.replace(
        '<source src="https://x/a.HD-720p-1.6Mbps-1.mp4"><source src="https://x/a.SD-480p-0.9Mbps-1.mp4">',
        '<source src="https://x/a.m3u8"><source src="https://x/a.HD-720p-1.6Mbps-1.mp4">',
      ).replace(
        '<source src="https://x/a.HD-1080p-2.5Mbps-1.mp4"><source src="https://x/a.m3u8">',
        '<source src="https://x/a.HD-1080p-2.5Mbps-1.mp4"><source src="https://x/a.SD-480p-0.9Mbps-1.mp4">',
      ),
      GOOD_DESKTOP,
      200,
      1,
    ],
    ['a 404', GOOD_MOBILE, GOOD_DESKTOP, 404, 1],
    [
      'buybox wrapper gone',
      GOOD_MOBILE.replace('product-buybox', 'gone'),
      GOOD_DESKTOP,
      200,
      1,
    ],
    [
      'a product with no video is not penalised',
      GOOD_MOBILE.replace(/<video[\s\S]*<\/video>/, ''),
      GOOD_DESKTOP.replace(/<video[\s\S]*<\/video>/, ''),
      200,
      0,
    ],
  ];

  let failed = 0;
  for (const [name, mobile, desktop, status, expected] of cases) {
    const found = checkProduct({
      handle: 'self-test',
      mobile,
      desktop,
      status,
    }).filter((f) => f.severity === 'fail');
    const ok = found.length === expected;
    if (!ok) {
      failed++;
      console.log(
        `  FAIL  ${name}: expected ${expected} finding(s), got ${found.length}` +
          (found.length ? ` (${found.map((f) => f.what).join('; ')})` : ''),
      );
    } else {
      console.log(`  ok    ${name}`);
    }
  }
  console.log(
    `\n${cases.length - failed}/${cases.length} self-test cases passed`,
  );
  return failed === 0;
}

/* -------------------------------------------------------------------- *
 * The network half.
 * -------------------------------------------------------------------- */

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) {
    process.exit(selfTest() ? 0 : 1);
  }

  const arg = (name, fallback) => {
    const i = args.indexOf(name);
    return i === -1 ? fallback : args[i + 1];
  };
  const origin = (arg('--origin', DEFAULT_ORIGIN) || DEFAULT_ORIGIN).replace(
    /\/$/,
    '',
  );
  const handles = (arg('--handles', '') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const targets = handles.length ? handles : DEFAULT_HANDLES;

  console.log(`\nPDP smoke against ${origin}`);
  console.log(`${targets.length} products, HTML only, nothing is added to a cart\n`);

  const all = [];
  let varyChecked = false;

  for (const handle of targets) {
    const url = `${origin}/products/${handle}`;
    let mobileRes;
    let desktop = '';
    let mobile = '';
    try {
      mobileRes = await fetch(url, {headers: MOBILE_HEADERS});
      mobile = await mobileRes.text();
      const desktopRes = await fetch(url, {headers: DESKTOP_HEADERS});
      desktop = await desktopRes.text();

      // Checked once: a cache in front of this must key on the header the
      // body depends on, or it will serve one form factor's HTML to the
      // other and the split above becomes worse than not doing it at all.
      if (!varyChecked) {
        varyChecked = true;
        const vary = mobileRes.headers.get('vary') || '';
        if (!/sec-ch-ua-mobile/i.test(vary)) {
          all.push({
            handle,
            severity: 'fail',
            what: `Vary does not include Sec-CH-UA-Mobile (got "${vary}")`,
          });
        } else {
          console.log(`  Vary: ${vary}`);
        }
      }
    } catch (error) {
      all.push({handle, severity: 'fail', what: `fetch failed: ${error.message}`});
      continue;
    }

    const findings = checkProduct({
      handle,
      mobile,
      desktop,
      status: mobileRes.status,
    });
    all.push(...findings);

    const sources = videoSourceOrder(mobile);
    const label = sources.length
      ? `phone gets ${sources[0]?.match(/(SD|HD)-\d+p/)?.[0] || '?'} first`
      : 'no video';
    const bad = findings.filter((f) => f.severity === 'fail').length;
    console.log(
      `  ${bad ? 'FAIL' : 'ok  '}  ${handle.slice(0, 52).padEnd(54)} ${label}`,
    );
  }

  const fails = all.filter((f) => f.severity === 'fail');
  const warns = all.filter((f) => f.severity === 'warn');

  console.log('');
  for (const f of [...fails, ...warns]) {
    console.log(`  ${f.severity.toUpperCase()}  ${f.handle}: ${f.what}`);
  }
  console.log(
    `\n${targets.length - new Set(fails.map((f) => f.handle)).size}/${
      targets.length
    } products clean, ${fails.length} failure(s), ${warns.length} warning(s)\n`,
  );
  process.exit(fails.length ? 1 : 0);
}

main();
