/**
 * Stream Chat Lite offers Twitch and Kick only.
 *
 * 2026-10-05: Twitch and Kick only. YouTube and TikTok are
 * paid-widget features and the upsell for the Multistream Chat Widget Pack.
 * Until then the free-chat copy said "merges any two of Twitch, Kick, YouTube
 * and TikTok" on the homepage slot, the landing page, the setup page, the
 * welcome email and the meta description, and the setup page offered YouTube
 * and TikTok pickers and key fields. A claim the free widget no longer makes
 * has to disappear everywhere at once, and nothing else would notice one that
 * crept back, so this reads the source.
 *
 * Offline, no network, no catalogue. It scans the Stream Chat Lite surfaces,
 * strips code comments, and fails on:
 *
 *   1. YouTube or TikTok named anywhere that is not an upsell to the paid
 *      Multistream Chat Widget (the words "Multistream Chat Widget" must sit
 *      within 120 characters before or 220 after, in the same string or JSX run).
 *   2. Count claims the free tier no longer makes: "any two", "any 2",
 *      "two of Twitch", "all four platforms", "all 4 platforms".
 *   3. The setup page's PLATFORM_ORDER or PLATFORM_LABEL naming anything other
 *      than twitch and kick.
 *
 * The widget itself (sws-free-chat) still connects YouTube and TikTok for URLs
 * minted before this change, on purpose. That is runtime, not an offer, and it
 * has its own test in sws-free-chat/test/removal-harness.mjs.
 *
 * Usage:
 *   node scripts/audit-free-chat-platforms.mjs               scan this repo
 *   node scripts/audit-free-chat-platforms.mjs --root <dir>  scan another tree
 *                                                            (e.g. an old checkout)
 *   node scripts/audit-free-chat-platforms.mjs --self-test   run fixtures
 *
 * Exit 1 on any finding.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Every file that carries Stream Chat Lite copy. `only` limits a shared file to
// one function so the rest of it (the whole homepage, the search palette) is
// not judged.
const SURFACES = [
  {file: 'app/routes/free-chat-widget.jsx'},
  {file: 'app/routes/free-chat-widget_.confirm.jsx'},
  {file: 'app/components/FreeChatProductCard.jsx'},
  {file: 'app/lib/freeChatEmail.server.js'},
  {file: 'app/routes/_index.jsx', only: 'FreeChatWidgetSlot'},
  {file: 'app/components/SearchResultsPredictive.jsx', only: 'function SearchResultsPredictiveFreeChat'},
];

const PLATFORM_RE = /youtube|tiktok/gi;
const UPSELL_RE = /multistream chat widget/i;
const UPSELL_AFTER = 220;
const UPSELL_BEFORE = 120; // a heading can name the product just above the sentence
const COUNT_CLAIMS = [
  /\bany two\b/i,
  /\bany 2\b/i,
  /\btwo of (?:twitch|kick)/i,
  /\ball (?:four|4) platforms\b/i,
];

/** Drop block comments, JSX comments and line comments (not `://`). */
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Collapse JSX/string noise so a sentence split across lines reads as one. */
function flatten(src) {
  return src
    .replace(/\{' '\}/g, ' ')
    .replace(/\s(?:to|href|src)=\{`[^`]*`\}/g, '')
    .replace(/&ldquo;|&rdquo;|&rsquo;/g, '"')
    .replace(/\s+/g, ' ');
}

function scope(src, only) {
  if (!only) return src;
  const i = src.indexOf(only);
  if (i === -1) return '';
  // From the marker to the next top-level function or a generous cap.
  const rest = src.slice(i);
  const next = rest.slice(1).search(/\n(?:export )?(?:async )?function /);
  return next === -1 ? rest.slice(0, 4000) : rest.slice(0, next + 1);
}

/** Findings for one source text. Pure, used by the self-test. */
export function auditText(label, raw, only) {
  const findings = [];
  const text = flatten(stripComments(scope(raw, only)));

  for (const m of text.matchAll(PLATFORM_RE)) {
    const near = text.slice(Math.max(0, m.index - UPSELL_BEFORE), m.index + UPSELL_AFTER);
    if (!UPSELL_RE.test(near)) {
      const ctx = text.slice(Math.max(0, m.index - 50), m.index + 70).trim();
      findings.push(`${label}: names ${m[0]} outside a paid-widget upsell: "...${ctx}..."`);
    }
  }
  for (const re of COUNT_CLAIMS) {
    const m = text.match(re);
    if (m) findings.push(`${label}: free tier no longer makes this claim: "${m[0]}"`);
  }

  // Setup page picker.
  const order = raw.match(/const PLATFORM_ORDER = \[([^\]]*)\]/);
  if (order) {
    const names = [...order[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    if (names.join(',') !== 'twitch,kick') {
      findings.push(`${label}: PLATFORM_ORDER is [${names.join(', ')}], must be [twitch, kick]`);
    }
  }
  const labels = raw.match(/const PLATFORM_LABEL = \{([^}]*)\}/);
  if (labels) {
    const keys = [...labels[1].matchAll(/(\w+):/g)].map((x) => x[1]);
    if (keys.join(',') !== 'twitch,kick') {
      findings.push(`${label}: PLATFORM_LABEL keys are [${keys.join(', ')}], must be [twitch, kick]`);
    }
  }
  return findings;
}

function auditRoot(root) {
  const findings = [];
  let scanned = 0;
  for (const {file, only} of SURFACES) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) {
      findings.push(`${file}: missing, the audit surface list is stale`);
      continue;
    }
    scanned++;
    findings.push(...auditText(file, fs.readFileSync(full, 'utf8'), only));
  }
  return {findings, scanned};
}

function selfTest() {
  const cases = [
    // [name, source, only, expectedFindingCount > 0]
    ['old homepage slot', 'merges any two of Twitch, Kick, YouTube and TikTok.', undefined, true],
    ['old landing bullet', '<li>Any 2 platforms: Twitch, Kick, YouTube or TikTok</li>', undefined, true],
    ['old email', 'Stream Chat Lite connects any 2 platforms (Twitch, Kick, YouTube or TikTok)', undefined, true],
    ['old key field', '<h3>YouTube</h3><label>Your YouTube Data API v3 key</label>', undefined, true],
    ['old upsell', 'Want all 4 platforms at once, plus themed skins', undefined, true],
    ['TikTok in alt text', 'alt="messages from Twitch, Kick and TikTok"', undefined, true],
    ['picker with youtube', "const PLATFORM_ORDER = ['twitch', 'kick', 'youtube'];", undefined, true],
    ['picker label with tiktok', "const PLATFORM_LABEL = {twitch: 'Twitch', kick: 'Kick', tiktok: 'TikTok'};", undefined, true],
    ['claim split across JSX lines', 'merges chat from any two of\n  Twitch and Kick', undefined, true],
    // Must pass.
    ['new homepage slot', 'merges Twitch and Kick chat into one.', undefined, false],
    ['paid upsell is allowed', "Want YouTube and TikTok too, plus themed skins? See the{' '} <Link>Multistream Chat Widget Pack</Link>", undefined, false],
    ['upsell split across lines', "YouTube and TikTok chat are in the{' '}\n <Link>\n Multistream Chat Widget Pack\n </Link>", undefined, false],
    ['comment mentioning youtube', "// YouTube and TikTok are paid-widget features.\nconst x = 1;", undefined, false],
    ['block comment mentioning tiktok', '/* any two of Twitch, Kick, YouTube and TikTok */ const x = 1;', undefined, false],
    ['correct picker', "const PLATFORM_ORDER = ['twitch', 'kick'];\nconst PLATFORM_LABEL = {twitch: 'Twitch', kick: 'Kick'};", undefined, false],
    ['url with // is not a comment', 'to="https://x.test/a" YouTube', undefined, true],
    ['scoped to one function', 'function Other() { return "YouTube"; }\nfunction FreeChatWidgetSlot() { return "Twitch and Kick"; }\nfunction After() { return "TikTok"; }', 'FreeChatWidgetSlot', false],
  ];
  let bad = 0;
  for (const [name, src, only, shouldFail] of cases) {
    const got = auditText('fixture', src, only).length > 0;
    const ok = got === shouldFail;
    if (!ok) bad++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} (${shouldFail ? 'must be flagged' : 'must pass'})`);
  }
  console.log(`\n${cases.length - bad}/${cases.length} self-test cases passed`);
  process.exit(bad ? 1 : 0);
}

const args = process.argv.slice(2);
if (args.includes('--self-test')) selfTest();

const rootIdx = args.indexOf('--root');
const root = rootIdx !== -1 ? path.resolve(args[rootIdx + 1]) : path.resolve(HERE, '..');
const {findings, scanned} = auditRoot(root);
console.log(`Stream Chat Lite platform claims: ${scanned} surfaces scanned under ${root}`);
if (findings.length) {
  console.log(`\n${findings.length} finding${findings.length === 1 ? '' : 's'}:`);
  for (const f of findings) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('No findings. Twitch and Kick only.');
