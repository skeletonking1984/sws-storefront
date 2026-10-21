/**
 * Fails if app/lib/configRegistry.js has drifted from what the code actually
 * reads. A status page that omits a variable is worse than no status page:
 * it reports "nothing required is missing" while something is.
 *
 * Usage: node scripts/audit-config-registry.mjs
 */
import {execSync} from 'node:child_process';
import {ALL_CONFIG_KEYS} from '../app/lib/configRegistry.js';

// Every PUBLIC_*/PRIVATE_* identifier referenced anywhere in the app, whether
// as a property (env.FOO) or as a string key in a mapping object ('FOO').
/*
 * Only source files. Scanning CSS produced a false positive from a comment
 * in app.css that quotes the truncated string "PUBLIC_X_PIXEL_" as an
 * example of the very wrapping bug that rule fixes. Environment variables
 * are never read from a stylesheet, so there is nothing to find there.
 */
const grep = execSync(
  `grep -rhoE --include='*.js' --include='*.jsx' --include='*.ts' --include='*.tsx' ` +
    `"(PUBLIC|PRIVATE)_[A-Z0-9_]+" app/ server.js || true`,
  {encoding: 'utf8'},
);

const IGNORE = new Set([
  // Documentation prose and type names, not real variables.
  'PUBLIC_STOREFRONT_API_TOKEN_IS',
]);

const used = [...new Set(grep.split('\n').map((s) => s.trim()).filter(Boolean))]
  .filter((k) => !IGNORE.has(k))
  .sort();

const registry = new Set(ALL_CONFIG_KEYS);
const missing = used.filter((k) => !registry.has(k));
const stale = ALL_CONFIG_KEYS.filter((k) => !used.includes(k));

console.log(`referenced in code : ${used.length}`);
console.log(`in the registry    : ${ALL_CONFIG_KEYS.length}`);

if (missing.length) {
  console.log(`\nMISSING from the registry (${missing.length}):`);
  for (const k of missing) console.log(`  ${k}`);
}
if (stale.length) {
  console.log(`\nIn the registry but not referenced in app/ (${stale.length}):`);
  for (const k of stale) console.log(`  ${k}   <- fine if only read by a script or documented ahead of use`);
}
if (!missing.length) console.log('\nNo variable is missing from the registry.');
process.exit(missing.length ? 1 : 0);
