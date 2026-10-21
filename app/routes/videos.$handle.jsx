import {Link, useLoaderData} from 'react-router';
import {
  buildVideoObjectJsonLd,
  findVideoMedia,
  lookupVideoMetadata,
} from '~/lib/video';
// Real Admin-API uploadDate/duration for every Shopify video, keyed by
// numeric video id. See that file's own sourceNote and
// app/routes/products.$handle.jsx for the other reader of this file.
import videoMetadata from '~/data/video-metadata.json';
import {buildMeta, getOrigin} from '~/lib/seo';
import {subjectFromTitle} from '~/lib/productName';
import {brand} from '~/lib/brand.config';

/**
 * The dedicated watch page for one product's demo video.
 *
 * WHY THIS ROUTE EXISTS, 2026-09-28
 * ----------------------------------
 * Search Console's video report: "Video isn't on a watch page", 69 affected,
 * validation failed 2026-09-24. Until this route, `/sitemap/video/1.xml`
 * nominated the PDP (`app/routes/products.$handle.jsx`) as every video's
 * watch page, and the PDP carried the `VideoObject` JSON-LD.
 *
 * A PDP can never satisfy Google's rule, no matter how correct its markup
 * is. From https://support.google.com/webmasters/answer/9495631 (read
 * 2026-09-28): a watch page's "main purpose is to show a single video," and
 * Google's own example of what is explicitly NOT a watch page is "a product
 * details page with a complementary video." That is a description of this
 * shop's PDP, word for word: a buy box, a description, reviews and related
 * products, with a video alongside all of it. The 2026-09-23/24 fix (see
 * `scripts/audit-watch-pages.mjs`'s prior header) removed the video from cross-sell CARDS on other pages,
 * which was real and needed, but it never touched this deeper problem: the
 * one page the sitemap still pointed at was never eligible to begin with.
 *
 * This route is a page whose entire purpose is the video: a real
 * `<video controls>` first and large, a one-line description, and a link
 * back to the product. Nothing else competes with it. The `VideoObject`
 * JSON-LD moved here from the PDP (see `buildVideoObjectJsonLd` in
 * `app/lib/video.js`) and the video sitemap now nominates this URL instead
 * (`app/lib/sitemap.js`). The PDP's own `<video>` player is unchanged: a
 * buyer who lands there still sees and can play the clip, and a small
 * "Watch the demo" link now points here so Googlebot can discover this page
 * by crawling from the PDP, not only from the sitemap.
 */

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader({context, params}) {
  const {handle} = params;
  const {storefront} = context;

  if (!handle) {
    throw new Response(null, {status: 404});
  }

  const {product} = await storefront.query(VIDEO_WATCH_PRODUCT_QUERY, {
    variables: {handle},
  });

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  const videoMedia = findVideoMedia(product.media?.nodes);
  if (!videoMedia) {
    // No video, no watch page. Matches the PDP's own 404 convention for a
    // handle that does not resolve to something real.
    throw new Response(null, {status: 404});
  }

  const meta = lookupVideoMetadata(videoMetadata, videoMedia.id);

  return {product, videoMedia, meta};
}

export const meta = ({data, matches, location}) => {
  const product = data?.product;
  const title = product?.title ?? '';
  const shortTitle = subjectFromTitle(title) || title;
  const origin = getOrigin(matches);
  const thumbnailUrl = data?.videoMedia?.previewImage?.url;
  return buildMeta({
    title: `${shortTitle} demo video | ${brand.name}`,
    description: `Watch the ${shortTitle} running on stream, straight from the file a buyer downloads.`,
    url: `${origin}${location.pathname}`,
    image: thumbnailUrl,
  });
};

export default function VideoWatch() {
  /** @type {LoaderReturnData} */
  const {product, videoMedia, meta: videoMeta} = useLoaderData();
  const title = product.title;
  const shortTitle = subjectFromTitle(title) || title;
  const pageUrl = `${brand.origin}/videos/${product.handle}`;

  const videoJsonLd = buildVideoObjectJsonLd({
    title,
    videoMedia,
    meta: videoMeta,
    pageUrl,
  });

  return (
    <div className="watch-page">
      {videoJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(videoJsonLd).replace(/</g, '\\u003c'),
          }}
        />
      )}
      <video
        controls
        autoPlay
        loop
        muted
        playsInline
        poster={videoMedia.previewImage?.url}
        className="watch-video"
      >
        {(videoMedia.sources ?? []).map((source) => (
          <source key={source.url} src={source.url} type={source.mimeType} />
        ))}
      </video>
      <h1 className="watch-title">{shortTitle} demo</h1>
      <p className="watch-description">
        A real demo of the {shortTitle} running on stream, the exact file a
        buyer downloads.
      </p>
      <Link to={`/products/${product.handle}`} className="watch-back-link">
        See the {shortTitle} product page →
      </Link>
    </div>
  );
}

const VIDEO_WATCH_PRODUCT_QUERY = `#graphql
  query VideoWatchProduct($handle: String!) {
    product(handle: $handle) {
      id
      handle
      title
      media(first: 25) {
        nodes {
          __typename
          ... on Video {
            id
            alt
            previewImage {
              url
            }
            sources {
              url
              mimeType
              format
              width
              height
            }
          }
        }
      }
    }
  }
`;

/** @typedef {import('./+types/videos.$handle').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
