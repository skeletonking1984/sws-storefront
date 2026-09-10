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
    // (streamwidgetshop.com/cdn/shop/videos/...), not cdn.shopify.com.
    // Hydrogen's CSP helper has no mediaSrc option, and media-src falls
    // back to default-src per the CSP spec, so extend that instead,
    // without this, video playback silently fails with no console error.
    // GA4 (gtag.js) and the X pixel (uwt.js) are also loaded as plain
    // <script> tags with no scriptSrc directive set, so they land here too,
    // script-src falls back to default-src the same way media-src does.
    // Same trap as the video one: a blocked script fails with no console
    // error, it just never fires.
    defaultSrc: [
      "'self'",
      'https://cdn.shopify.com',
      'https://shopify.com',
      'https://streamwidgetshop.com',
      'https://www.googletagmanager.com',
      'https://static.ads-twitter.com',
      'https://analytics.twitter.com',
      'https://t.co',
    ],
    // Brand fonts (Baloo 2 + Nunito) come from Google Fonts. Without these two
    // the stylesheet is blocked and the whole site silently falls back to system font.
    styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.shopify.com', 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'https://cdn.shopify.com', 'https://fonts.gstatic.com'],
    // Beacon/collect requests gtag.js and uwt.js make via fetch or
    // sendBeacon, not a plain script or img load. connectSrc is an explicit
    // directive here (it already has a default), so these must be listed
    // even though the same hosts are also above in defaultSrc for the
    // script tag itself.
    connectSrc: [
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://analytics.google.com',
      'https://analytics.twitter.com',
      'https://t.co',
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
