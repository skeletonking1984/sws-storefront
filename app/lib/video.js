/**
 * Shared helpers for turning a Storefront API `Video` media node plus the
 * committed `app/data/video-metadata.json` (Admin API `uploadDate`/`duration`,
 * see that file's own `sourceNote`) into the pieces used by both the PDP's
 * VideoObject JSON-LD (`app/routes/products.$handle.jsx`) and the video
 * sitemap (`app/lib/sitemap.js` + the sitemap route).
 *
 * Kept in one place so the two never disagree on which mp4 rendition counts
 * as "highest resolution" or how a video id is looked up.
 */

/**
 * The Storefront API returns the full GID (`gid://shopify/Video/123`) on a
 * product's media node; `video-metadata.json` is keyed by just the numeric
 * id, so this splits on the last `/` to join the two.
 * @param {string | undefined} gid
 * @returns {string | undefined}
 */
export function videoIdFromGid(gid) {
  if (!gid) return undefined;
  return gid.split('/').pop();
}

/**
 * Picks the highest resolution mp4 `source` off a Video media node. Google
 * wants a direct file for `contentUrl`/`video:content_loc`, so the m3u8
 * (adaptive HLS playlist) is ignored even when present.
 * @param {Array<{url: string, mimeType?: string, format?: string, width?: number, height?: number}>} sources
 */
export function pickBestMp4Source(sources) {
  const mp4Sources = (sources ?? []).filter(
    (source) => source.mimeType === 'video/mp4' || source.format === 'mp4',
  );
  if (!mp4Sources.length) return undefined;
  return mp4Sources.reduce((best, source) => {
    const bestArea = (best.width ?? 0) * (best.height ?? 0);
    const sourceArea = (source.width ?? 0) * (source.height ?? 0);
    return sourceArea > bestArea ? source : best;
  });
}

/**
 * Looks up a Video media node's real `uploadDate`/`duration` in the
 * committed metadata file. Returns `undefined` (never a fabricated date)
 * when the id has no entry, per the rule that `uploadDate` is required by
 * Google and a wrong one is worse than none.
 * @param {{videos?: Record<string, {uploadDate: string, duration: string, durationMs: number}>}} videoMetadata
 * @param {string | undefined} gid
 */
export function lookupVideoMetadata(videoMetadata, gid) {
  const id = videoIdFromGid(gid);
  if (!id) return undefined;
  return videoMetadata?.videos?.[id];
}

/**
 * Finds the first `Video` node in a product's media list. This catalog puts
 * at most one demo video per product, so "first" is "the" video.
 * @param {Array<{__typename: string}>} media
 */
export function findVideoMedia(media) {
  return (media ?? []).find((item) => item.__typename === 'Video');
}

/**
 * Builds the `VideoObject` JSON-LD for a product's demo video. Lives here,
 * not in a route, because it is the ONE emitter now: only the dedicated
 * watch page (`app/routes/videos.$handle.jsx`) carries it. It used to also
 * render on the PDP, which is exactly what Google's watch-page rule forbids
 * ("a product details page with a complementary video" does not qualify),
 * see that route's header comment for the full story.
 *
 * Returns `undefined` (emitting no VideoObject at all) whenever any required
 * field is missing: `video-metadata.json` has no entry for this video's id,
 * there is no mp4 source, or there is no preview image. A wrong or guessed
 * `uploadDate` is worse than no VideoObject, so nothing here is ever
 * substituted or invented.
 * @param {{title: string, videoMedia: any, meta: {uploadDate: string, duration: string} | undefined, pageUrl: string}}
 */
export function buildVideoObjectJsonLd({title, videoMedia, meta, pageUrl}) {
  if (!meta) return undefined;
  const contentUrl = pickBestMp4Source(videoMedia?.sources)?.url;
  const thumbnailUrl = videoMedia?.previewImage?.url;
  if (!contentUrl || !thumbnailUrl) return undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    // Real alt text on the Shopify video ("Animated Star Goal Widget
    // demo") when present; otherwise a plain factual name derived from the
    // product title, never invented marketing copy.
    name: videoMedia.alt || `${title} demo video`,
    description: `A demo video of the ${title} running on stream.`,
    thumbnailUrl,
    uploadDate: meta.uploadDate,
    duration: meta.duration,
    contentUrl,
    // The watch page's OWN url, never the PDP's. That is the entire point
    // of moving this block: Google resolves the page a VideoObject is
    // embedded on and checks that the page's primary purpose is the video,
    // so `url` has to agree with where this script tag is actually served.
    url: pageUrl,
  };
}
