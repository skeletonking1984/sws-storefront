#!/usr/bin/env node
/*
 * Capture real stage widgets as TRANSPARENT PNGs for the blog heroes.
 *
 * Why live capture and not the product art library: that library is Etsy
 * listing art, opaque JPEG with a background already baked in. Pasting one onto
 * a hero gives you a picture of a picture, which is exactly what the current
 * blog heroes are and why they read as filler.
 *
 * WHY NOT widget-preview.html. It was the obvious harness and it is the wrong
 * one for stills. Its demo loop fires a tip every 900ms until the goal hits 650
 * to animate a bar filling, which is right for watching a goal widget in OBS
 * and badly wrong for a chat widget: the first capture came back with SEVEN
 * identical "Now tipped $90!" rows and three real messages buried among them.
 * A hero has one frame, so the frame has to be composed, not sampled from a
 * loop built for a different purpose.
 *
 * So the bundle is fetched here and mounted with a feed chosen for the widget's
 * KIND: a chat gets varied speakers, platforms and badges and exactly one
 * money event; a goal gets only enough tips to sit at a believable part-full
 * reading. No repeats, no spam, nothing still animating at capture time.
 *
 * Cropping is a separate PIL step (crop_widgets.py): no pngjs or sharp here.
 *
 *   node render_widgets.mjs celestial-moon-goal neon-chat ...
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire('/Users/todd/Documents/orgs/SWS/repos/sws-monthly-report/package.json');
const puppeteer = require('puppeteer-core');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'widgets-raw');
const STAGE = 'http://localhost:8791';
const STAGE_REPO = '/Users/todd/Documents/orgs/SWS/repos/sws-widget-stage';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/* Real-looking chat. Deliberately about the product being on screen, never a
 * fake testimonial naming a real streamer (sws-content-no-fake-social-proof). */
const CHAT = [
  {nick: 'moonbeam_gg',  text: 'the overlay looks so clean',      badges: []},
  {nick: 'velvetmoth',   text: 'ok the glow is doing it for me',  badges: [{type: 'subscriber'}]},
  {nick: 'astra_dawn',   text: 'every platform in one box',       badges: [{type: 'moderator'}]},
  {nick: 'pixiedust_44', text: 'goal bar is almost full',         badges: []},
  {nick: 'nightowl22',   text: 'welcome to the stream',           badges: [{type: 'vip'}]},
];

const ids = process.argv.slice(2);
if (!ids.length) { console.error('usage: render_widgets.mjs <widget-id>...'); process.exit(1); }

fs.mkdirSync(OUT, {recursive: true});

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-color-profile=srgb'],
  defaultViewport: {width: 1100, height: 1100, deviceScaleFactor: 2},
});

