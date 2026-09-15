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

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}

/** @typedef {import('@shopify/hydrogen').HydrogenRouterContextProvider} HydrogenRouterContextProvider */
/** @typedef {import('react-router').EntryContext} EntryContext */
