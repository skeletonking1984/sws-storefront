import {useLoaderData, data} from 'react-router';
import {CartForm} from '@shopify/hydrogen';
import {CartMain} from '~/components/CartMain';
import {buildMeta, getOrigin} from '~/lib/seo';
import {readClickIds} from '~/lib/clickIds.server';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({matches, location}) => {
  const origin = getOrigin(matches);
  return buildMeta({
    title: 'Your Cart | Stream Widget Shop',
    description: 'Your Stream Widget Shop cart.',
    url: `${origin}${location.pathname}`,
    noIndex: true,
  });
};

/**
 * @type {HeadersFunction}
 */
export const headers = ({actionHeaders}) => actionHeaders;

/**
 * @param {Route.ActionArgs}
 */
export async function action({request, context}) {
  const {cart} = context;

  const formData = await request.formData();

  const {action, inputs} = CartForm.getFormInput(formData);

  if (!action) {
    throw new Error('No action provided');
  }

  let status = 200;
  let result;

  switch (action) {
    case CartForm.ACTIONS.LinesAdd:
      result = await cart.addLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesUpdate:
      result = await cart.updateLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesRemove:
      result = await cart.removeLines(inputs.lineIds);
      break;
    case CartForm.ACTIONS.DiscountCodesUpdate: {
      const formDiscountCode = inputs.discountCode;

      // User inputted discount code
      const discountCodes = formDiscountCode ? [formDiscountCode] : [];

      // Combine discount codes already applied on cart
      discountCodes.push(...inputs.discountCodes);

      result = await cart.updateDiscountCodes(discountCodes);
      break;
    }
    case CartForm.ACTIONS.GiftCardCodesAdd: {
      const formGiftCardCode = inputs.giftCardCode;

      const giftCardCodes = formGiftCardCode ? [formGiftCardCode] : [];

      result = await cart.addGiftCardCodes(giftCardCodes);
      break;
    }
    case CartForm.ACTIONS.GiftCardCodesRemove: {
      const appliedGiftCardIds = inputs.giftCardCodes;
      result = await cart.removeGiftCardCodes(appliedGiftCardIds);
      break;
    }
    case CartForm.ACTIONS.BuyerIdentityUpdate: {
      result = await cart.updateBuyerIdentity({
        ...inputs.buyerIdentity,
      });
      break;
    }
    default:
      throw new Error(`${action} cart action is not defined`);
  }

  const cartId = result?.cart?.id;
  const headers = cartId ? cart.setCartId(result.cart.id) : new Headers();
  const {cart: cartResult, errors, warnings} = result;

  // Carry every captured click id (GA4, X, Meta, Google Ads, TikTok,
  // Microsoft, Pinterest -- see app/lib/clickIds.server.js) onto this cart
  // so it survives into the order and can be read back out server side by
  // the orders/create purchase webhook (app/routes/webhooks.orders.jsx).
  //
  // Runs on EVERY cart mutation, not only creation. `cartAttributesUpdate`
  // is a full replace of the attributes array, not a merge (confirmed
  // against Hydrogen's own mutation), so a cart that already existed
  // before an id was captured -- the exact gap that left order #1040 with
  // empty customAttributes -- would otherwise never get backfilled. Fixed
  // here by re-checking on every mutation and merging in only what is
  // still missing.
  //
  // Never overwrites: any attribute already present (a captured click id
  // from an earlier request, or an unrelated attribute this cart carries
  // for some other reason) is passed straight through untouched.
  if (cartId && cartResult) {
    const clickIds = readClickIds(request);
    const existingAttributes = cartResult.attributes || [];
    const existingKeys = new Set(existingAttributes.map((attr) => attr.key));
    const missingAttributes = Object.entries(clickIds)
      .filter(([key, value]) => value && !existingKeys.has(key))
      .map(([key, value]) => ({key, value}));

    if (missingAttributes.length > 0) {
      try {
        await cart.updateAttributes([
          ...existingAttributes.map(({key, value}) => ({key, value})),
          ...missingAttributes,
        ]);
      } catch (error) {
        console.error('Failed to relay click ids to cart attributes', error);
      }
    }
  }

  const redirectTo = formData.get('redirectTo') ?? null;
  if (typeof redirectTo === 'string') {
    status = 303;
    headers.set('Location', redirectTo);
  }

  return data(
    {
      cart: cartResult,
      errors,
      warnings,
      analytics: {
        cartId,
      },
    },
    {status, headers},
  );
}

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  const {cart} = context;
  return await cart.get();
}

export default function Cart() {
  /** @type {LoaderReturnData} */
  const cart = useLoaderData();

  return (
    <div className="cart">
      <h1>Cart</h1>
      <CartMain layout="page" cart={cart} />
    </div>
  );
}

/** @typedef {import('react-router').HeadersFunction} HeadersFunction */
/** @typedef {import('./+types/cart').Route} Route */
/** @typedef {import('@shopify/hydrogen').CartQueryDataReturn} CartQueryDataReturn */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
/** @typedef {ReturnType<typeof useActionData<typeof action>>} ActionReturnData */
