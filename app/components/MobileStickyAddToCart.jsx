import {useEffect, useState} from 'react';
import {useAside} from './Aside';
import {ProductPrice} from './ProductPrice';

/**
 * Mobile-only sticky Add to cart bar for the PDP.
 *
 * Mobile session-to-cart-add was 0.31% against desktop's 3.0% (last 7 days,
 * Shopify). The real Add to cart button sat about 1.7 screens down at
 * 360x789 on production (Cute Love Ghost PDP, gallery/rating/price/title/
 * full keyword title/highlights all sit above it), so most phone buyers
 * scrolled straight past it.
 *
 * This bar never duplicates the cart form. `targetRef` points at the real
 * button's own DOM node (see ProductForm/AddToCartButton). Pressing this bar
 * just calls `.click()` on that real button, so the one existing
 * `<AnnotatedCartForm>` fetcher submits, the real button's own `onClick`
 * (opens the cart drawer) fires, and the add_to_cart analytics event fires
 * once, exactly as if the shopper had scrolled down and pressed the real
 * button themselves. There is no second form and no second fetcher here.
 *
 * Visible only while that real button is scrolled off screen
 * (IntersectionObserver), hidden while any aside (cart/search/menu) is open
 * -- both through `useAside()` and, as a CSS-only backstop, through
 * `.overlay.expanded` (see app.css) -- and hidden again once the page has
 * scrolled to its true end, so it never sits permanently over the footer.
 *
 * @param {{
 *   targetRef: {current: HTMLButtonElement | null};
 *   price?: MoneyV2;
 *   compareAtPrice?: MoneyV2 | null;
 *   available: boolean;
 * }}
 */
export function MobileStickyAddToCart({
  targetRef,
  price,
  compareAtPrice,
  available,
}) {
  const {type: asideType} = useAside();
  // Both default to the "bar hidden" state so the first paint (server and
  // client, before any effect has run) agrees with itself. The observers
  // below correct this within a frame once real measurements exist.
  const [targetOffscreen, setTargetOffscreen] = useState(false);
  const [atPageEnd, setAtPageEnd] = useState(false);

  useEffect(() => {
    const node = targetRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => setTargetOffscreen(!entry.isIntersecting),
      {threshold: 0},
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [targetRef]);

  useEffect(() => {
    function checkPageEnd() {
      const scrolledToEnd =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 8;
      setAtPageEnd(scrolledToEnd);
    }
    checkPageEnd();
    window.addEventListener('scroll', checkPageEnd, {passive: true});
    window.addEventListener('resize', checkPageEnd);
    return () => {
      window.removeEventListener('scroll', checkPageEnd);
      window.removeEventListener('resize', checkPageEnd);
    };
  }, []);

  const asideOpen = asideType !== 'closed';
  const show = targetOffscreen && !asideOpen && !atPageEnd;

  function handlePress() {
    // Same button, same form, same fetcher. A disabled real button ignores
    // .click() the same way it ignores a real tap, so "Sold out" here can
    // never submit.
    targetRef.current?.click();
  }

  return (
    <div
      className={`mobile-sticky-atc${show ? ' mobile-sticky-atc-visible' : ''}`}
      aria-hidden={!show}
    >
      <div className="mobile-sticky-atc-price">
        <ProductPrice price={price} compareAtPrice={compareAtPrice} />
      </div>
      <button
        type="button"
        className="mobile-sticky-atc-button sws-btn sws-btn-primary"
        onClick={handlePress}
        disabled={!available}
        tabIndex={show ? 0 : -1}
      >
        {available ? 'Add to cart' : 'Sold out'}
      </button>
    </div>
  );
}

/** @typedef {import('@shopify/hydrogen/storefront-api-types').MoneyV2} MoneyV2 */
