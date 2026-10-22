import {data, redirect, Link, useActionData} from 'react-router';
import {readClickIds} from '~/lib/clickIds.server';
import {buildMeta, getOrigin} from '~/lib/seo';
import {brand} from '~/lib/brand.config';

/**
 * Buy now: one variant straight to Shopify hosted checkout, skipping the
 * cart page.
 *
 * It creates a SEPARATE cart holding only that one line and redirects to its
 * checkoutUrl. The visitor's own cart is never touched: this calls the
 * Storefront API directly instead of `context.cart`, and never calls
 * `cart.setCartId`, so the cart cookie is left exactly as it was. Whatever
 * the shopper had in the cart is still there when they come back.
 *
 * A plain form POST answered with a 303, so it works with no JavaScript. With
 * JavaScript, BuyNowButton.jsx publishes begin_checkout first and then submits
 * the same form natively.
 *
 * Carried onto the new cart, so the order reports the same as a cart checkout:
 * - every captured click id (see app/lib/clickIds.server.js), read by the
 *   orders/create webhook for attribution
 * - any discount code applicable on the shopper's existing cart (read only)
 * - the signed in customer, when there is one, so checkout is prefilled
 */
const MAX_QUANTITY = 10;
const VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/\d+$/;
const HANDLE = /^[a-z0-9][a-z0-9-]*$/i;

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({matches, location}) => {
  const origin = getOrigin(matches);
  return buildMeta({
    title: `Checkout | ${brand.name}`,
    description: `Opening checkout at ${brand.name}.`,
    url: `${origin}${location.pathname}`,
    noIndex: true,
  });
};

/**
 * @param {Route.ActionArgs}
 */
export async function action({request, context}) {
  const {storefront, cart, customerAccount} = context;
  const formData = await request.formData();

  const merchandiseId = String(formData.get('merchandiseId') || '');
  const parsedQuantity = Number.parseInt(
    String(formData.get('quantity') || '1'),
    10,
  );
  const quantity = Math.min(
    MAX_QUANTITY,
    Math.max(1, Number.isFinite(parsedQuantity) ? parsedQuantity : 1),
  );
  const handle = String(formData.get('handle') || '');
  const backTo = HANDLE.test(handle) ? `/products/${handle}` : '/';

  if (!VARIANT_GID.test(merchandiseId)) {
    return data(
      {error: 'That product could not be found.', backTo},
      {status: 400},
    );
  }

  const attributes = Object.entries(readClickIds(request, context.env))
    .filter(([, value]) => Boolean(value))
    .map(([key, value]) => ({key, value: String(value)}));

  // Read only. A failed read just means no codes are carried over.
  const existingCart = await cart.get().catch(() => null);
  const discountCodes = (existingCart?.discountCodes || [])
    .filter((discount) => discount.applicable && discount.code)
    .map((discount) => discount.code);

  /** @type {Record<string, string>} */
  const buyerIdentity = {countryCode: storefront.i18n.country};
  try {
    if (await customerAccount.isLoggedIn()) {
      const token = await customerAccount.getAccessToken();
      if (token) buyerIdentity.customerAccessToken = token;
    }
  } catch {
    // A guest checkout is still a checkout.
  }

  let checkoutUrl = null;
  try {
    const {cartCreate} = await storefront.mutate(BUY_NOW_CART_CREATE, {
      variables: {
        input: {
          lines: [{merchandiseId, quantity}],
          attributes,
          discountCodes,
          buyerIdentity,
        },
      },
    });
    if (cartCreate?.userErrors?.length) {
      console.error('Buy now cartCreate userErrors', cartCreate.userErrors);
    }
    checkoutUrl = cartCreate?.cart?.checkoutUrl || null;
  } catch (error) {
    console.error('Buy now cartCreate failed', error);
  }

  if (!checkoutUrl) {
    return data(
      {error: 'Checkout could not be opened. Please try again.', backTo},
      {status: 502},
    );
  }

  return redirect(checkoutUrl, 303);
}

/**
 * Rendered only when the action could not reach checkout, or on a direct
 * visit (no loader on purpose: React Router re-runs loaders as a GET after a
 * failed action, so a GET redirect here would swallow the error). The error
 * is the one red element; the way back is a normal link.
 */
export default function BuyNow() {
  /** @type {ActionReturnData} */
  const result = useActionData();

  if (!result) {
    return (
      <div className="buy-now-page">
        <h1>Checkout</h1>
        <p>
          Pick a widget first.{' '}
          <Link to="/collections/all">Browse the shop</Link> or{' '}
          <Link to="/cart">go to your cart</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="buy-now-page">
      <h1>Checkout</h1>
      <p className="buy-now-error" role="alert">
        {result.error}
      </p>
      <p>
        <Link to={result.backTo}>Back to the product</Link> or{' '}
        <Link to="/cart">go to your cart</Link>.
      </p>
    </div>
  );
}

const BUY_NOW_CART_CREATE = `#graphql
  mutation BuyNowCartCreate(
    $input: CartInput!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartCreate(input: $input) {
      cart {
        id
        checkoutUrl
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

/** @typedef {import('./+types/buy-now').Route} Route */
/** @typedef {ReturnType<typeof useActionData<typeof action>>} ActionReturnData */
