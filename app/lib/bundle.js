/**
 * Build-your-own bundle: tiers and price math, shared by the /bundle page and
 * the cart note. Pure functions, no I/O, so the same numbers show on the page,
 * in the cart and in the launch post.
 *
 * The discount itself is applied by Shopify at checkout (three automatic
 * "amount off products" discounts on the `widgets` collection, minimum 3, 6
 * and 9 items).
 * The discounts went live 2026-10-16 16:39 ET, so DISCOUNT_LIVE is true. The
 * page never fakes a discount in the cart: the cart shows what Shopify returns.
 */

export const DISCOUNT_LIVE = true;

export const MIN_ITEMS = 3;
export const MAX_ITEMS = 9;

/** Highest tier first. `min` items unlock `pct` off every widget in the kit. */
export const TIERS = [
  {min: 9, pct: 45},
  {min: 6, pct: 35},
  {min: 3, pct: 25},
];

/** The tier a kit of `n` widgets gets, or null under the minimum. */
export function tierFor(n) {
  return TIERS.find((t) => n >= t.min) || null;
}

/** The next tier up from `n`, with how many more widgets unlock it. */
export function nextTier(n) {
  const up = [...TIERS].reverse().find((t) => t.min > n);
  return up ? {...up, more: up.min - n} : null;
}

const cents = (v) => Math.round(Number(v || 0) * 100);

/**
 * Price a kit. `prices` are the widgets' own prices (numbers or strings).
 * Discount is per line and ROUNDED DOWN to the cent. Measured on the live cart
 * 2026-10-17: Shopify gave $18.99 x 35% = $6.64 off (6.6465 floored; rounding
 * to nearest would be 6.65) on five of five lines, and a 3 widget kit came out
 * 2 cents and a 6 widget kit 5 cents under the page when this used Math.round.
 * Rounding down keeps the page equal to what checkout charges.
 * @param {Array<number|string>} prices
 */
export function priceKit(prices) {
  const n = prices.length;
  const tier = tierFor(n);
  const listC = prices.reduce((s, p) => s + cents(p), 0);
  const offC = tier
    ? prices.reduce((s, p) => s + Math.floor((cents(p) * tier.pct) / 100), 0)
    : 0;
  return {
    count: n,
    pct: tier ? tier.pct : 0,
    list: listC / 100,
    save: offC / 100,
    total: (listC - offC) / 100,
    next: nextTier(n),
    ready: n >= MIN_ITEMS,
  };
}

/** "$12.34" */
export function money(v) {
  return `$${Number(v || 0).toFixed(2)}`;
}

/** Hidden line attributes that mark a cart line as part of one built kit. */
export const BUNDLE_ATTR = '_bundle';
export const BUNDLE_SIZE_ATTR = '_bundle_size';
/** Cart actions handled in app/routes/cart.jsx. */
export const BUNDLE_SYNC_ACTION = 'BundleSync';
export const CLEAR_CART_ACTION = 'ClearCart';
