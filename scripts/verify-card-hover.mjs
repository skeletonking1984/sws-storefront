/**
 * Does a fast mouse sweep across a grid of product cards stay quiet?
 *
 * Why (2026-10-09): moving the pointer quickly across /collections/all
 * made the page "glitch". Nothing a static check could see was wrong. CLS was
 * 0, the scrollbar never moved and no card rect changed. The cost was all in
 * work the hover STARTED: every mouseenter promoted `data-src` to `src` and
 * called `el.load()`, so one pass over 24 cards kicked off 24 video downloads;
 * the opaque preview faded in at mouseenter whether or not it had a frame to
 * show; and the hover animated box-shadow and border-color on an element
 * carrying `backdrop-filter`, which repaints the card and re-blurs its
 * backdrop every frame of the transition.
 *
 * So this measures the three things that distinguish "smooth" from "no layout
 * shift", in a real browser:
 *   1. zero layout-shift entries over the whole run
 *   2. no card's preview video reaches `.is-active`, and none gets a `src`,
 *      during a pass that spends under 100ms on each tile
 *   3. every card's LAYOUT box (offsetLeft/Top/Width/Height, which a
 *      transform cannot move) is identical before and after
 * plus two style guards, because the fix lives in CSS and is easy to undo:
 *   4. .product-item transitions nothing but transform
 *   5. .product-item is promoted up front (will-change / a 3D transform)
 * and one positive control, so a quiet grid is not just a dead one:
 *   6. a DELIBERATE hover (held past the intent delay) does request the clip
 *
 * It only moves the mouse and never clicks, so it is safe against production.
 *
 * Usage:
 *   npm run verify:card-hover
 *   node scripts/verify-card-hover.mjs https://streamwidgetshop.com/collections/all
 *   node scripts/verify-card-hover.mjs --url http://localhost:3111/collections/all
 *
 * Second job, added 2026-10-18 after the homepage "New arrivals" tiles
 * vanished on hover while this check was green: after a deliberate hover on a
 * tile, every other tile in the same grid must still be displayed and
 * hit-testable. See checkSiblingsSurvive() for why the old checks could not
 * see it, and for what it runs against.
 *
 * Exits 1 on any failure. Deliberately NOT wired into deploy:prod: it needs a
 * grid with at least one product video and a pointer, which a preview URL
 * cannot always promise.
 */
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const argVal = (k) => {
  const i = args.indexOf(k);
  return i === -1 ? null : args[i + 1];
};
const URL_ARG =
  argVal('--url') || args.find((a) => /^https?:\/\//.test(a)) || null;
const TARGET = URL_ARG || 'http://localhost:3000/collections/all';
const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/* Desktop, because the bug is a hover bug and a phone has no pointer. */
const VIEWPORT = {width: 1440, height: 900};
/* Must stay under HOVER_INTENT_MS in ProductItem.jsx (180ms). This is the
   dwell the assertion is about: a tile the pointer crosses, not one it lands
   on. */
const MAX_DWELL_MS = 100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Installed before the sweep. Records layout shifts, how long the pointer
   actually spent on each card, and every class change on a preview video.
   All timestamps are performance.now().

   The dwell is measured in the page rather than in Node on purpose: a CDP
   mouse.move returns when the browser has processed it, and on a page that is
   already janking that round trip was measured at 554ms, which is the jank
   this script exists to catch rather than the dwell it wants to assert on. */
function instrument() {
  const state = {
    shifts: [],
    videoClassChanges: [],
    hovers: [],
    layout: [],
    startedAt: performance.now(),
  };
  window.__swsCardHover = state;

  /* Not `buffered: true`, and filtered by start time on top: shifts from the
     page's own load (lazy images settling) are not the hover's doing, and
     counting them would make this check cry wolf on every run. */
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      if (e.startTime < state.startedAt) continue;
      state.shifts.push({t: e.startTime, value: e.value, recentInput: e.hadRecentInput});
    }
  }).observe({type: 'layout-shift'});

  const cards = [...document.querySelectorAll('.product-item')];
  state.layout = cards.map((c, i) => ({
    i,
    left: c.offsetLeft,
    top: c.offsetTop,
    width: c.offsetWidth,
    height: c.offsetHeight,
  }));
  cards.forEach((c, i) => {
    c.dataset.swsCardIndex = String(i);
    c.addEventListener('mouseenter', () => state.hovers.push({i, t: performance.now(), in: true}));
    c.addEventListener('mouseleave', () => state.hovers.push({i, t: performance.now(), in: false}));
  });

  new MutationObserver((records) => {
    for (const r of records) {
      const el = r.target;
      if (!el.classList?.contains('product-item-video')) continue;
      state.videoClassChanges.push({
        t: performance.now(),
        attr: r.attributeName,
        i: Number(el.closest('.product-item')?.dataset.swsCardIndex ?? -1),
        active: el.classList.contains('is-active'),
        hasSrc: el.hasAttribute('src'),
      });
    }
  }).observe(document.body, {
    attributes: true,
    /* `src` as well as `class`: the hover promotes `data-src` to `src`, and
       that assignment is the moment a video download becomes possible. */
    attributeFilter: ['class', 'src'],
    subtree: true,
  });

  return {
    cards: cards.length,
    videos: document.querySelectorAll('.product-item-video').length,
    withSrc: document.querySelectorAll('.product-item-video[src]').length,
  };
}

