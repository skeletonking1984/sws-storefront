/**
 * Truth check for /llms.txt.
 *
 * Why this exists, 2026-09-26
 * ---------------------------
 * The 2026-09-23 pass proved every link in /llms.txt returned 200 and left
 * the box open because nobody had checked what the file SAYS about each
 * product. It said something false: "a product with no mark works on Twitch
 * only", and Celestial Star (number 3 by revenue, `works_with` Twitch and
 * Kick) had no mark. Link checks cannot see a wrong sentence. This reads the
 * text and holds every product line to that product's `custom.works_with`.
 *
 * Rules (a finding exits 1):
 *   - no em or en dash anywhere
 *   - no blanket single platform rule ("Twitch only", "no mark works on")
 *   - every product line names the platforms it works on
 *   - the platforms a line names equal the product's works_with platforms,
 *     no more and no fewer
 *   - a Goal Widget line says it reads no chat
 *   - the Multistream mark appears exactly when works_with has YouTube + Kick
 *   - a product with no works_with is never given a platform (its line may
 *     name none; that is "no verified list yet", not a finding)
 *   - every product in the catalogue appears exactly once across the
 *     Products and Full catalog sections (added 2026-10-18)
 *
 * Usage:
 *   node scripts/audit-llms-txt.mjs               # build from the live catalogue with the repo's builder
 *   node scripts/audit-llms-txt.mjs --live [url]  # fetch the served file (default production)
 *   node scripts/audit-llms-txt.mjs --file path   # audit a saved copy (e.g. from a local preview)
 *   node scripts/audit-llms-txt.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const {buildLlmsTxt} = await import(
  pathToFileURL(path.join(ROOT, 'app/lib/llmsTxt.js'))
);
const {isMultistream, parseWorksWith} = await import(
  pathToFileURL(path.join(ROOT, 'app/lib/platforms.js'))
);

const STREAM_PLATFORMS = ['Twitch', 'YouTube', 'Kick', 'TikTok'];
const BASE = 'https://streamwidgetshop.com';

function platformsOf(product) {
  const raw =
    typeof product.worksWith === 'string'
      ? product.worksWith
      : product.worksWith?.value;
  const list = (parseWorksWith(raw) ?? []).map((p) => String(p).toLowerCase());
  return STREAM_PLATFORMS.filter((p) => list.includes(p.toLowerCase()));
}

/** Findings for one llms.txt body against the products it should describe. */
export function audit(text, productsByHandle, {checkCoverage = false} = {}) {
  const findings = [];
  if (/[–\u2014]/.test(text)) findings.push('contains an em or en dash');
  if (/twitch only|no mark works on/i.test(text)) {
    findings.push('states a blanket single platform rule ("Twitch only")');
  }
  const sectionOf = (name) =>
    text.split(`\n## ${name}\n`)[1]?.split('\n## ')[0] ?? '';
  // The self-test fixtures start with "# x\n\n## Products", so also accept
  // the heading at the very start of the text.
  const products = text.startsWith('## Products')
    ? text.split('## Products\n')[1]?.split('\n## ')[0] ?? ''
    : sectionOf('Products');
  const section = `${products}\n${sectionOf('Full catalog')}`;
  const lines = section.split('\n').filter((l) => l.startsWith('- ['));
  if (!lines.length) findings.push('no product lines');
  const seen = new Map();
  const unverified = [];
  for (const line of lines) {
    const handle = line.match(/\/products\/([^)]+)\)/)?.[1];
    seen.set(handle, (seen.get(handle) ?? 0) + 1);
    const product = productsByHandle.get(handle);
    if (!product) {
      findings.push(`${handle}: not in the catalogue`);
      continue;
    }
    const said = line.match(/Works on ([^.]+)\./)?.[1];
    const want = platformsOf(product);
    if (!said && want.length) {
      findings.push(`${handle}: line names no platforms`);
    } else if (!said) {
      unverified.push(handle);
    } else {
      const got = STREAM_PLATFORMS.filter((p) =>
        new RegExp(`\\b${p}\\b`).test(said),
      );
      if (got.join() !== want.join()) {
        findings.push(
          `${handle}: says ${got.join('/') || 'none'}, works_with ${want.join('/') || 'none'}`,
        );
      }
    }
    if (product.productType === 'Goal Widget' && !/reads no chat/.test(line)) {
      findings.push(`${handle}: goal widget line does not say it reads no chat`);
    }
    const marked = line.includes('**Multistream**');
    if (marked !== isMultistream(product)) {
      findings.push(`${handle}: multistream mark ${marked ? 'present' : 'missing'}, works_with says otherwise`);
    }
  }
  for (const [handle, n] of seen) {
    if (n > 1) findings.push(`${handle}: appears ${n} times`);
  }
  if (checkCoverage) {
    for (const handle of productsByHandle.keys()) {
      if (!seen.has(handle)) findings.push(`${handle}: in the catalogue but not in the file`);
    }
  }
  return {findings, lines: lines.length, unique: seen.size, unverified: unverified.length};
}

