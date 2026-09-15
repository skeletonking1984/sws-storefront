/**
 * Does an ordinary cart mutation destroy attributes the app cannot re-derive?
 *
 * This is BAT-147. `app/lib/context.js` passes only `queryFragment` to
 * `createHydrogenContext`'s cart config and never `mutateFragment`, so every
 * cart MUTATION resolves Hydrogen's own MINIMAL_CART_FRAGMENT
 * ({id, totalQuantity, checkoutUrl}), which has no `attributes` field.
 * `app/routes/cart.jsx` therefore reads `existingAttributes` as [] on every
 * mutation and `cartAttributesUpdate` becomes a full replace rather than a
 * merge.
 *
 * WHY A DECOY. Every check in verify-tracking.mjs asserts that the keys the
 * code WRITES are present, and all of them pass while this bug is live,
 * because the app re-derives its own click ids from cookies every time. A
 * presence-only check cannot see a deletion. So this writes a value the app
 * has no way to reconstruct and asserts it is still there afterwards.
 *
 *   node scripts/verify-cart-attributes.mjs                 # against production
 *   node scripts/verify-cart-attributes.mjs <origin>        # against a preview
 *
 * Exits 1 when the decoy is destroyed.
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

console.log('1. create a cart through the real /cart action');
await linesAdd(variantId);
const id = cartId();
if (!id) { console.log('   could not read the cart cookie'); process.exit(1); }
console.log(`   cart ${id.slice(0, 46)}...`);

// A value the app has no way to reconstruct from a cookie.
const decoy = `bat147-${Date.now()}`;
console.log(`\n2. write a decoy the app cannot re-derive: gift_note=${decoy}`);
await sf(
  `mutation($id:ID!,$attrs:[AttributeInput!]!){cartAttributesUpdate(cartId:$id,attributes:$attrs){cart{attributes{key value}}userErrors{message}}}`,
  {id, attrs: [{key: 'gift_note', value: decoy}]},
);

const read = async () => {
  const j = await sf(`query($id:ID!){cart(id:$id){attributes{key value}}}`, {id});
  return j.data?.cart?.attributes || [];
};

await new Promise((r) => setTimeout(r, 6000)); // rule out read-after-write lag
const before = await read();
console.log('   attributes now:', before.map((a) => a.key).join(', ') || '(none)');
if (!before.some((a) => a.key === 'gift_note')) {
  console.log('   decoy never landed, cannot run the test');
  process.exit(1);
}

console.log('\n3. one ordinary LinesAdd through the app, same cookies');
await linesAdd(variantId);
await new Promise((r) => setTimeout(r, 4000));
const after = await read();
console.log('   attributes now:', after.map((a) => a.key).join(', ') || '(none)');

const survived = after.find((a) => a.key === 'gift_note')?.value === decoy;
console.log(`\n${survived ? 'PASS' : 'FAIL'}  the decoy ${survived ? `survived` : `was DESTROYED by`} an ordinary cart mutation`);
if (!survived) {
  console.log('      This is BAT-147. Anything the app cannot rebuild from a');
  console.log('      cookie is lost on the next mutation, including a twclid');
  console.log('      whose 90 day cookie has expired on a long lived cart.');
}
process.exit(survived ? 0 : 1);
