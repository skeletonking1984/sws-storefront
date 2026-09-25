#!/usr/bin/env node
/**
 * Blog SEO residuals 1–3 from SWS QA VERDICT 2026-09-23.
 * Auth: PRIVATE_ADMIN_API_TOKEN (same credential used for today's articleUpdate).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
function loadEnv() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv();

const shop = process.env.PUBLIC_STORE_DOMAIN || process.env.SHOPIFY_SHOP || '72470e-33.myshopify.com';
const token = process.env.PRIVATE_ADMIN_API_TOKEN;
if (!token) {
  console.error('Missing PRIVATE_ADMIN_API_TOKEN');
  process.exit(1);
}

const API = `https://${shop}/admin/api/2024-10/graphql.json`;
const NEON = 'https://streamwidgetshop.com/products/neon-aesthetic-glowy-transparent-chat-and-goal-stream-widgets-minimal-neon-light-elegant-glow-theme-clean-vibe-streamelement-only';

async function gql(query, variables) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

const JOBS = [
  {
    id: 'gid://shopify/Article/566684483774',
    handle: 'best-twitch-and-kick-chat-widgets-and-stream-overlays-for-obs-in-2026',
    replace: [['https://streamwidgetshop.etsy.com/listing/4333471272/neon-stream-chat-and-goal-widgets?utm_source=chatgpt.com', NEON]],
  },
  {
    id: 'gid://shopify/Article/566463365310',
    handle: 'best-cyberpunk-twitch-overlays-and-chat-widgets-for-futuristic-stream-setups',
    replace: [
      ['https://streamwidgetshop.etsy.com/listing/1904169495?utm_source=chatgpt.com', NEON],
      ['Cyberpunk 2077', 'neon-noir and cyberpunk games'],
    ],
  },
  {
    id: 'gid://shopify/Article/566799499454',
    handle: 'where-to-watch-the-fifa-world-cup-2026-as-a-streamer-and-how-to-create-content-around-it',
    replace: [['https://streamwidgetshop.etsy.com', 'https://streamwidgetshop.com']],
  },
  {
    id: 'gid://shopify/Article/566184247486',
    handle: 'hire-a-custom-stream-widget-developer-for-kick-twitch',
    replace: [['immersion — all critical for keeping viewers watching longer.', 'immersion, all critical for keeping viewers watching longer.']],
  },
];

const GET = `query ($id: ID!) { article(id: $id) { id handle body } }`;
const UPDATE = `mutation ($id: ID!, $article: ArticleUpdateInput!) {
  articleUpdate(id: $id, article: $article) {
    article { id handle }
    userErrors { field message }
  }
}`;

function apply(body, pairs) {
  let out = body;
  const missing = [];
  for (const [from, to] of pairs) {
    if (!out.includes(from)) missing.push(from);
    else out = out.split(from).join(to);
  }
  return { out, missing };
}

for (const job of JOBS) {
  const { article } = await gql(GET, { id: job.id });
  if (!article) throw new Error(`No article ${job.handle}`);
  const { out, missing } = apply(article.body || '', job.replace);
  if (missing.length) console.warn(`WARN ${job.handle}: missing needles:`, missing);
  if (out === article.body) {
    console.log(`SKIP ${job.handle}: no changes`);
    continue;
  }
  const data = await gql(UPDATE, { id: job.id, article: { body: out } });
  const errs = data.articleUpdate.userErrors;
  if (errs?.length) throw new Error(`${job.handle}: ${JSON.stringify(errs)}`);
  console.log(`OK ${job.handle}`);
}
console.log('Done. Re-verify rendered HTML, then append HANDOFF residuals note.');
