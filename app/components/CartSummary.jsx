import {CartForm, Money, useAnalytics} from '@shopify/hydrogen';
import {AnnotatedCartForm} from '~/components/AnnotatedCartForm';
import {useEffect, useId, useRef, useState} from 'react';
import {useFetcher} from 'react-router';

/**
 * @param {CartSummaryProps}
 */
export function CartSummary({cart, layout}) {
  const className =
    layout === 'page' ? 'cart-summary-page' : 'cart-summary-aside';
  const summaryId = useId();
  const discountsHeadingId = useId();
  const discountCodeInputId = useId();
  const giftCardHeadingId = useId();
  const giftCardInputId = useId();

  // Money needs a full {amount, currencyCode}. Only build one when there is
  // a real difference, so a cart with no discount renders exactly as before.
  const subtotal = Number(cart?.cost?.subtotalAmount?.amount);
  const total = Number(cart?.cost?.totalAmount?.amount);
  const savings =
    Number.isFinite(subtotal) && Number.isFinite(total) && subtotal - total > 0
      ? {
          amount: (subtotal - total).toFixed(2),
          currencyCode:
            cart?.cost?.totalAmount?.currencyCode ||
            cart?.cost?.subtotalAmount?.currencyCode ||
            'USD',
        }
      : null;

  const appliedCodes =
    cart?.discountCodes?.filter((discount) => discount.applicable) || [];
  const appliedGiftCards = cart?.appliedGiftCards || [];

  const codeForms = (
    <>
      <CartDiscounts
        discountCodes={cart?.discountCodes}
        discountsHeadingId={discountsHeadingId}
        discountCodeInputId={discountCodeInputId}
      />
      <CartGiftCard
        giftCardCodes={cart?.appliedGiftCards}
        giftCardHeadingId={giftCardHeadingId}
        giftCardInputId={giftCardInputId}
      />
    </>
  );

  const checkout = (
    <CartCheckoutActions checkoutUrl={cart?.checkoutUrl} cart={cart} />
  );

  // In the drawer the summary is pinned under the scrolling line items, so
  // every pixel it spends is a pixel of cart the buyer cannot see. Measured
  // at 360px wide it was 365px tall inside a 536px drawer, and two thirds of
  // that was a discount form and a gift card form that almost nobody uses.
  //
  // Collapsed, the block is totals plus the checkout button, and the code
  // forms are one tap away. Left open when a code is already applied, so a
  // shopper can always see and remove what they entered.
  if (layout !== 'page') {
    return (
      <div aria-labelledby={summaryId} className={className}>
        <h4 id={summaryId}>Totals</h4>
        <Totals cart={cart} savings={savings} />
        {checkout}
        <details
          className="cart-code-disclosure"
          open={appliedCodes.length > 0 || appliedGiftCards.length > 0}
        >
          <summary>Add a discount or gift card</summary>
          {codeForms}
        </details>
      </div>
    );
  }

  return (
    <div aria-labelledby={summaryId} className={className}>
      <h4 id={summaryId}>Totals</h4>
      <Totals cart={cart} savings={savings} />
      {codeForms}
      {checkout}
    </div>
  );
}

/**
 * Subtotal, and the discount and total rows only when a code actually moved
 * the number.
 * @param {{cart: CartSummaryProps['cart']; savings: {amount: string; currencyCode: string} | null}}
 */
function Totals({cart, savings}) {
  return (
    <>
      <dl role="group" className="cart-subtotal">
        <dt>Subtotal</dt>
        <dd>
          {cart?.cost?.subtotalAmount?.amount ? (
            <Money data={cart?.cost?.subtotalAmount} />
          ) : (
            '-'
          )}
        </dd>
      </dl>
      {/* Subtotal is the pre-discount figure and never moves when a code is
          applied, so showing it alone made a working discount look broken:
          the shopper typed a valid code, the number stayed put, and nothing
          said otherwise. Show what they actually pay, and the saving, only
          when the two figures genuinely differ. */}
      {savings ? (
        <>
          <dl role="group" className="cart-discount-line">
            <dt>Discount</dt>
            <dd>
              {'-'}
              <Money data={savings} />
            </dd>
          </dl>
          <dl role="group" className="cart-total">
            <dt>Total</dt>
            <dd>
              <Money data={cart.cost.totalAmount} />
            </dd>
          </dl>
        </>
      ) : null}
    </>
  );
}

/**
 * Checkout is Shopify hosted, so Hydrogen never publishes a begin_checkout
 * equivalent on its own. This fires one at click time, before the browser
 * navigates away to the hosted checkout, via the same publish/subscribe
 * bus PixelBus.jsx already listens on (see its `custom_begin_checkout`
 * handling in app/lib/analytics/events.js) rather than calling gtag
 * directly here.
 * @param {{checkoutUrl?: string; cart?: CartApiQueryFragment | OptimisticCart<CartApiQueryFragment | null>}}
 */
