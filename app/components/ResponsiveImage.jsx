import {cdnImageSrcSet, cdnImageUrl} from '~/lib/shopifyImage';

/**
 * A Shopify CDN image that actually ships a `srcset`, and never crops.
 *
 * Drop in for Hydrogen's `<Image data={...} sizes={...} />` on this catalog.
 * Hydrogen's own component could not be used here: it only builds a srcset
 * when it knows the image's dimensions, and this repo deliberately strips
 * `width`/`height` from the image fragments so that <Image> cannot derive an
 * aspect ratio and append `crop=center` to non square product art. The result
 * was a page with no responsive images at all (verified on the live homepage
 * 2026-09-15: 0 srcset attributes, 528 KiB wasted across 13 images).
 *
 * `sizes` is required, because a srcset without it makes the browser assume
 * the image fills the viewport and pick the largest candidate, which is the
 * bug this component exists to fix.
 *
 * @param {{
 *   data?: {url?: string; altText?: string | null} | null;
 *   sizes: string;
 *   alt?: string;
 *   loading?: 'eager' | 'lazy';
 *   fetchPriority?: 'high' | 'low' | 'auto';
 *   className?: string;
 *   widths?: number[];
 *   fallbackWidth?: number;
 * }}
 */
export function ResponsiveImage({
  data,
  sizes,
  alt,
  loading = 'lazy',
  fetchPriority,
  className,
  widths,
  fallbackWidth = 600,
}) {
  const url = data?.url;
  if (!url) return null;

  return (
    <img
      className={className}
      // `src` is the fallback for anything that ignores srcset. Sized for a
      // mid range card rather than left at the full original.
      src={cdnImageUrl(url, fallbackWidth)}
      srcSet={cdnImageSrcSet(url, widths)}
      sizes={sizes}
      alt={alt ?? data?.altText ?? ''}
      loading={loading}
      fetchPriority={fetchPriority}
    />
  );
}
