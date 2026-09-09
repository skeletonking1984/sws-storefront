/**
 * Attach Etsy listing videos to the matching Shopify products.
 *
 * Every SWS product is sold on Etsy first. Most of those listings carry a short
 * mp4 demo of the widget actually running, and that clip is the single best
 * conversion asset the storefront has. Shopify had 8 of 130 active products
 * with a VIDEO media item before this script existed.
 *
 * Shopify will NOT fetch an arbitrary mp4 by URL for mediaContentType VIDEO.
 * The only path is the staged upload flow:
 *
 *   1. stagedUploadsCreate(resource: VIDEO, fileSize, mimeType, POST)
 *   2. multipart POST the real bytes to the returned target + parameters
 *   3. productCreateMedia(originalSource: resourceUrl, mediaContentType: VIDEO)
 *   4. poll product.media until status READY or FAILED
 *
 * Steps 1, 3 and 4 need an Admin API token. This repo only holds a READ ONLY
 * Storefront token (.env), so those three steps are driven from the Shopify
 * Admin MCP tools by the operator. This script owns everything that does not
 * need admin credentials: building the mapping, downloading the mp4, doing the
 * presigned multipart POST, and tracking per row state so a rerun never
 * repeats finished work.
 *
 * Commands
 *   match <shopifyCatalog.json> <etsyListings.json>
 *       Build or refresh data/etsy-video-map.json. Seeds the 16 hand verified
 *       rows from data/etsy-shopify-map.json, then matches the remainder by
 *       normalised title similarity. Low confidence rows are written with
 *       shopify_product_id null so a human can see what was skipped. Existing
 *       rows keep their recorded state.
 *
 *   videos <listingVideos.json>
 *       Merge {listing_id: videoUrlOrNull} into the map.
 *
 *   pending
 *       Print the rows that still need a video attached, in revenue order.
 *
 *   fetch <listing_id>
 *       curl the Etsy mp4 to the temp dir. Prints the real byte size, which is
 *       what stagedUploadsCreate has to be told.
 *
 *   upload <listing_id> <stagedTarget.json>
 *       multipart POST the downloaded file to the staged target.
 *
 *   mark <listing_id> <state> [note]
 *       Record the outcome of a row. States: done, no_video, failed, unmatched.
 *
 * Idempotency: match, videos and mark all merge into data/etsy-video-map.json
 * and never clobber a row already marked done. Nothing here deletes or replaces
 * Shopify media; the only Shopify write in the whole flow is an additive
 * productCreateMedia.
 *
 * Two Shopify limits constrain the staging step, and both are charged at
 * stagedUploadsCreate time rather than at productCreateMedia time:
 *
 *   200 video uploads per hour per shop
 *   250 videos and 3D models in total, a hard plan cap
 *
 * A staged target reserves a slot against both the moment it is created, even
 * if no bytes are ever posted to it, and releases it only when the target
 * expires roughly 70 minutes later. So never request targets speculatively.
 * Both limits surface as per input entries in userErrors with a null url on the
 * rejected elements while earlier elements succeed, which means the caller has
 * to inspect the response element by element; a mutation that did not throw is
 * not evidence that every target was created.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';

const ROOT = new URL('..', import.meta.url).pathname;
const MAP_PATH = path.join(ROOT, 'data', 'etsy-video-map.json');
const SEED_PATH = path.join(ROOT, 'data', 'etsy-shopify-map.json');
const ADJ_PATH = path.join(ROOT, 'data', 'etsy-video-adjudication.json');
const TMP_DIR = path.join(os.tmpdir(), 'sws-etsy-videos');

/* ------------------------------------------------------------ normalising */

/**
 * Boilerplate that appears on both platforms and carries no identity. Left in,
 * it makes every goal widget look like every other goal widget.
 */
const BOILERPLATE = [
  /is fully customisable for twitch streamlabs tiktok studio and streamelements/g,
  /is fully customisable for twitch streamlabs and streamelements/g,
  /is fully customisable for twitch streamelements and obs/g,
  /is fully customisable for twitch streamelements/g,
  /fully customisable/g,
  /digital download/g,
  /instant download/g,
  /streamelements only/g,
  /stream ?elements/g,
  /stream ?labs/g,
  /tiktok studio/g,
  /with pronouns and alerts for twitch streams/g,
  /with pronouns and alerts for twitch/g,
  /for twitch streams/g,
  /vtuber streamer gift/g,
  /vtuber streamer/g,
  /animated overlay/g,
  /stream overlay/g,
  /overlay/g,
  /widgets?/g,
  /twitch/g,
  /youtube/g,
  /kick/g,
  /tiktok/g,
  /\bobs\b/g,
  /theme/g,
  /clean vibe/g,
  /easy setup/g,
  /one click installation/g,
];

