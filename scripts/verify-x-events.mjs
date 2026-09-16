/**
 * Asserts what x.server.js's `sendEvent` actually PUTS ON THE WIRE.
 *
 * Not a re-implementation test. It calls the real exported function and
 * intercepts `fetch`, so every assertion is about the exact bytes that would
 * reach X. A verifier that rebuilds the payload it is checking proves only
 * that two pieces of code agree, which is how the over-long feed id and the
 * missing price_currency both shipped green.
 *
 * The four things that have actually gone wrong on this integration, all of
 * which look fine in code review and all of which are checked here:
 *
 *   1. identifiers SPLIT into one object per signal. X rejects
 *      [{twclid},{ip_address}] outright with "At least one user identifier
 *      must be provided" even though two were supplied. Verified live
 *      2026-09-15. This does not degrade matching, it records nothing.
 *   2. `value` with no `price_currency`. X counts the conversion and reports
 *      a blank sale amount, so cost per action computes and ROAS does not.
 *   3. An event sent with NO identifier at all, which X cannot attribute and
 *      which should never leave the building.
 *   4. An event name with no X conversion event configured being sent under
 *      some other event's id, which reports the wrong thing rather than
 *      nothing.
 *
 *   node scripts/verify-x-events.mjs
 */
import {sendEvent} from '../app/lib/conversions/x.server.js';

const ENV = {
  PUBLIC_X_PIXEL_ID: 'oTEST',
  PRIVATE_X_RELAY_URL: 'https://relay.invalid/x',
  PRIVATE_X_RELAY_TOKEN: 'tok',
  PUBLIC_X_EVENT_ID_PAGE_VIEW: 'evPAGEVIEW',
  PUBLIC_X_EVENT_ID_VIEW_CONTENT: 'evVIEWCONTENT',
  PUBLIC_X_EVENT_ID_ADD_TO_CART: 'evADDTOCART',
  PUBLIC_X_EVENT_ID_BEGIN_CHECKOUT: 'evBEGINCHECKOUT',
};

const pass = [];
const fail = [];
function check(name, ok, detail) {
  (ok ? pass : fail).push(detail ? `${name}  [${detail}]` : name);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`);
}

/** Runs sendEvent with fetch intercepted, returns the conversion it posted. */
async function capture(args) {
  let sent = null;
  const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    sent = {url, body: JSON.parse(init.body)};
    return new Response(JSON.stringify({ok: true}), {status: 200});
  };
  try {
    const result = await sendEvent({env: ENV, clickIds: {}, params: {}, ...args});
    return {sent, result};
  } finally {
    globalThis.fetch = real;
  }
}

const IDS = {ip: '203.0.113.9', userAgent: 'Mozilla/5.0 (test)'};

console.log('\nevent name maps to the configured X event id');
for (const [name, expected] of [
  ['page_view', 'evPAGEVIEW'],
  ['view_item', 'evVIEWCONTENT'],
  ['add_to_cart', 'evADDTOCART'],
  ['begin_checkout', 'evBEGINCHECKOUT'],
]) {
  const {sent, result} = await capture({name, ...IDS});
  const got = sent?.body?.conversions?.[0]?.event_id;
  check(`${name} -> ${expected}`, result.ok && got === expected, got || 'nothing sent');
}

console.log('\nnames with no X conversion event are not sent under someone else\'s id');
for (const name of ['view_item_list', 'select_item', 'remove_from_cart', 'view_cart', 'search']) {
  const {sent, result} = await capture({name, ...IDS});
  check(`${name} is skipped`, sent === null && !result.ok, result.reason);
}

console.log('\npurchase is never accepted here: that is the webhook\'s job alone');
{
  const {sent} = await capture({name: 'purchase', params: {value: 39.99}, ...IDS});
  check('purchase is skipped', sent === null);
}

console.log('\nidentifiers is ONE object, never one per signal');
{
  const {sent} = await capture({
    name: 'page_view',
    clickIds: {_twclid: 'tw123'},
    ...IDS,
  });
  const ids = sent?.body?.conversions?.[0]?.identifiers;
  check('identifiers has exactly one element', ids?.length === 1, `length ${ids?.length}`);
  check(
    'that one element carries all three signals',
    ids?.[0]?.twclid === 'tw123' &&
      ids?.[0]?.ip_address === IDS.ip &&
      ids?.[0]?.user_agent === IDS.userAgent,
    JSON.stringify(ids?.[0] || null),
  );
}

console.log('\nan event with nothing to attribute on is not sent');
{
  const {sent, result} = await capture({name: 'page_view'});
  check('no identifier means no send', sent === null && result.reason === 'no_identifier');
}
{
  const {sent} = await capture({name: 'page_view', clickIds: {_twclid: 'tw1'}});
  check('twclid alone is enough to send', sent !== null);
}
{
  const {sent} = await capture({name: 'page_view', ip: IDS.ip});
  check('ip alone is enough to send', sent !== null);
}

console.log('\nvalue and price_currency travel together or not at all');
{
  const {sent} = await capture({
    name: 'add_to_cart',
    params: {value: 29.99, currency: 'USD', items: [{id: 'p1', name: 'Widget', quantity: 2}]},
    ...IDS,
  });
  const c = sent?.body?.conversions?.[0];
  check('value is sent as a string', c?.value === '29.99', String(c?.value));
  check('price_currency accompanies it', c?.price_currency === 'USD', String(c?.price_currency));
  check('number_items sums quantities', c?.number_items === 2, String(c?.number_items));
}
{
  const {sent} = await capture({name: 'add_to_cart', params: {value: 29.99}, ...IDS});
  const c = sent?.body?.conversions?.[0];
  check('currency defaults rather than being omitted', c?.price_currency === 'USD', String(c?.price_currency));
}
{
  const {sent} = await capture({name: 'page_view', ...IDS});
  const c = sent?.body?.conversions?.[0];
  check(
    'no value means no price_currency either',
    c && c.value === undefined && c.price_currency === undefined,
    JSON.stringify({value: c?.value, price_currency: c?.price_currency}),
  );
}

console.log('\nunconfigured X sends nothing');
{
  let sent = null;
  const real = globalThis.fetch;
  globalThis.fetch = async () => { sent = true; return new Response('{}'); };
  const r = await sendEvent({env: {}, name: 'page_view', params: {}, clickIds: {}, ...IDS});
  globalThis.fetch = real;
  check('no pixel id means no send', sent === null && r.reason === 'not_configured');
}

console.log(`\n${pass.length} passed, ${fail.length} failed`);
if (fail.length) {
  for (const f of fail) console.error('  FAIL ' + f);
  process.exit(1);
}
console.log('PASS: X receives the funnel events, correctly shaped, or nothing at all.');
