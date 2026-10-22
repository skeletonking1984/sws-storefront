/**
 * Is the mobile Buy now / Add to cart bar actually pinned to the bottom of the screen?
 *
 * Why, 2026-10-03. fd498d3 (2026-09-27) reordered backdrop-filter so the
 * minifier finally kept the blur in Chrome. The blur landed on the PDP buy
 * card, and a backdrop-filter (or transform, filter, contain, perspective,
 * will-change) on any ancestor makes that ancestor the containing block for
 * position: fixed. The bar still computed `position: fixed; bottom: 0`, so
 * every static check and smoke:pdp (served HTML only) passed, while on a real
 * phone the button pinned to the bottom of the card and scrolled away. It
 * stayed broken for six days until it was spotted on a phone.
 *
 * So this check renders the page in a real browser at phone size and measures
 * where the button IS, never what its CSS says:
 *   1. its rect bottom equals the viewport bottom at four scroll positions
 *   2. it spans the full viewport width
 *   3. elementFromPoint at its centre returns the button (nothing covers it)
 *   4. no ancestor creates a containing block for fixed elements
 *   5. its z-index stays below the cart drawer (.overlay), the 2026-09-14
 *      bug where the bar covered "Continue to Checkout"
 * and on desktop width that the button is NOT fixed.
 *
 * It never clicks Add to cart, so it is safe against production.
 *
 * Usage:
 *   node scripts/verify-mobile-cart-bar.mjs                     # production
 *   node scripts/verify-mobile-cart-bar.mjs --origin http://localhost:3199
 *   node scripts/verify-mobile-cart-bar.mjs --self-test         # must catch the bug
 *
 * Exits 1 on any failure, so it gates `npm run deploy:prod`.
 */
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const argVal = (k) => {
  const i = args.indexOf(k);
  return i === -1 ? null : args[i + 1];
};
const ORIGIN = (argVal('--origin') || 'https://streamwidgetshop.com').replace(/\/$/, '');
const SELF_TEST = args.includes('--self-test');
const CHROME =
  process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/* One single-variant product and the top sellers, same set as smoke:pdp. */
const HANDLES = (argVal('--handles') || [
  'celestial-stream-kit',
  'multistream-chat-widget-twitch-youtube-kick-overlay-digital-download-easy-setup-one-click-installation',
  'sakura-petal-butterfly-glass-transparent-chat-and-goal-stream-widgets-minimal-elegant-glass-theme-clean-vibe-streamelement-only',
].join(',')).split(',');

const PHONE = {width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true};
const DESKTOP = {width: 1280, height: 900};