function normalise(raw) {
  let s = String(raw)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  for (const re of BOILERPLATE) s = s.replace(re, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

const STOP = new Set([
  'and', 'the', 'for', 'with', 'a', 'of', 'to', 'in', 'on', 'is', 'only',
  'chat', 'goal', 'stream', 'widget', 'animated', 'customisable',
  'customizable', 'streamer', 'streams', 'download', 'pack', 'cute', 'minimal',
]);

function tokens(norm) {
  return new Set(norm.split(' ').filter((t) => t && !STOP.has(t)));
}

/* ------------------------------------------------------------- similarity */

/**
 * Inverse document frequency over the combined corpus. Without it, shared
 * filler like "liquid" or "bar" scores as highly as "brimstone", and two
 * unrelated bar goals match each other.
 */
function buildIdf(docs) {
  const df = new Map();
  for (const d of docs) for (const t of d) df.set(t, (df.get(t) || 0) + 1);
  const n = docs.length;
  const idf = new Map();
  for (const [t, c] of df) idf.set(t, Math.log((n + 1) / (c + 0.5)));
  return idf;
}

function weight(set, idf) {
  let w = 0;
  for (const t of set) w += idf.get(t) || 1;
  return w;
}

function similarity(a, b, idf) {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += idf.get(t) || 1;
  const union = weight(a, idf) + weight(b, idf) - inter;
  return union > 0 ? inter / union : 0;
}

function rareShared(a, b, idf, floor) {
  let n = 0;
  for (const t of a) if (b.has(t) && (idf.get(t) || 1) >= floor) n += 1;
  return n;
}

/* ------------------------------------------------------------------- state */

function loadMap() {
  if (!fs.existsSync(MAP_PATH)) return {generated_at: null, rows: []};
  return JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
}

function saveMap(map) {
  map.generated_at = new Date().toISOString();
  map.rows.sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.etsy_listing_id - b.etsy_listing_id);
  fs.mkdirSync(path.dirname(MAP_PATH), {recursive: true});
  fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2) + '\n');
}

function rowFor(map, listingId) {
  return map.rows.find((r) => r.etsy_listing_id === Number(listingId));
}

/* ------------------------------------------------------------------ match */

/** Accept thresholds. Deliberately strict: a wrong video is worse than none. */
const ACCEPT_SCORE = 0.62;
const ACCEPT_MARGIN = 0.12;
const RARE_IDF = 1.6;
const MIN_RARE_SHARED = 1;