for (const id of ids) {
  /* widget.json is read off DISK, not over HTTP. The stage serves only its
   * public/ directory and widgets/ is a sibling of it, so the obvious
   * `${STAGE}/widgets/<id>/widget.json` 404s, the catch swallows it, and every
   * widget silently captures as kind=chat. That is how celestial-moon-goal, a
   * goal widget, got fed five chat messages on the first run. */
  let kind = 'chat';
  const metaPath = path.join(STAGE_REPO, 'widgets', id, 'widget.json');
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    if (meta.kind) kind = meta.kind;
  } else {
    console.log(`WARN  ${id.padEnd(30)} no widget.json at ${metaPath}, assuming chat`);
  }

  let bundle;
  try {
    bundle = await (await fetch(`${STAGE}/bundles/${id}.json`)).json();
  } catch (e) {
    console.log(`FAIL  ${id.padEnd(30)} bundle fetch: ${e.message}`);
    continue;
  }

  const page = await browser.newPage();
  await page.setViewport({width: 1100, height: 1100, deviceScaleFactor: 2});

  /* Mount the real bundle exactly the way the stage harness does, minus its
   * demo loop. Scripts are loaded from the stage origin so jquery and the
   * StreamElements shim resolve. */
  const boot = {fieldData: bundle.fieldData, widgetId: bundle.id};
  const doc = `<!doctype html><html><head><meta charset="utf-8">
<script>window.__SWS_BOOT__ = ${JSON.stringify(boot).replace(/</g, '\\u003c')};<\/script>
<script src="${STAGE}/jquery.min.js"><\/script>
<style>html,body{margin:0;height:100%;background:transparent}${bundle.css}</style>
</head><body>${bundle.html}
<script>${bundle.js}<\/script>
<script src="${STAGE}/se-shim.js"><\/script>
</body></html>`;

  await page.goto(`${STAGE}/blank-mount`, {waitUntil: 'domcontentloaded'}).catch(() => {});
  await page.setContent(doc, {waitUntil: 'domcontentloaded', timeout: 20000});
  // Let the widget's own boot code bind its listeners before anything is sent.
  await new Promise((r) => setTimeout(r, 1500));

  /*
   * Fill a goal to ~68% of its own target, using the event it actually counts.
   *
   * Two separate traps here, both of which shipped a broken looking card once:
   *
   * 1. TARGET. Targets differ per widget (celestial-moon-goal 100, moon-jar-goal
   *    50, star-goal 10). A flat amount sent 420 into a target of 100 and the
   *    hero read "goal $420 / $100", a bar past full, which is the one state
   *    that sells nothing.
   *
   * 2. EVENT TYPE. Each goal declares `goalType` naming what it counts, and a
   *    widget ignores everything else. star-goal counts SUBSCRIBERS and
   *    lotus-butterfly-goal counts CHEERS, so feeding both a tip left them
   *    sitting at "Donation Goal 0 / 10" and "0 / 10000" in the first full
   *    render of all 43. An empty goal bar looks like a bug, not a product.
   *
   * Count based goals (subscriber, follower, raid) need N DISCRETE events
   * rather than one carrying an amount, so those are emitted individually and
   * capped, since a target of 100 subscribers is not worth 68 postMessages.
   */
  const fd = bundle.fieldData || {};
  const goalType = String(fd.goalType || 'tip').toLowerCase();
  const target = Number(fd.goalTarget ?? fd.goal ?? fd.target ?? 100) || 100;
  const fill = target * 0.68;
  const MAX_EVENTS = 15;

  let goalFeed;
  if (goalType === 'subscriber' || goalType === 'follower' || goalType === 'raid') {
    const n = Math.max(1, Math.min(MAX_EVENTS, Math.round(fill)));
    const names = ['Marney', 'Strong', 'CometTip', 'lunaflux', 'velvetmoth', 'astra_dawn'];
    goalFeed = Array.from({length: n}, (_, i) => ({
      listener: `${goalType}-latest`,
      event: {name: names[i % names.length], amount: 1},
    }));
  } else {
    // tip and cheer both carry a value, so three events can cover the fill.
    const listener = goalType === 'cheer' ? 'cheer-latest' : 'tip-latest';
    goalFeed = [
      {listener, event: {amount: +(fill * 0.45).toFixed(2), name: 'Marney'}},
      {listener, event: {amount: +(fill * 0.32).toFixed(2), name: 'Strong'}},
      {listener, event: {amount: +(fill * 0.23).toFixed(2), name: 'CometTip'}},
    ];
  }

  const feed = kind === 'goal'
    ? goalFeed
    : [
        ...CHAT.map((m) => ({listener: 'message', event: {data: {...m, displayName: m.nick, tags: {}, emotes: []}}})),
        {listener: 'tip-latest', event: {amount: 25, name: 'Jordan'}},
      ];

  for (const payload of feed) {
    await page.evaluate((p) => {
      window.postMessage({__sws: true, type: 'event', payload: p}, '*');
    }, payload);
    await new Promise((r) => setTimeout(r, feed.length > 6 ? 180 : 450));
  }

  // Let entry animations land and settle before the frame is taken.
  await new Promise((r) => setTimeout(r, 2500));

  await page.screenshot({path: path.join(OUT, `${id}.png`), omitBackground: true, type: 'png'});
  console.log(`ok    ${id.padEnd(30)} kind=${kind} events=${feed.length}` + (kind === 'goal' ? ` type=${goalType} target=${target} fill=${fill.toFixed(0)}` : ''));
  await page.close();
}

await browser.close();
