import * as serverBuild from 'virtual:react-router/server-build';
import {createRequestHandler, storefrontRedirect} from '@shopify/hydrogen';
import {createHydrogenRouterContext} from '~/lib/context';
import {buildFirstTouchSetCookieHeaders} from '~/lib/clickIds.server';
import {ensureFirstPartyClientId} from '~/lib/firstPartyId.server';
import {ensureFirstPartySession} from '~/lib/firstPartySession.server';
import {previewGate} from '~/lib/previewGate.server';
import {
  applyEdgeCacheHeaders,
  isEdgeCacheCandidate,
} from '~/lib/edgeCache.server';
import {readFirstPartyClientId} from '~/lib/firstPartyId.server';
import {readFirstPartySession} from '~/lib/firstPartySession.server';

/**
 * Paths served to machines, never to a browsing person: the three product
 * feeds Google Merchant, X Shopping and Pinterest ingest. Kept as an exact
 * set rather than a prefix match, so a future `/feedback` route can never
 * silently opt itself out of analytics by matching a `startsWith`.
 *
 * The canonical list of what each channel consumes lives in
 * app/lib/channels.js; this is the serving side of the same three files.
 */
const MACHINE_FEED_PATHS = new Set([
  '/feed.xml',
  '/feed.csv',
  '/feed.pinterest.csv',
]);

function isMachineFeedPath(pathname) {
  return MACHINE_FEED_PATHS.has(pathname);
}

/**
 * A mutating request (the cart POST) must see the first-party cookies this
 * very response is about to set. A visitor whose first page came from the
 * edge cache has no `sws_cid`/`sws_ses` until the /api/v beacon lands, and a
 * cart created before then would be built without a GA4 client id. Adds only
 * a cookie the request does not already carry, so an existing value is never
 * shadowed.
 *
 * @param {Request} request
 * @param {string | null} clientIdSetCookie
 * @param {string | null} sessionSetCookie
 * @returns {Request}
 */
function withFirstPartyCookies(request, clientIdSetCookie, sessionSetCookie) {
  const cookieHeader = request.headers.get('Cookie');
  const add = [];
  if (clientIdSetCookie && !readFirstPartyClientId(cookieHeader)) {
    add.push(clientIdSetCookie.split(';')[0]);
  }
  if (sessionSetCookie && !readFirstPartySession(cookieHeader)) {
    add.push(sessionSetCookie.split(';')[0]);
  }
  if (!add.length) return request;
  const headers = new Headers(request.headers);
  headers.set(
    'Cookie',
    cookieHeader ? `${cookieHeader}; ${add.join('; ')}` : add.join('; '),
  );
  return new Request(request, {headers});
}

/**
 * Export a fetch handler in module format.
 */
