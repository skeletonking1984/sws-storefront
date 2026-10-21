/**
 * Live status probes for the /compatibility page.
 *
 * SERVER ONLY. The `.server.js` suffix keeps this file out of the client
 * bundle, and that is the whole point: the probe addresses (STATUS_URL_* env vars) are internal and
 * must never reach the browser (not in the HTML, not in a data request, not
 * in a script). The route loader calls `getServiceStatus()` and passes on
 * only `{feature, state, checkedAt}`. `feature` is a customer-facing label.
 *
 * States:
 *   up      expected status code, answered in under SLOW_MS
 *   slow    expected status code but slow, or any unexpected non-5xx code
 *   down    timeout, network error, or a 5xx
 *   unknown the probe step itself failed; never rendered as green
 *
 * Result cache: 60 seconds in the Cache API, so page loads do not hammer the
 * services. If the Cache API is missing (older runtimes) it just probes.
 */

const PROBE_TIMEOUT_MS = 3000;
const SLOW_MS = 1500;
const CACHE_TTL_S = 60;
const CACHE_NAME = 'sws-compat-status-v2';
const CACHE_KEY = 'https://status-cache.invalid/compat';

/**
 * The only place the probe targets live. `feature` is what a customer reads.
 * Ko-fi is deliberately absent (unshipped). Niconico has no dot (not a listed
 * product).
 */
const PROBES = [
  {feature: 'Stream Chat Lite', envKey: 'STATUS_URL_CHAT', expect: 200},
  {feature: 'Now Playing music widget', envKey: 'STATUS_URL_NOWPLAYING', expect: 200},
  {feature: 'Downloads', envKey: 'STATUS_URL_DOWNLOADS', expect: 200},
];

/** Probe URLs come from server env vars so internal hosts never live in source. */
function probeUrl(probe, env) {
  const url = env?.[probe.envKey];
  return typeof url === 'string' && url.startsWith('https://') ? url : null;
}

/** Customer-facing labels, in display order. Safe to send to the browser. */
export const SERVICE_FEATURES = PROBES.map((probe) => probe.feature);

/**
 * Pure classifier, exported so the self-test can feed it known inputs.
 * @param {{status?: number, elapsedMs?: number, failed?: boolean}} result
 * @param {number} expect
 * @returns {'up' | 'slow' | 'down'}
 */
export function classifyProbe({status, elapsedMs, failed}, expect) {
  if (failed || typeof status !== 'number') return 'down';
  if (status >= 500) return 'down';
  if (status === expect) return elapsedMs < SLOW_MS ? 'up' : 'slow';
  return 'slow';
}

async function runProbe(probe, now, env) {
  const checkedAt = new Date(now()).toISOString();
  const url = probeUrl(probe, env);
  if (!url) return {feature: probe.feature, state: 'unknown', checkedAt};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'manual',
      headers: {'user-agent': 'sws-compat-status'},
    });
    const elapsedMs = Date.now() - started;
    // Drop the body without reading it.
    response.body?.cancel?.().catch(() => {});
    return {
      feature: probe.feature,
      state: classifyProbe({status: response.status, elapsedMs}, probe.expect),
      checkedAt,
    };
  } catch {
    return {feature: probe.feature, state: 'down', checkedAt};
  } finally {
    clearTimeout(timer);
  }
}

function unknownResult(now) {
  let checkedAt;
  try {
    checkedAt = new Date(now()).toISOString();
  } catch {
    checkedAt = new Date().toISOString();
  }
  return SERVICE_FEATURES.map((feature) => ({
    feature,
    state: 'unknown',
    checkedAt,
  }));
}

/**
 * Probes every service in parallel (3s timeout each) and caches the answer
 * for 60 seconds. Never throws: if anything in this step fails, every
 * feature comes back as `unknown`, which the page renders as grey
 * "Status unavailable".
 * @returns {Promise<Array<{feature: string, state: string, checkedAt: string}>>}
 */
export async function getServiceStatus({env, now = Date.now} = {}) {
  try {
    let cache = null;
    try {
      cache = typeof caches !== 'undefined' ? await caches.open(CACHE_NAME) : null;
      const hit = cache ? await cache.match(CACHE_KEY) : null;
      if (hit) {
        const cached = await hit.json();
        if (Array.isArray(cached) && cached.length === PROBES.length) return cached;
      }
    } catch {
      cache = null;
    }

    const results = await Promise.all(PROBES.map((probe) => runProbe(probe, now, env)));

    try {
      if (cache) {
        await cache.put(
          CACHE_KEY,
          new Response(JSON.stringify(results), {
            headers: {
              'content-type': 'application/json',
              'cache-control': `public, max-age=${CACHE_TTL_S}`,
            },
          }),
        );
      }
    } catch {
      // A failed cache write only costs an extra probe next time.
    }
    return results;
  } catch {
    return unknownResult(now);
  }
}