function cmdMatch(shopifyPath, etsyPath) {
  const products = JSON.parse(fs.readFileSync(shopifyPath, 'utf8'));
  const listings = JSON.parse(fs.readFileSync(etsyPath, 'utf8')).filter(
    (l) => l.state === 'active',
  );
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const map = loadMap();

  const byId = new Map(products.map((p) => [p.id, p]));
  const taken = new Set();
  const seededListings = new Set();
  const out = [];

  // 1. hand verified rows win outright.
  seed.forEach((s, i) => {
    const p = byId.get(s.shopify_product_id);
    if (!p) {
      out.push({
        etsy_listing_id: s.etsy_listing_id,
        etsy_title: s.title,
        shopify_product_id: null,
        handle: s.handle,
        shopify_title: null,
        confidence: 'manual_missing',
        score: null,
        priority: 1000 - i,
        state: 'unmatched',
        note: 'Seed row points at a product that is not in the active catalog.',
      });
      seededListings.add(s.etsy_listing_id);
      return;
    }
    taken.add(p.id);
    seededListings.add(s.etsy_listing_id);
    out.push({
      etsy_listing_id: s.etsy_listing_id,
      etsy_title: s.title,
      shopify_product_id: p.id,
      handle: p.handle,
      shopify_title: p.title,
      confidence: 'manual',
      score: 1,
      priority: 1000 - i,
      state: p.hasVideo ? 'already_had_video' : 'todo',
      note: 'Hand verified in data/etsy-shopify-map.json.',
    });
  });

  // 2. reviewed decisions. data/etsy-video-adjudication.json maps an Etsy
  // listing id to the Shopify product id a reviewer confirmed, or to null for
  // "this listing genuinely has no product". These outrank the scorer, which is
  // how a borderline pair gets promoted without loosening the bar for everyone.
  const adj = fs.existsSync(ADJ_PATH)
    ? JSON.parse(fs.readFileSync(ADJ_PATH, 'utf8'))
    : {};
  const byListing = new Map(listings.map((l) => [l.listing_id, l]));
  for (const [lid, pid] of Object.entries(adj)) {
    const l = byListing.get(Number(lid));
    if (!l || seededListings.has(Number(lid))) continue;
    seededListings.add(Number(lid));
    if (!pid) {
      out.push({
        etsy_listing_id: Number(lid),
        etsy_title: l.title,
        shopify_product_id: null,
        handle: null,
        shopify_title: null,
        confidence: 'reviewed_none',
        score: null,
        priority: -1,
        state: 'unmatched',
        note: 'Reviewed: no confident Shopify counterpart.',
      });
      continue;
    }
    const p = byId.get(pid);
    if (!p) throw new Error(`adjudication points at unknown product ${pid}`);
    taken.add(p.id);
    out.push({
      etsy_listing_id: Number(lid),
      etsy_title: l.title,
      shopify_product_id: p.id,
      handle: p.handle,
      shopify_title: p.title,
      confidence: 'reviewed',
      score: null,
      priority: 0,
      state: p.hasVideo ? 'already_had_video' : 'todo',
      note: 'Reviewed pair.',
    });
  }

  // 3. everything else by weighted title similarity.
  const pRest = products.filter((p) => !taken.has(p.id));
  const lRest = listings.filter((l) => !seededListings.has(l.listing_id));

  const pTok = pRest.map((p) => tokens(normalise(p.title)));
  const lTok = lRest.map((l) => tokens(normalise(l.title)));
  const idf = buildIdf([...pTok, ...lTok]);

  const pairs = [];
  lRest.forEach((l, li) => {
    const scored = pRest
      .map((p, pi) => ({pi, score: similarity(lTok[li], pTok[pi], idf)}))
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    const second = scored[1] || {score: 0};
    if (!best) return;
    pairs.push({
      li,
      pi: best.pi,
      score: best.score,
      margin: best.score - second.score,
      rare: rareShared(lTok[li], pTok[best.pi], idf, RARE_IDF),
    });
  });

  // Greedy 1:1 assignment, strongest pairs first.
  pairs.sort((a, b) => b.score - a.score);
  const usedP = new Set();
  const usedL = new Set();
  for (const c of pairs) {
    if (usedP.has(c.pi) || usedL.has(c.li)) continue;
    const l = lRest[c.li];
    const p = pRest[c.pi];
    const ok =
      c.score >= ACCEPT_SCORE &&
      c.margin >= ACCEPT_MARGIN &&
      c.rare >= MIN_RARE_SHARED;
    if (!ok) continue;
    usedP.add(c.pi);
    usedL.add(c.li);
    out.push({
      etsy_listing_id: l.listing_id,
      etsy_title: l.title,
      shopify_product_id: p.id,
      handle: p.handle,
      shopify_title: p.title,
      confidence: c.score >= 0.95 ? 'exact' : 'high',
      score: Number(c.score.toFixed(3)),
      margin: Number(c.margin.toFixed(3)),
      priority: 0,
      state: p.hasVideo ? 'already_had_video' : 'todo',
      note: null,
    });
  }

  // 4. candidate sheet for the reviewer: every listing the scorer would not
  // take, with its three closest products. This is the input to the
  // adjudication file, so nothing is dropped silently.
  const candidates = [];
  lRest.forEach((l, li) => {
    if (usedL.has(li)) return;
    const ranked = pRest
      .map((p, pi) => ({pi, score: similarity(lTok[li], pTok[pi], idf)}))
      .filter((x) => !usedP.has(x.pi))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    candidates.push({
      etsy_listing_id: l.listing_id,
      etsy_title: l.title,
      candidates: ranked.map((x) => ({
        shopify_product_id: pRest[x.pi].id,
        shopify_title: pRest[x.pi].title,
        score: Number(x.score.toFixed(3)),
      })),
    });
  });
  fs.writeFileSync(
    path.join(ROOT, 'data', 'etsy-video-candidates.json'),
    JSON.stringify(candidates, null, 2) + '\n',
  );

  // 5. record what was left behind so it is visible, not silently dropped.
  lRest.forEach((l, li) => {
    if (usedL.has(li)) return;
    const c = pairs.find((x) => x.li === li);
    out.push({
      etsy_listing_id: l.listing_id,
      etsy_title: l.title,
      shopify_product_id: null,
      handle: null,
      shopify_title: c ? pRest[c.pi].title : null,
      confidence: 'low',
      score: c ? Number(c.score.toFixed(3)) : 0,
      margin: c ? Number(c.margin.toFixed(3)) : 0,
      priority: -1,
      state: 'unmatched',
      note: 'Best candidate did not clear the confidence bar. Left unmatched on purpose.',
    });
  });

  // Preserve any state already recorded by an earlier run.
  //
  // A finished row also keeps the product it was finished against. Without
  // that, rescoring on a later run can drop a done row into the low band, which
  // nulls its product id while the state still says done, and the map stops
  // describing what is actually attached in Shopify.
  const prev = new Map(map.rows.map((r) => [r.etsy_listing_id, r]));
  const DONE = ['done', 'already_had_video'];
  for (const r of out) {
    const old = prev.get(r.etsy_listing_id);
    if (!old) continue;
    if (old.video_url !== undefined) r.video_url = old.video_url;
    if (old.media_id) r.media_id = old.media_id;
    if (['done', 'no_video', 'failed', 'already_had_video'].includes(old.state)) {
      r.state = old.state;
      if (old.note) r.note = old.note;
    }
    if (DONE.includes(old.state) && old.shopify_product_id) {
      r.shopify_product_id = old.shopify_product_id;
      r.handle = old.handle;
      r.shopify_title = old.shopify_title;
      r.confidence = old.confidence;
      r.score = old.score;
    }
  }

  map.rows = out;
  saveMap(map);

  const counts = out.reduce((a, r) => ((a[r.confidence] = (a[r.confidence] || 0) + 1), a), {});
  console.log('rows', out.length, counts);
  console.log('unmatched active shopify products',
    pRest.filter((_, i) => !usedP.has(i)).length);
}