// ---- Self-test ---------------------------------------------------------------

function selfTest() {
  const star = {
    handle: 'star',
    title: 'Celestial Star Goal Widget for Twitch and Kick',
    seo: {title: 'Celestial Star Goal Widget for Twitch and Kick'},
    productType: 'Goal Widget',
    worksWith: {value: '["Twitch","Kick","StreamElements","Streamlabs","OBS"]'},
  };
  const multi = {
    handle: 'multi',
    title: 'Multistream Chat',
    productType: 'Chat Widget',
    worksWith: {value: '["Twitch","YouTube","Kick","TikTok","StreamElements"]'},
  };
  const jar = {
    handle: 'jar',
    title: 'Moon Jar',
    productType: 'Goal Widget',
    worksWith: {value: '["Twitch","YouTube","Kick","StreamElements"]'},
  };
  const bare = {handle: 'bare', title: 'Bare Alert', productType: 'Alert Widget'};
  const map = new Map([star, multi, jar].map((p) => [p.handle, p]));
  const fullMap = new Map([star, multi, jar, bare].map((p) => [p.handle, p]));
  const good = buildLlmsTxt({baseUrl: BASE, products: [star, multi, jar], collections: []});
  const full = buildLlmsTxt({baseUrl: BASE, products: [star], collections: [], catalog: [star, multi, jar, bare]});
  const header = '# x\n\n## Products\n\n';
  const cases = [
    ['builder output is clean', good, 0],
    ['the 2026-09-25 rule sentence', good.replace('## Products', 'A product with no mark works on Twitch only.\n\n## Products'), 1],
    ['an em dash', good.replace('Chat widget', 'Chat widget \u2014 glow'), 1],
    ['old style line with no platforms', `${header}- [Star](${BASE}/products/star)\n`, 2],
    ['platform dropped (Kick missing)', `${header}- [Star](${BASE}/products/star): Goal widget, reads no chat. Works on Twitch.\n`, 1],
    ['platform added (YouTube overclaim)', `${header}- [Star](${BASE}/products/star): Goal widget, reads no chat. Works on Twitch, YouTube and Kick.\n`, 1],
    ['goal line without the no chat clause', `${header}- [Star](${BASE}/products/star): Goal widget. Works on Twitch and Kick.\n`, 1],
    ['multistream mark missing', `${header}- [Jar](${BASE}/products/jar): Goal widget, reads no chat. Works on Twitch, YouTube and Kick.\n`, 1],
    ['multistream mark on a two platform product', `${header}- [Star](${BASE}/products/star) **Multistream**: Goal widget, reads no chat. Works on Twitch and Kick.\n`, 1],
    ['handle not in catalogue', `${header}- [Gone](${BASE}/products/gone): Chat widget. Works on Twitch.\n`, 1],
    ['full catalog, curated + grouped, each once', full, 0, true],
    ['full catalog drops a product', full.replace(/^- \[Bare Alert\].*\n/m, ''), 1, true],
    ['full catalog repeats a product', full.replace('### Alert Widgets', '### Alert Widgets\n\n' + full.match(/^- \[.*\/products\/star\).*$/m)[0]), 1, true],
    ['no works_with and no platform claim is fine', `${header}- [Bare Alert](${BASE}/products/bare): Alert widget.\n`, 0, 'map'],
    ['no works_with but a platform claim', `${header}- [Bare Alert](${BASE}/products/bare): Alert widget. Works on Twitch.\n`, 1, 'map'],
  ];
  let pass = 0;
  for (const [name, text, want, mode] of cases) {
    const {findings} = audit(text, mode ? fullMap : map, {checkCoverage: mode === true});
    const ok = findings.length === want;
    if (ok) pass++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}  want ${want}, got ${findings.length}${ok ? '' : ` ${JSON.stringify(findings)}`}`);
  }
  console.log(`\n${pass}/${cases.length} self-test cases`);
  process.exit(pass === cases.length ? 0 : 1);
}

// ---- Live ----------------------------------------------------------------------

// Read lazily so --self-test and --file need no credentials file.
const loadEnv = () => Object.fromEntries(
  fs
    .readFileSync(`${ROOT}/.env`, 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => [
      l.slice(0, l.indexOf('=')).trim(),
      l.slice(l.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, ''),
    ]),
);

async function storefront(query, variables = {}) {
  const env = loadEnv();
  const res = await fetch(
    `https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
      },
      body: JSON.stringify({query, variables}),
    },
  );
  const body = await res.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors));
  return body.data;
}

