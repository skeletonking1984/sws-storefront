/**
 * Is production running the code we keep checking?
 *
 * Why this exists, 2026-09-17
 * ---------------------------
 * The merchant listing fields Google wanted were committed on 2026-09-16.
 * Production stayed on the 2026-09-14 build until the 17th. For two days
 * `audit:structured-data` ran "against production", reported everything
 * green, and was describing code nobody was serving, while Search Console
 * counted real failures on the build that WAS live.
 *
 * Every check in this repo that fetches streamwidgetshop.com has that same
 * blind spot. They verify a deployment and report it as if they had verified
 * the repo. This closes it by asking the deployment what it is.
 *
 * The rule that keeps it alive
 * ----------------------------
 * It compares SHIPPABLE commits, not all commits. Comparing HEAD to the
 * deployed commit would go red the instant anyone writes a line, including a
 * LAUNCH.md entry, and a check that is red every day is a check nobody reads.
 * So: production is "fresh" when every unshipped commit touches only paths
 * that cannot change what a visitor receives.
 *
 * Usage:
 *   node scripts/audit-deploy-freshness.mjs [--origin https://...]
 *   node scripts/audit-deploy-freshness.mjs --self-test
 */
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');

/**
 * A commit is shippable if it touches anything the deployment serves.
 *
 * Anything NOT matching this is documentation, data the build does not read,
 * or tooling that runs on a laptop. Deliberately generous: a path nobody
 * thought about counts as shippable, so the failure mode is a false alarm
 * that gets one path added here, never a real change sliding past unnoticed.
 */
