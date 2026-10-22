import {Link} from 'react-router';
import {SHOP_RATING} from '~/components/EtsyRating';
import {brand} from '~/lib/brand.config';

/**
 * The trust row under the buy button.
 *
 * Why, 2026-10-22: mobile added to cart on 0.76% of sessions against 4.0% on
 * desktop (Shopify, last 30 days), and the product pages that take the ad
 * and X traffic converted near zero while the homepage, which carries its
 * rating and "widgets sold" line in the hero, converted ten times better.
 * The buy card had a rating badge and nothing else a first-time buyer checks
 * before paying a shop they have never heard of: does the file arrive, what
 * if it does not work, who do I write to.
 *
 * Every line is a fact the site already states elsewhere, never a new claim:
 * - instant download: every product is a digital file delivered at checkout
 * - the shop rating: app/data/etsy-shop-stats.json, the same numbers as the
 *   badge, stated as text (no link out to Etsy)
 * - the refund terms: /policies/refund-policy, see PRODUCT_REFUND_LINE in
 *   app/lib/policyContent.js. "Fixed or refunded" is that policy's own
 *   promise for a broken widget, not a blanket money back guarantee.
 * - the support address: brand.supportEmail
 *
 * @param {{showShopRating?: boolean}} props
 */
export function ProductTrust({showShopRating = true}) {
  return (
    <ul className="product-trust" aria-label="Before you buy">
      <li>
        <span className="product-trust-icon" aria-hidden="true">
          ✓
        </span>
        Instant download after checkout
      </li>
      {showShopRating ? (
        <li>
          <span className="product-trust-icon" aria-hidden="true">
            ✓
          </span>
          <span>
            Shop rating {SHOP_RATING.average.toFixed(2)} stars from{' '}
            {SHOP_RATING.count.toLocaleString('en-US')} Etsy reviews
          </span>
        </li>
      ) : null}
      <li>
        <span className="product-trust-icon" aria-hidden="true">
          ✓
        </span>
        <span>
          Broken widget? Fixed or refunded.{' '}
          <Link to="/policies/refund-policy" prefetch="intent">
            Refund policy
          </Link>
        </span>
      </li>
      <li>
        <span className="product-trust-icon" aria-hidden="true">
          ✓
        </span>
        <span>
          Setup help:{' '}
          <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>
        </span>
      </li>
    </ul>
  );
}
