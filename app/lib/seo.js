import ogImageAsset from '~/assets/og-image.jpg';

const SITE_NAME = 'Stream Widget Shop';
const TWITTER_HANDLE = '@streamwidget';
const PRODUCTION_ORIGIN = 'https://streamwidgetshop.com';

/**
 * Pulls the canonical origin the root loader computed from the real request
 * (production domain if the request came in on it, otherwise the actual
 * request origin, e.g. localhost or a preview host) out of a route meta
 * function's `matches` argument.
 *
 * Reading it off the root match avoids adding an `origin` field to every
 * route loader, since React Router meta functions already receive every
 * ancestor match's loader data.
 * @param {Array<{id: string, data: any}>} matches
 * @returns {string}
 */
export function getOrigin(matches) {
  const root = matches?.find((match) => match.id === 'root');
  return root?.data?.origin || PRODUCTION_ORIGIN;
}

/**
 * Turn a Vite asset import into an absolute URL, without double-prefixing.
 *
 * The trap: in dev, Vite hands back a root-relative path (`/assets/og-image
 * -<hash>.jpg`) and the origin has to be prepended. On Oxygen it hands back
 * a FULL absolute Shopify CDN URL, and prepending the origin then produces
 * `https://streamwidgetshop.comhttps://cdn.shopify.com/...`, which is a
 * valid-looking string and a dead link. It shipped that way to production on
 * 2026-09-10 and every shared link rendered with no thumbnail.
 *
 * Anything already absolute is returned untouched.
 *
 * @param {string} origin
 * @param {string} asset
 */
export function absoluteAsset(origin, asset) {
  if (!asset) return asset;
  return /^https?:\/\//.test(asset) ? asset : `${origin}${asset}`;
}

/**
 * Builds the shared React Router meta descriptor array for a route: title,
 * description, canonical link, Open Graph tags, and Twitter Card tags.
 *
 * `url` must be an absolute URL (build it with `getOrigin(matches) +
 * location.pathname` in the calling route's meta function).
 *
 * `image`, if provided, must also be an absolute URL (e.g. a product's own
 * Shopify CDN image URL). If omitted, this falls back to the site's default
 * OG image, resolved against the same origin as `url`.
 * @param {{
 *   title: string,
 *   description: string,
 *   url: string,
 *   image?: string,
 *   type?: string,
 *   noIndex?: boolean,
 * }} options
 * @returns {Array<Record<string, any>>}
 */
export function buildMeta({
  title,
  description,
  url,
  image,
  type = 'website',
  noIndex = false,
}) {
  const origin = new URL(url).origin;
  const ogImage = image || absoluteAsset(origin, ogImageAsset);

  const tags = [
    {title},
    {name: 'description', content: description},
    {tagName: 'link', rel: 'canonical', href: url},
    {property: 'og:title', content: title},
    {property: 'og:description', content: description},
    {property: 'og:url', content: url},
    {property: 'og:type', content: type},
    {property: 'og:image', content: ogImage},
    {property: 'og:image:width', content: '1200'},
    {property: 'og:image:height', content: '630'},
    {property: 'og:site_name', content: SITE_NAME},
    {property: 'og:locale', content: 'en_US'},
    {name: 'twitter:card', content: 'summary_large_image'},
    {name: 'twitter:title', content: title},
    {name: 'twitter:description', content: description},
    {name: 'twitter:image', content: ogImage},
    {name: 'twitter:site', content: TWITTER_HANDLE},
  ];

  if (noIndex) {
    tags.push({name: 'robots', content: 'noindex'});
  }

  return tags;
}