/* Runs in the page. Returns a list of failure strings. */
async function measurePhone() {
  const fails = [];
  // Since Buy now (2026-10-22) the fixed bar is the .product-buy-actions row
  // holding Buy now and Add to cart, not the lone Add to cart button.
  const b = document.querySelector('.product-buy-actions');
  if (!b) return ['no .product-buy-actions bar on the page'];
  if (!b.querySelector('.add-to-cart-button')) return ['no .add-to-cart-button in the bar'];
  const vh = innerHeight;
  const vw = document.documentElement.clientWidth;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const maxY = document.documentElement.scrollHeight - vh;
  for (const y of [0, Math.round(maxY / 3), Math.round((2 * maxY) / 3), maxY]) {
    scrollTo(0, y);
    await sleep(200);
    const r = b.getBoundingClientRect();
    if (Math.abs(r.bottom - vh) > 1) {
      fails.push(`at scrollY ${y} the button bottom is ${Math.round(r.bottom)}, viewport bottom is ${vh}: not pinned`);
      break;
    }
  }
  const r = b.getBoundingClientRect();
  if (Math.abs(r.width - vw) > 1) {
    fails.push(`button is ${Math.round(r.width)}px wide, viewport is ${vw}px`);
  }
  for (const btn of b.querySelectorAll('button')) {
    const br = btn.getBoundingClientRect();
    const hit = document.elementFromPoint(br.x + br.width / 2, br.y + br.height / 2);
    if (!hit || !btn.contains(hit)) {
      fails.push(`centre of ${btn.className} hits ${hit ? hit.tagName + '.' + hit.className : 'nothing'}, not the button`);
    }
  }
  for (let e = b.parentElement; e && e !== document.documentElement; e = e.parentElement) {
    const s = getComputedStyle(e);
    const why = [
      s.transform !== 'none' && `transform ${s.transform}`,
      s.filter !== 'none' && `filter ${s.filter}`,
      s.backdropFilter && s.backdropFilter !== 'none' && `backdrop-filter ${s.backdropFilter}`,
      s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none' && `-webkit-backdrop-filter ${s.webkitBackdropFilter}`,
      s.perspective !== 'none' && `perspective ${s.perspective}`,
      /paint|layout|strict|content/.test(s.contain) && `contain ${s.contain}`,
      /transform|filter|perspective/.test(s.willChange) && `will-change ${s.willChange}`,
      s.containerType && s.containerType !== 'normal' && `container-type ${s.containerType}`,
    ].filter(Boolean);
    if (why.length) {
      fails.push(`ancestor <${e.tagName.toLowerCase()} class="${e.className}"> traps position:fixed: ${why.join(', ')}`);
    }
  }
  const bz = Number(getComputedStyle(b).zIndex) || 0;
  for (const o of document.querySelectorAll('.overlay')) {
    const oz = Number(getComputedStyle(o).zIndex) || 0;
    if (bz >= oz) {
      fails.push(`button z-index ${bz} is not below .overlay z-index ${oz}: it would cover the cart drawer's checkout link`);
      break;
    }
  }
  return fails;
}

async function measureDesktop() {
  const b = document.querySelector('.product-buy-actions');
  if (!b) return ['no .product-buy-actions bar on the page'];
  return [b, ...b.querySelectorAll('button')].some((e) => getComputedStyle(e).position === 'fixed')
    ? ['buy actions are position:fixed on desktop width']
    : [];
}

/* The exact bug from fd498d3, re-applied in the page. */
const BREAK_IT =
  '.product-main{-webkit-backdrop-filter:blur(14px)!important;backdrop-filter:blur(14px)!important}';

async function checkHandle(browser, handle, {inject} = {}) {
  const url = `${ORIGIN}/products/${handle}`;
  const out = [];
  const page = await browser.newPage();
  try {
    await page.setViewport(PHONE);
    const res = await page.goto(url, {waitUntil: 'networkidle2', timeout: 45000});
    if (!res || res.status() !== 200) return [`${handle}: responded ${res?.status()}`];
    await page.waitForSelector('.product-buy-actions', {timeout: 15000}).catch(() => {});
    if (inject) await page.addStyleTag({content: inject});
    for (const f of await page.evaluate(measurePhone)) out.push(`${handle} [phone]: ${f}`);
    await page.setViewport(DESKTOP);
    await new Promise((r) => setTimeout(r, 300));
    for (const f of await page.evaluate(measureDesktop)) out.push(`${handle} [desktop]: ${f}`);
  } finally {
    await page.close();
  }
  return out;
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
});
let failed = false;
try {
  if (SELF_TEST) {
    const handle = HANDLES[HANDLES.length - 1];
    const clean = await checkHandle(browser, handle);
    const broken = await checkHandle(browser, handle, {inject: BREAK_IT});
    console.log(`clean page: ${clean.length ? 'FAIL\n  ' + clean.join('\n  ') : 'pass'}`);
    console.log(`with the fd498d3 bug re-applied: ${broken.length ? 'caught (' + broken.length + ' findings)' : 'NOT CAUGHT'}`);
    broken.forEach((f) => console.log('  ' + f));
    failed = clean.length > 0 || broken.length === 0;
  } else {
    for (const h of HANDLES) {
      const f = await checkHandle(browser, h);
      console.log(`${f.length ? 'FAIL' : 'pass'}  ${h}`);
      f.forEach((x) => console.log('  ' + x));
      if (f.length) failed = true;
    }
  }
} finally {
  await browser.close();
}
console.log(failed ? '\nMobile cart bar check FAILED.' : '\nMobile cart bar check passed.');
process.exit(failed ? 1 : 0);
