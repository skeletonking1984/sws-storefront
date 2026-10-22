import {useEffect, useState} from 'react';
import {useAnalytics} from '@shopify/hydrogen';

/**
 * One tap from the product page to Shopify hosted checkout, skipping the
 * cart. A plain <form> posting to /buy-now (app/routes/buy-now.jsx), which
 * answers with a 303 to the checkout of a fresh one-line cart, so it works
 * with no JavaScript and never touches the shopper's own cart.
 *
 * With JavaScript, the submit is held just long enough to publish
 * begin_checkout on the same bus and with the same delivery wait as
 * CartSummary.jsx's checkout link, then the form is submitted natively.
 * `form.submit()` does not fire `submit` again, so there is no loop.
 *
 * @param {{
 *   selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
 *   product: {id: string; title: string; handle: string; productType?: string};
 *   quantity?: number;
 * }}
 */
export function BuyNowButton({selectedVariant, product, quantity = 1}) {
  const {publish} = useAnalytics();
  const [pending, setPending] = useState(false);

  // Back from checkout via the browser's back/forward cache restores the
  // page with this still pending. Clear it so the button works again.
  useEffect(() => {
    const reset = () => setPending(false);
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  if (!selectedVariant) return null;

  /** @param {React.FormEvent<HTMLFormElement>} event */
  function handleSubmit(event) {
    if (pending) {
      event.preventDefault();
      return;
    }
    setPending(true);

    // begin_checkout normalizes a cart (app/lib/analytics/events.js), so
    // describe this one line in that shape.
    const cart = {
      cost: {
        totalAmount: {
          amount: (Number(selectedVariant.price.amount) * quantity).toFixed(2),
          currencyCode: selectedVariant.price.currencyCode,
        },
      },
      lines: {
        nodes: [
          {
            quantity,
            merchandise: {
              id: selectedVariant.id,
              title: selectedVariant.title,
              price: selectedVariant.price,
              product: {
                id: product.id,
                title: product.title,
                productType: product.productType,
              },
            },
          },
        ],
      },
    };

    if (typeof window.gtag !== 'function') {
      publish('custom_begin_checkout', {cart});
      return;
    }

    event.preventDefault();
    const form = event.currentTarget;
    let submitted = false;
    const submit = () => {
      if (submitted) return;
      submitted = true;
      form.submit();
    };
    publish('custom_begin_checkout', {cart, onSent: submit});
    window.setTimeout(submit, 800);
  }

  return (
    <form
      method="post"
      action="/buy-now"
      className="buy-now-form"
      onSubmit={handleSubmit}
      toolname="buy_widget_now"
      tooldescription="Open Shopify checkout with only this widget, skipping the cart. The shopper still pays themselves; the existing cart is left as it is."
    >
      <input type="hidden" name="merchandiseId" value={selectedVariant.id} />
      <input type="hidden" name="quantity" value={quantity} />
      <input type="hidden" name="handle" value={product.handle} />
      <button
        type="submit"
        className="buy-now-button sws-btn sws-btn-primary"
        disabled={!selectedVariant.availableForSale}
        aria-busy={pending}
      >
        {pending ? 'Opening checkout' : 'Buy now'}
      </button>
    </form>
  );
}

/** @typedef {import('storefrontapi.generated').ProductFragment} ProductFragment */
