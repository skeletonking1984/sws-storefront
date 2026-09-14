/**
 * End to end verification of the conversion tracking relay, against a LIVE
 * deployment. Run it after every deploy that touches tracking.
 *
 *   node scripts/verify-tracking.mjs                       # production
 *   node scripts/verify-tracking.mjs http://localhost:3000  # a dev server
 *
 * Exits 0 when everything passes, 1 on the first real failure, and prints
 * the evidence for every check either way.
 *
 * WHY THIS EXISTS, because it is the whole point:
 *
 * Two tracking bugs shipped to production on 2026-09-13 and 2026-09-14 and
 * BOTH had passing tests at the time. The tests were written against
 * fixtures that encoded the same wrong assumption as the code:
 *
 *   1. `parseGaSession` was unit tested against an invented `GS1.1.a.b`
 *      cookie. Production serves the `GS2.1.s...$o...` shape. Every order
 *      went out with no session id and GA4 reassigned the purchase to a
 *      new session, which is what put revenue on a /checkouts/ landing
 *      page. Caught only because Todd placed a real test order.
 *   2. `transport_type: 'beacon'` was added to make begin_checkout survive
 *      the navigation to hosted checkout. It is a Universal Analytics
 *      field that GA4 ignores. It looked right and did nothing.
 *
 * So this script does not import the app's own parsers and feed them
 * fixtures. It drives the DEPLOYED site over HTTP with realistic cookies
 * and asserts on what the server actually did. If a check here can pass
 * while the feature is broken, the check is worthless and should be
 * rewritten.
 */

import fs from 'node:fs';

const ORIGIN = (process.argv[2] || 'https://streamwidgetshop.com').replace(
  /\/$/,
  '',
);

const pass = [];
const fail = [];

function check(name, ok, detail) {
  (ok ? pass : fail).push({name, detail});
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`  ${mark}  ${name}${detail ? `  ${detail}` : ''}`);
}

function section(title) {
  console.log(`\n${title}`);
}

/** Real captured cookie values, not invented ones. See the header. */
const GA_COOKIE_SHAPES = [
  {
    label: 'GS2 dollar delimited (current, live on streamwidgetshop.com)',
    value: 'GS2.1.s1789350851$o2$g1$t1789351798$j60$l0$h0',
    sessionId: '1789350851',
    sessionNumber: '2',
  },
  {
    label: 'GS1 dot delimited (older, still served to some clients)',
    value: 'GS1.1.1789346700.5.1.1789346730.0.0.0',
    sessionId: '1789346700',
    sessionNumber: '5',
  },
];

const CLIENT_ID = '1468354930.1789346442';

