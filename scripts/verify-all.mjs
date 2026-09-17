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
  ['channels', 'scripts/verify-channels.mjs', {}],
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
