/**
 * Shop-level Etsy rating, shown as a trust signal on product pages.
 *
 * This is the aggregate StreamWidgetShop rating on Etsy (not a per-listing
 * rating — Etsy doesn't expose a reliable per-listing sample size for every
 * product). Update SHOP_RATING when it's next pulled from the Etsy API.
 */
const SHOP_RATING = {
  average: 4.75,
  count: 981,
  url: 'https://www.etsy.com/shop/StreamWidgetShop/reviews',
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
