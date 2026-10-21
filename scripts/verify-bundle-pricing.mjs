/**
 * Checks the bundle tiers and price math in app/lib/bundle.js.
 *   node scripts/verify-bundle-pricing.mjs
 */
import {priceKit, tierFor, nextTier} from '../app/lib/bundle.js';

let fail = 0;
const ok = (name, cond, got) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : `  got ${JSON.stringify(got)}`}`);
  if (!cond) fail++;
};

ok('2 items: no tier, locked', !priceKit([10, 10]).ready && priceKit([10, 10]).pct === 0, priceKit([10, 10]));
ok('3 items: 25%', tierFor(3).pct === 25);
ok('5 items: 25%', tierFor(5).pct === 25);
ok('6 items: 35%', tierFor(6).pct === 35);
ok('8 items: 35%', tierFor(8).pct === 35);
ok('9 items: 45%', tierFor(9).pct === 45);
ok('next from 4 is 6 (2 more, 35%)', nextTier(4).more === 2 && nextTier(4).pct === 35, nextTier(4));
ok('next from 9 is none', nextTier(9) === null);
const k3 = priceKit([10, 10, 10]);
ok('3 x $10 = $22.50, save $7.50', k3.total === 22.5 && k3.save === 7.5, k3);
const k9 = priceKit(Array(9).fill(19.99));
ok('9 x $19.99 at 45%: per-line round DOWN (899.55c -> 899c)', k9.list === 179.91 && k9.save === 80.91 && k9.total === 99, k9);

// Measured on the live Shopify cart 2026-10-17 (automatic discounts, local build of bbpromo1):
// the cart subtotal Shopify returned for the first 3 and first 6 top sellers.
const live3 = priceKit([18.99, 18.99, 16.49]);
ok('live cart: 3 top sellers at 25% = $40.87', live3.total === 40.87, live3);
const live6 = priceKit([18.99, 18.99, 16.49, 15.99, 7.99, 16.79]);
ok('live cart: 6 widgets at 35% = $61.94', live6.total === 61.94, live6);

// Launch-post example: six real top sellers at their Shopify prices (2026-10-15)
const six = [
  ['Multistream Chat Widget', 18.99],
  ['Moon Jar Goal Widget', 18.99],
  ['Y2K Sticker Chat Widget', 16.49],
  ['Neon Glow Chat and Goal Widget', 15.99],
  ['Spooky Jar Goal Widget', 18.99],
  ['Celestial Star Goal Widget', 7.99],
];
const ex = priceKit(six.map((x) => x[1]));
console.log('\nExample 6-widget kit:', six.map((x) => `${x[0]} $${x[1]}`).join(', '));
console.log(`list $${ex.list.toFixed(2)}  kit $${ex.total.toFixed(2)}  save $${ex.save.toFixed(2)} (${ex.pct}%)`);
ok('example is 35%', ex.pct === 35, ex);

process.exit(fail ? 1 : 0);
