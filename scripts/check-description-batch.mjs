/**
 * Check a written description batch BEFORE it is pushed to Shopify.
 *
 * The live audits (`audit:descriptions`, `audit:policy`) only run against
 * what is already published, so without this the first thing that notices a
 * bad rewrite is the live product page. This runs the same rules against the
 * draft, plus the two things that are only checkable here: that every claim
 * traces to the batch's own Etsy source, and that the draft is not just the
 * old text again.
 *
 * Usage: node scripts/check-description-batch.mjs [written.json] [batch.json]
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const WRITTEN = process.argv[2] || `${ROOT}/data/description-batch-written.json`;
const BATCH = process.argv[3] || `${ROOT}/data/description-batch.json`;

const written = JSON.parse(fs.readFileSync(WRITTEN, 'utf8'));
const batch = JSON.parse(fs.readFileSync(BATCH, 'utf8'));
const sources = Object.fromEntries(batch.rows.map((r) => [r.handle, r]));

const text = (html) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/* The same act-of-refusing patterns audit-policy-claims.mjs uses. Duplicated
 * deliberately: this file must be able to reject a draft with no network and
 * no live policy read, and the list is four lines. */
const DENIES = [
  /non-?refundable/i,
  /no refunds?\b/i,
  /all sales (?:are )?final/i,
  /(?:unable|not able) to (?:offer|provide|issue|give|process)[^.]{0,40}\b(?:refunds?|exchanges?|cancellations?)/i,
  /(?:refunds?|exchanges?|cancellations?)[^.]{0,40}(?:are|is) not (?:available|offered|possible|permitted|accepted)/i,
  /we (?:do not|don't|cannot|can't) (?:offer|provide|issue|give|accept)[^.]{0,40}\b(?:refunds?|exchanges?|returns?)/i,
];

/* The carve-out the approved paragraph itself contains. It reads as a denial
 * to a blunt pattern and is not one, which is the false positive that cost a
 * pass on 2026-09-15. */
const CARVE_OUT = /changed your mind about is not refundable/i;

const PLATFORMS = ['YouTube', 'Kick', 'TikTok'];

const issues = [];
for (const row of written.rows) {
  const src = sources[row.handle];
  const add = (what, quote) => issues.push({handle: row.handle, what, quote});

  if (!src) {
    add('handle is not in the prepared batch, so nothing can verify its claims');
    continue;
  }
  const html = row.descriptionHtml || '';
  const body = text(html);
  const source = `${src.etsy_title || ''} ${src.etsy_description || ''}`;

  if (!html.trim()) add('empty description');
  if (body === text(src.current_description_html || '')) add('description is unchanged');

  // Todd reacts strongly to these and they are banned shop wide.
  if (/[—–]/.test(html)) add('contains an em dash or en dash');

  // Structure: the standard's section order, checked by presence not order
  // so a sensible reordering is not failed, but a missing section is.
  for (const heading of ['What You Get', 'Works With', 'Setup', 'FAQ']) {
    if (!new RegExp(heading, 'i').test(body)) add(`missing the "${heading}" section`);
  }

  // Refund story. Must not deny, and must actually carry the policy line.
  const stripped = body.replace(CARVE_OUT, ' ');
  for (const pattern of DENIES) {
    const hit = stripped.match(pattern);
    if (hit) add('denies refunds while the shop policy grants them', hit[0]);
  }
  if (!/refund/i.test(body)) add('says nothing about refunds at all');
  // Added 2026-09-25. The refund policy changed (broken widget: fix first) and
  // 86 live descriptions were moved to PRODUCT_REFUND_LINE in
  // app/lib/policyContent.js. Older one-off batch scripts still hold the
  // previous sentence as a constant, so a copied script would bring it back.
  if (/Refunds within 30 days if the download never arrived/i.test(body)) {
    add('carries the pre-2026-09-25 refund sentence; use PRODUCT_REFUND_LINE from app/lib/policyContent.js');
  }

  // Platform claims must trace to this product's own Etsy listing AND to its
  // works_with metafield, which is the audited source the badge row reads.
  for (const platform of PLATFORMS) {
    const claimed = new RegExp(`\\b${platform}\\b`, 'i').test(body);
    if (!claimed) continue;
    const inSource = new RegExp(`\\b${platform}\\b`, 'i').test(source);
    const inMetafield = (src.works_with || []).some(
      (p) => p.toLowerCase() === platform.toLowerCase(),
    );
    if (!inSource) add(`claims ${platform}, which its own Etsy listing never names`);
    else if (!inMetafield) add(`claims ${platform}, which its works_with metafield does not carry`);
  }

  // "What You Get" must describe files this listing actually ships. The
  // strongest cheap check is the count of archives claimed against the count
  // shipped, because inventing a second zip is the common failure.
  const zipsShipped = (src.etsy_files || []).filter((f) =>
    /zip/i.test(f.type || f.filename || ''),
  ).length;
  const zipsClaimed = (body.match(/\.zip\b/gi) || []).length;
  if (zipsClaimed > zipsShipped) {
    add(`names ${zipsClaimed} .zip file(s), the listing ships ${zipsShipped}`);
  }

  // A Streamlabs VERSION is a shipped artifact, not the desktop app it is
  // displayed in. Claiming the first without one is the overclaim last
  // settled on 2026-09-17; naming the second is always fine.
  const shipsStreamlabsFile = (src.etsy_files || []).some((f) =>
    /streamlab/i.test(f.filename || ''),
  );
  const claimsStreamlabsVersion =
    /(?:separate |a )?Streamlabs version is included|upload the widget files to[^.]{0,40}Streamlabs|Streamlabs file set|version for Streamlabs/i.test(
      body,
    );
  if (claimsStreamlabsVersion && !shipsStreamlabsFile) {
    add('claims a Streamlabs version, the manifest ships no Streamlabs file');
  }
}

console.log(`${written.rows.length} draft description(s) checked.`);
if (!issues.length) {
  console.log('No issue. Safe to apply.');
  process.exit(0);
}
console.log(`\n${issues.length} issue(s):\n`);
for (const i of issues) {
  console.log(`  ${i.handle}`);
  console.log(`    ${i.what}`);
  if (i.quote) console.log(`    ...${i.quote}...`);
}
process.exit(1);
