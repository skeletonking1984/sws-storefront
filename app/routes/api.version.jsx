/**
 * `/api/version` reports which commit this deployment was built from.
 *
 * It exists so that "verified against production" can be checked rather than
 * assumed. On 2026-09-17 three days of commits sat unshipped while checks ran
 * against production and reported on code nobody was serving, and Search
 * Console was counting real failures on the build that WAS live. Nothing could
 * tell the difference because nothing knew what production was running.
 *
 * Resource route, no default export, same shape as api.e.jsx and
 * webhooks.orders.jsx.
 *
 * Deliberately says nothing a competitor could not learn from the page source
 * anyway: a commit hash, its date, and the build time. No paths, no versions
 * of anything, no config. It is also `noindex` via headers rather than robots,
 * since a JSON resource route never reaches the sitemap.
 */
import buildInfo from '~/data/build-info.json';

/**
 * @param {import('@shopify/remix-oxygen').LoaderFunctionArgs} args
 */
export async function loader() {
  return new Response(JSON.stringify(buildInfo), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // No caching. A cached answer would defeat the entire purpose: the
      // question is always "what is running RIGHT NOW".
      'Cache-Control': 'no-store, max-age=0',
      'X-Robots-Tag': 'noindex',
    },
  });
}
