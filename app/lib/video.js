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
