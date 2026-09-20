/**
 * Runs EVERY channel health check, then reports.
 *
 * WHY THIS FILE EXISTS. `verify:all` used to be a chain of `&&`, so the first
 * non-zero exit stopped the run. On 2026-09-15 `audit:ip` failed on two live
 * IP named products, which is a known long lived blocker, and that single
 * expected failure silently skipped the last three checks in the chain:
 * verify-test-order-filter, verify-tracking and verify-feed. A nightly routine
 * that stops checking the moment it finds its first known problem is not a
 * nightly routine. The three skipped checks cover the test order guard in
 * front of all revenue reporting, conversion tracking, and the product feed
 * every sales channel consumes, so the checks being skipped were the ones
 * guarding the money.
 *
 * Every check now runs to completion, output is streamed as it happens, and a
 * summary at the end says which passed and which failed. The exit code is
 * still 1 if anything failed, so CI and the nightly routine behave the same.
 *
 *   node scripts/verify-all.mjs
 */
import {spawnSync} from 'node:child_process';

const CHECKS = [
  /*
   * --live, not the bare run, and that flag is the whole point of the check.
   *
   * The Meta pixel assertion was added to verify-channels on 2026-09-19 for
   * exactly one failure mode: PUBLIC_META_PIXEL_ID is unset on Oxygen, the
   * adapter no-ops, and a missing pixel and a quiet day are byte-for-byte the
   * same page. It only runs behind --live, because it has to fetch the served
   * HTML to see what is actually in it. This list called the script with no
   * arguments, so the nightly suite ran the offline half and printed
   * PASS channels on 2026-09-19 while `npm run verify:channels` failed on the
   * same repo, in the same minute, on the same missing pixel.
   *
   * A check built so a fault cannot go quiet, invoked in the one place that
   * runs every night, in the mode that cannot see the fault.
   */
  ['channels', 'scripts/verify-channels.mjs', {}, ['--live']],
  ['catalog', 'scripts/audit-catalog.mjs', {}],
  ['shipping', 'scripts/audit-shipping.mjs', {}],
  ['policy claims', 'scripts/audit-policy-claims.mjs', {}],
  ['IP risk', 'scripts/audit-ip-risk.mjs', {ETSY_PACKAGE_ROOT: '../sws-etsy-mcp'}],
  ['channel prices', 'scripts/audit-channel-prices.mjs', {ETSY_PACKAGE_ROOT: '../sws-etsy-mcp'}],
  ['test order filter', 'scripts/verify-test-order-filter.mjs', {}],
  ['tracking', 'scripts/verify-tracking.mjs', {}],
  ['first-party session', 'scripts/verify-first-party-session.mjs', {}],
  ['X funnel events', 'scripts/verify-x-events.mjs', {}],
  ['feed', 'scripts/verify-feed.mjs', {}],
  ['feed csv (X spec)', 'scripts/verify-feed-csv.mjs', {}],
  ['feed csv (Pinterest spec)', 'scripts/verify-feed-pinterest.mjs', {}],
  // --gate, not the bare run. See the BACKLOG_HIGH_WATER comment in that
  // file: 70 descriptions are a counted rewrite queue being worked off a
  // batch a night, and the gate fails if that queue GROWS or if anything is
  // wrong with a product outside it.
  ['descriptions', 'scripts/audit-descriptions.mjs', {}, ['--gate']],
  // A sample, not the whole catalogue: this one fetches the rendered page AND
  // the image bytes for each product, so 122 of them would dominate the run.
  // Best-selling first, because those are the links that actually get shared.
  ['share cards', 'scripts/audit-share-cards.mjs', {}, ['--limit', '8']],
  // Search Console found three different missing fields in this markup on
  // three separate days, each time before anything here did. It is a lagging
  // indicator by design, so the same questions get asked locally now.
  ['structured data', 'scripts/audit-structured-data.mjs', {}, ['--limit', '6']],
  // The PDP answer block. Generated from the catalogue, so a template
  // change is a catalogue-wide change, which is exactly what a check is
  // for. Text only here; the --live form fetches real pages and belongs in
  // the post-deploy pass, not in a check that has to run offline.
  ['answer blocks', 'scripts/audit-answer-blocks.mjs', {}],
  // Alt text on every product image. This is catalogue DATA, not code, so it
  // regresses the moment anyone adds a product or an image through the API:
  // productCreate and productCreateMedia both leave alt empty, which is how
  // 676 of 918 media nodes ended up with none.
  // FAQPage markup on the FAQ page and every PDP. Built from the Shopify page
  // body, which Todd can edit without touching this repo, so the question
  // count on the page and the Question count in the markup are asserted equal
  // rather than assumed. Text form here; --live belongs in the post-deploy pass.
  ['FAQ JSON-LD', 'scripts/audit-faq-jsonld.mjs', {}],
  ['alt text', 'scripts/audit-alt-text.mjs', {}],
  // Walks the path a buyer walks, ending in a REAL cart. A sample, because
  // each product costs a page fetch plus a cart creation. Run
  // `npm run audit:buyable` with no limit before anything that touches the
  // catalogue at scale.
  ['buyable', 'scripts/audit-buyable.mjs', {}, ['--limit', '20']],
  /*
   * LAST on purpose. Every check above fetches the live site, so if this one
   * fails their results describe older code than the repo contains, and the
   * reader needs to know that after seeing them, not before.
   */
  /*
   * Does every page load at all. Every other check asks a narrow question of
   * a product; the site is also collections, policies, pages, a blog, a cart
   * and an account area, and a dead one of those was invisible to all of them.
   */
  ['site health', 'scripts/audit-site-health.mjs', {}],
  ['deploy freshness', 'scripts/audit-deploy-freshness.mjs', {}],
];

const results = [];

for (const [name, script, extraEnv, args = []] of CHECKS) {
  console.log(`\n${'='.repeat(64)}\n${name}\n${'='.repeat(64)}`);
  const run = spawnSync(process.execPath, [script, ...args], {
    stdio: 'inherit',
    env: {...process.env, ...extraEnv},
  });
  const code = run.status === null ? 1 : run.status;
  results.push([name, code]);
}

console.log(`\n${'='.repeat(64)}\nSUMMARY\n${'='.repeat(64)}`);
for (const [name, code] of results) {
  console.log(`  ${code === 0 ? 'PASS' : 'FAIL'}  ${name}`);
}

const failed = results.filter(([, code]) => code !== 0);
console.log(
  `\n${results.length - failed.length}/${results.length} checks passed.` +
    (failed.length ? ` Failed: ${failed.map(([n]) => n).join(', ')}` : ''),
);

process.exit(failed.length ? 1 : 0);