/* Viewport-space centres of the cards whose CENTRE is on screen, so the sweep
   crosses tiles rather than empty space. Centre rather than the whole rect:
   requiring a fully visible card dropped a 4-up row to the 3 cards that
   cleared the header, and three tiles is a thin sweep. */
function cardCentres() {
  return [...document.querySelectorAll('.product-item')]
    .map((c) => c.getBoundingClientRect())
    .map((r) => ({x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: r.width}))
    .filter((p) => p.w > 0 && p.y > 0 && p.y < innerHeight)
    .map(({x, y}) => ({x, y}));
}

function readState() {
  const s = window.__swsCardHover;
  const cards = [...document.querySelectorAll('.product-item')];
  return {
    shifts: s.shifts,
    videoClassChanges: s.videoClassChanges,
    hovers: s.hovers,
    layoutBefore: s.layout,
    layoutAfter: cards.map((c, i) => ({
      i,
      left: c.offsetLeft,
      top: c.offsetTop,
      width: c.offsetWidth,
      height: c.offsetHeight,
    })),
    withSrc: document.querySelectorAll('.product-item-video[src]').length,
    activeNow: document.querySelectorAll('.product-item-video.is-active').length,
  };
}

/* The hover must not animate anything that repaints or reflows. */
function readStyles() {
  const card = document.querySelector('.product-item');
  if (!card) return null;
  const s = getComputedStyle(card);
  const after = getComputedStyle(card, '::after');
  return {
    transitionProperty: s.transitionProperty,
    willChange: s.willChange,
    transform: s.transform,
    overflow: s.overflow,
    afterTransitionProperty: after.transitionProperty,
    afterBoxShadow: after.boxShadow,
    afterOpacity: after.opacity,
  };
}

/* In-page: one entry per tile grid (a distinct parent of .product-item),
   each tile reduced to what a shopper can see: is it laid out, and is it what
   the pointer would hit at its own centre. Grid index is the order of first
   appearance, so before and after line up. */
function snapshotGrids() {
  const cards = [...document.querySelectorAll('.product-item')];
  const parents = [...new Set(cards.map((c) => c.parentElement))];
  return parents.map((parent, g) => {
    const tiles = [...parent.children].filter((e) => e.classList.contains('product-item'));
    return {
      g,
      parentClass: parent.className,
      childCount: parent.children.length,
      tiles: tiles.map((c, i) => {
        const r = c.getBoundingClientRect();
        const cs = getComputedStyle(c);
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        const onScreen = r.width > 0 && cx > 0 && cx < innerWidth && cy > 0 && cy < innerHeight;
        const hit = onScreen ? document.elementFromPoint(cx, cy) : null;
        return {
          i,
          title: (c.querySelector('.product-item-title')?.textContent || '').trim().slice(0, 40),
          shown: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0,
          onScreen,
          hit: hit ? c.contains(hit) : null,
        };
      }),
    };
  });
}

