import {EtsyRatingBadge} from '~/components/EtsyRating';

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
  return (
    <section className="etsy-reviews" aria-labelledby="etsy-reviews-heading">
      <h2 id="etsy-reviews-heading">Etsy reviews</h2>
      <EtsyRatingBadge />
      <p className="etsy-reviews-note">
        Recent reviews from StreamWidgetShop on Etsy — see all on Etsy.
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
