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
  ['catalog', 'scripts/audit-catalog.mjs', {}],
  ['shipping', 'scripts/audit-shipping.mjs', {}],
  ['policy claims', 'scripts/audit-policy-claims.mjs', {}],
  ['IP risk', 'scripts/audit-ip-risk.mjs', {ETSY_PACKAGE_ROOT: '../sws-etsy-mcp'}],
  ['channel prices', 'scripts/audit-channel-prices.mjs', {ETSY_PACKAGE_ROOT: '../sws-etsy-mcp'}],
  ['test order filter', 'scripts/verify-test-order-filter.mjs', {}],
  ['tracking', 'scripts/verify-tracking.mjs', {}],
  ['feed', 'scripts/verify-feed.mjs', {}],
];

const results = [];

for (const [name, script, extraEnv] of CHECKS) {
  console.log(`\n${'='.repeat(64)}\n${name}\n${'='.repeat(64)}`);
  const run = spawnSync(process.execPath, [script], {
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
