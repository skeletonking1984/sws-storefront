/**
 * A product video may appear, with its VideoObject JSON-LD, on exactly one
 * page: its own dedicated watch page. Every other page, PDP included, is
 * not a watch page, and Google says so.
 *
 * WHY THIS FILE WAS REWRITTEN, 2026-09-28
 * ----------------------------------------
 * The 2026-09-23 version of this file, and the fix it audited, both rested
 * on a premise that turned out to be wrong: that the PDP, once a product
 * video was removed from unrelated cross-sell cards, WAS a valid watch page.
 * Search Console disagreed. Its report sat at 66-of-113, then 69-of-112,
 * "Video isn't on a watch page", validation Failed 2026-09-24, with every
 * example row a PDP paired with its own correctly-marked-up video.
 *
 * Google's own definition (support.google.com/webmasters/answer/9495631,
 * read 2026-09-28) says a watch page's "main purpose is to show a user a
 * single video," and its own example of what does NOT qualify is "a product
 * details page with a complementary video." That describes every PDP on
 * this storefront word for word: a buy box, a description, reviews and
 * related products sit around the clip. No amount of correct VideoObject
 * markup on that page could ever pass, because the page itself is the wrong
 * shape of page. The 2026-09-23 fix (card videos moved to `data-src`, see
 * git history for `00f9272`) was real and still matters, it stopped a video
 * from appearing on pages that are not even the product's own, but it could
 * not and did not fix this report, and the old version of this file passed
 * anyway because it only ever asked "is the PDP still able to show the
 * video," never "is the PDP an eligible watch page at all."
 *
 * THE FIX: a dedicated page per video, `/videos/<handle>`
 * (`app/routes/videos.$handle.jsx`), whose entire purpose is the video. The
 * video sitemap (`app/lib/sitemap.js`) nominates that URL, and the
 * VideoObject JSON-LD (`app/lib/video.js`'s `buildVideoObjectJsonLd`) moved
 * there from the PDP. The PDP keeps its own `<video>` player, a buyer who
 * lands there still sees and can play the clip, and a "Watch the demo" link
 * on the PDP points at the watch page. What the PDP lost is the JSON-LD and
 * the sitemap nomination, because carrying either of those on a page that
 * is not a watch page is exactly the defect this report describes.
 *
 * WHAT THIS ASSERTS, and it fails in every direction on purpose, because the
 * cheap way to pass part of it is to break another part:
 *
 *   1. Non-watch pages (home, the shop-all collection, search, AND every
 *      PDP) must NOT be a sitemap `loc` for a video entry, and must NOT
 *      carry VideoObject JSON-LD.
 *   2. Non-watch pages that are not a PDP (home, collection, search) must
 *      also not serve a crawlable product video URL at all: that is the
 *      2026-09-23 defect (a video on a page that is not even the right
 *      product), and it is a different failure mode from a PDP correctly
 *      showing its own product's own video.
 *   3. The watch page (`/videos/<handle>`) MUST carry a crawlable video URL
 *      AND VideoObject JSON-LD.
 *   4. Every sitemap `loc` for a video entry must be a watch page URL
 *      (`/videos/<handle>`), never a PDP URL.
 *
 * Rule 1's PDP-JSON-LD half without rule 3 is how somebody "fixes" this by
 * deleting the VideoObject from everywhere, Search Console goes quiet, and
 * every video stops being indexed at all. That would read as success and
 * is not one.
 *
 * Usage:
 *   node scripts/audit-watch-pages.mjs [--origin https://...]
 *   node scripts/audit-watch-pages.mjs --self-test
 */

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const ORIGIN = arg('--origin', 'https://streamwidgetshop.com');
const SELF_TEST = process.argv.includes('--self-test');

/**
 * Pages that must never serve a crawlable product video URL at all,
 * deferred or otherwise unrelated to their own content. Not PDPs: a PDP is
 * allowed to keep its own product's video, it just cannot be the WATCH page
 * for it (see the sitemap/JSON-LD checks below for that half).
 *
 * The homepage hero clip (`HeroStreamClip` in `app/routes/_index.jsx`) is a
 * different asset and mounts only after hydration, so it never reaches the
 * served HTML this reads. It is not a product video and is not covered here.
 */
const NON_WATCH_PATHS = ['/', '/collections/all', '/search?q=goal'];

/**
 * A product video URL in a `src` attribute. Shopify serves these from
 * `cdn.shopify.com` and the shop serves some from its own origin, so match on
 * the extension rather than the host, and only inside a real `src=`, because
 * `data-src=` is the whole point of the 2026-09-23 fix.
 */
