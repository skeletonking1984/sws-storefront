/**
 * The share-card image tags, kept in their own file with NO imports.
 *
 * Two reasons it is separate from seo.js. First, seo.js imports the bundled
 * default card as a Vite asset (`~/assets/og-image.jpg`), which plain Node
 * cannot resolve, so nothing in that file can be exercised by a script. An
 * unattended scheduled run cannot start a dev server and Oxygen preview URLs
 * are behind Shopify OAuth, so "load the page and look" is not available
 * either: logic that cannot be imported is logic that ships unverified.
 * Second, this is the exact logic that was wrong, so it is the logic that
 * most needs a test.
 *
 * What was wrong, 2026-09-17: `og:image:width` and `og:image:height` were
 * hardcoded to 1200x630 on every route. Not one of the 122 live product
 * featured images is 1.91:1 (83 square, 37 at 4:3, one 5:4, one portrait),
 * so every product share told Discord, Slack and X that a square image was a
 * wide banner. Consumers lay the card out from the declared size before
 * fetching the bytes, which is why a correct image unfurled as a sliver of
 * art in a black box.
 */

/**
 * The real pixel size of what the Shopify CDN will serve for `?width=N`.
 *
 * The `width` param **never upscales**, so a source narrower than `maxWidth`
 * comes back at its own width and declaring `maxWidth` would be a fresh lie
 * of the same kind this replaces. Height is derived from the source ratio
 * rather than assumed.
 *
 * Returns null when the size is not known, which makes the caller omit the
 * tags. Absent is a safe answer: every consumer then measures the image
 * itself. Present and wrong is not.
 *
 * @param {{width?: number|string, height?: number|string} | null | undefined} image
 * @param {number} maxWidth
 * @returns {{width: number, height: number} | null}
 */
export function ogImageDimensions(image, maxWidth) {
  const sourceWidth = Number(image?.width);
  const sourceHeight = Number(image?.height);
  if (!Number.isFinite(sourceWidth) || sourceWidth <= 0) return null;
  if (!Number.isFinite(sourceHeight) || sourceHeight <= 0) return null;
  const width = Math.min(maxWidth, Math.round(sourceWidth));
  return {width, height: Math.round((width * sourceHeight) / sourceWidth)};
}

/**
 * The `og:image` / `og:image:width` / `og:image:height` / `twitter:image`
 * descriptors for one page.
 *
 * @param {{
 *   image?: string,
 *   imageWidth?: number,
 *   imageHeight?: number,
 *   defaultImage: string,
 * }} options
 * @returns {Array<Record<string, any>>}
 */
export function ogImageTags({image, imageWidth, imageHeight, defaultImage}) {
  const usingDefault = !image;
  const src = image || defaultImage;

  // The bundled default card genuinely is 1200x630, so it keeps its size. A
  // caller-supplied image only gets a size when the caller supplied one.
  const size = usingDefault
    ? {width: 1200, height: 630}
    : ogImageDimensions({width: imageWidth, height: imageHeight}, Infinity);

  return [
    {property: 'og:image', content: src},
    ...(size
      ? [
          {property: 'og:image:width', content: String(size.width)},
          {property: 'og:image:height', content: String(size.height)},
        ]
      : []),
    {name: 'twitter:image', content: src},
  ];
}
