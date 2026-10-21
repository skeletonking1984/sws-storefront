#!/usr/bin/env node
/**
 * Fails (exit 1) if a brand/store-specific literal appears anywhere in
 * app/ outside app/lib/brand.config.js and app/lib/brand.config.example.js,
 * unless the exact file:line is listed in
 * scripts/brand-literals.allowlist.json with a reason.
 *
 * This is what makes "extract every brand literal into ONE config file" a
 * checked contract instead of a one-time cleanup: any future PR that
 * reintroduces `Stream Widget Shop`, `streamwidgetshop.com`, the GA4
 * fallback id, the `StreamWidgetShop` Etsy slug, the `@streamwidget` /
 * `x.com/streamwidget` X handle, a quoted `Stream Widget`/`Stream Widgets`
 * string, or `SWS` inside any quoted string directly in app/ fails
 * CI/local `npm run audit:brand-literals`.
 *
 * Usage: node scripts/audit-brand-literals.mjs
 */
import {readFileSync, readdirSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const appDir = path.join(repoRoot, 'app');

// The literals this clone-by-config effort tracks, CASE-SENSITIVE. Started
// as the three patterns used to find the first 107 hits
// (`grep -rn "Stream Widget Shop\|streamwidgetshop\|G-X0978HDVTK" app`),
// widened to also catch the Etsy shop slug's own casing, the X handle/URL,
// and any bare "Stream Widget(s)"/"SWS" QUOTED STRING LITERAL (bounded by
// matching quotes, so this does not fire on `--sws-accent-1` CSS custom
// property names, `sws-holo` class names, or prose mentioning SWS in a
// comment -- only on an actual string value a clone would need to change).
const PATTERNS = [
  {name: 'brand name', re: /Stream Widget Shop/},
  {name: 'domain', re: /streamwidgetshop/},
  {name: 'ga4 fallback id', re: /G-X0978HDVTK/},
  {name: 'etsy shop slug', re: /StreamWidgetShop/},
  {name: 'x handle', re: /@streamwidget\b/},
  {name: 'x.com url', re: /x\.com\/streamwidget\b/},
  {name: 'quoted "Stream Widget(s)"', re: /(['"`])Stream Widgets?\1/},
  // Substring match, not whole-string: catches `SWS` inside a longer quoted
  // string ("SWS newsletter signup: ...") as well as a bare 'SWS'/"SWS", but
  // never an unquoted mention (CSS custom properties like --sws-accent-1,
  // class names like sws-holo, or a comment saying "SWS's own house rule").
  {name: 'quoted "SWS" (anywhere in a quoted string)', re: /'[^'\n]*SWS[^'\n]*'|"[^"\n]*SWS[^"\n]*"|`[^`\n]*SWS[^`\n]*`/},
];

// Files allowed to carry these literals as the actual source of truth.
const EXEMPT_FILES = new Set([
  'app/lib/brand.config.js',
  'app/lib/brand.config.example.js',
]);

const allowlistPath = path.join(__dirname, 'brand-literals.allowlist.json');
/** @type {Array<{file: string, line: number, reason: string}>} */
let allowlist = [];
try {
  allowlist = JSON.parse(readFileSync(allowlistPath, 'utf8'));
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}
const allowedSet = new Set(allowlist.map((e) => `${e.file}:${e.line}`));

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(jsx?|tsx?)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(appDir);
const violations = [];

for (const absPath of files) {
  const relPath = path.relative(repoRoot, absPath).split(path.sep).join('/');
  if (EXEMPT_FILES.has(relPath)) continue;

  const lines = readFileSync(absPath, 'utf8').split('\n');
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    for (const {name, re} of PATTERNS) {
      if (re.test(line)) {
        const key = `${relPath}:${lineNo}`;
        if (allowedSet.has(key)) continue;
        violations.push({file: relPath, line: lineNo, pattern: name, text: line.trim()});
      }
    }
  });
}

if (violations.length) {
  console.error(`\naudit:brand-literals FAILED - ${violations.length} literal(s) found outside brand.config.js:\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.pattern}]  ${v.text}`);
  }
  console.error(
    '\nMove these into app/lib/brand.config.js, or add a reasoned entry to ' +
      'scripts/brand-literals.allowlist.json if this is a genuine exception.\n',
  );
  process.exit(1);
}

console.log(
  `audit:brand-literals OK - 0 brand literals outside brand.config.js ` +
    `(scanned ${files.length} files, ${allowlist.length} allowlisted).`,
);