function CartCheckoutActions({checkoutUrl, cart}) {
  const {publish} = useAnalytics();
  if (!checkoutUrl) return null;

  return (
    <div className="cart-checkout-actions">
      <a
        href={checkoutUrl}
        target="_self"
        className="cart-checkout-button"
        onClick={(event) => {
          // Hold the navigation until GA4 confirms begin_checkout was
          // actually delivered, then go. Checkout is on
          // shop.streamwidgetshop.com, a different origin, so leaving this
          // page cancels any request that has not gone out yet, and
          // begin_checkout is the most valuable step in the funnel to
          // lose. GA4 signals delivery through `event_callback`, which
          // app/lib/analytics/pixels/ga4.js attaches when the event
          // carries `onSent`.
          //
          // Two independent guarantees that a buyer is never trapped here:
          // gtag's own `event_timeout` fires the callback anyway if the
          // hit stalls, and the timer below runs even when gtag.js was
          // blocked outright and none of that code exists. `navigate` is
          // latched so whichever fires first wins and the second is a
          // no-op.
          //
          // If gtag never loaded there is nothing to wait for, so the link
          // is left completely alone and behaves like a normal link.
          if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
            publish('custom_begin_checkout', {cart});
            return;
          }

          event.preventDefault();
          let navigated = false;
          const navigate = () => {
            if (navigated) return;
            navigated = true;
            window.location.href = checkoutUrl;
          };

          publish('custom_begin_checkout', {cart, onSent: navigate});
          window.setTimeout(navigate, 800);
        }}
      >
        Continue to Checkout &rarr;
      </a>
      <br />
    </div>
  );
}

/**
 * @param {{
 *   discountCodes?: CartApiQueryFragment['discountCodes'];
 *   discountsHeadingId: string;
 *   discountCodeInputId: string;
 * }}
 */
function CartDiscounts({
  discountCodes,
  discountsHeadingId,
  discountCodeInputId,
}) {
  const codes =
    discountCodes
      ?.filter((discount) => discount.applicable)
      ?.map(({code}) => code) || [];

  return (
    <section aria-label="Discounts">
      {/* Have existing discount, display it with a remove option */}
      <dl hidden={!codes.length}>
        <div>
          <dt id={discountsHeadingId}>Discounts</dt>
          <UpdateDiscountForm>
            <div
              className="cart-discount"
              role="group"
              aria-labelledby={discountsHeadingId}
            >
              <code>{codes?.join(', ')}</code>
              &nbsp;
              <button type="submit" aria-label="Remove discount">
                Remove
              </button>
            </div>
          </UpdateDiscountForm>
        </div>
      </dl>

      {/* Show an input to apply a discount */}
      <UpdateDiscountForm discountCodes={codes}>
        <div className="cart-code-form">
          <label htmlFor={discountCodeInputId} className="sr-only">
            Discount code
          </label>
          <input
            id={discountCodeInputId}
            className="cart-code-input"
            type="text"
            name="discountCode"
            placeholder="Discount code"
          />
          <button
            className="cart-code-apply"
            type="submit"
            aria-label="Apply discount code"
          >
            Apply
          </button>
        </div>
      </UpdateDiscountForm>
    </section>
  );
}

/**
 * @param {{
 *   discountCodes?: string[];
 *   children: React.ReactNode;
 * }}
 */
function UpdateDiscountForm({discountCodes, children}) {
  return (
    <AnnotatedCartForm
      route="/cart"
      action={CartForm.ACTIONS.DiscountCodesUpdate}
      inputs={{
        discountCodes: discountCodes || [],
      }}
      toolname="apply_discount_code"
      tooldescription="Apply a discount code to the shopping cart, or remove the one already applied."
    >
      {/* CartForm hands the fetcher to a function child. The cart action
          returns an errors array when a typed code did not apply, and
          without rendering it a wrong code looks exactly like a right one:
          the request succeeds, the discount never appears, and nothing
          says why. */}
      {(fetcher) => {
        const errors = fetcher?.data?.errors;
        return (
          <>
            {children}
            {errors?.length ? (
              <p className="cart-discount-error" role="status">
                {errors[0].message}
              </p>
            ) : null}
          </>
        );
      }}
    </AnnotatedCartForm>
  );
}

/**
 * @param {{
 *   giftCardCodes: CartApiQueryFragment['appliedGiftCards'] | undefined;
 *   giftCardHeadingId: string;
 *   giftCardInputId: string;
 * }}
 */
