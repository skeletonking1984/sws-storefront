const SHOP_RATING = {
  average: 4.75,
  count: 981,
  url: 'https://www.etsy.com/shop/StreamWidgetShop/reviews',
};

/**
 * Recurring themes actually observed across real StreamWidgetShop reviews —
 * not Etsy's own per-category scoring (item quality/delivery/etc aren't
 * exposed by Etsy's public API, so we don't fabricate those numbers).
 */
const REVIEW_THEMES = [
  'Easy to install',
  'Cute design',
  'Great customization',
  'Clear tutorial',
  'Works as described',
];

/**
 * A handful of real recent StreamWidgetShop reviews from Etsy, shown as
 * social proof. These are shop-wide (not filtered to this exact listing) —
 * labeled honestly rather than implied as this-product-specific.
 */
const SAMPLE_REVIEWS = [
  {
    rating: 5,
    text: "You can edit the star's colour and also the size, it's super cute and matches my stream really well, plus I can't wait to see the star come back together when the goal is reached! Love it, thank you so much.",
  },
  {
    rating: 5,
    text: 'Super cute widget and very customizable! PDF has a link to a video tutorial... it was easy to set up!',
  },
  {
    rating: 5,
    text: 'Great product and tutorial. Works perfectly.',
  },
];

export function EtsyReviews() {
  const fullStars = Math.round(SHOP_RATING.average);
  return (
    <section className="etsy-reviews" aria-labelledby="etsy-reviews-heading">
      <h2 id="etsy-reviews-heading">Reviews for this shop</h2>

      <div className="etsy-review-themes">
        <span className="etsy-review-themes-label">What buyers say:</span>
        {REVIEW_THEMES.map((theme) => (
          <span key={theme} className="etsy-review-theme">
            ✓ {theme}
          </span>
        ))}
      </div>

      <a
        href={SHOP_RATING.url}
        target="_blank"
        rel="noopener noreferrer"
        className="etsy-review-summary"
      >
        <span className="etsy-review-summary-number">
          {SHOP_RATING.average.toFixed(1)}
        </span>
        <span className="etsy-rating-stars" aria-hidden="true">
          {Array.from({length: 5}, (_, i) =>
            i < fullStars ? '★' : '☆',
          ).join('')}
        </span>
        <span className="etsy-review-summary-label">
          Shop average ({SHOP_RATING.count} reviews on Etsy)
        </span>
      </a>

      <p className="etsy-reviews-note">
        These are shop-wide Etsy reviews, not filtered to this exact listing —
        see all on Etsy.
      </p>

      <div className="etsy-reviews-grid">
        {SAMPLE_REVIEWS.map((review, i) => (
          <blockquote className="etsy-review-card" key={i}>
            <span className="etsy-review-stars" aria-hidden="true">
              {'★'.repeat(review.rating)}
            </span>
            <p>&ldquo;{review.text}&rdquo;</p>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
