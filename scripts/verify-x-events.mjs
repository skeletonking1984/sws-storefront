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

console.log('\nhashed_email rides on funnel events when we know the visitor');
{
  const HE = 'a'.repeat(64);
  const {sent} = await capture({name: 'view_item', hashedEmail: HE, ...IDS});
  const ids = sent?.body?.conversions?.[0]?.identifiers;
  check('hashed_email is attached', ids?.[0]?.hashed_email === HE, JSON.stringify(ids?.[0] || null));
  check('still ONE identifier object', ids?.length === 1, `length ${ids?.length}`);
}
{
  const {sent} = await capture({name: 'page_view', hashedEmail: 'x'.repeat(64)});
  check('hashed_email alone is enough to send', sent !== null);
}
{
  const {sent} = await capture({name: 'page_view', ...IDS});
  const id0 = sent?.body?.conversions?.[0]?.identifiers?.[0];
  check('absent when unknown, never empty-string', id0 && !('hashed_email' in id0),
    JSON.stringify(id0 || null));
}

// The two hashers MUST agree. hashedEmail.server.js hashes the signup address
// and x.server.js hashes the ORDER address; if their normalization diverges the
// same person is two people to X and matching silently halves. Nothing at
// runtime would ever surface that, so it is asserted here against a known digest.
{
  const {hashEmail} = await import('../app/lib/hashedEmail.server.js');
  const a = await hashEmail('  Todd@Example.COM ');
  const b = await hashEmail('todd@example.com');
  check('normalization is trim + lowercase', a === b, a);
  check('digest is SHA256 hex', /^[0-9a-f]{64}$/.test(a || ''), String(a).slice(0, 16));
  check('rejects a non-address', (await hashEmail('nope')) === null);
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


/*
 * WIRING GUARD. Source-level, and deliberately so.
 *
 * Everything above proves x.server.js shapes a correct CAPI payload. None of
 * it can prove the thing that actually costs money here, which is how many
 * places an event is sent FROM. The dangerous regression is someone adding
 * twq('event', ...) back into the browser adapter: X would then receive the
 * same event from the pixel and from CAPI with no shared conversion_id, and
 * double count every page view, add to cart and checkout. Nothing fails,
 * nothing errors, the numbers are just wrong and the bidder optimises on
 * them.
 *
 * A behavioural test cannot see this: /api/e answers 204 either way, and X's
 * own totals are the only place the duplication shows up, days later. So
 * these read the source and assert the invariant directly. Brittle on
 * purpose: if someone edits these files, this SHOULD make them think.
 */
import {readFileSync} from 'node:fs';
const R = new URL('..', import.meta.url).pathname;
const src = (f) => readFileSync(`${R}/${f}`, 'utf8');
/*
 * Count CODE, not prose. The first run of this guard failed on the comment
 * that explains why the events were removed, which contains the literal
 * text twq('event', ...). A guard that cannot tell an instruction from a
 * sentence about an instruction will be silenced by the next person who
 * hits it, and a silenced guard protects nothing.
 */
const code = (f) =>
  src(f)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

console.log('\nwiring: exactly one system sends each event');
{
  const x = code('app/lib/analytics/pixels/x.js');
  const events = (x.match(/twq\('event'/g) || []).length;
  const config = (x.match(/twq\('config'/g) || []).length;
  check('X browser adapter fires NO events', events === 0, `${events} twq('event') calls`);
  check('X base tag is still installed', config > 0, `${config} twq('config') calls`);
  check('uwt.js loader retained', x.includes('static.ads-twitter.com/uwt.js'));
}
{
  const bus = code('app/components/pixels/PixelBus.jsx');
  check("X is relayed unconditionally", bus.includes("relayEvent(event, ['x'])"));
  check("GA4 is relayed as ['ga4']", bus.includes("relayEvent(event, ['ga4'])"));
  // The GA4 gate must still stand between the subscribe body and GA4's relay,
  // or a normal visitor's event reaches GA4 from gtag.js AND from the relay.
  const xAt = bus.indexOf("relayEvent(event, ['x'])");
  const gateAt = bus.indexOf('if (ga4Loaded === true) return;');
  const ga4At = bus.indexOf("relayEvent(event, ['ga4'])");
  check('GA4 relay still sits behind the loaded gate', gateAt > xAt && ga4At > gateAt,
    `x@${xAt} gate@${gateAt} ga4@${ga4At}`);
  check('purchase is never relayed', bus.includes("if (event.name === 'purchase') return;"));
}
{
  const route = code('app/routes/api.e.jsx');
  check('relay filters by the destinations allow-list', route.includes('allowed.has(destination.id)'));
  check('missing allow-list falls back to ga4 only', route.includes(": ['ga4'];"));
  check('purchase still rejected at the route', !route.includes("'purchase',"));
}

const wiringFailed = fail.length;
console.log(`\n${pass.length} passed, ${fail.length} failed`);
if (wiringFailed) {
  for (const f of fail) console.error('  FAIL ' + f);
  process.exit(1);
}
console.log('PASS: X receives every funnel event, correctly shaped, from exactly one system.');