const CRAWLABLE_VIDEO = /(?<!data-)src="([^"]*\.(?:mp4|m3u8|webm)[^"]*)"/gi;

/** A `data-src` carrying a video, which is what the cross-sell cards should have. */
const DEFERRED_VIDEO = /data-src="([^"]*\.(?:mp4|m3u8|webm)[^"]*)"/gi;

function findCrawlable(html) {
  return [...html.matchAll(CRAWLABLE_VIDEO)].map((m) => m[1]);
}
function findDeferred(html) {
  return [...html.matchAll(DEFERRED_VIDEO)].map((m) => m[1]);
}

/** Does this HTML carry a VideoObject in its JSON-LD? */
function hasVideoObject(html) {
  return /"@type"\s*:\s*"VideoObject"/.test(html);
}

/** Is this a watch page URL (`/videos/<handle>`), not a PDP URL? */
function isWatchPageUrl(url) {
  return /\/videos\/[^/]+\/?$/.test(url);
}

/** Turns a watch page URL into its PDP URL: same origin, `/videos/x` -> `/products/x`. */
function watchUrlToPdpUrl(url) {
  return url.replace('/videos/', '/products/');
}

if (SELF_TEST) {
  /*
   * The pattern-matching cases from the 2026-09-23 version, unchanged: they
   * still cover the real defect that fix addressed (a card video leaking a
   * bare `src` onto a page it does not belong on). Plus new cases for the
   * URL-shape helper the sitemap check below depends on.
   */
  const cases = [
    ['bare src mp4 is crawlable', '<video src="https://cdn/x.mp4">', 1, 0],
    ['data-src mp4 is not crawlable', '<video data-src="https://cdn/x.mp4">', 0, 1],
    [
      'both present, the src still counts',
      '<video src="https://cdn/a.mp4" data-src="https://cdn/b.mp4">',
      1,
      1,
    ],
    ['webm is a video too', '<video src="https://cdn/x.webm">', 1, 0],
    ['hls is a video too', '<video src="https://cdn/x.m3u8">', 1, 0],
    ['an image src is not a video', '<img src="https://cdn/x.jpg">', 0, 0],
    ['no video at all', '<div>nothing here</div>', 0, 0],
    [
      'query string after the extension still matches',
      '<video src="https://cdn/x.mp4?v=123">',
      1,
      0,
    ],
    ['source element counts', '<source src="https://cdn/x.mp4" type="video/mp4">', 1, 0],
    ['two cards, two hits', '<video src="/a.mp4"><video src="/b.mp4">', 2, 0],
    ['data-src on two cards', '<video data-src="/a.mp4"><video data-src="/b.mp4">', 0, 2],
  ];
  let failed = 0;
  for (const [name, html, wantCrawlable, wantDeferred] of cases) {
    const gotCrawlable = findCrawlable(html).length;
    const gotDeferred = findDeferred(html).length;
    const ok = gotCrawlable === wantCrawlable && gotDeferred === wantDeferred;
    if (!ok) failed++;
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'}  ${name}  (crawlable ${gotCrawlable}/${wantCrawlable}, deferred ${gotDeferred}/${wantDeferred})`,
    );
  }
  // The JSON-LD half, which has its own way of quietly going missing.
  const ldCases = [
    ['VideoObject present', '{"@type":"VideoObject","name":"x"}', true],
    ['VideoObject with spaces', '{"@type" : "VideoObject"}', true],
    ['no VideoObject', '{"@type":"Product"}', false],
    ['empty page', '', false],
  ];
  for (const [name, html, want] of ldCases) {
    const got = hasVideoObject(html);
    const ok = got === want;
    if (!ok) failed++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}  (${got}/${want})`);
  }
  // The watch-page-URL-shape helper the sitemap check depends on: a wrong
  // shape here would let a PDP URL sail through the sitemap check unnoticed.
  const urlCases = [
    ['a watch page URL', 'https://streamwidgetshop.com/videos/boba-drink', true],
    ['a watch page URL with trailing slash', 'https://streamwidgetshop.com/videos/boba-drink/', true],
    ['a PDP URL is not a watch page', 'https://streamwidgetshop.com/products/boba-drink', false],
    ['the homepage is not a watch page', 'https://streamwidgetshop.com/', false],
    [
      'a handle that itself contains "products" still resolves off the path prefix',
      'https://streamwidgetshop.com/videos/products-goal-widget',
      true,
    ],
  ];
  for (const [name, url, want] of urlCases) {
    const got = isWatchPageUrl(url);
    const ok = got === want;
    if (!ok) failed++;
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}  (${got}/${want})`);
  }
  console.log(failed ? `\n${failed} self-test case(s) failed` : '\nself-test clean');
  process.exit(failed ? 1 : 0);
}

async function get(path) {
  const res = await fetch(`${ORIGIN}${path}`, {
    headers: {'user-agent': 'sws-watch-page-audit'},
  });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return res.text();
}

/**
 * Every `<loc>` in the video sitemap, plus a pick of one real watch page URL
 * to run the deeper checks against. Taken from the live sitemap rather than
 * hardcoded, so this cannot pass by testing a page that no longer has a
 * video.
 */
async function readVideoSitemap() {
  const xml = await get('/sitemap/video/1.xml');
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (!locs.length) throw new Error('no <loc> entries in /sitemap/video/1.xml');
  const count = (xml.match(/<video:video>/g) || []).length;
  return {locs, count};
}