const SHIPPABLE = [/^app\//, /^public\//, /^server\.js$/, /^package(-lock)?\.json$/, /^vite\.config/, /^\.env/];

/** Paths that look shippable but are not served to anyone. */
const NOT_SHIPPABLE = [/^app\/data\/build-info\.json$/];

export function isShippablePath(file) {
  if (NOT_SHIPPABLE.some((r) => r.test(file))) return false;
  return SHIPPABLE.some((r) => r.test(file));
}

/**
 * @param {{deployedCommit: string|null, headCommit: string, unshipped: Array<{sha: string, subject: string, files: string[]}>}} input
 */
export function auditFreshness({deployedCommit, headCommit, unshipped}) {
  const issues = [];
  if (!deployedCommit || deployedCommit === 'unknown') {
    return {
      issues: [
        'production does not report a build commit, so freshness cannot be checked at all',
      ],
      shippableBehind: [],
    };
  }
  if (deployedCommit === headCommit) return {issues: [], shippableBehind: []};

  const shippableBehind = unshipped.filter((c) => c.files.some(isShippablePath));
  if (shippableBehind.length) {
    issues.push(
      `production is running ${deployedCommit.slice(0, 7)} and ${shippableBehind.length} unshipped commit(s) change what visitors receive`,
    );
  }
  return {issues, shippableBehind};
}

if (process.argv.includes('--self-test')) {
  const c = (sha, subject, files) => ({sha, subject, files});
  const cases = [
    [
      'production on HEAD passes',
      {deployedCommit: 'aaa', headCommit: 'aaa', unshipped: []},
      0,
    ],
    [
      'unshipped docs only: PASSES, or this check is red every day and dies',
      {deployedCommit: 'aaa', headCommit: 'bbb', unshipped: [c('bbb', 'LAUNCH entry', ['LAUNCH.md'])]},
      0,
    ],
    [
      'unshipped script only: passes, scripts run on a laptop',
      {deployedCommit: 'aaa', headCommit: 'bbb', unshipped: [c('bbb', 'new audit', ['scripts/audit-x.mjs'])]},
      0,
    ],
    [
      'THE 2026-09-17 CASE: an app/ change sitting unshipped is caught',
      {deployedCommit: 'aaa', headCommit: 'bbb', unshipped: [c('bbb', 'merchant fields', ['app/routes/products.$handle.jsx'])]},
      1,
    ],
    [
      'server.js unshipped is caught, it is in front of every request',
      {deployedCommit: 'aaa', headCommit: 'bbb', unshipped: [c('bbb', 'feed paths', ['server.js'])]},
      1,
    ],
    [
      'a mixed commit counts as shippable, one served file is enough',
      {deployedCommit: 'aaa', headCommit: 'bbb', unshipped: [c('bbb', 'both', ['LAUNCH.md', 'app/lib/seo.js'])]},
      1,
    ],
    [
      'the build stamp itself never counts as a change',
      {deployedCommit: 'aaa', headCommit: 'bbb', unshipped: [c('bbb', 'stamp', ['app/data/build-info.json'])]},
      0,
    ],
    [
      'no stamp at all is reported, not silently passed',
      {deployedCommit: null, headCommit: 'bbb', unshipped: []},
      1,
    ],
    [
      'an unknown stamp is reported too',
      {deployedCommit: 'unknown', headCommit: 'bbb', unshipped: []},
      1,
    ],
    [
      'several unshipped app commits are one finding, not a pile',
      {
        deployedCommit: 'aaa',
        headCommit: 'ddd',
        unshipped: [c('bbb', 'x', ['app/a.js']), c('ccc', 'y', ['app/b.js']), c('ddd', 'z', ['README.md'])],
      },
      1,
    ],
  ];
  let pass = 0;
  for (const [name, input, expected] of cases) {
    const got = auditFreshness(input).issues.length;
    const ok = got === expected;
    if (ok) pass++;
    console.log(`${ok ? 'pass' : 'FAIL'}  ${name}  (expected ${expected}, got ${got})`);
  }
  console.log(`\n${pass}/${cases.length} self-test cases pass.`);
  process.exit(pass === cases.length ? 0 : 1);
}

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const ORIGIN = arg('--origin', 'https://streamwidgetshop.com');

const git = (...args) => execFileSync('git', args, {cwd: ROOT, encoding: 'utf8'}).trim();

let deployed = null;
try {
  const res = await fetch(`${ORIGIN}/api/version`, {headers: {'Cache-Control': 'no-cache'}});
  if (res.ok) deployed = (await res.json()).commit ?? null;
  else console.log(`/api/version answered ${res.status}`);
} catch (err) {
  console.log(`could not reach ${ORIGIN}/api/version: ${err.message}`);
}

const head = git('rev-parse', 'HEAD');
let unshipped = [];
if (deployed && deployed !== 'unknown' && deployed !== head) {
  let range;
  try {
    git('cat-file', '-e', `${deployed}^{commit}`);
    range = `${deployed}..HEAD`;
  } catch {
    console.log(`deployed commit ${deployed.slice(0, 7)} is not in this clone, cannot list what is unshipped`);
  }
  if (range) {
    const shas = git('log', '--format=%H%x00%s', range).split('\n').filter(Boolean);
    unshipped = shas.map((line) => {
      const [sha, subject] = line.split('\0');
      const files = git('show', '--name-only', '--format=', sha).split('\n').filter(Boolean);
      return {sha, subject, files};
    });
  }
}

const {issues, shippableBehind} = auditFreshness({
  deployedCommit: deployed,
  headCommit: head,
  unshipped,
});

console.log(`production: ${deployed ? deployed.slice(0, 7) : 'unknown'}`);
console.log(`HEAD:       ${head.slice(0, 7)}`);
console.log(`unshipped commits: ${unshipped.length}, of which change what visitors receive: ${shippableBehind.length}`);

if (!issues.length) {
  console.log('\nProduction is serving the current shippable code.');
  if (unshipped.length) {
    console.log(`(${unshipped.length} unshipped commit(s), all docs, data or tooling. Not a problem.)`);
  }
  process.exit(0);
}

console.log('');
for (const i of issues) console.log(`  ${i}`);
if (shippableBehind.length) {
  console.log('\nUnshipped and visitor-facing:');
  for (const c of shippableBehind) {
    console.log(`  ${c.sha.slice(0, 7)}  ${c.subject.slice(0, 68)}`);
  }
  console.log(
    '\nEVERY check in this repo that fetches the live site is currently\n' +
      'describing older code than the repo contains. Deploy, or read those\n' +
      'results as history.\n\n' +
      '  npx shopify hydrogen deploy --env=production\n\n' +
      'That command needs an interactive terminal: it asks Continue? and an\n' +
      'agent cannot answer it.',
  );
}
process.exit(1);
