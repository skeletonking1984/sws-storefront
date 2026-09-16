#!/usr/bin/env node
/*
 * Capture ONE widget PNG PER ARTICLE, not one per widget.
 *
 * The first pass captured each widget once and reused it across every article
 * that referenced it, which is why the blog index looked like one image 43
 * times: all 30-odd chat heroes carried the identical five messages from the
 * identical five avatars. Background and palette variation cannot hide that,
 * because the chat content IS the picture at card size.
 *
 * Each article now gets its own feed from chatpool.mjs, seeded by its handle,
 * so the output is deterministic (re-rendering an article is a real diff) while
 * no two articles match.
 *
 *   node render_article_widgets.mjs            all articles in map.json
 *   node render_article_widgets.mjs <handle>   just those
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {chatFor, tipFor} from './chatpool.mjs';

const require = createRequire('/Users/todd/Documents/orgs/SWS/repos/sws-monthly-report/package.json');
const puppeteer = require('puppeteer-core');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'widgets-raw');
const STAGE = 'http://localhost:8791';
const STAGE_REPO = '/Users/todd/Documents/orgs/SWS/repos/sws-widget-stage';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/* Which LINES group suits each hero theme. */
const LINE_GROUP = {
  celestial: 'celestial', cozy: 'cozy', neon: 'neon', cyber: 'neon',
  pastel: 'general', gold: 'goal', violet: 'general',
};

const rows = JSON.parse(fs.readFileSync(path.join(HERE, 'map.json'), 'utf8'));
const only = process.argv.slice(2);
const todo = only.length ? rows.filter((r) => only.includes(r[0])) : rows;
if (!todo.length) { console.error('nothing to render'); process.exit(1); }

fs.mkdirSync(OUT, {recursive: true});

const bundleCache = new Map();
async function bundleFor(id) {
  if (!bundleCache.has(id)) {
    bundleCache.set(id, await (await fetch(`${STAGE}/bundles/${id}.json`)).json());
  }
  return bundleCache.get(id);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-color-profile=srgb'],
  defaultViewport: {width: 1100, height: 1100, deviceScaleFactor: 2},
});

let done = 0;
for (const [handle, theme, , , widgetId] of todo) {
  let kind = 'chat';
  const metaPath = path.join(STAGE_REPO, 'widgets', widgetId, 'widget.json');
  if (fs.existsSync(metaPath)) kind = JSON.parse(fs.readFileSync(metaPath, 'utf8')).kind || 'chat';

  let bundle;
  try { bundle = await bundleFor(widgetId); }
  catch (e) { console.log(`FAIL  ${handle.slice(0, 44)} bundle: ${e.message}`); continue; }

  const page = await browser.newPage();
  await page.setViewport({width: 1100, height: 1100, deviceScaleFactor: 2});

  const boot = {fieldData: bundle.fieldData, widgetId: bundle.id};
  const doc = `<!doctype html><html><head><meta charset="utf-8">
<script>window.__SWS_BOOT__ = ${JSON.stringify(boot).replace(/</g, '\\u003c')};<\/script>
<script src="${STAGE}/jquery.min.js"><\/script>
<style>html,body{margin:0;height:100%;background:transparent}${bundle.css}</style>
</head><body>${bundle.html}
<script>${bundle.js}<\/script>
<script src="${STAGE}/se-shim.js"><\/script>
</body></html>`;

  await page.setContent(doc, {waitUntil: 'domcontentloaded', timeout: 20000});
  await new Promise((r) => setTimeout(r, 1500));

  const fd = bundle.fieldData || {};
  const goalType = String(fd.goalType || 'tip').toLowerCase();
  const target = Number(fd.goalTarget ?? fd.goal ?? fd.target ?? 100) || 100;
  const fill = target * 0.68;

  let feed;
  if (kind === 'goal') {
    if (goalType === 'subscriber' || goalType === 'follower' || goalType === 'raid') {
      const n = Math.max(1, Math.min(15, Math.round(fill)));
      const names = chatFor(handle, 'general', Math.min(6, n)).map((c) => c.nick);
      feed = Array.from({length: n}, (_, i) => ({
        listener: `${goalType}-latest`, event: {name: names[i % names.length], amount: 1},
      }));
    } else {
      const l = goalType === 'cheer' ? 'cheer-latest' : 'tip-latest';
      const who = chatFor(handle, 'general', 3).map((c) => c.nick);
      feed = [
        {listener: l, event: {amount: +(fill * 0.45).toFixed(2), name: who[0]}},
        {listener: l, event: {amount: +(fill * 0.32).toFixed(2), name: who[1]}},
        {listener: l, event: {amount: +(fill * 0.23).toFixed(2), name: who[2]}},
      ];
    }
  } else {
    const msgs = chatFor(handle, LINE_GROUP[theme] || 'general', 5);
    const tip = tipFor(handle);
    feed = [
      ...msgs.map((m) => ({listener: 'message', event: {data: {...m, displayName: m.nick, tags: {}, emotes: []}}})),
      {listener: 'tip-latest', event: tip},
    ];
  }

  for (const payload of feed) {
    await page.evaluate((p) => window.postMessage({__sws: true, type: 'event', payload: p}, '*'), payload);
    await new Promise((r) => setTimeout(r, feed.length > 6 ? 180 : 450));
  }
  await new Promise((r) => setTimeout(r, 2200));

  // Named by ARTICLE, so two articles sharing a widget still get their own art.
  await page.screenshot({path: path.join(OUT, `${handle}.png`), omitBackground: true, type: 'png'});
  await page.close();
  done++;
  console.log(`ok ${String(done).padStart(2)}/${todo.length}  ${widgetId.padEnd(28)} ${handle.slice(0, 44)}`);
}

await browser.close();
