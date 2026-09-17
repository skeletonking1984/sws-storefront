/**
 * After a batch is pushed, confirm the LIVE description is byte for byte the
 * draft that was checked.
 *
 * Why it exists: there is no admin token in this repo, so a description
 * rewrite reaches Shopify by being retyped into a `productUpdate` call rather
 * than read from the file. A dropped section or a truncated blob would be
 * invisible, because the live audits only assert the absence of known bad
 * wording and a half written description passes all of them. The draft file
 * is the only thing that knows what was supposed to land.
 *
 * Usage: node scripts/verify-description-batch.mjs [written.json]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const WRITTEN = process.argv[2] || `${ROOT}/data/description-batch-written.json`;

const env = Object.fromEntries(
  fs
    .readFileSync(`${ROOT}/.env`, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [
      l.slice(0, l.indexOf('=')).trim(),
      l
        .slice(l.indexOf('=') + 1)
        .trim()
        .replace(/^['"]|['"]$/g, ''),
    ]),
);

const written = JSON.parse(fs.readFileSync(WRITTEN, 'utf8'));

/* Shopify normalises the HTML it stores: it collapses the blank lines between
 * blocks and can reorder nothing else. Comparing raw strings would fail on
 * whitespace alone and teach everyone to ignore this check, so both sides are
 * normalised the same way and the comparison stays exact on CONTENT. */
const norm = (html) =>
  (html || '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();

const url = `https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`;
const query = `query($h:String!){product(handle:$h){handle descriptionHtml}}`;

let bad = 0;
for (const row of written.rows) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
    },
    body: JSON.stringify({query, variables: {h: row.handle}}),
  });
  const body = await res.json();
  const live = body?.data?.product?.descriptionHtml;
  if (live == null) {
    console.log(`MISSING  ${row.handle}\n  not resolvable on the Storefront API`);
    bad++;
    continue;
  }
  const a = norm(live);
  const b = norm(row.descriptionHtml);
  if (a === b) {
    console.log(`ok       ${row.handle}`);
    continue;
  }
  bad++;
  // Report WHERE they diverge, not just that they do: the first differing
  // index localises a truncation immediately.
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  console.log(`MISMATCH ${row.handle}`);
  console.log(`  live ${a.length} chars, draft ${b.length} chars, first difference at ${i}`);
  console.log(`  live  ...${a.slice(Math.max(0, i - 40), i + 60)}...`);
  console.log(`  draft ...${b.slice(Math.max(0, i - 40), i + 60)}...`);
}

console.log(`\n${written.rows.length - bad}/${written.rows.length} live description(s) match the draft.`);
process.exit(bad ? 1 : 0);
