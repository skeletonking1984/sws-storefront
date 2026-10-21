/**
 * Verifies the home "We're live" banner LIVE GATE (app/lib/liveBanner.js).
 *
 *   node scripts/verify-live-banner.mjs          offline cases (mocked fetch)
 *   node scripts/verify-live-banner.mjs --live   also probe the real checker once
 *
 * The bug this guards: the banner used to be driven only by metafield
 * sws.live_banner `on`, so it stayed up after the stream ended. It must render
 * only when the metafield is on AND the channel is verified live. Every
 * failure of the check (timeout, HTTP error, junk body, no Twitch link) must
 * HIDE it. Cases that assert the banner still SHOWS are included, because a
 * gate that hides everything would pass the hide cases and break the feature.
 *
 * Also guards the edge cache seam: a page Oxygen may store must NOT
 * be rendered with the banner, because the stored HTML outlives the stream by
 * up to ~32 minutes. The banner for those pages comes from /api/v instead.
 * `scripts/verify-edge-cache.mjs` asserts the same thing on real HTML.
 */
import {
  isChannelLive,
  loadLiveBanner,
  loadLiveBannerForPage,
  parseDecapiUptime,
  twitchLoginFromLinks,
} from '../app/lib/liveBanner.js';

const LIVE = '1 day, 17 hours, 43 minutes, 39 seconds';
const metafield = (over = {}) =>
  JSON.stringify({
    on: true,
    message: "We're live now",
    cta_label: 'Get early access',
    cta_url: '/pages/now-playing',
    links: [{label: 'Twitch', url: 'https://twitch.tv/StreamWidget'}],
    ...over,
  });
const storefrontWith = (value) => ({
  CacheShort: () => ({}),
  query: async () => ({shop: {metafield: value == null ? null : {value}}}),
});
const body = (text, status = 200) => async () =>
  new Response(text, {status, headers: {'content-type': 'text/plain'}});
const hang = (_url, {signal}) =>
  new Promise((_, reject) =>
    signal.addEventListener('abort', () => reject(signal.reason)),
  );
const boom = async () => {
  throw new Error('network down');
};
/** In-memory stand-in for hydrogen's withCache.run that records calls. */
function fakeWithCache() {
  const store = new Map();
  const w = {
    misses: 0,
    run: async ({cacheKey, shouldCacheResult}, fn) => {
      const k = cacheKey.join('|');
      if (store.has(k)) return store.get(k);
      w.misses++;
      const v = await fn({addDebugData() {}});
      if (shouldCacheResult(v)) store.set(k, v);
      return v;
    },
  };
  return w;
}

// AbortSignal.timeout timers are unref'd; keep the loop alive for the hang case.
const keepAlive = setInterval(() => {}, 1000);
let failed = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};
const shown = async (value, fetchImpl, withCache) =>
  Boolean(await loadLiveBanner({storefront: storefrontWith(value), withCache}, {fetchImpl}));

// parsing
eq('parse: uptime string = live', parseDecapiUptime(LIVE, 'StreamWidget'), true);
eq('parse: "5 minutes" = live', parseDecapiUptime('5 minutes', 'StreamWidget'), true);
eq('parse: "x is offline" = offline', parseDecapiUptime('StreamWidget is offline', 'StreamWidget'), false);
eq('parse: case-insensitive offline', parseDecapiUptime('streamwidget is offline', 'StreamWidget'), false);
eq('parse: other channel offline text = unknown', parseDecapiUptime('someone is offline', 'StreamWidget'), null);
eq('parse: rate-limit junk = unknown', parseDecapiUptime('Too many requests', 'StreamWidget'), null);
eq('parse: html = unknown', parseDecapiUptime('<html>5 minutes</html>', 'StreamWidget'), null);
eq('parse: empty = unknown', parseDecapiUptime('', 'StreamWidget'), null);
eq('login: twitch.tv link', twitchLoginFromLinks([{url: 'https://twitch.tv/StreamWidget'}]), 'StreamWidget');
eq('login: www + youtube first', twitchLoginFromLinks([{url: 'https://youtube.com/@x'}, {url: 'https://www.twitch.tv/abc_1/'}]), 'abc_1');
eq('login: lookalike host rejected', twitchLoginFromLinks([{url: 'https://twitch.tv.evil.com/x'}]), null);
eq('login: bad chars rejected', twitchLoginFromLinks([{url: 'https://twitch.tv/a%2Fb'}]), null);
eq('login: no twitch link', twitchLoginFromLinks([{url: 'https://kick.com/x'}]), null);