const FIELDS = `title handle productType seo { title } worksWith: metafield(namespace: "custom", key: "works_with") { value }`;

async function catalogue() {
  const all = [];
  let cursor = null;
  do {
    const data = await storefront(
      `query($cursor: String) { products(first: 250, after: $cursor) { pageInfo { hasNextPage endCursor } nodes { ${FIELDS} } } }`,
      {cursor},
    );
    all.push(...data.products.nodes);
    cursor = data.products.pageInfo.hasNextPage ? data.products.pageInfo.endCursor : null;
  } while (cursor);
  return all;
}

if (process.argv.includes('--self-test')) selfTest();
else {
  const products = await catalogue();
  const map = new Map(products.map((p) => [p.handle, p]));
  let text;
  let source;
  const liveIdx = process.argv.indexOf('--live');
  if (liveIdx !== -1) {
    const next = process.argv[liveIdx + 1];
    const origin = next && !next.startsWith('--') ? next.replace(/\/$/, '') : BASE;
    const res = await fetch(`${origin}/llms.txt`);
    text = await res.text();
    source = `${origin}/llms.txt (HTTP ${res.status})`;
  } else {
    const data = await storefront(
      `{ collection(handle: "top-widgets") { products(first: 30) { nodes { ${FIELDS} } } } collections(first: 20) { nodes { title handle } } }`,
    );
    text = buildLlmsTxt({
      baseUrl: BASE,
      products: data.collection?.products?.nodes ?? [],
      collections: data.collections.nodes,
      catalog: products,
    });
    source = 'repo builder over the live catalogue';
  }
  const fileIdx = process.argv.indexOf('--file');
  if (fileIdx !== -1) {
    text = fs.readFileSync(process.argv[fileIdx + 1], 'utf8');
    source = `file ${process.argv[fileIdx + 1]}`;
  }
  const {findings, lines, unique, unverified} = audit(text, map, {checkCoverage: true});
  console.log(`llms.txt audit: ${source}, ${lines} product lines, ${unique} unique, ${products.length} products in catalogue, ${unverified} with no works_with (no platform claimed)`);
  for (const f of findings) console.log(`  FINDING  ${f}`);
  console.log(findings.length ? `\n${findings.length} finding(s)` : '\nNo findings.');
  process.exit(findings.length ? 1 : 0);
}
