/**
 * `/api/quickview/:handle`: the few fields the /bundle quick-view needs
 * (2026-10-18). Fetched only when a shopper opens a
 * quick-view, so the bundle page itself loads nothing extra.
 *
 * Resource route, no default export, same shape as api.version.jsx. Public
 * catalogue data only (what the product page already shows).
 */
import {findVideoMedia, pickBestMp4Source} from '~/lib/video';

/** @param {import('@shopify/remix-oxygen').LoaderFunctionArgs} args */
export async function loader({params, context}) {
  const handle = String(params.handle || '').slice(0, 255);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'X-Robots-Tag': 'noindex',
  };
  if (!/^[a-z0-9-]+$/.test(handle)) {
    return new Response(JSON.stringify({error: 'bad handle'}), {
      status: 400,
      headers,
    });
  }
  const {product} = await context.storefront.query(QUICKVIEW_QUERY, {
    variables: {handle},
    cache: context.storefront.CacheShort(),
  });
  if (!product) {
    return new Response(JSON.stringify({error: 'not found'}), {
      status: 404,
      headers,
    });
  }
  const nodes = product.media?.nodes || [];
  const video = findVideoMedia(nodes);
  const mp4 = video && pickBestMp4Source(video.sources);
  const images = nodes
    .filter((m) => m.__typename === 'MediaImage' && m.image?.url)
    .slice(0, 6)
    .map((m) => ({url: m.image.url, alt: m.image.altText || product.title}));
  if (!images.length && product.featuredImage) {
    images.push({
      url: product.featuredImage.url,
      alt: product.featuredImage.altText || product.title,
    });
  }
  const body = {
    handle: product.handle,
    title: product.title,
    description: shortDescription(product.description),
    video: mp4
      ? {
          url: mp4.url,
          poster: video.previewImage?.url || images[0]?.url || null,
        }
      : null,
    images,
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {...headers, 'Cache-Control': 'public, max-age=300'},
  });
}

/**
 * One or two plain sentences from the product description, about 180
 * characters at most. Plain text in, so no HTML; URLs, emoji runs and dash
 * separators are dropped so the sheet reads as a sentence, not a keyword list.
 */
export function shortDescription(text) {
  const clean = String(text || '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[\u2013\u2014]/g, ',')
    .replace(/[\u2600-\u27BF\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/\uFE0F/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return '';
  const sentences = clean.match(/[^.!?]+[.!?]+/g) || [clean];
  let out = '';
  for (const s of sentences) {
    const next = (out + ' ' + s.trim()).trim();
    if (next.length > 200) break;
    out = next;
    if (out.length > 90) break;
  }
  if (!out) {
    // One long first sentence: end it at the last comma (or word) before
    // ~200 characters so it reads as a phrase, not a cut-off word.
    const head = clean.slice(0, 200);
    const comma = head.lastIndexOf(', ');
    out =
      (comma > 80 ? head.slice(0, comma) : head.replace(/\s+\S*$/, '')).replace(
        /[,;:\s]+$/,
        '',
      ) + '...';
  }
  return out;
}

const QUICKVIEW_QUERY = `#graphql
  query BundleQuickView(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      handle
      title
      description
      featuredImage { url altText }
      media(first: 12) {
        nodes {
          __typename
          ... on MediaImage { image { url altText } }
          ... on Video {
            previewImage { url }
            sources { url mimeType format width height }
          }
        }
      }
    }
  }
`;
