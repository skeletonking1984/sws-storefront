import * as serverBuild from 'virtual:react-router/server-build';
import {createRequestHandler, storefrontRedirect} from '@shopify/hydrogen';
import {createHydrogenRouterContext} from '~/lib/context';
import {buildFirstTouchSetCookieHeaders} from '~/lib/clickIds.server';
import {ensureFirstPartyClientId} from '~/lib/firstPartyId.server';

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
      const hydrogenContext = await createHydrogenRouterContext(
        request,
        env,
        executionContext,
      );

      /**
       * Create a Hydrogen request handler that internally
       * delegates to React Router for routing and rendering.
       */
      const handleRequest = createRequestHandler({
        build: serverBuild,
        mode: process.env.NODE_ENV,
        getLoadContext: () => hydrogenContext,
      });

      const response = await handleRequest(request);

      if (hydrogenContext.session.isPending) {
        response.headers.set(
          'Set-Cookie',
          await hydrogenContext.session.commit(),
        );
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
      const {setCookie: firstPartyIdSetCookie} = ensureFirstPartyClientId(request);
      if (firstPartyIdSetCookie) {
        response.headers.append('Set-Cookie', firstPartyIdSetCookie);
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
