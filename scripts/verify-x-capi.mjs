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
import {sendPurchase, isConfigured} from '../app/lib/conversions/x.server.js';

const REQUIRED = [
  'PRIVATE_X_CONSUMER_KEY',
  'PRIVATE_X_CONSUMER_SECRET',
  'PRIVATE_X_ACCESS_TOKEN',
  'PRIVATE_X_ACCESS_TOKEN_SECRET',
  'PUBLIC_X_PIXEL_ID',
  'PRIVATE_X_PURCHASE_EVENT_ID',
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

console.log('Credentials');
let missing = 0;
for (const key of REQUIRED) {
  const v = env[key];
  if (!v) missing++;
  const shown = key.startsWith('PUBLIC_') ? v : v ? `set, ${v.length} chars` : '';
  console.log(`  ${v ? 'OK     ' : 'MISSING'} ${key}${v ? '  ' + shown : ''}`);
}
console.log(`\n  isConfigured(): ${isConfigured(env)}`);
if (missing) {
  console.log(`\n${missing} value(s) missing. Nothing sent.`);
  process.exit(1);
}

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
