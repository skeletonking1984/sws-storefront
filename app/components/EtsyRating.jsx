import etsyShopStats from '~/data/etsy-shop-stats.json';

/**
 * Shop-level Etsy rating, shown as a trust signal on product pages.
 *
 * This is the aggregate rating for brand.config.js's `social.etsySlug`
 * Etsy shop (not a per-listing
 * rating, Etsy doesn't expose a reliable per-listing sample size for every
 * product). Sourced from app/data/etsy-shop-stats.json, the small
 * client-safe stats-only slice rebuilt by scripts/build-etsy-reviews.mjs.
 * The full per-product review text lives in app/data/etsy-reviews.json,
 * server use only, never import that one here.
 */
export const SHOP_RATING = {
  average: etsyShopStats.shop.average,
  count: etsyShopStats.shop.count,
  url: etsyShopStats.shop.url,
};

/** Shop-wide Etsy stats, for trust strips (e.g. homepage hero). */
export const SHOP_STATS = {
  soldCount: etsyShopStats.shop.soldCount,
  favoriteCount: etsyShopStats.shop.favoriteCount,
};

/*
 * `href` jumps to the reviews on THIS page. It used to open Etsy in a new
 * tab, which sat beside the price on every product page and sent the buyer
 * to a second store mid decision (2026-10-22 conversion pass). The rating
 * is still stated as text; it just no longer leaves the site.
 */
export function EtsyRatingBadge({compact = false, href = '#shop-reviews'}) {
  const fullStars = Math.round(SHOP_RATING.average);
  return (
    <a
      href={href}
      className={`etsy-rating${compact ? ' etsy-rating-compact' : ''}`}
    >
      <span className="etsy-rating-stars" aria-hidden="true">
        {Array.from({length: 5}, (_, i) => (i < fullStars ? '★' : '☆')).join(
          '',
        )}
      </span>
      <span className="etsy-rating-text">
        {SHOP_RATING.average.toFixed(2)} Etsy rating ({SHOP_RATING.count}{' '}
        reviews)
      </span>
    </a>
  );
}
