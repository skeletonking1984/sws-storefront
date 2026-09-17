import ogImageAsset from '~/assets/og-image.jpg';
import {ogImageTags} from '~/lib/ogImage';

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
 *
 * `imageWidth` and `imageHeight` are the REAL pixel dimensions of `image`.
 * Pass them whenever they are known, and leave them out when they are not.
 *
 * Why that matters, 2026-09-17: these two tags used to be hardcoded to
 * 1200x630 for every page, including every product. **Not one of the 122
 * product featured images is 1.91:1** (83 are square, 37 are 4:3, one is
 * portrait), so every product page was telling Discord, Slack and X that a
 * square image was a wide banner. A consumer lays the card out from the
 * declared size before it ever fetches the bytes, which is why the Dreamy
 * Lotus unfurl rendered as a narrow sliver of art in a wide black box. The
 * image was correct the whole time; the measurement next to it was not.
 *
 * Omitting the pair is safe and is the deliberate fallback: every consumer
 * then reads the real size off the image itself. A wrong size is strictly
 * worse than no size.
 * @param {{
 *   title: string,
 *   description: string,
 *   url: string,
 *   image?: string,
 *   imageWidth?: number,
 *   imageHeight?: number,
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
  imageWidth,
  imageHeight,
  type = 'website',
  noIndex = false,
}) {
  const origin = new URL(url).origin;
  // Image tags live in ~/lib/ogImage so they can be imported and tested by
  // a plain script (this file cannot: the asset import above needs Vite).
  // See npm run audit:share-cards -- --self-test.
  const imageTags = ogImageTags({
    image,
    imageWidth,
    imageHeight,
    defaultImage: absoluteAsset(origin, ogImageAsset),
  });

  const tags = [
    {title},
    {name: 'description', content: description},
    {tagName: 'link', rel: 'canonical', href: url},
    {property: 'og:title', content: title},
    {property: 'og:description', content: description},
    {property: 'og:url', content: url},
    {property: 'og:type', content: type},
    ...imageTags.filter((t) => t.property),
    {property: 'og:site_name', content: SITE_NAME},
    {property: 'og:locale', content: 'en_US'},
    {name: 'twitter:card', content: 'summary_large_image'},
    {name: 'twitter:title', content: title},
    {name: 'twitter:description', content: description},
    ...imageTags.filter((t) => t.name),
    {name: 'twitter:site', content: TWITTER_HANDLE},
  ];

  if (noIndex) {
    tags.push({name: 'robots', content: 'noindex'});
  }

  return tags;
}
