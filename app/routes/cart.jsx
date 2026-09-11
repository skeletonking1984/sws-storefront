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
      // `CartForm` only serialises its own `inputs` prop into the hidden
      // cartFormInput field, so the code the shopper types into the sibling
      // <input name="discountCode"> never arrives in `inputs`. Reading it
      // from `inputs` left it undefined, which collapsed the update to the
      // codes already on the cart (usually none) and called
      // updateDiscountCodes([]). That is a successful no-op: the request
      // returned 200 and the discount silently never applied. Read the typed
      // value off the raw form data instead.
      const typedDiscountCode = String(formData.get('discountCode') || '').trim();
      const existingDiscountCodes = inputs.discountCodes || [];

      // Dedupe case-insensitively: re-applying a code already on the cart
      // must not send it twice.
      const discountCodes = typedDiscountCode
        ? [
            ...existingDiscountCodes.filter(
              (code) => code.toLowerCase() !== typedDiscountCode.toLowerCase(),
            ),
            typedDiscountCode,
          ]
        : existingDiscountCodes;

      result = await cart.updateDiscountCodes(discountCodes);

      // Shopify accepts an unrecognised code and simply marks it
      // applicable: false, so a wrong code is otherwise indistinguishable
      // from a right one. Only judge that when the mutation actually gave
      // back a cart to judge from: `result.cart` can come back undefined
      // here, and treating that as "invalid" reported a valid, correctly
      // applied WELCOME10 as a bad code. No data means no claim.
      const returnedCodes = result?.cart?.discountCodes;
      if (typedDiscountCode && Array.isArray(returnedCodes)) {
        const applied = returnedCodes.some(
          (discount) =>
            discount.applicable &&
            discount.code?.toLowerCase() === typedDiscountCode.toLowerCase(),
        );
        if (!applied) {
          result = {
            ...result,
            errors: [
              ...(result?.errors || []),
              {message: `"${typedDiscountCode}" is not a valid discount code.`},
            ],
          };
        }
      }
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
