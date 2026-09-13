/**
 * Same-origin event relay: `/api/e`, for the browser ecommerce events
 * (page_view, view_item, view_item_list, select_item, add_to_cart,
 * remove_from_cart, view_cart, begin_checkout, search -- see
 * app/lib/analytics/events.js) that PixelBus.jsx would otherwise only
 * send via a third-party pixel script. A content blocker that kills
 * gtag.js/uwt.js/fbevents.js kills those events too; this route gives
 * PixelBus.jsx a same-origin fallback path that a blocker cannot single
 * out just by watching for a third-party host.
 *
 * The path is deliberately generic. `/track`, `/collect`, `/analytics`
 * and `/pixel` are common enough that they show up as generic rules on
 * public filter lists (EasyList and friends) independent of any specific
 * vendor; `/api/e` is not a known analytics path and has no reason to be
 * targeted on its own. This is obscurity, not a security boundary --  see
 * docs/conversion-tracking.md's ad-blocker section for the honest limits
 * of that.
 *
 * PixelBus.jsx only ever POSTs here when it has already determined the
 * browser pixel did NOT load (see PixelBus.jsx and
 * app/lib/analytics/pixels/ga4.js's `didLoad`), so a normal, unblocked
 * visitor never touches this route at all and nothing double counts.
 *
 * Resource route: no default export, same pattern as
 * app/routes/webhooks.orders.jsx. `loader` exists only to return an
 * explicit 405 for GET, because React Router's own "no loader for this
 * route" fallback surfaced as a 400 in testing on that route, not the 405
 * the framework docs describe.
 */

import {destinations} from '~/lib/conversions/index.server';
import {readClickIds} from '~/lib/clickIds.server';

/**
 * Every event name app/lib/analytics/events.js's `normalizeEvent` can
 * produce. `purchase` is deliberately never in this set: purchase is the
 * orders/create webhook's job alone (see app/routes/webhooks.orders.jsx),
 * verified against Shopify's own HMAC signature. Accepting a purchase
 * event on a route reachable from any page's JS would let anyone forge
 * revenue with a single POST.
 */
const ALLOWED_EVENT_NAMES = new Set([
  'page_view',
  'view_item',
  'view_item_list',
  'select_item',
  'add_to_cart',
  'remove_from_cart',
  'view_cart',
  'begin_checkout',
  'search',
]);

export function loader() {
  return new Response('Method Not Allowed', {status: 405});
}

/**
 * @param {Route.ActionArgs} args
 */
export async function action({request, context}) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {status: 405});
  }

  if (!isSameOriginRequest(request)) {
    return new Response('Forbidden', {status: 403});
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response('Bad Request', {status: 400});
  }

  const name = body?.name;
  if (typeof name !== 'string' || !ALLOWED_EVENT_NAMES.has(name)) {
    return new Response('Bad Request', {status: 400});
  }

  const params =
    body?.params && typeof body.params === 'object' ? body.params : {};

  // Same precedence as the purchase path (see app/lib/clickIds.server.js),
  // which is exactly why Part 1 (the app-owned `sws_cid` fallback) has to
  // exist before this route is worth building: without it, a blocked
  // visitor's relayed events would carry no client id at all.
  const clickIds = readClickIds(request);

  // Fan out to every destination that implements the optional `sendEvent`
  // (see app/lib/conversions/index.server.js). A destination without it is
  // simply skipped -- adding a platform's event relay stays one file.
  // Promise.allSettled + always-204, same isolation as
  // app/routes/webhooks.orders.jsx: one destination's failure must never
  // surface to the browser or block another destination's send.
  const results = await Promise.allSettled(
    destinations
      .filter((destination) => typeof destination.sendEvent === 'function')
      .map(async (destination) => {
        if (!destination.isConfigured(context.env)) {
          return {id: destination.id, ok: false, reason: 'not_configured'};
        }
        return destination.sendEvent({
          env: context.env,
          name,
          params,
          clickIds,
        });
      }),
  );

  for (const result of results) {
    if (result.status === 'rejected') {
      // Only reachable if a destination threw instead of returning
      // {ok: false}, which its own interface contract says it must not
      // do -- see app/lib/conversions/index.server.js.
      console.error('api.e: a destination threw unexpectedly', result.reason);
    }
  }

  return new Response(null, {status: 204});
}

/**
 * Not a security boundary (no secret is being protected), just a check
 * that this route is not a free relay for an arbitrary third-party page.
 * `Sec-Fetch-Site` is sent by every modern browser and cannot be spoofed
 * by page JS, so it is checked first when present; older browsers/clients
 * that omit it fall back to an `Origin` match.
 *
 * @param {Request} request
 * @returns {boolean}
 */
function isSameOriginRequest(request) {
  const secFetchSite = request.headers.get('Sec-Fetch-Site');
  if (secFetchSite) return secFetchSite === 'same-origin';

  const origin = request.headers.get('Origin');
  if (!origin) return false;

  return origin === new URL(request.url).origin;
}

/** @typedef {import('./+types/api.e').Route} Route */
