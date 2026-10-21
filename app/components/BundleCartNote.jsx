import {PlatformRow} from '~/components/BundleBuilder';
import {BUNDLE_ATTR, tierFor} from '~/lib/bundle';
import {SAMPLE_REVIEWS} from '~/components/EtsyReviews';

/**
 * Shown in the cart when it holds widgets added from /bundle. Says which tier
 * the kit gets and that the saving is applied by Shopify at checkout, with the
 * platform logos and one real Etsy review near the cart. It never shows a
 * discounted price itself: the price is whatever Shopify returns.
 */
export function BundleCartNote({lines}) {
  // Count units, not lines: Shopify's bundle discounts use quantity, so a
  // bundle line raised with + in the cart counts toward the next tier.
  const n = lines
    .filter((l) => (l.attributes || []).some((a) => a.key === BUNDLE_ATTR))
    .reduce((sum, l) => sum + (l.quantity || 1), 0);
  if (!n) return null;
  const tier = tierFor(n);
  return (
    <div className="bb-cart-note" role="note">
      <span>
        Your bundle: {n} widgets
        {tier ? (
          <>
            {' '}
            <b>{tier.pct}% off</b> applied at checkout
          </>
        ) : (
          ' (pick at least 3 for 25% off)'
        )}
      </span>
      <PlatformRow />
      <span className="bb-cart-review">
        ★★★★★ “{SAMPLE_REVIEWS[1].text}” (Etsy review)
      </span>
    </div>
  );
}