/* ----------------------------------------------------------------- videos */

function cmdVideos(videosPath) {
  const videos = JSON.parse(fs.readFileSync(videosPath, 'utf8'));
  const map = loadMap();
  let withVideo = 0;
  let without = 0;
  for (const r of map.rows) {
    if (!(String(r.etsy_listing_id) in videos)) continue;
    const url = videos[String(r.etsy_listing_id)];
    r.video_url = url || null;
    if (url) withVideo += 1;
    else {
      without += 1;
      if (r.state === 'todo') r.state = 'no_video';
    }
  }
  saveMap(map);
  console.log('video urls set', withVideo, 'listings with no video', without);
}

/* ---------------------------------------------------------------- pending */

function cmdPending() {
  const map = loadMap();
  const rows = map.rows.filter(
    (r) => r.state === 'todo' && r.shopify_product_id && r.video_url,
  );
  for (const r of rows) {
    console.log([r.priority, r.etsy_listing_id, r.shopify_product_id, r.video_url].join('\t'));
  }
  console.error('pending', rows.length);
}

/* ------------------------------------------------------------ fetch bytes */

function filePath(listingId) {
  return path.join(TMP_DIR, `${listingId}.mp4`);
}

function cmdFetch(listingId) {
  const map = loadMap();
  const r = rowFor(map, listingId);
  if (!r || !r.video_url) throw new Error(`no video url for ${listingId}`);
  fs.mkdirSync(TMP_DIR, {recursive: true});
  const dest = filePath(listingId);
  if (!fs.existsSync(dest) || fs.statSync(dest).size === 0) {
    execFileSync('curl', ['-fsSL', '-o', dest, r.video_url], {stdio: 'inherit'});
  }
  const size = fs.statSync(dest).size;
  if (size < 1024) throw new Error(`downloaded file for ${listingId} is only ${size} bytes`);
  console.log(JSON.stringify({listing_id: Number(listingId), path: dest, size}));
}

/* ----------------------------------------------------- presigned multipart */

/**
 * The staged target is presigned, so this POST needs no admin credentials.
 * Parameter order matters for the Google upload endpoint Shopify hands back,
 * and the file part must come last.
 */
async function cmdUpload(listingId, targetPath) {
  const target = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
  const dest = filePath(listingId);
  const bytes = fs.readFileSync(dest);
  const form = new FormData();
  for (const {name, value} of target.parameters) form.append(name, value);
  form.append('file', new Blob([bytes], {type: 'video/mp4'}), `${listingId}.mp4`);

  const res = await fetch(target.url, {method: 'POST', body: form});
  const body = await res.text();
  if (!res.ok) {
    console.log(JSON.stringify({ok: false, status: res.status, body: body.slice(0, 500)}));
    process.exitCode = 1;
    return;
  }
  console.log(JSON.stringify({ok: true, status: res.status, resourceUrl: target.resourceUrl}));
}

/* ------------------------------------------------------------------- mark */

function cmdMark(listingId, state, note) {
  const map = loadMap();
  const r = rowFor(map, listingId);
  if (!r) throw new Error(`no row for ${listingId}`);
  r.state = state;
  if (note) r.note = note;
  saveMap(map);
  console.log(`${listingId} -> ${state}`);
}

/* ------------------------------------------------------------------- main */

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case 'match':
    cmdMatch(args[0], args[1]);
    break;
  case 'videos':
    cmdVideos(args[0]);
    break;
  case 'pending':
    cmdPending();
    break;
  case 'fetch':
    cmdFetch(args[0]);
    break;
  case 'upload':
    await cmdUpload(args[0], args[1]);
    break;
  case 'mark':
    cmdMark(args[0], args[1], args.slice(2).join(' '));
    break;
  default:
    console.error('usage: sync-etsy-videos.mjs <match|videos|pending|fetch|upload|mark> ...');
    process.exit(1);
}
