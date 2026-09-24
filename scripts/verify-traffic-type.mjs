/**
 * Does a cart once flagged as internal traffic stop being flagged when a
 * real buyer finishes it?
 *
 * This is the second half of BAT-147 (was BAT-148). readClickIds emits
 * `_traffic_type=internal` for a QA cookie or an automated browser and
 * omits the key for everyone else. cart.jsx used to skip absent keys, so
 * once a cart carried `internal` nothing could remove it, and the
 * orders/create webhook stamped `traffic_type: internal` on a real sale.
 *
 * Drives the live /cart action: one LinesAdd with `sws_qa=1`, then one
 * without it on the same cart, and asserts the flag is gone.
 *
 *   node scripts/verify-traffic-type.mjs                 # against production
 *   node scripts/verify-traffic-type.mjs <origin>        # against a preview
 *
 * Exits 1 when the flag survives.
 */
import fs from 'node:fs';

const origin = process.argv[2] || 'https://streamwidgetshop.com';
/*
 * Oxygen preview deployments sit behind Shopify OAuth at the edge, so a
 * preview needs the CLI's --auth-bypass-token as a HEADER (it does not work
 * as a query parameter). Production ignores this.
 */
const bypass = process.env.OXYGEN_BYPASS_TOKEN;
const edgeHeaders = bypass ? {'oxygen-auth-bypass-token': bypass} : {};
const env = Object.fromEntries(
  fs.readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n').filter(Boolean)
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')];
    }),
);

const SF = `https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`;
const sf = async (query, variables) => {
  const r = await fetch(SF, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
    },
    body: JSON.stringify({query, variables}),
  });
  return r.json();
};

let cookie = '';
const remember = (res) => {
  for (const c of res.headers.getSetCookie?.() || []) {
    const kv = c.split(';')[0];
    const name = kv.split('=')[0];
    cookie = cookie.split('; ').filter(Boolean)
      .filter((p) => !p.startsWith(name + '=')).concat(kv).join('; ');
  }
};
const cartId = () => {
  const raw = cookie.split('; ').find((c) => c.startsWith('cart='))?.slice(5);
  return raw ? `gid://shopify/Cart/${decodeURIComponent(raw)}` : null;
};

const linesAdd = async (variantId) => {
  const body = new URLSearchParams();
  body.append('cartFormInput', JSON.stringify({
    action: 'LinesAdd',
    inputs: {lines: [{merchandiseId: variantId, quantity: 1}]},
  }));
  const res = await fetch(`${origin}/cart`, {
    method: 'POST', body,
    headers: {
      ...edgeHeaders,
      cookie,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  remember(res);
  return res.ok;
};

console.log(`Target: ${origin}\n`);
// A real variant to put in the cart.
const probe = await fetch(`${origin}/api/agent?op=search&q=neon&limit=1`, {headers: edgeHeaders});
if (!probe.headers.get('content-type')?.includes('json')) {
  console.log('The target returned HTML, not JSON. A preview needs');
  console.log('OXYGEN_BYPASS_TOKEN set to the CLI --auth-bypass-token value.');
  process.exit(1);
}
const found = await probe.json();
const variantId = found.results[0].variantId;

const read = async (id) =>
  (await sf(`query($id:ID!){cart(id:$id){attributes{key value}}}`, {id}))
    .data?.cart?.attributes || [];
const flag = (attrs) => attrs.find((a) => a.key === '_traffic_type')?.value;

console.log('1. add to cart as QA traffic (sws_qa=1)');
cookie = 'sws_qa=1';
await linesAdd(variantId);
const id = cartId();
if (!id) { console.log('   could not read the cart cookie'); process.exit(1); }
await new Promise((r) => setTimeout(r, 5000)); // rule out read-after-write lag
const before = flag(await read(id));
console.log(`   _traffic_type = ${before ?? 'MISSING'}`);
if (before !== 'internal') {
  console.log('   the QA flag never landed, cannot run the test');
  process.exit(1);
}

console.log('\n2. same cart, QA cookie gone, one ordinary LinesAdd');
cookie = cookie.split('; ').filter((c) => !c.startsWith('sws_qa=')).join('; ');
await linesAdd(variantId);
await new Promise((r) => setTimeout(r, 5000));
const after = flag(await read(id));
console.log(`   _traffic_type = ${after ?? '(absent)'}`);

const cleared = after === undefined;
console.log(`\n${cleared ? 'PASS' : 'FAIL'}  the internal flag ${cleared ? 'was cleared' : 'SURVIVED'} once a real buyer took the cart over`);
process.exit(cleared ? 0 : 1);
