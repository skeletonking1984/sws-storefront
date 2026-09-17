/**
 * Stamp the git commit into the build, so a running deployment can say which
 * code it is.
 *
 * Why, 2026-09-17. The merchant listing fields Google wanted were committed on
 * 2026-09-16 and production stayed on the 2026-09-14 build until the 17th. For
 * two days `audit:structured-data` ran happily "against production" and was
 * reporting on code nobody was serving, while Search Console counted real
 * failures on the build that WAS live. Nothing anywhere could tell the
 * difference, because nothing knew what production was running.
 *
 * Written by `prebuild`, so every `npm run build`, and therefore every deploy,
 * carries the commit it was built from. Gitignored on purpose: committing it
 * would make every build dirty the tree, and a stamp read out of git rather
 * than out of the deployment is exactly the fiction this is meant to end.
 *
 * Degrades to `unknown` rather than failing the build. A missing stamp makes
 * the freshness check say "cannot tell", which is honest; a stamp that blocks
 * a deploy would be a worse trade.
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'app/data/build-info.json');

const git = (...args) => {
  try {
    return execFileSync('git', args, {cwd: ROOT, encoding: 'utf8'}).trim();
  } catch {
    return '';
  }
};

const info = {
  commit: git('rev-parse', 'HEAD') || 'unknown',
  shortCommit: git('rev-parse', '--short', 'HEAD') || 'unknown',
  committedAt: git('log', '-1', '--format=%cI') || null,
  builtAt: new Date().toISOString(),
};

fs.mkdirSync(path.dirname(OUT), {recursive: true});
fs.writeFileSync(OUT, JSON.stringify(info, null, 2) + '\n');
console.log(`build stamped: ${info.shortCommit} (${info.committedAt || 'no commit date'})`);
