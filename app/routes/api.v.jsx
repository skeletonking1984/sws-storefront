import {loadLiveBanner} from '~/lib/liveBanner';

/**
 * `/api/v`: the visitor's own cart and login state, the "We're live" banner,
 * plus the first-party cookies a cached page could not set.
 *
 * Public pages are stored by Oxygen's full-page cache and handed to every
 * visitor (app/lib/edgeCache.server.js), so they cannot carry a cart, a
 * signed in name, or Set-Cookie. After hydration the browser calls this once
 * (`useVisitor` in app/root.jsx). It runs the worker, so server.js stamps the
 * first-party `sws_cid`/`sws_ses` cookies on the response exactly as it does
 * on any uncached request, and it returns the cart and login state.
 *
 * The live banner is here for the same reason as the cart: it changes within
 * a minute (the stream starts and ends), and a stored page would show a stale
 * one for up to ~32 minutes. loadLiveBanner never throws and fails closed
 * (null), and with the metafield off it costs one CacheShort query, run in
 * parallel with the cart read so it adds no latency to this route.
 *
 * Never cacheable: no Oxygen-Cache-Control, and Cache-Control says private,
 * no-store. Not a candidate in isEdgeCacheCandidate. Path is deliberately
 * generic, same reasoning as /api/e.
 *
 * A failure here must not break the page: it degrades to an empty cart and a
 * signed out header, which is what the cached page already showed.
 */

/**
 * @param {import('react-router').LoaderFunctionArgs} args
 */
export async function loader({context}) {
  let cart = null;
  let isLoggedIn = false;
  // Started first so it overlaps the cart read. Cannot reject (see above), so
  // a failure here never costs the visitor their cart state, and vice versa.
  const liveBannerPromise = loadLiveBanner(context);
  try {
    [cart, isLoggedIn] = await Promise.all([
      context.cart.get(),
      context.customerAccount.isLoggedIn(),
    ]);
  } catch (error) {
    console.error(error);
  }

  const liveBanner = (await liveBannerPromise) ?? null;

  return new Response(
    JSON.stringify({
      cart: cart ?? null,
      isLoggedIn: Boolean(isLoggedIn),
      liveBanner,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'private, no-store, max-age=0',
        Vary: 'Cookie',
        'X-Robots-Tag': 'noindex',
      },
    },
  );
}
