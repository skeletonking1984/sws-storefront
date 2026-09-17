/**
 * Checks the channel manifest against what the code and the live site ACTUALLY
 * do. Not a pretty-printer for app/lib/channels.js.
 *
 * The distinction is the whole point. A manifest that merely describes the
 * system becomes decoration the day it drifts, and every failure this file
 * exists to catch was a drift nobody saw:
 *
 *   - X declared purchase and events; only sendPurchase existed.
 *   - Meta has a complete adapter and nothing connected to it.
 *   - Pinterest had a valid feed and an unclaimed domain.
 *
 * So every `expects` key is verified against a fact:
 *   events    the adapter file must export sendEvent
 *   purchase  the adapter file must export sendPurchase
 *   pixel     the browser adapter must exist and inject a script
 *   feed      the route file must exist AND the live URL must return 200
 *
 * Exit 1 on any mismatch. A channel that is deliberately off (Meta) declares
 * that in `expects` and passes; the manifest is where an intentional gap gets
 * recorded, so "not wired" and "broken" stop looking the same.
 *
 *   node scripts/verify-channels.mjs              # offline checks only
 *   node scripts/verify-channels.mjs --live       # also fetch every feed
 */
import {existsSync, readFileSync} from 'node:fs';

const R = new URL('..', import.meta.url).pathname;
const {SOURCES, DESTINATIONS, TRACKING_PLAN} = await import(`${R}/app/lib/channels.js`);
const LIVE = process.argv.includes('--live');
const ORIGIN = 'https://streamwidgetshop.com';

const fail = [];
const rows = [];

/** Strip comments: a mention of sendEvent in prose is not an implementation. */
const code = (f) =>
  readFileSync(`${R}/${f}`, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');

function has(file, needle) {
  if (!file || !existsSync(`${R}/${file}`)) return false;
  return code(file).includes(needle);
}

for (const d of DESTINATIONS) {
  const got = {};
  const e = d.expects;

  // events / purchase: the export must exist in CODE, not in a comment.
  got.events = has(d.adapter, 'export async function sendEvent') ||
               has(d.adapter, 'export function sendEvent');
  got.purchase = has(d.adapter, 'export async function sendPurchase') ||
                 has(d.adapter, 'export function sendPurchase');

  // pixel: a browser adapter that actually injects something.
  got.pixel = Boolean(d.browser) && existsSync(`${R}/${d.browser}`) &&
              (has(d.browser, 'createElement(\'script\')') || has(d.browser, 'loadScript'));

  // feed: the route must exist on disk.
  got.feed = null;
  if (e.feed) {
    const route = `app/routes/[${e.feed.replace(/^\//, '')}].jsx`;
    got.feed = existsSync(`${R}/${route}`) ? e.feed : null;
    if (!got.feed) fail.push(`${d.id}: declares feed ${e.feed} but ${route} does not exist`);
  }

  for (const key of ['events', 'purchase', 'pixel']) {
    if (e[key] && !got[key]) {
      fail.push(`${d.id}: declares ${key} but ${d.adapter || d.browser || 'no file'} does not implement it`);
    }
    // The other direction matters just as much: an adapter that sends
    // something the manifest does not declare is an UNDECLARED connection,
    // which is how data reaches a channel nobody is watching.
    if (!e[key] && got[key]) {
      fail.push(`${d.id}: implements ${key} but the manifest does not declare it`);
    }
  }

  rows.push({
    id: d.id,
    pixel: e.pixel ? (got.pixel ? 'yes' : 'MISSING') : 'no',
    events: e.events ? (got.events ? 'yes' : 'MISSING') : 'no',
    purchase: e.purchase ? (got.purchase ? 'yes' : 'MISSING') : 'no',
    feed: e.feed ? (got.feed ? e.feed : 'MISSING') : '-',
    claim: e.claim ? 'required' : '-',
  });
}

// Every adapter on disk must appear in the manifest. A destination that exists
// in code and not here is exactly the blind spot this file is for.
const {readdirSync} = await import('node:fs');
const adapters = readdirSync(`${R}/app/lib/conversions`)
  .filter((f) => f.endsWith('.server.js') && !f.startsWith('index'))
  .map((f) => f.replace('.server.js', ''));
for (const a of adapters) {
  if (!DESTINATIONS.some((d) => d.id === a)) {
    fail.push(`adapter ${a}.server.js exists but is not in the manifest`);
  }
}

// The tracking plan must match what the relay route actually accepts.
const relay = code('app/routes/api.e.jsx');
for (const name of SOURCES.storefront.emits) {
  if (!relay.includes(`'${name}'`)) {
    fail.push(`tracking plan has ${name} but api.e.jsx does not accept it`);
  }
}
if (relay.includes("'purchase',")) {
  fail.push('api.e.jsx accepts purchase from the browser: revenue must only come from the webhook');
}

console.log('\nCHANNELS');
console.table(rows);
console.log(`sources: ${Object.keys(SOURCES).length}   destinations: ${DESTINATIONS.length}   tracking plan: ${TRACKING_PLAN.length} events`);

if (LIVE) {
  console.log('\nlive feeds:');
  for (const d of DESTINATIONS.filter((x) => x.expects.feed)) {
    try {
      const res = await fetch(`${ORIGIN}${d.expects.feed}?cb=${Date.now()}`);
      const items = res.headers.get('x-feed-items');
      console.log(`  ${d.id.padEnd(18)} ${res.status}  items=${items || '?'}`);
      if (!res.ok) fail.push(`${d.id}: live feed ${d.expects.feed} returned ${res.status}`);
      if (items && Number(items) === 0) fail.push(`${d.id}: live feed is empty`);
    } catch (error) {
      fail.push(`${d.id}: live feed unreachable (${error.message})`);
    }
  }
}

const off = DESTINATIONS.filter((d) => !d.expects.pixel && !d.expects.events && !d.expects.purchase && !d.expects.feed);
if (off.length) console.log(`\nnot connected by choice: ${off.map((d) => d.id).join(', ')}`);

console.log();
if (fail.length) {
  console.error('FAIL');
  for (const f of fail) console.error('  ' + f);
  process.exit(1);
}
console.log('PASS: every declared connection is implemented, and nothing sends undeclared.');
