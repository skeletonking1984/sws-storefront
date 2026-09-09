import etsyReviews from '~/data/etsy-reviews.json';

/**
 * Shop-level Etsy rating, shown as a trust signal on product pages.
 *
 * This is the aggregate StreamWidgetShop rating on Etsy (not a per-listing
 * rating, Etsy doesn't expose a reliable per-listing sample size for every
 * product). Sourced from app/data/etsy-reviews.json, the single source of
 * truth for shop stats, rebuilt by scripts/build-etsy-reviews.mjs.
 */
export const SHOP_RATING = {
  average: etsyReviews.shop.average,
  count: etsyReviews.shop.count,
  url: etsyReviews.shop.url,
};

/** Shop-wide Etsy stats, for trust strips (e.g. homepage hero). */
export const SHOP_STATS = {
  soldCount: etsyReviews.shop.soldCount,
  favoriteCount: etsyReviews.shop.favoriteCount,
};

export function EtsyRatingBadge({compact = false}) {
  const fullStars = Math.round(SHOP_RATING.average);
  return (
    <a
      href={SHOP_RATING.url}
      target="_blank"
      rel="noopener noreferrer"
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