async function main() {
  console.log(`Verifying conversion tracking against ${ORIGIN}`);

  // ---------------------------------------------------------------- 1
  section('1. Endpoints are alive and locked');

  const relayGet = await fetch(`${ORIGIN}/api/e`);
  check('/api/e GET is 405', relayGet.status === 405, `got ${relayGet.status}`);

  const relayNoOrigin = await fetch(`${ORIGIN}/api/e`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({name: 'page_view', params: {}}),
  });
  check(
    '/api/e rejects a cross origin POST',
    relayNoOrigin.status === 403,
    `got ${relayNoOrigin.status}`,
  );

  const sameOrigin = {
    'Content-Type': 'application/json',
    Origin: ORIGIN,
    'Sec-Fetch-Site': 'same-origin',
  };

  const relayPurchase = await fetch(`${ORIGIN}/api/e`, {
    method: 'POST',
    headers: sameOrigin,
    body: JSON.stringify({name: 'purchase', params: {}}),
  });
  check(
    '/api/e refuses a forged purchase',
    relayPurchase.status === 400,
    `got ${relayPurchase.status}`,
  );

  const relayValid = await fetch(`${ORIGIN}/api/e`, {
    method: 'POST',
    headers: sameOrigin,
    body: JSON.stringify({
      name: 'view_item',
      params: {name: 'view_item', currency: 'USD', value: 1},
    }),
  });
  check(
    '/api/e accepts a real same origin event',
    relayValid.status === 204,
    `got ${relayValid.status}`,
  );

  const hookGet = await fetch(`${ORIGIN}/webhooks/orders`);
  check(
    '/webhooks/orders GET is 405',
    hookGet.status === 405,
    `got ${hookGet.status}`,
  );

  const hookUnsigned = await fetch(`${ORIGIN}/webhooks/orders`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: '{"id":1}',
  });
  // 401 means the HMAC secret is set AND the request was rejected. 503
  // would mean the secret is missing, which is a different, louder problem.
  check(
    '/webhooks/orders rejects an unsigned POST as 401, not 503',
    hookUnsigned.status === 401,
    hookUnsigned.status === 503
      ? 'got 503, PRIVATE_SHOPIFY_WEBHOOK_SECRET is NOT set on this environment'
      : `got ${hookUnsigned.status}`,
  );

  const hookForged = await fetch(`${ORIGIN}/webhooks/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Hmac-Sha256': 'bogus',
    },
    body: '{"id":1}',
  });
  check(
    '/webhooks/orders rejects a forged HMAC',
    hookForged.status === 401,
    `got ${hookForged.status}`,
  );

  // ---------------------------------------------------------------- 2
  section('2. First party client id cookie');

  const fresh = await fetch(`${ORIGIN}/`);
  const setCookie = fresh.headers.get('set-cookie') || '';
  const minted = (setCookie.match(/sws_cid=([^;]+)/) || [])[1];
  check('sws_cid is minted on a fresh visit', Boolean(minted), minted || 'none');
  check(
    'sws_cid is HttpOnly',
    /sws_cid=[^;]+;[^,]*HttpOnly/i.test(setCookie),
    'a cookie page JS can read is one a blocker can strip',
  );
  if (ORIGIN.startsWith('https://')) {
    check(
      'sws_cid is Secure over https',
      /sws_cid=[^;]+;[^,]*Secure/i.test(setCookie),
      '',
    );
  }
  check(
    'sws_cid has GA4 client id shape',
    Boolean(minted) && /^\d+\.\d+$/.test(minted),
    minted || '',
  );

  if (minted) {
    const replay = await fetch(`${ORIGIN}/`, {
      headers: {Cookie: `sws_cid=${minted}`},
    });
    const again = replay.headers.get('set-cookie') || '';
    check(
      'sws_cid is not re-minted when already present',
      !/sws_cid=/.test(again),
      '',
    );
  }

  // ---------------------------------------------------------------- 3
  // The regression that actually shipped. Drives the real cart action with
  // a real cookie shape and asserts the server wrote the right attributes.
  section('3. Cart carries the ids the purchase webhook needs');

  const variantId = await firstAvailableVariantId();
  if (!variantId) {
    check('found a purchasable variant to test with', false, 'none returned');
  } else {
    for (const shape of GA_COOKIE_SHAPES) {
      await verifyCartAttributes({variantId, shape, internal: false});
    }
    // Internal tagging is what keeps test orders out of the numbers.
    await verifyCartAttributes({
      variantId,
      shape: GA_COOKIE_SHAPES[0],
      internal: true,
    });
  }

  // ---------------------------------------------------------------- 4
  section('4. Storefront serves the analytics bundle');
  const home = await fetch(`${ORIGIN}/`).then((r) => r.text());
  check(
    'GA4 measurement id is in the served page',
    /G-[A-Z0-9]{8,}/.test(home),
    (home.match(/G-[A-Z0-9]{8,}/) || [])[0] || 'not found',
  );

  // ---------------------------------------------------------------- done
  console.log(`\n${pass.length} passed, ${fail.length} failed`);
  if (fail.length) {
    console.log('\nFAILURES:');
    for (const f of fail) console.log(`  - ${f.name}  ${f.detail}`);
    process.exit(1);
  }
  console.log('Conversion tracking verified end to end.');
}

/**
 * Posts to the deployed cart action exactly the way the site's own form
 * does, with a chosen `_ga_<container>` cookie shape, then reads the
 * resulting cart back out of the Storefront API and asserts the attributes.
 *
 * @param {{variantId: string, shape: typeof GA_COOKIE_SHAPES[number], internal: boolean}} args
 */
async function verifyCartAttributes({variantId, shape, internal}) {
  const label = internal ? `${shape.label} + internal` : shape.label;

  const cookies = [
    `_ga=GA1.1.${CLIENT_ID}`,
    `_ga_${measurementSuffix()}=${shape.value}`,
  ];
  if (internal) cookies.push('sws_qa=1');

  const body = new URLSearchParams();
  body.set(
    'cartFormInput',
    JSON.stringify({
      action: 'LinesAdd',
      inputs: {lines: [{merchandiseId: variantId, quantity: 1}]},
    }),
  );

  const res = await fetch(`${ORIGIN}/cart`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: cookies.join('; '),
      // A plain browser UA, so the only internal signal under test is the
      // sws_qa cookie and not this script's own user agent.
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36',
    },
    body,
  });

  const cartCookie = (
    (res.headers.get('set-cookie') || '').match(/(?:^|[,;\s])cart=([^;]+)/) ||
    []
  )[1];
  if (!cartCookie) {
    check(`cart created [${label}]`, false, `status ${res.status}, no cart cookie`);
    return;
  }

  const attributes = await readCartAttributes(decodeURIComponent(cartCookie));
  if (!attributes) {
    check(`cart readable [${label}]`, false, 'Storefront API returned no cart');
    return;
  }
  const map = Object.fromEntries(attributes.map((a) => [a.key, a.value]));

  check(
    `_ga_client_id relayed [${label}]`,
    map._ga_client_id === CLIENT_ID,
    `got ${map._ga_client_id ?? 'MISSING'}`,
  );
  check(
    `_ga_session_id parsed from this cookie shape [${label}]`,
    map._ga_session_id === shape.sessionId,
    `want ${shape.sessionId}, got ${map._ga_session_id ?? 'MISSING'}`,
  );
  check(
    `_ga_session_number parsed [${label}]`,
    map._ga_session_number === shape.sessionNumber,
    `want ${shape.sessionNumber}, got ${map._ga_session_number ?? 'MISSING'}`,
  );
  if (internal) {
    check(
      `_traffic_type is internal [${label}]`,
      map._traffic_type === 'internal',
      `got ${map._traffic_type ?? 'MISSING'}`,
    );
  } else {
    check(
      `_traffic_type absent for a normal visitor [${label}]`,
      map._traffic_type === undefined,
      `got ${map._traffic_type}`,
    );
  }
}

function measurementSuffix() {
  return (env().PUBLIC_GA4_MEASUREMENT_ID || 'G-X0978HDVTK').replace(/^G-/, '');
}

let cachedEnv;
function env() {
  if (cachedEnv) return cachedEnv;
  cachedEnv = Object.fromEntries(
    fs
      .readFileSync(new URL('../.env', import.meta.url), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const i = line.indexOf('=');
        return [line.slice(0, i), line.slice(i + 1).replace(/^["']|["']$/g, '')];
      }),
  );
  return cachedEnv;
}

async function storefront(query, variables) {
  const e = env();
  const res = await fetch(
    `https://${e.PUBLIC_STORE_DOMAIN}/api/2025-07/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': e.PUBLIC_STOREFRONT_API_TOKEN,
      },
      body: JSON.stringify({query, variables}),
    },
  );
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 300));
  return json.data;
}

async function firstAvailableVariantId() {
  const data = await storefront(
    `{products(first:5){nodes{title variants(first:1){nodes{id availableForSale}}}}}`,
  );
  for (const product of data.products.nodes) {
    const variant = product.variants.nodes[0];
    if (variant?.availableForSale) return variant.id;
  }
  return null;
}

async function readCartAttributes(cartCookieValue) {
  const data = await storefront(
    `query($id:ID!){cart(id:$id){attributes{key value}}}`,
    {id: `gid://shopify/Cart/${cartCookieValue}`},
  );
  return data.cart ? data.cart.attributes : null;
}

main().catch((error) => {
  console.error('\nverify-tracking crashed:', error.message);
  process.exit(1);
});
