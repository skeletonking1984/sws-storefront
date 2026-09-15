/**
 * End to end check of the X Conversion API destination.
 *
 * Reports which credentials are present, builds the exact payload the
 * purchase webhook would send, and optionally posts it to X.
 *
 *   node scripts/verify-x-capi.mjs            # dry run, builds and prints, sends nothing
 *   node scripts/verify-x-capi.mjs --send     # actually posts one test conversion
 *
 * Reads credentials from the environment, or from a local .env.x file which
 * is gitignored. Never print a secret: only presence and length are shown.
 */
import fs from 'node:fs';
import {sendPurchase, isConfigured, authMode} from '../app/lib/conversions/x.server.js';

// Two ways to authenticate. The pixel token path needs 3 values in total,
// the OAuth path needs 6. Either is fine; the script reports which one the
// current environment satisfies.
const ALWAYS = ['PUBLIC_X_PIXEL_ID', 'PRIVATE_X_PURCHASE_EVENT_ID'];
const PATH_A = ['PRIVATE_X_PIXEL_TOKEN'];
const PATH_B = [
  'PRIVATE_X_CONSUMER_KEY',
  'PRIVATE_X_CONSUMER_SECRET',
  'PRIVATE_X_ACCESS_TOKEN',
  'PRIVATE_X_ACCESS_TOKEN_SECRET',
];

const env = {...process.env};
for (const file of ['.env.x', '.env']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const i = line.indexOf('=');
    if (i < 1 || line.trim().startsWith('#')) continue;
    const k = line.slice(0, i).trim();
    if (env[k] === undefined) env[k] = line.slice(i + 1).trim().replace(/^["']|["']$/g, '');
  }
}

const show = (keys, label) => {
  console.log(`\n${label}`);
  let have = 0;
  for (const key of keys) {
    const v = env[key];
    if (v) have++;
    const detail = key.startsWith('PUBLIC_') ? v : v ? `set, ${v.length} chars` : '';
    console.log(`  ${v ? 'OK     ' : 'MISSING'} ${key}${v ? '  ' + detail : ''}`);
  }
  return have === keys.length;
};

const base = show(ALWAYS, 'Needed either way');
const a = show(PATH_A, 'Path A: pixel token (Ads UI > Events Manager, no developer account)');
const b = show(PATH_B, 'Path B: OAuth 1.0a (developer account with Ads API access)');

const mode = authMode(env);
console.log(`\n  auth path in use: ${mode || 'none'}`);
console.log(`  isConfigured():   ${isConfigured(env)}`);

if (!base || !mode) {
  console.log('\nNot ready. Supply PUBLIC_X_PIXEL_ID and PRIVATE_X_PURCHASE_EVENT_ID,');
  console.log('plus EITHER PRIVATE_X_PIXEL_TOKEN (path A) or all four path B values.');
  console.log('Nothing sent.');
  process.exit(1);
}
void a; void b;

// A realistic order, shaped exactly like Shopify's orders/create webhook body.
const order = {
  id: 9999999999,
  email: process.argv.includes('--email')
    ? process.argv[process.argv.indexOf('--email') + 1]
    : 'capi-test@streamwidgetshop.com',
  processed_at: new Date().toISOString(),
  total_price: '10.52',
  line_items: [
    {product_id: 8537283920062, title: 'Cute Octopus Liquid Filling Goal Widget', price: '10.52', quantity: 1},
  ],
};

const eventId = `capi-test-${Date.now()}`;
console.log('\nPayload the webhook would send');
console.log(`  event_id       ${env.PRIVATE_X_PURCHASE_EVENT_ID}`);
console.log(`  pixel          ${env.PUBLIC_X_PIXEL_ID}`);
console.log(`  conversion_id  ${eventId}`);
console.log(`  value          ${order.total_price}`);
console.log(`  identifiers    hashed_email (sha256 of ${order.email}), twclid if the buyer came from an X ad`);

if (!process.argv.includes('--send')) {
  console.log('\nDry run. Re-run with --send to post it to X.');
  process.exit(0);
}

console.log('\nSending...');
const result = await sendPurchase({env, order, clickIds: {}, eventId});
console.log('  result:', JSON.stringify(result));
if (result.ok) {
  console.log('\nAccepted by X. Check Ads Manager > Conversion Diagnostics:');
  console.log('  - "Conversion API (CAPI)" should stop saying Not set up');
  console.log('  - the Conversions over time chart should show a server-side series');
  console.log('  Allow a few minutes; the panel updates on a delay.');
} else {
  console.log('\nRejected. reason above. send_failed_401 or _403 means the');
  console.log('credentials or the ads-account permission are wrong, not the payload.');
}
process.exit(result.ok ? 0 : 1);
