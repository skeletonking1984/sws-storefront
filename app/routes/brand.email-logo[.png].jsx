import logo from '~/assets/logo.png';

/**
 * Stable logo URL for emails: https://streamwidgetshop.com/brand/email-logo.png
 *
 * Shopify notification templates cannot be edited through the API, so the
 * order confirmation email points here once and never changes. This route
 * serves whatever the site header uses (app/assets/logo.png), so swapping the
 * site logo updates every email on the next deploy with no template edit.
 * Bytes are streamed rather than redirected, because some mail image proxies
 * do not follow redirects.
 *
 * @param {Route.LoaderArgs}
 */
export async function loader({request}) {
  const assetUrl = new URL(logo, request.url);
  const res = await fetch(assetUrl);
  if (!res.ok) {
    return new Response('logo unavailable', {status: 502});
  }
  return new Response(res.body, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': `public, max-age=${60 * 60 * 24}`,
    },
  });
}
