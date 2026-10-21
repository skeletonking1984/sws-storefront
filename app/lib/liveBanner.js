/**
 * "We're live" banner config. Lives in ONE shop metafield so it can be turned
 * on and off without a redeploy. Runbook: docs/LIVE-BANNER.md.
 *
 *   namespace `sws`, key `live_banner`, type `json`, Storefront API access
 *   PUBLIC_READ (set on the metafield definition).
 *
 * FAILS CLOSED. Anything missing, unparseable or malformed returns null and the
 * banner renders nothing. A bad value must never break the home page. Two gates
 * must both pass: metafield `on` (master switch) AND the channel is verified
 * live (see LIVE GATE below).
 */

export const LIVE_BANNER_QUERY = `#graphql
  query LiveBanner($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    shop {
      metafield(namespace: "sws", key: "live_banner") {
        value
      }
    }
  }
`;

const MAX_LINKS = 6;
const MAX_TEXT = 140;

/** @param {unknown} v */
function text(v, max = MAX_TEXT) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
}

/**
 * Same-site path ("/pages/x") or https URL. Rejects protocol-relative
 * ("//evil"), javascript:, data: and http:.
 * @param {unknown} v
 */
function safeUrl(v) {
  const t = text(v, 500);
  if (!t) return null;
  if (t.startsWith('/') && !t.startsWith('//') && !t.includes('\\')) return t;
  try {
    const u = new URL(t);
    return u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * @param {string | null | undefined} raw metafield value (JSON string)
 * @returns {{message: string, ctaLabel: string, ctaUrl: string, links: {label: string, url: string}[]} | null}
 */
export function parseLiveBanner(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object' || data.on !== true) return null;

  const message = text(data.message);
  if (!message) return null;

  const ctaLabel = text(data.cta_label, 40);
  const ctaUrl = safeUrl(data.cta_url);
  const links = (Array.isArray(data.links) ? data.links : [])
    .map((l) => ({label: text(l?.label, 30), url: safeUrl(l?.url)}))
    .filter((l) => l.label && l.url && l.url.startsWith('https://'))
    .slice(0, MAX_LINKS);

  return {
    message,
    ctaLabel: ctaLabel && ctaUrl ? ctaLabel : '',
    ctaUrl: ctaLabel && ctaUrl ? ctaUrl : '',
    links,
  };
}

/**
 * LIVE GATE. The metafield is only the master switch ("allowed to show"). The
 * banner also has to be true: the channel must actually be live right now, or a
 * forgotten `on: true` keeps a "We're live" bar up after the stream ends.
 *
 * Source: https://decapi.me/twitch/uptime/<login>, a public no-auth text
 * endpoint. No Twitch Helix creds exist in this repo or the Oxygen env, so
 * Helix is not an option without a new secret. decapi returns plain text:
 *   offline (and unknown channel): "<login> is offline"
 *   live: the uptime, "1 day, 17 hours, 43 minutes, 39 seconds"
 * We only treat a response as LIVE when it is exactly an uptime string, and
 * as OFFLINE when it is exactly "<login> is offline". Anything else (HTTP
 * error, timeout, rate-limit text, markup) is UNKNOWN, which hides the banner.
 *
 * The login is derived from the metafield's own Twitch link, which
 * the operator tooling writes from the stream overlay app's config
 * (links.twitch), so the channel is still single-sourced there.
 */
export const LIVE_CHECK_TIMEOUT_MS = 1500;
/** Fresh for 60s, then served stale up to 30s more while refreshed in the background. */
export const LIVE_CHECK_CACHE = {
  mode: 'public',
  maxAge: 60,
  staleWhileRevalidate: 30,
};

const UNIT = '(?:second|minute|hour|day|week|month|year)s?';
const UPTIME_RE = new RegExp(
  `^\\d+ ${UNIT}(?:(?:, | and |, and )\\d+ ${UNIT})*$`,
);
const TWITCH_LOGIN_RE = /^[A-Za-z0-9_]{1,25}$/;

/**
 * Twitch login from the banner's links (first twitch.tv link), else null.
 * @param {{url: string}[]} links already validated https links
 */
export function twitchLoginFromLinks(links) {
  for (const l of links || []) {
    try {
      const u = new URL(l.url);
      const host = u.hostname.toLowerCase();
      if (host !== 'twitch.tv' && host !== 'www.twitch.tv') continue;
      const login = u.pathname.split('/').filter(Boolean)[0];
      if (login && TWITCH_LOGIN_RE.test(login)) return login;
    } catch {
      // malformed URL: skip it
    }
  }
  return null;
}

/**
 * Interpret a decapi uptime body. true = live, false = offline, null = unknown.
 * @param {string} body
 * @param {string} login
 * @returns {boolean | null}
 */
export function parseDecapiUptime(body, login) {
  const t = String(body ?? '').trim();
  if (UPTIME_RE.test(t)) return true;
  if (t.toLowerCase() === `${login.toLowerCase()} is offline`) return false;
  return null;
}

/**
 * One uncached probe. Never throws. true / false / null (unknown).
 * @param {string} login
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<boolean | null>}
 */
export async function probeTwitchLive(login, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(
      `https://decapi.me/twitch/uptime/${encodeURIComponent(login)}`,
      {signal: AbortSignal.timeout(LIVE_CHECK_TIMEOUT_MS)},
    );
    if (!res.ok) return null;
    return parseDecapiUptime(await res.text(), login);
  } catch {
    return null;
  }
}

/**
 * Cached live check. Only a definite answer (live / offline) is cached;
 * unknown is not, so one bad request does not hide a real live banner for 60s.
 * Returns true ONLY when confirmed live.
 * @param {string} login
 * @param {{withCache?: import('@shopify/hydrogen').WithCache, fetchImpl?: typeof fetch}} [deps]
 * @returns {Promise<boolean>}
 */
export async function isChannelLive(login, {withCache, fetchImpl} = {}) {
  try {
    const run = () => probeTwitchLive(login, fetchImpl);
    if (!withCache) return (await run()) === true;
    const result = await withCache.run(
      {
        cacheKey: ['sws', 'live-gate', 'twitch', login.toLowerCase()],
        cacheStrategy: LIVE_CHECK_CACHE,
        shouldCacheResult: (v) => v === true || v === false,
      },
      run,
    );
    return result === true;
  } catch {
    return false;
  }
}

/**
 * Load + parse + live gate. Never throws, never blocks the page for long.
 * Metafield off/missing short-circuits before any network call to the checker.
 * @param {{storefront: import('@shopify/hydrogen').Storefront, withCache?: import('@shopify/hydrogen').WithCache}} ctx
 * @param {{fetchImpl?: typeof fetch}} [opts]
 */
export async function loadLiveBanner({storefront, withCache}, opts = {}) {
  try {
    const res = await storefront.query(LIVE_BANNER_QUERY, {
      // ~1s fresh, short stale window: an OFF flip lands within seconds.
      cache: storefront.CacheShort(),
    });
    const banner = parseLiveBanner(res?.shop?.metafield?.value);
    if (!banner) return null;
    const login = twitchLoginFromLinks(banner.links);
    if (!login) return null; // cannot verify live, so fail closed
    const live = await isChannelLive(login, {
      withCache,
      fetchImpl: opts.fetchImpl,
    });
    return live ? banner : null;
  } catch {
    return null;
  }
}

/**
 * Banner for a server render of a page. Null for a response Oxygen's
 * full-page cache may store (`context.edgeCacheable`, set by server.js):
 * that HTML lives for max-age + stale-while-revalidate (about 32 minutes), so
 * a "We're live" bar baked into it outlives the stream. Those pages get the
 * banner from /api/v (app/routes/api.v.jsx, never cached) after hydration
 * instead. Makes no query and no probe for a candidate request.
 * @param {{edgeCacheable?: boolean, storefront: import('@shopify/hydrogen').Storefront, withCache?: import('@shopify/hydrogen').WithCache}} ctx
 * @param {{fetchImpl?: typeof fetch}} [opts]
 */
export async function loadLiveBannerForPage(ctx, opts = {}) {
  if (ctx.edgeCacheable) return null;
  return loadLiveBanner(ctx, opts);
}
