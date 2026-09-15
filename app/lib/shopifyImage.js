/**
 * Responsive sources for Shopify CDN images, WITHOUT ever cropping.
 *
 * Why this is hand rolled instead of using Hydrogen's <Image>:
 *
 * Most of this catalog's source art is not square (a "square looking" product
 * screenshot is often 2801x2161), and Hydrogen's <Image> appends `crop=center`
 * to the CDN URL whenever it knows an aspect ratio, which silently chops the
 * edges off. On 2026-09-07 that was fixed by removing `width`/`height` from the
 * image fragments so Hydrogen could not derive a ratio.
 *
 * That worked, and it cost the srcset. With no dimensions to work from,
 * <Image> emitted a bare <img src> pointing at the full size original. Verified
 * on the live homepage on 2026-09-15: **zero `srcset` attributes on the entire
 * page**, and Lighthouse reported 528 KiB wasted across 13 images, including
 * 1280x1280 and 2000x2000 files painted into 404x404 and 242x242 boxes.
 *
 * So: build the srcset here, with `width` alone and no `crop`. Proven against
 * six real catalog images on 2026-09-15, including a non square 1240x1208 which
 * came back 400x390, the identical ratio. `width` on its own scales, it never
 * crops. That is the whole trick, and it is why nothing in this file may ever
 * add a `crop`, `height` or `aspectRatio` parameter to a CDN URL.
 */

/** Widths worth generating. Covers a 242px card at 3x and a 600px hero at 2x. */
const DEFAULT_WIDTHS = [200, 300, 400, 600, 800, 1200];

/**
 * Same CDN URL at a given rendered width. Preserves any query the URL already
 * carries (Shopify stamps a `v=` cache buster on most of them).
 * @param {string | undefined} url
 * @param {number} width
 * @returns {string | undefined}
 */
export function cdnImageUrl(url, width) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    parsed.searchParams.set('width', String(Math.round(width)));
    // Deliberately not set: crop, height, and anything else that can change
    // the framing. See the note at the top of this file.
    parsed.searchParams.delete('crop');
    parsed.searchParams.delete('height');
    return parsed.toString();
  } catch {
    // A relative or malformed URL is left exactly as it came in rather than
    // guessed at, so a bad value degrades to today's behaviour.
    return url;
  }
}

/**
 * A `srcset` string for the same image at several widths.
 * @param {string | undefined} url
 * @param {number[]} [widths]
 * @returns {string | undefined}
 */
export function cdnImageSrcSet(url, widths = DEFAULT_WIDTHS) {
  if (!url) return undefined;
  return widths.map((w) => `${cdnImageUrl(url, w)} ${w}w`).join(', ');
}
