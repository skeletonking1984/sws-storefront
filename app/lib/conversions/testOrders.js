/**
 * Keep internal test orders out of the ad platforms.
 *
 * Found 2026-09-15: 8 of the last 10 Shopify orders were Todd checking out with
 * the 100% discount code SWSTEST-JDSA7N from techgazetteteam@gmail.com. Shopify
 * reports those with `test: false`, because a real checkout using a real
 * discount IS a real order as far as Shopify is concerned, so nothing filtered
 * them and every one dispatched a Purchase conversion. X's Events Manager showed
 * 12 Purchase events in 12 hours against exactly ONE order, and the bidder was
 * learning from a pile of $0 sales that never happened.
 *
 * Lives in its own module, not in webhooks.orders.jsx, so the predicate can be
 * imported by a plain node script. Node cannot import .jsx, and a guard in front
 * of all revenue reporting is not allowed to be untestable.
 */

/**
 * Discount codes whose prefix marks an order as an internal test.
 *
 * A prefix rather than one fixed code, so a rotated or per-person code
 * (SWSTEST-JDSA7N, SWSTEST-AUNY, ...) is covered without another deploy. Keep it
 * loud and unmistakable: anything a real customer might plausibly type must NOT
 * live here, or genuine revenue stops being reported, which is the same failure
 * in the other and more expensive direction.
 */
export const TEST_DISCOUNT_PREFIX = 'SWSTEST';

/**
 * Is this an internal test order rather than a real sale?
 *
 * @param {any} order Raw Shopify `orders/create` payload.
 * @returns {string | null} Short reason when it is a test, null when it should
 *   be reported to every destination.
 */
export function internalTestOrder(order) {
  // Shopify's own test mode. Rarely set for these, but free to check.
  if (order?.test === true) return 'shopify test mode';

  const codes = Array.isArray(order?.discount_codes) ? order.discount_codes : [];
  for (const entry of codes) {
    const code = typeof entry === 'string' ? entry : entry?.code;
    if (
      typeof code === 'string' &&
      code.trim().toUpperCase().startsWith(TEST_DISCOUNT_PREFIX)
    ) {
      return `discount code ${code.trim()}`;
    }
  }

  // A zero-total order carries no revenue to report, and sending it as a
  // conversion with value 0 is worse than sending nothing: it tells the bidder
  // the click was worth zero and drags the learned value down.
  const total = Number(order?.total_price);
  if (Number.isFinite(total) && total === 0) return 'zero total';

  return null;
}
