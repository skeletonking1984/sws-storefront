import {ServerRouter} from 'react-router';
import {isbot} from 'isbot';
import {renderToReadableStream} from 'react-dom/server';
import {createContentSecurityPolicy} from '@shopify/hydrogen';

/**
 * @param {Request} request
 * @param {number} responseStatusCode
 * @param {Headers} responseHeaders
 * @param {EntryContext} reactRouterContext
 * @param {HydrogenRouterContextProvider} context
 */
export default async function handleRequest(
  request,
  responseStatusCode,
  responseHeaders,
  reactRouterContext,
  context,
) {
  const {nonce, header, NonceProvider} = createContentSecurityPolicy({
    shop: {
      checkoutDomain: context.env.PUBLIC_CHECKOUT_DOMAIN,
      storeDomain: context.env.PUBLIC_STORE_DOMAIN,
    },
    // Product videos are served from the store's own custom domain
    // (.../cdn/shop/videos/...), not cdn.shopify.com.
    //
    // WHICH custom domain is not fixed: Shopify builds those CDN URLs from
    // the ONLINE STORE's primary domain, and that moved to
    // shop.streamwidgetshop.com on 2026-09-11 when the apex was handed to
    // Hydrogen and checkout had to stay on a brand subdomain. CSP host
    // matching is exact, so an allowlist entry for the apex does not cover
    // the subdomain, and every product video died silently the moment the
    // domain moved. The wildcard is deliberate: the media host is a moving
    // target and this must not break again the next time it moves.
    // Hydrogen's CSP helper has no mediaSrc option, and media-src falls
    // back to default-src per the CSP spec, so extend that instead,
    // without this, video playback silently fails with no console error.
    // GA4 (gtag.js), the X pixel (uwt.js) and the Meta pixel (fbevents.js)
    // are also loaded as plain <script> tags with no scriptSrc directive
    // set, so they land here too, script-src falls back to default-src the
    // same way media-src does. Same trap as the video one: a blocked
    // script fails with no console error, it just never fires.
    defaultSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://shopify.com',
      'https://streamwidgetshop.com',
      'https://*.streamwidgetshop.com',
      'https://www.googletagmanager.com',
      'https://static.ads-twitter.com',
      'https://analytics.twitter.com',
      'https://t.co',
      'https://connect.facebook.net',
      'https://www.facebook.com',
    ],
    // Brand fonts (Baloo 2 + Nunito) come from Google Fonts. Without these two
    // the stylesheet is blocked and the whole site silently falls back to system font.
    styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.shopify.com'],
    // Fonts are self hosted as of 2026-09-15, so no third party font origin.
    fontSrc: ["'self'", 'https://cdn.shopify.com'],
    // Beacon/collect requests gtag.js and uwt.js make via fetch or
    // sendBeacon, not a plain script or img load. connectSrc is an explicit
    // directive here (it already has a default), so these must be listed
    // even though the same hosts are also above in defaultSrc for the
    // script tag itself.
    connectSrc: [
      // HLS playback (.m3u8 plus its segments) is fetched, not loaded as a
      // plain media element source, so the media host has to be here too or
      // the video stalls at 0:00 exactly as if the file were missing.
      "'self'",
      'https://streamwidgetshop.com',
      'https://*.streamwidgetshop.com',
      'https://cdn.shopify.com',
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://analytics.google.com',
      // gtag sends a SECOND beacon per event, to stats.g.doubleclick.net,
      // whenever Google Signals is on for the property. It carries the same
      // tid and cid as the /g/collect above and is what feeds demographics,
      // cross device and any Google Ads remarketing audience. Measured
      // blocked on production 2026-09-23 on both the homepage and a
      // collection page: "Connecting to 'https://stats.g.doubleclick.net/g/
      // collect?...tid=G-X0978HDVTK' violates ... connect-src".
      //
      // It failed the way everything else in this file fails: the purchase
      // numbers stayed right, because purchase is sent server side from the
      // orders webhook and never touches this, so no report looked wrong.
      // Only the audience data was missing, and a missing audience does not
      // announce itself anywhere except the visitor's own console.
      'https://stats.g.doubleclick.net',
      // Not measured here, added because this machine is in the US and GA4
      // routes some regions to a region1 endpoint instead of the global one.
      // Same silent failure if it is ever hit and missing, and allowlisting
      // a Google collect host this page already talks to costs nothing.
      'https://region1.google-analytics.com',
      'https://region1.analytics.google.com',
      'https://analytics.twitter.com',
      'https://t.co',
      'https://connect.facebook.net',
      'https://www.facebook.com',
    ],
  });

  const body = await renderToReadableStream(
    <NonceProvider>
      <ServerRouter
        context={reactRouterContext}
        url={request.url}
        nonce={nonce}
      />
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get('user-agent'))) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  responseHeaders.set('Content-Security-Policy', header);
  /*
    The PDP picks its video rendition from `Sec-CH-UA-Mobile` (see the
    product loader), so a cache in front of this must not hand a phone's
    HTML to a desktop or the other way round.

    Scoped to product routes rather than set globally: the product page is
    the only response whose body depends on that header, and splitting the
    cache key for the homepage, collections and the cart would cost hit rate
    to protect a difference that does not exist there.
  */
  if (new URL(request.url).pathname.startsWith('/products/')) {
    responseHeaders.append('Vary', 'Sec-CH-UA-Mobile');
  }

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}

/** @typedef {import('@shopify/hydrogen').HydrogenRouterContextProvider} HydrogenRouterContextProvider */
/** @typedef {import('react-router').EntryContext} EntryContext */