// the gate
eq('on=true + offline  -> HIDDEN (the bug)', await shown(metafield(), body('StreamWidget is offline')), false);
eq('on=true + live     -> SHOWN', await shown(metafield(), body(LIVE)), true);
eq('on=false + live    -> HIDDEN (master switch)', await shown(metafield({on: false}), body(LIVE)), false);
eq('metafield missing + live -> HIDDEN', await shown(null, body(LIVE)), false);
eq('on=true + HTTP 500 -> HIDDEN', await shown(metafield(), body(LIVE, 500)), false);
eq('on=true + network error -> HIDDEN', await shown(metafield(), boom), false);
eq('on=true + junk body -> HIDDEN', await shown(metafield(), body('Rate limited')), false);
eq('on=true + no twitch link -> HIDDEN', await shown(metafield({links: [{label: 'Kick', url: 'https://kick.com/x'}]}), body(LIVE)), false);
const t0 = Date.now();
eq('on=true + hung checker -> HIDDEN', await shown(metafield(), hang), false);
const took = Date.now() - t0;
eq(`hung checker bounded (~1.5s, took ${took}ms)`, took >= 1400 && took < 2500, true);

// off switch never calls the checker
let calls = 0;
const counting = async () => (calls++, new Response(LIVE));
await shown(metafield({on: false}), counting);
eq('on=false makes ZERO checker calls', calls, 0);

// caching
{
  const w = fakeWithCache();
  let n = 0;
  const f = async () => (n++, new Response(LIVE));
  await isChannelLive('StreamWidget', {withCache: w, fetchImpl: f});
  await isChannelLive('streamwidget', {withCache: w, fetchImpl: f});
  await isChannelLive('StreamWidget', {withCache: w, fetchImpl: f});
  eq('definite answer cached: 3 calls -> 1 fetch', n, 1);

  const w2 = fakeWithCache();
  let m = 0;
  const flaky = async () => {
    m++;
    if (m === 1) throw new Error('blip');
    return new Response(LIVE);
  };
  const a = await isChannelLive('StreamWidget', {withCache: w2, fetchImpl: flaky});
  const b = await isChannelLive('StreamWidget', {withCache: w2, fetchImpl: flaky});
  eq('unknown (error) is NOT cached: blip hidden, next call shows', [a, b], [false, true]);
}

// edge cache seam: a cache candidate render never carries the banner
{
  let queries = 0;
  let probes = 0;
  const spy = {
    CacheShort: () => ({}),
    query: async () => (queries++, {shop: {metafield: {value: metafield()}}}),
  };
  const probe = async () => (probes++, new Response(LIVE));
  const cacheable = await loadLiveBannerForPage({storefront: spy, edgeCacheable: true}, {fetchImpl: probe});
  eq('page render, edge cache candidate + live -> NO banner (markup would be stored)', cacheable, null);
  eq('page render, edge cache candidate makes zero queries and zero probes', [queries, probes], [0, 0]);
  const uncached = await loadLiveBannerForPage({storefront: spy, edgeCacheable: false}, {fetchImpl: probe});
  eq('page render, uncached + live -> SHOWN (server side as before)', Boolean(uncached), true);
  const unset = await loadLiveBannerForPage({storefront: spy}, {fetchImpl: probe});
  eq('page render, edgeCacheable unset + live -> SHOWN', Boolean(unset), true);
  // /api/v calls loadLiveBanner directly, which must not look at the flag.
  eq('/api/v path (loadLiveBanner) ignores the flag and shows when live', await shown(metafield(), body(LIVE)), true);
  // Metafield off: exactly one query and no probe, so /api/v stays fast.
  queries = 0;
  probes = 0;
  const offSpy = {CacheShort: () => ({}), query: async () => (queries++, {shop: {metafield: {value: metafield({on: false})}}})};
  await loadLiveBanner({storefront: offSpy}, {fetchImpl: probe});
  eq('metafield off: one storefront query, zero probes', [queries, probes], [1, 0]);
}

if (process.argv.includes('--live')) {
  const login = 'StreamWidget';
  const res = await fetch(`https://decapi.me/twitch/uptime/${login}`, {signal: AbortSignal.timeout(5000)});
  const text = await res.text();
  const parsed = parseDecapiUptime(text, login);
  console.log(`LIVE probe: HTTP ${res.status} body=${JSON.stringify(text)} parsed=${parsed}`);
  eq('live probe: checker answered with a definite state', parsed === true || parsed === false, true);
}

clearInterval(keepAlive);
console.log(failed ? `\n${failed} FAILED` : '\nlive banner gate: all checks passed');
process.exit(failed ? 1 : 0);