/* Scrolls grid `g` to the middle of the screen and returns the centre of its
   first tile, the worst case for the bug below (it hid every tile AFTER the
   one hovered). Null when the grid has fewer than two tiles. */
function prepareGrid(g) {
  const cards = [...document.querySelectorAll('.product-item')];
  const parent = [...new Set(cards.map((c) => c.parentElement))][g];
  const tiles = [...parent.children].filter((e) => e.classList.contains('product-item'));
  if (tiles.length < 2) return null;
  tiles[0].scrollIntoView({block: 'center'});
  const r = tiles[0].getBoundingClientRect();
  return {x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2)};
}

/* Why this exists (2026-10-18): hovering a homepage "New arrivals" tile
   made the OTHER tiles disappear, and this script was green the whole time.
   Three holes, all closed here:
   1. It only ever loaded /collections/all. The homepage grids are the only ones
      with a positional rule (.home-row--cap4 > :nth-child(n + 5)), so the one
      page that could fail was never opened. The origin's / is now always run.
   2. The sweep is too fast to trigger the bug. React Router's
      <Link prefetch="intent"> injects its <link rel="prefetch"> elements as
      SIBLINGS of the tile after ~100ms of hover, and a sweep leaves every tile
      sooner than that. Only a deliberate dwell inserts them, so the dwell has
      to be held for the full wait below.
   3. The old deliberate-hover control looked at src/is-active and never
      re-read a tile's box afterwards.
   Pass means: for every grid on the page, hover its first tile for real, wait
   out the prefetch, and every tile that was shown before is still shown, still
   has a size, and is what the pointer hits at its own centre. */
