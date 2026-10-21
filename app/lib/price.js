/**
 * Shared price-comparison helpers. Every card, the PDP and the cart all need
 * the same answer to "is this actually on sale", and getting it wrong in
 * only one place is how a `compareAtPrice` that Shopify set equal to (or
 * below) the real price ends up rendered as a fake discount ("$12.00
 * $12.00" struck through). One gate, reused everywhere a price renders.
 */

/**
 * True only when `compareAtPrice` is a real, higher price than `price`.
 * Never true when either amount is missing, or when compareAtPrice is equal
 * to or less than price -- Shopify leaves compareAtPrice set to the same
 * value as price on plenty of products with no discount intended.
 * @param {{amount?: string|number|null}|null|undefined} price
 * @param {{amount?: string|number|null}|null|undefined} compareAtPrice
 */
export function hasRealDiscount(price, compareAtPrice) {
  const priceAmount = price?.amount != null ? parseFloat(price.amount) : NaN;
  const compareAmount =
    compareAtPrice?.amount != null ? parseFloat(compareAtPrice.amount) : NaN;
  if (Number.isNaN(priceAmount) || Number.isNaN(compareAmount)) return false;
  return compareAmount > priceAmount;
}

/**
 * A cart line only carries a per-unit `compareAtAmountPerQuantity`, but the
 * line's own `cost.totalAmount` is already quantity x price. To show a
 * strikethrough total next to it (rather than a per-unit price next to a
 * multi-unit total, which is the wrong comparison), scale the compare-at
 * per-unit price by the same quantity.
 * @param {{
 *   quantity?: number;
 *   cost?: {compareAtAmountPerQuantity?: {amount?: string; currencyCode?: string} | null};
 * } | null | undefined} line
 */
export function computeLineCompareAtTotal(line) {
  const perUnit = line?.cost?.compareAtAmountPerQuantity;
  const quantity = line?.quantity;
  if (!perUnit?.amount || !quantity) return null;
  const amount = parseFloat(perUnit.amount) * quantity;
  if (!(amount > 0)) return null;
  return {amount: amount.toFixed(2), currencyCode: perUnit.currencyCode};
}
