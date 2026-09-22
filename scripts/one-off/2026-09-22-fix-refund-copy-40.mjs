/**
 * The last 40 product descriptions that deny refunds while the site grants them.
 *
 * On 2026-09-15 twelve products were fixed and `npm run audit:policy` was built
 * to stop it coming back. On 2026-09-17 that audit's pattern was widened and it
 * found SEVENTY more live products carrying the shop's original Etsy line,
 * "I am unable to offer exchanges, refunds, or cancellations". Thirty were
 * cleared since. These are the remaining 40, and they are the whole of what
 * `audit:policy` still reports.
 *
 * All 40 carry the SAME sentence, byte for byte, once each:
 *
 *   "...please get in touch with me. I will do everything in my power to help,
 *    but I am unable to offer exchanges, refunds, or cancellations."
 *
 * so this is one substitution, not forty rewrites. The offer of help stays; only
 * the refusal is replaced, with the sentence derived from
 * /policies/refund-policy that the other 83 products already carry.
 *
 * Surgical, same contract as the 2026-09-15 script: it refuses to emit a payload
 * unless, for every product, the banned wording is gone, the new sentence is
 * present, no double full stop was spliced in, and THE PLAIN TEXT OF THE OLD
 * DESCRIPTION WITH THE SAME RULE APPLIED EQUALS THE PLAIN TEXT OF THE NEW ONE,
 * character for character. Anything else moving is a hard stop.
 *
 *   node scripts/one-off/2026-09-22-fix-refund-copy-40.mjs <in.json> <out.json>
 */
import fs from 'node:fs';

const [SRC, OUT] = process.argv.slice(2);
if (!SRC || !OUT) {
  console.error('usage: node 2026-09-22-fix-refund-copy-40.mjs <in.json> <out.json>');
  process.exit(1);
}

// The refund policy page, dated 2026-09-09, in one sentence. Identical to the
// string the 2026-09-15 script wrote into the first twelve, so the catalogue
// speaks with one voice rather than two near-miss paraphrases.
const REFUND =
  'Refunds within 30 days if the download never arrived, the files are ' +
  'corrupt or incomplete, the item is not what this listing described, you ' +
  'were charged twice, or we cannot get it running on a platform this ' +
  'listing claims. A working file you downloaded and then changed your mind ' +
  'about is not refundable. Full detail is on our Refund Policy page.';

// The comma and the trailing full stop are part of the match. Matching only up
// to "cancellations" leaves the old sentence's full stop in front of a
// replacement that already ends in one, which is the "Refund Policy page.."
// failure the Demon Samurai hit on 2026-09-15.
const FIND = 'help, but I am unable to offer exchanges, refunds, or cancellations.';
const REPLACE = `help. ${REFUND}`;

// Same denial vocabulary audit-policy-claims.mjs uses, so this script cannot
// declare success on wording that audit would still fail.
const BANNED =
  /non-?refundable|no refunds?\b|no exchanges?\b|all sales (?:are )?final|(?:unable|not able) to (?:offer|provide|issue|give|process)[^.]{0,40}\b(?:refunds?|exchanges?|cancellations?)/i;

// The carve-out the new sentence itself contains. It reads as a denial to the
// bare pattern above and is the false positive that cost 2026-09-15 twelve
// bogus findings, so it is removed before the banned check runs.
const CARVE_OUT =
  'A working file you downloaded and then changed your mind about is not refundable.';

const textOf = (html) =>
  html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

const data = JSON.parse(fs.readFileSync(SRC, 'utf8')).data;
const payload = {};
const report = [];

for (const key of Object.keys(data).sort()) {
  const node = data[key];
  const old = node.descriptionHtml;

  const hits = old.split(FIND).length - 1;
  if (hits !== 1) {
    throw new Error(`${key}: expected exactly 1 occurrence of the refusal, found ${hits}`);
  }
  const next = old.replace(FIND, REPLACE);

  // 0. no punctuation artifact from the splice
  if (textOf(next).replace(/\.\.\./g, '').includes('..')) {
    throw new Error(`${key}: double full stop introduced by the replacement`);
  }
  // 1. no denial wording survives, ignoring the policy's own carve-out
  const withoutCarveOut = textOf(next).split(CARVE_OUT).join(' ');
  const survivor = withoutCarveOut.match(BANNED);
  if (survivor) {
    throw new Error(`${key}: denial wording still present after edit: "${survivor[0]}"`);
  }
  // 2. the new sentence is there
  if (!textOf(next).includes('Refunds within 30 days')) {
    throw new Error(`${key}: replacement sentence missing`);
  }
  // 3. nothing else moved. Apply the same rule to the OLD plain text and
  //    require character equality with the NEW plain text.
  const expected = textOf(old).replace(FIND, REPLACE);
  if (expected !== textOf(next)) {
    throw new Error(`${key}: text changed beyond the refund sentence`);
  }

  payload[key] = {id: node.id, handle: node.handle, descriptionHtml: next};
  report.push([key, node.title.slice(0, 40), old.length, next.length]);
}

fs.writeFileSync(OUT, JSON.stringify(payload, null, 1));
console.log(`${Object.keys(payload).length} products, all checks passed\n`);
for (const [key, title, lo, ln] of report) {
  console.log(`${title.padEnd(42)} ${String(lo).padStart(5)} -> ${String(ln).padStart(5)}  ${key}`);
}
