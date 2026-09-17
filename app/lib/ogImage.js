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
 *
 * That fix made each card honest about its own shape, and honest turned out
 * not to be enough: with 1:1, 4:3 and portrait art all declaring themselves
 * truthfully, every product's card came out a different HEIGHT, which is the
 * second thing Todd raised the same day. So the shape is decided here now,
 * rather than by whatever the source art happens to be, and `buildMeta` is
 * simply told the one size. `SHARE_CARD` and `shareCardUrl` below are that
 * decision; `ogImageDimensions` stays as the general helper behind it.
 */

/**
 * The one size every share card is rendered at, and the brand background the
 * spare area is filled with.
 *
 * 1200x630 is the Open Graph standard and what X, Discord, Slack, Facebook
 * and LinkedIn all lay a large card out at. `padColor` is `--sws-bg` from
 * app.css, so the fill reads as the page the link leads to rather than as a
 * black bar.
 */
export const SHARE_CARD = {width: 1200, height: 630, padColor: '0b0713'};

/**
 * A Shopify CDN URL rendered as a share card: exactly SHARE_CARD.width by
 * SHARE_CARD.height, with the whole image inside it and the remainder filled
 * with the brand background.
 *
 * Why PAD and not crop, 2026-09-17. Todd, on two X cards rendering at
 * different heights: "can the image be the same size? make sure it crops
 * right." Same size needs one fixed ratio, and this catalogue has no image
 * anywhere near 1.91:1 (83 square, 37 at 4:3, one portrait), so a fixed ratio
 * means either cropping every product or padding every product.
 *
 * Cropping loses the sale. Verified by rendering both: `crop=center` on the
 * Celestial kit hero cuts off "10 widgets. One sky.", the headline, and the
 * entire platform and price line at the bottom, leaving a jar and some
 * thumbnails. This is the same trap already recorded in CLAUDE.md for gallery
 * images, where `aspectRatio` made Hydrogen append `crop=center` and silently
 * chopped edge content off non-square art. Listing art here carries its
 * words at the top and bottom, which is exactly what a 1.91:1 crop removes.
 *
 * Padding keeps every pixel. Verified on all three shapes: the square Dreamy
 * Lotus, the 4:3 kit hero and the portrait Moon Jar all survive whole and
 * legible, and because the art's own background is near black the fill is
 * close to invisible.
 *
 * Two CDN behaviours this relies on, both measured rather than assumed:
 * `pad_color` is honoured and is genuinely different from `crop` (three
 * requests, three different payloads, and the rendered images differ), and
 * a padded request returns EXACTLY the requested size every time, including
 * when the target is larger than the source. So the declared dimensions are
 * a constant that is always true.
 *
 * Returns the url untouched when it is not parseable, rather than throwing
 * inside a meta function.
 *
 * @param {string} url
 * @returns {string}
 */
export function shareCardUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('width', String(SHARE_CARD.width));
    parsed.searchParams.set('height', String(SHARE_CARD.height));
    // No `crop`. Adding one here would silently switch this from padding to
    // cropping and cost exactly what the comment above describes.
    parsed.searchParams.set('pad_color', SHARE_CARD.padColor);
    return parsed.toString();
  } catch {
    return url;
  }
}

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