async function checkSiblingsSurvive(page, url) {
  const problems = [];
  const info = [];
  const res = await page.goto(url, {waitUntil: 'networkidle2', timeout: 60000});
  if (!res || res.status() !== 200) {
    problems.push(`${url} responded ${res?.status()}`);
    return {problems, info};
  }
  /* The homepage's first-visit offer is a full-screen scrim on production. It
     swallows pointer events, which would make every hover below land on it. */
  await page.$eval('.launch-offer-scrim', (b) => b.click()).catch(() => {});
  await sleep(1200);
  const grids = await page.evaluate(snapshotGrids);
  const multi = grids.filter((x) => x.tiles.length >= 2);
  info.push(`${url}: ${grids.length} tile grids, ${multi.length} with 2+ tiles`);
  if (!multi.length) {
    problems.push(`${url}: no grid with two or more tiles, nothing to hover`);
    return {problems, info};
  }
  for (const grid of multi.slice(0, 6)) {
    const pt = await page.evaluate(prepareGrid, grid.g);
    if (!pt) continue;
    await sleep(500);
    const before = (await page.evaluate(snapshotGrids))[grid.g];
    await page.mouse.move(2, 2);
    await page.mouse.move(pt.x, pt.y);
    /* Longer than the prefetch intent delay plus a React commit, with room. */
    await sleep(1500);
    const landed = await page.evaluate(
      (g) => {
        const cards = [...document.querySelectorAll('.product-item')];
        const parent = [...new Set(cards.map((c) => c.parentElement))][g];
        return [...parent.children].some((e) => e.classList.contains('product-item') && e.matches(':hover'));
      },
      grid.g,
    );
    if (!landed) {
      problems.push(`${url} grid ${grid.g} (${grid.parentClass}): the pointer never reached the first tile, so nothing was proved`);
      continue;
    }
    const after = (await page.evaluate(snapshotGrids))[grid.g];
    const lost = before.tiles.filter((t) => t.shown && !after.tiles[t.i]?.shown);
    const unhittable = before.tiles.filter(
      (t) => t.shown && t.onScreen && after.tiles[t.i]?.shown && after.tiles[t.i].onScreen && !after.tiles[t.i].hit,
    );
    const added = after.childCount - before.childCount;
    info.push(
      `${url} grid ${grid.g} (${grid.parentClass || 'no class'}): ${before.tiles.filter((t) => t.shown).length} tiles shown before, ${after.tiles.filter((t) => t.shown).length} after hover, +${added} sibling nodes`,
    );
    if (lost.length) {
      problems.push(
        `${url} grid ${grid.g} (${grid.parentClass}): hovering the first tile hid ${lost.length} other tile(s): ${lost.map((t) => `#${t.i} "${t.title}"`).join(', ')}. Sibling nodes added by the hover: ${added}. A positional selector (nth-child, :last-child, +) is counting them.`,
      );
    }
    if (unhittable.length) {
      problems.push(
        `${url} grid ${grid.g} (${grid.parentClass}): ${unhittable.length} tile(s) are laid out but something else covers their centre after the hover: ${unhittable.map((t) => `#${t.i}`).join(', ')}`,
      );
    }
    await page.mouse.move(2, 2);
    await sleep(300);
  }
  return {problems, info};
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
});
const fails = [];
const notes = [];
try {
  const page = await browser.newPage();
  await page.setViewport(VIEWPORT);
  const res = await page.goto(TARGET, {waitUntil: 'networkidle2', timeout: 60000});
  if (!res || res.status() !== 200) {
    fails.push(`${TARGET} responded ${res?.status()}`);
  } else {
    await page.waitForSelector('.product-item', {timeout: 20000});
    /* Settle lazy images first: a shift caused by the page still loading is
       not the hover's fault and would make this check lie. */
    await sleep(1200);

    const counts = await page.evaluate(instrument);
    notes.push(
      `${counts.cards} cards, ${counts.videos} preview videos, ${counts.withSrc} already carrying src`,
    );
    if (!counts.cards) fails.push('no .product-item on the page');

    /* ---- the fast sweep ---- */
    const centres = await page.evaluate(cardCentres);
    if (centres.length < 2) fails.push(`only ${centres.length} cards in view, nothing to sweep`);
    /* Throwaway first move: the first CDP input of a session carries the
       connection warm-up and would show up as one long dwell. */
    await page.mouse.move(2, 2);
    for (const pass of [centres, [...centres].reverse()]) {
      for (const p of pass) await page.mouse.move(p.x, p.y);
    }
    /* Off the grid, so the tile the sweep ended on does not become a
       deliberate hover while we wait, then wait out the intent delay and the
       fade so a late activation still gets recorded. */
    await page.mouse.move(2, 2);
    await sleep(800);

    const s = await page.evaluate(readState);

    const realShifts = s.shifts.filter((x) => x.value > 0);
    if (realShifts.length) {
      const total = realShifts.reduce((a, x) => a + x.value, 0);
      fails.push(
        `${realShifts.length} layout-shift entries, total ${total.toFixed(4)} (expected 0)`,
      );
    }

    /* Per card: how long the pointer actually sat on it. A card the sweep
       lingered on is a deliberate hover and is allowed to preview, so the
       assertion only covers cards every one of whose visits was quicker than
       MAX_DWELL_MS. */
    const dwellByCard = new Map();
    const open = new Map();
    for (const h of s.hovers) {
      if (h.in) open.set(h.i, h.t);
      else if (open.has(h.i)) {
        const list = dwellByCard.get(h.i) || [];
        list.push(h.t - open.get(h.i));
        dwellByCard.set(h.i, list);
        open.delete(h.i);
      }
    }
    const quick = [...dwellByCard.entries()].filter(([, d]) =>
      d.every((ms) => ms < MAX_DWELL_MS),
    );
    const worstQuick = Math.max(0, ...quick.flatMap(([, d]) => d));
    notes.push(
      `crossed ${dwellByCard.size} tiles, ${quick.length} of them in under ${MAX_DWELL_MS}ms every time (worst of those ${worstQuick.toFixed(0)}ms)`,
    );
    if (quick.length < 2) {
      fails.push(
        `the sweep proved nothing: only ${quick.length} tiles were crossed in under ${MAX_DWELL_MS}ms`,
      );
    }

    const quickIds = new Set(quick.map(([i]) => i));
    const activated = s.videoClassChanges.filter(
      (c) => c.attr === 'class' && c.active && quickIds.has(c.i),
    );
    if (activated.length) {
      fails.push(
        `${activated.length} preview videos reached .is-active on cards the pointer never held for ${MAX_DWELL_MS}ms (cards ${[...new Set(activated.map((a) => a.i))].join(', ')})`,
      );
    }
    const requested = s.videoClassChanges.filter(
      (c) => c.attr === 'src' && quickIds.has(c.i),
    );
    if (requested.length) {
      fails.push(
        `${requested.length} preview videos had src promoted on cards the pointer never held for ${MAX_DWELL_MS}ms: that is a video download per crossed tile`,
      );
    }
    notes.push(`${s.withSrc - counts.withSrc} clips requested in total across the sweep`);

    for (const b of s.layoutBefore) {
      const a = s.layoutAfter[b.i];
      if (!a) {
        fails.push(`card ${b.i} disappeared during the sweep`);
        continue;
      }
      for (const k of ['left', 'top', 'width', 'height']) {
        if (a[k] !== b[k]) {
          fails.push(`card ${b.i} layout ${k} moved ${b[k]} -> ${a[k]} (transform-free box must not change)`);
        }
      }
    }

    /* ---- style guards ---- */
    const st = await page.evaluate(readStyles);
    if (st) {
      const animated = st.transitionProperty.split(',').map((x) => x.trim());
      const banned = animated.filter(
        (p) =>
          /^(box-shadow|border-color|border|background|background-color|filter|backdrop-filter|all)$/.test(p) ||
          /^(width|height|top|left|right|bottom|margin|padding|font-size)/.test(p),
      );
      if (banned.length) {
        fails.push(
          `.product-item transitions ${banned.join(', ')}: a hover must animate transform/opacity only`,
        );
      }
      const promoted =
        /transform/.test(st.willChange) || /matrix3d|translate3d/.test(st.transform);
      if (!promoted) {
        fails.push(
          `.product-item is not promoted up front (will-change: ${st.willChange}, transform: ${st.transform}), so the hover creates and tears down a layer per card`,
        );
      }
      if (st.afterBoxShadow === 'none') {
        notes.push('note: .product-item::after carries no box-shadow, so the glow may have moved back onto the card');
      }
      if (st.overflow === 'hidden' && st.afterBoxShadow !== 'none') {
        fails.push(
          '.product-item has overflow: hidden, which clips the ::after glow: the hover shadow would be invisible',
        );
      }
    }

    /* ---- positive control: a deliberate hover still previews ---- */
    const target = await page.evaluate(() => {
      const v = document.querySelector('.product-item-video');
      if (!v) return null;
      const r = v.closest('.product-item').getBoundingClientRect();
      return {x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2)};
    });
    if (!target) {
      notes.push('note: no .product-item-video in view, the deliberate-hover control did not run');
    } else {
      await page.mouse.move(target.x, target.y);
      await sleep(2500);
      const after = await page.evaluate(() => ({
        withSrc: document.querySelectorAll('.product-item-video[src]').length,
        active: document.querySelectorAll('.product-item-video.is-active').length,
        readyState: document.querySelector('.product-item-video')?.readyState ?? -1,
      }));
      if (after.withSrc < 1) {
        fails.push(
          'a deliberate 2.5s hover never promoted the clip to src: the intent delay is not firing and the preview is dead',
        );
      } else if (!after.active) {
        notes.push(
          `note: the clip was requested but never faded in (readyState ${after.readyState}); on a cold cache that is the gate working, not a bug`,
        );
      } else {
        notes.push('deliberate hover: clip requested and faded in');
      }
    }
  }

  /* ---- every tile grid survives a deliberate hover ---- */
  const origin = new URL(TARGET).origin;
  for (const url of [...new Set([TARGET, `${origin}/`])]) {
    const r = await checkSiblingsSurvive(page, url);
    r.info.forEach((n) => notes.push(n));
    r.problems.forEach((f) => fails.push(f));
  }
} finally {
  await browser.close();
}

notes.forEach((n) => console.log(n));
fails.forEach((f) => console.log(`FAIL  ${f}`));
console.log(
  fails.length
    ? `\nCard hover check FAILED (${fails.length}).`
    : '\nCard hover check passed.',
);
process.exit(fails.length ? 1 : 0);