function CartGiftCard({giftCardCodes, giftCardHeadingId, giftCardInputId}) {
  const giftCardCodeInput = useRef(null);
  const removeButtonRefs = useRef(new Map());
  const previousCardIdsRef = useRef([]);
  const giftCardAddFetcher = useFetcher({key: 'gift-card-add'});
  const [removedCardIndex, setRemovedCardIndex] = useState(null);

  useEffect(() => {
    if (giftCardAddFetcher.data) {
      if (giftCardCodeInput.current !== null) {
        giftCardCodeInput.current.value = '';
      }
    }
  }, [giftCardAddFetcher.data]);

  useEffect(() => {
    const currentCardIds = giftCardCodes?.map((card) => card.id) || [];

    if (removedCardIndex !== null && giftCardCodes) {
      const focusTargetIndex = Math.min(
        removedCardIndex,
        giftCardCodes.length - 1,
      );
      const focusTargetCard = giftCardCodes[focusTargetIndex];
      const focusButton = focusTargetCard
        ? removeButtonRefs.current.get(focusTargetCard.id)
        : null;

      if (focusButton) {
        focusButton.focus();
      } else if (giftCardCodeInput.current) {
        giftCardCodeInput.current.focus();
      }

      setRemovedCardIndex(null);
    }

    previousCardIdsRef.current = currentCardIds;
  }, [giftCardCodes, removedCardIndex]);

  const handleRemoveClick = (cardId) => {
    const index = previousCardIdsRef.current.indexOf(cardId);
    if (index !== -1) {
      setRemovedCardIndex(index);
    }
  };

  return (
    <section aria-label="Gift cards">
      {giftCardCodes && giftCardCodes.length > 0 && (
        <dl>
          <dt id={giftCardHeadingId}>Applied Gift Card(s)</dt>
          {giftCardCodes.map((giftCard) => (
            <dd key={giftCard.id} className="cart-discount">
              <RemoveGiftCardForm
                giftCardId={giftCard.id}
                lastCharacters={giftCard.lastCharacters}
                onRemoveClick={() => handleRemoveClick(giftCard.id)}
                buttonRef={(el) => {
                  if (el) {
                    removeButtonRefs.current.set(giftCard.id, el);
                  } else {
                    removeButtonRefs.current.delete(giftCard.id);
                  }
                }}
              >
                <code>***{giftCard.lastCharacters}</code>
                &nbsp;
                <Money data={giftCard.amountUsed} />
              </RemoveGiftCardForm>
            </dd>
          ))}
        </dl>
      )}

      <AddGiftCardForm fetcherKey="gift-card-add">
        <div className="cart-code-form">
          <label htmlFor={giftCardInputId} className="sr-only">
            Gift card code
          </label>
          <input
            id={giftCardInputId}
            className="cart-code-input"
            type="text"
            name="giftCardCode"
            placeholder="Gift card code"
            ref={giftCardCodeInput}
          />
          <button
            className="cart-code-apply"
            type="submit"
            disabled={giftCardAddFetcher.state !== 'idle'}
            aria-label="Apply gift card code"
          >
            Apply
          </button>
        </div>
      </AddGiftCardForm>
    </section>
  );
}

/**
 * @param {{
 *   fetcherKey?: string;
 *   children: React.ReactNode;
 * }}
 */
function AddGiftCardForm({fetcherKey, children}) {
  return (
    <AnnotatedCartForm
      fetcherKey={fetcherKey}
      route="/cart"
      action={CartForm.ACTIONS.GiftCardCodesAdd}
      toolname="apply_gift_card"
      tooldescription="Apply a gift card code to the shopping cart."
    >
      {children}
    </AnnotatedCartForm>
  );
}

/**
 * @param {{
 *   giftCardId: string;
 *   lastCharacters: string;
 *   children: React.ReactNode;
 *   onRemoveClick?: () => void;
 *   buttonRef?: (el: HTMLButtonElement | null) => void;
 * }}
 */
function RemoveGiftCardForm({
  giftCardId,
  lastCharacters,
  children,
  onRemoveClick,
  buttonRef,
}) {
  return (
    <AnnotatedCartForm
      route="/cart"
      action={CartForm.ACTIONS.GiftCardCodesRemove}
      inputs={{
        giftCardCodes: [giftCardId],
      }}
      toolname="remove_gift_card"
      tooldescription="Remove a gift card already applied to the shopping cart."
    >
      {children}
      &nbsp;
      <button
        type="submit"
        aria-label={`Remove gift card ending in ${lastCharacters}`}
        onClick={onRemoveClick}
        ref={buttonRef}
      >
        Remove
      </button>
    </AnnotatedCartForm>
  );
}

/**
 * @typedef {{
 *   cart: OptimisticCart<CartApiQueryFragment | null>;
 *   layout: CartLayout;
 * }} CartSummaryProps
 */

/** @typedef {import('storefrontapi.generated').CartApiQueryFragment} CartApiQueryFragment */
/** @typedef {import('~/components/CartMain').CartLayout} CartLayout */
/** @typedef {import('@shopify/hydrogen').OptimisticCart} OptimisticCart */
