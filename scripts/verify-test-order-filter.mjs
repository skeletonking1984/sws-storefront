/**
 * Prove the internal-test-order filter blocks what it should and, more
 * importantly, does NOT block a real sale.
 *
 * This guard (app/lib/conversions/testOrders.js) sits in front of every
 * conversion destination. If it over-matches,
 * real revenue silently stops being reported to X and GA4 and the shop looks
 * dead; if it under-matches, the optimiser goes back to learning from Todd's own
 * $0 checkouts. Both failures are invisible from the outside, so both directions
 * are tested here, with the real order shapes taken from live Shopify payloads:
 *
 *   #1044  total 0.00, discount SWSTEST-JDSA7N, test:false   -> must be skipped
 *   #1041  total 19.10, no discount codes                    -> must be sent
 *
 * The second is the one that matters. A filter that blocks everything passes any
 * test suite that only checks "does it catch the bad ones".
 *
 * Usage: node scripts/verify-test-order-filter.mjs
 */
import {internalTestOrder} from '../app/lib/conversions/testOrders.js';

const cases = [
  // --- must be SKIPPED -----------------------------------------------------
  {
    name: 'real order #1044 shape: 100% SWSTEST discount, test:false',
    order: {
      id: 1, test: false, total_price: '0.00',
      discount_codes: [{code: 'SWSTEST-JDSA7N', amount: '18.99', type: 'percentage'}],
    },
    skip: true,
  },
  {
    name: 'test code in lower case',
    order: {id: 2, total_price: '0.00', discount_codes: [{code: 'swstest-auny'}]},
    skip: true,
  },
  {
    name: 'test code with surrounding whitespace',
    order: {id: 3, total_price: '5.00', discount_codes: [{code: '  SWSTEST-X  '}]},
    skip: true,
  },
  {
    name: 'a future test code that is not JDSA7N',
    order: {id: 4, total_price: '0.00', discount_codes: [{code: 'SWSTEST-2027'}]},
    skip: true,
  },
  {
    name: 'discount_codes as plain strings',
    order: {id: 5, total_price: '0.00', discount_codes: ['SWSTEST-STR']},
    skip: true,
  },
  {
    name: 'shopify test mode, even at full price',
    order: {id: 6, test: true, total_price: '18.99', discount_codes: []},
    skip: true,
  },
  {
    name: 'zero total with no discount code at all',
    order: {id: 7, total_price: '0.00', discount_codes: []},
    skip: true,
  },

  // --- must be SENT --------------------------------------------------------
  {
    name: 'real order #1041 shape: 19.10, no discount',
    order: {id: 8, test: false, total_price: '19.10', discount_codes: []},
    skip: false,
  },
  {
    name: 'real order with a GENUINE customer discount code',
    order: {id: 9, test: false, total_price: '12.00', discount_codes: [{code: 'LAUNCH20'}]},
    skip: false,
  },
  {
    name: 'a code that merely contains the word test',
    order: {id: 10, test: false, total_price: '9.99', discount_codes: [{code: 'GREATESTHITS'}]},
    skip: false,
  },
  {
    name: 'a real sale for a small amount',
    order: {id: 11, test: false, total_price: '0.99', discount_codes: []},
    skip: false,
  },
  {
    name: 'missing discount_codes entirely',
    order: {id: 12, test: false, total_price: '18.99'},
    skip: false,
  },
  {
    name: 'malformed payload, no fields: send rather than silently swallow',
    order: {},
    skip: false,
  },
];

let failed = 0;
for (const c of cases) {
  const reason = internalTestOrder(c.order);
  const skipped = reason !== null;
  const ok = skipped === c.skip;
  if (!ok) failed++;
  const want = c.skip ? 'SKIP' : 'SEND';
  const got = skipped ? `SKIP (${reason})` : 'SEND';
  console.log(`${ok ? 'pass' : 'FAIL'}  want ${want}, got ${got}  -- ${c.name}`);
}

const sends = cases.filter((c) => !c.skip).length;
console.log(
  failed === 0
    ? `\n${cases.length}/${cases.length} pass, including ${sends} that MUST still be reported.`
    : `\n${failed} FAILED. Do not deploy: this guard sits in front of all revenue reporting.`,
);
process.exit(failed === 0 ? 0 : 1);
