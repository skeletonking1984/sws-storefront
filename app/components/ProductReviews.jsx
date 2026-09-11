import {useState} from 'react';
import {SHOP_RATING} from '~/components/EtsyRating';

/**
 * Per-product Etsy review data (see scripts/build-etsy-reviews.mjs), the
 * shape written for one product handle in app/data/etsy-reviews.json:
 * {handle, etsyListingId, count, average, distribution, reviews}. This
 * component never imports that JSON itself, it's the full-catalog,
 * server-only dataset. The caller (the product route loader) looks up the
 * one product's slice and passes it down as `data`, so no review text ever
 * reaches the client bundle for products the visitor isn't viewing.
 */

/** Formats a YYYY-MM-DD string without a timezone-driven off-by-one day. */
function formatReviewDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
    'en-US',
    {year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC'},
  );
}

/**
 * Minimum reviews before a headline average and a distribution chart are
 * worth showing.
 *
 * Below this the summary is not a rating, it is one or two people rendered
 * as a statistic. A single unhappy buyer became a "1.0 out of 5" banner over
 * a product with no other feedback, and two buyers became "3.0" with a bar
 * chart implying a measured distribution. Both read as a verdict on the
 * product and neither is one.
 *
 * This is NOT a filter. Every review still renders in full, most recent
 * first, whatever it says. What is suppressed is the false precision on top
 * of them. The same threshold already gates `aggregateRating` in the PDP's
 * JSON-LD (see app/routes/products.$handle.jsx), so this makes the page
 * agree with the structured data it already emits.
 */
const MIN_REVIEWS_FOR_SUMMARY = 3;

/**
 * Per-product Etsy reviews, real and verbatim, for this exact listing (not
 * the shop-wide sample in EtsyReviews.jsx). Sorted most recent first,
 * whatever the rating, first 3 shown with an expander for the rest.
 * @param {{data: {count: number, average: number, distribution: object, reviews: Array}}} props
 */
export function ProductReviews({data}) {
  const [expanded, setExpanded] = useState(false);

  if (!data || data.reviews.length === 0) return null;

  // Floor, never round. A 4.5 average rounded up paints 5 solid stars and
  // overstates the product, the exact number sits right next to it anyway.
  const fullStars = Math.floor(data.average);
  const showSummary = data.count >= MIN_REVIEWS_FOR_SUMMARY;
  const visibleReviews = expanded ? data.reviews : data.reviews.slice(0, 3);
  const hasMore = data.reviews.length > 3;

  return (
    <section
      className="product-reviews"
      id="product-reviews"
      aria-labelledby="product-reviews-heading"
    >
      <h2 id="product-reviews-heading">What buyers say about this widget</h2>

      {showSummary ? (
        <div className="product-reviews-summary">
          <span className="product-reviews-summary-number">
            {data.average.toFixed(1)}
          </span>
          <span className="etsy-rating-stars" aria-hidden="true">
            {Array.from({length: 5}, (_, i) =>
              i < fullStars ? '★' : '☆',
            ).join('')}
          </span>
          <span className="product-reviews-summary-label">
            {data.count} review{data.count === 1 ? '' : 's'} on Etsy for this
            listing
          </span>
        </div>
      ) : (
        <p className="product-reviews-summary-label">
          {data.count} review{data.count === 1 ? '' : 's'} left on this
          widget&rsquo;s Etsy listing. Too few to average, so here they are in
          full.
        </p>
      )}

      {showSummary ? (
        <div className="product-reviews-distribution">
          {[5, 4, 3, 2, 1].map((star) => {
            const n = data.distribution[String(star)] || 0;
            const pct = data.count ? Math.round((n / data.count) * 100) : 0;
            return (
              <div className="product-reviews-distribution-row" key={star}>
                <span className="product-reviews-distribution-label">
                  {star}★
                </span>
                <span className="product-reviews-distribution-bar">
                  <span
                    className="product-reviews-distribution-fill"
                    style={{width: `${pct}%`}}
                  />
                </span>
                <span className="product-reviews-distribution-count">{n}</span>
              </div>
            );
          })}
        </div>
      ) : null}

      <p className="product-reviews-note">
        Real reviews left on this widget&apos;s Etsy listing, most recent
        first.
      </p>

      <div className="product-reviews-grid">
        {visibleReviews.map((review, i) => (
          <blockquote className="product-review-card" key={i}>
            <span className="etsy-review-stars" aria-hidden="true">
              {'★'.repeat(review.rating)}
              {'☆'.repeat(5 - review.rating)}
            </span>
            <p>&ldquo;{review.text}&rdquo;</p>
            <footer className="product-review-meta">
              <span>Verified Etsy buyer</span>
              <span>{formatReviewDate(review.date)}</span>
            </footer>
          </blockquote>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          className="product-reviews-expander"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded
            ? 'Show fewer reviews'
            : `Show all ${data.reviews.length} written reviews`}
        </button>
      )}

      <a
        href={SHOP_RATING.url}
        target="_blank"
        rel="noopener noreferrer"
        className="product-reviews-link"
      >
        See all StreamWidgetShop reviews on Etsy →
      </a>
    </section>
  );
}

/**
 * Compact product-level rating for the buy panel. Shows this listing's own
 * average and review count instead of the shop-wide badge, and jumps to the
 * reviews further down the page rather than off to Etsy.
 * @param {{data: {count: number, average: number, distribution: object, reviews: Array}}} props
 */
export function ProductRatingBadge({data}) {
  // Same floor as the review section. This badge sits directly beside the
  // price and the Add to cart button, so a one-review "1.0" here is the most
  // expensive place in the whole site to print a meaningless average. Below
  // the threshold the route falls back to the shop-wide badge, which is
  // labelled as shop-wide and is a real number over 990 reviews.
  if (!data || data.count < MIN_REVIEWS_FOR_SUMMARY) return null;
  const fullStars = Math.floor(data.average);
  return (
    <a className="etsy-rating etsy-rating-compact" href="#product-reviews">
      <span className="etsy-rating-stars" aria-hidden="true">
        {Array.from({length: 5}, (_, i) => (i < fullStars ? '★' : '☆')).join(
          '',
        )}
      </span>
      <span className="etsy-rating-text">
        {data.average.toFixed(1)} from {data.count} Etsy review
        {data.count === 1 ? '' : 's'} of this widget
      </span>
    </a>
  );
}