const failures = [];
const notes = [];

console.log(`WATCH PAGES  ${ORIGIN}\n`);

const {locs, count: sitemapCount} = await readVideoSitemap();
console.log(`video sitemap: ${sitemapCount} videos declared, ${locs.length} <loc> entries\n`);

console.log('every sitemap video entry must point at a watch page, never a PDP:');
const nonWatchLocs = locs.filter((loc) => !isWatchPageUrl(loc));
if (nonWatchLocs.length) {
  failures.push(
    `${nonWatchLocs.length} sitemap <loc> entries do not point at a /videos/<handle> ` +
      `watch page, e.g. ${nonWatchLocs[0]}. This is the exact defect Search Console ` +
      'reports as "Video isn\'t on a watch page": the sitemap is nominating a page ' +
      'that is not one. See app/lib/sitemap.js.',
  );
  console.log(`  FAIL  ${nonWatchLocs.length}/${locs.length} entries are not watch page URLs`);
} else {
  console.log(`  ok    all ${locs.length} entries are /videos/<handle> URLs`);
}

console.log('\nnon-watch pages must NOT serve a crawlable product video:');
for (const path of NON_WATCH_PATHS) {
  const html = await get(path);
  const crawlable = findCrawlable(html);
  const deferred = findDeferred(html);
  if (crawlable.length) {
    failures.push(
      `${path} serves ${crawlable.length} crawlable video URL(s), e.g. ${crawlable[0]}. ` +
        'A product video on a page that is not its own watch page or PDP is what ' +
        'Search Console reports. Use data-src, see ProductItem.jsx.',
    );
    console.log(`  FAIL  ${path.padEnd(20)} ${crawlable.length} crawlable, ${deferred.length} deferred`);
  } else {
    console.log(`  ok    ${path.padEnd(20)} 0 crawlable, ${deferred.length} deferred`);
  }
  if (!crawlable.length && !deferred.length) {
    notes.push(`${path} carries no card video at all, deferred or otherwise.`);
  }
  if (hasVideoObject(html)) {
    failures.push(`${path} carries VideoObject JSON-LD and is not a watch page.`);
    console.log('        FAIL  VideoObject JSON-LD present on a non-watch page');
  }
}

console.log('\nthe watch page must carry the video AND its VideoObject JSON-LD:');
const watchUrl = locs.find(isWatchPageUrl) ?? locs[0];
const watchPath = watchUrl.replace(ORIGIN, '');
const watchHtml = await get(watchPath);
const watchCrawlable = findCrawlable(watchHtml);
if (!watchCrawlable.length) {
  failures.push(
    `${watchPath} serves NO crawlable video, and it is the watch page for this ` +
      'video. app/routes/videos.$handle.jsx should render a real <video>/<source src>.',
  );
  console.log(`  FAIL  ${watchPath}\n        no crawlable video`);
} else {
  console.log(`  ok    ${watchPath}\n        ${watchCrawlable.length} crawlable video URL(s)`);
}
if (!hasVideoObject(watchHtml)) {
  failures.push(`${watchPath} has no VideoObject JSON-LD.`);
  console.log('  FAIL  VideoObject JSON-LD absent on the watch page');
} else {
  console.log('  ok    VideoObject JSON-LD present');
}

console.log("\nthe watch page's own PDP must NOT be a watch page:");
const pdpUrl = watchUrlToPdpUrl(watchUrl);
const pdpPath = pdpUrl.replace(ORIGIN, '');
const pdpHtml = await get(pdpPath);
if (hasVideoObject(pdpHtml)) {
  failures.push(
    `${pdpPath} carries VideoObject JSON-LD. A PDP is "a product details page ` +
      'with a complementary video," which Google explicitly excludes from being ' +
      'a watch page; see app/routes/videos.$handle.jsx header comment.',
  );
  console.log(`  FAIL  ${pdpPath}\n        VideoObject JSON-LD present on the PDP`);
} else {
  console.log(`  ok    ${pdpPath}\n        no VideoObject JSON-LD`);
}
if (locs.includes(pdpUrl)) {
  failures.push(`${pdpUrl} is a sitemap <loc>, and a PDP must never be one.`);
  console.log('  FAIL  PDP URL appears as a sitemap <loc>');
} else {
  console.log('  ok    PDP URL is not a sitemap <loc>');
}
// The PDP is still allowed to keep its own <video> player. Note only, never
// a failure: this is the "complementary video" Google's definition names,
// and removing it would just make every deployed fix here undetectable by
// this audit (see the header comment for why a quiet-by-deletion "fix" is
// not one).
notes.push(
  `${pdpPath} ${findCrawlable(pdpHtml).length ? 'still serves' : 'serves no'} crawlable ` +
    'video of its own; either is fine, it is not the watch page either way.',
);

if (notes.length) {
  console.log('\nNOTES');
  for (const n of notes) console.log(`  ${n}`);
}

if (failures.length) {
  console.log('\nFAIL');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
console.log('\nPASS');