export default {
  /**
   * @param {Request} request
   * @param {Env} env
   * @param {ExecutionContext} executionContext
   * @return {Promise<Response>}
   */
  async fetch(request, env, executionContext) {
    try {
      // Optional shared-password gate for non production builds. Returns null
      // and costs one undefined env lookup when PRIVATE_PREVIEW_PASSWORD is
      // unset, which is always the case in production.
      const gated = await previewGate(request, env);
      if (gated) return gated;

      // Eligible for Oxygen's full-page cache? Anonymous GET of a public
      // content route, no query string (see app/lib/edgeCache.server.js).
      // Decided from the RAW request, before React Router normalises a
      // `.data` URL, so a client navigation is never mistaken for a page.
      const edgeCacheKind = isEdgeCacheCandidate(request);

      // First-party ids are minted before the handler for a request that is
      // not a cache candidate, so the cart action reads the same values the
      // response then sets. Same single call per request as before.
      const firstPartyId = edgeCacheKind
        ? null
        : ensureFirstPartyClientId(request);
      const firstPartySession = edgeCacheKind
        ? null
        : ensureFirstPartySession(request);
      if (
        !edgeCacheKind &&
        request.method !== 'GET' &&
        request.method !== 'HEAD'
      ) {
        request = withFirstPartyCookies(
          request,
          firstPartyId.setCookie,
          firstPartySession.setCookie,
        );
      }

      const hydrogenContext = await createHydrogenRouterContext(
        request,
        env,
        executionContext,
        {edgeCacheable: Boolean(edgeCacheKind)},
      );

      /**
       * Create a Hydrogen request handler that internally
       * delegates to React Router for routing and rendering.
       */
      const handleRequest = createRequestHandler({
        build: serverBuild,
        mode: process.env.NODE_ENV,
        getLoadContext: () => hydrogenContext,
        // Hydrogen turns the Storefront API's tracking cookies and the
        // visitor tokens in Server-Timing into response headers. None of
        // that may sit in a stored page. The browser fetches them itself
        // through the same-origin Storefront API proxy instead (Hydrogen's
        // useShopifyCookies fetchTrackingValues path), so consent and
        // Shopify analytics keep working. Uncached routes are unchanged.
        collectTrackingInformation: !edgeCacheKind,
      });

      const response = await handleRequest(request);

      if (hydrogenContext.session.isPending) {
        response.headers.set(
          'Set-Cookie',
          await hydrogenContext.session.commit(),
        );
      }

      // Full-page cache. Only a response that is provably visitor free gets
      // the header, and then it returns BEFORE the cookie layer below, which
      // would otherwise stamp Set-Cookie on it. If the guard refuses (a
      // cookie appeared, a non-200), the request falls through and is served
      // uncached with the full cookie layer, exactly as before.
      if (edgeCacheKind && applyEdgeCacheHeaders(response, edgeCacheKind)) {
        return response;
      }

      // Machine feeds are not visitors. The analytics cookie layer below
      // (first-touch click ids, `sws_cid`, `sws_ses`) exists to follow a
      // PERSON from a landing page to a purchase, and a channel crawler is
      // neither. Verified 2026-09-17: a plain curl of /feed.csv came back
      // carrying `sws_cid` and `sws_ses`, so every ingestion attempt by X,
      // Google and Pinterest was minting a brand new visitor and a brand
      // new session against a file no person ever opens. Returned before
      // the cookie layer, after the Hydrogen session commit above, which
      // is left alone because it is cart state, not analytics.
      if (isMachineFeedPath(new URL(request.url).pathname)) {
        return response;
      }

      // First-touch click id capture (see app/lib/clickIds.server.js). A
      // click id only ever arrives on the landing request's URL, not on
      // whatever later request creates the cart, so it has to be pinned to
      // a first-party cookie here, on every request, before it is gone.
      // Cheap on requests with no known click id param (the common case):
      // one URLSearchParams scan against a short list of names. Uses
      // `.append()`, never `.set()`, so an unrelated Set-Cookie already on
      // the response (the session commit above) is never clobbered.
      for (const cookieHeader of buildFirstTouchSetCookieHeaders(request)) {
        response.headers.append('Set-Cookie', cookieHeader);
      }

      // First-party GA4 client id (see app/lib/firstPartyId.server.js).
      // Minted once, HttpOnly, on this app's own domain -- survives a
      // blocker that stops gtag.js (and so the `_ga` cookie) from ever
      // existing. `.append()`, never `.set()`, for the same reason as
      // above: it must not clobber the session commit or the first-touch
      // click id cookies already on this response.
      const firstPartyIdSetCookie = (
        firstPartyId ?? ensureFirstPartyClientId(request)
      ).setCookie;
      if (firstPartyIdSetCookie) {
        response.headers.append('Set-Cookie', firstPartyIdSetCookie);
      }

      // First-party SESSION, the companion to the client id above (see
      // app/lib/firstPartySession.server.js). A client id with NO session id
      // is why four of the last seven orders detached from their landing
      // page: the Measurement Protocol attaches a purchase with no session_id
      // to whatever session is open for that client, which was sometimes the
      // one Shopify's checkout tag opened on shop.streamwidgetshop.com, and
      // sometimes none at all. Same `.append()` discipline as above.
      const firstPartySessionSetCookie = (
        firstPartySession ?? ensureFirstPartySession(request)
      ).setCookie;
      if (firstPartySessionSetCookie) {
        response.headers.append('Set-Cookie', firstPartySessionSetCookie);
      }

      if (response.status === 404) {
        /**
         * Check for redirects only when there's a 404 from the app.
         * If the redirect doesn't exist, then `storefrontRedirect`
         * will pass through the 404 response.
         */
        return storefrontRedirect({
          request,
          response,
          storefront: hydrogenContext.storefront,
        });
      }

      return response;
    } catch (error) {
      console.error(error);
      return new Response('An unexpected error occurred', {status: 500});
    }
  },
};
