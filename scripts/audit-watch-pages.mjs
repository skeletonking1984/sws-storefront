/**
 * A product video may appear in the served HTML of exactly one page: its own
 * PDP. Every other page is not a watch page, and Google says so.
 *
 * WHY THIS EXISTS, 2026-09-23
 * ---------------------------
 * Search Console's video report has sat at the same number since 2026-09-14:
 * 66 videos indexed, and 66 videos not indexed for one reason, "Video isn't on
 * a watch page", validation Not Started. `/sitemap/video/1.xml` declares 113
 * videos, each nominating its PDP, and `audit:schema` is green on the PDP's
 * VideoObject. So the markup was never the finding and neither was the
 * sitemap.
 *
 * The cause was `app/components/ProductItem.jsx`. Every product card carried a
 * real `<video src="...mp4">` for the hover preview, and those cards render on
 * collection, search, home and blog cross-sell pages. Google found each file
 * on a page where the video is decorative, aria-hidden and not what the page
 * is about, which is the definition of "not a watch page". `preload="none"`
 * changes nothing here: the attribute is in the bytes whether or not a byte of
 * video is ever fetched.
 *
 * The fix moves the URL to `data-src` and promotes it to `src` on the first
 * hover. Googlebot renders JavaScript but does not hover, so the file leaves
 * those pages entirely and the visitor sees no difference.
 *
 * WHAT THIS ASSERTS, and it fails in BOTH directions on purpose, because the
 * cheap way to pass half of it is to break the other half:
 *
 *   1. No non-watch page serves a crawlable product video URL.
 *   2. The PDP still does, with its VideoObject JSON-LD intact.
 *
 * Without (2) somebody "fixes" this by deleting the video from the PDP as
 * well, Search Console goes quiet, and the 113 videos stop being indexed at
 * all. That would read as success.
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
 * Pages that must NOT carry a crawlable product video.
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
 * `data-src=` is the whole point of the fix.
 */
const CRAWLABLE_VIDEO = /(?<!data-)src="([^"]*\.(?:mp4|m3u8|webm)[^"]*)"/gi;

/** A `data-src` carrying a video, which is what the cards should have now. */
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

if (SELF_TEST) {
  /*
   * Eleven cases. The ones that matter are the pairs: a `data-src` must not
   * satisfy the PDP requirement, and a `src` must not be excused on a
   * collection page just because a `data-src` sits next to it.
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
  // And the JSON-LD half, which has its own way of quietly going missing.
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
 * The PDP to check. Taken from the live video sitemap rather than hardcoded,
 * so this cannot pass by testing a page that no longer has a video.
 */
async function pickPdpWithVideo() {
  const xml = await get('/sitemap/video/1.xml');
  const loc = xml.match(/<loc>([^<]+)<\/loc>/);
  if (!loc) throw new Error('no <loc> in /sitemap/video/1.xml');
  const count = (xml.match(/<video:video>/g) || []).length;
  return {url: loc[1], count};
}

const failures = [];
const notes = [];

console.log(`WATCH PAGES  ${ORIGIN}\n`);

const {url: pdpUrl, count: sitemapCount} = await pickPdpWithVideo();
console.log(`video sitemap: ${sitemapCount} videos declared\n`);

console.log('must NOT carry a crawlable product video:');
for (const path of NON_WATCH_PATHS) {
  const html = await get(path);
  const crawlable = findCrawlable(html);
  const deferred = findDeferred(html);
  if (crawlable.length) {
    failures.push(
      `${path} serves ${crawlable.length} crawlable video URL(s), e.g. ${crawlable[0]}. ` +
        'A product video on a page that is not its PDP is what Search Console ' +
        'reports as "Video isn\'t on a watch page". Use data-src, see ProductItem.jsx.',
    );
    console.log(`  FAIL  ${path.padEnd(20)} ${crawlable.length} crawlable, ${deferred.length} deferred`);
  } else {
    console.log(`  ok    ${path.padEnd(20)} 0 crawlable, ${deferred.length} deferred`);
  }
  if (!crawlable.length && !deferred.length) {
    notes.push(`${path} carries no card video at all, deferred or otherwise.`);
  }
}

console.log('\nthe one watch page, which must still carry it:');
const pdpPath = pdpUrl.replace(ORIGIN, '');
const pdp = await get(pdpPath);
const pdpCrawlable = findCrawlable(pdp);
if (!pdpCrawlable.length) {
  failures.push(
    `${pdpPath} serves NO crawlable video, and it is the watch page. ` +
      'Deferring the PDP video as well would silence Search Console by ' +
      'removing all 113 videos from the index. ProductGallery.jsx keeps a real src.',
  );
  console.log(`  FAIL  ${pdpPath}\n        no crawlable video`);
} else {
  console.log(`  ok    ${pdpPath}\n        ${pdpCrawlable.length} crawlable video URL(s)`);
}
if (!hasVideoObject(pdp)) {
  failures.push(`${pdpPath} has no VideoObject JSON-LD.`);
  console.log('  FAIL  VideoObject JSON-LD absent');
} else {
  console.log('  ok    VideoObject JSON-LD present');
}

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
