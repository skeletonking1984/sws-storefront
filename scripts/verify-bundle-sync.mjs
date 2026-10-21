import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
const origin = process.argv[2];
const outDir = process.argv[3];
const tag = process.argv[4] || 'local';
fs.mkdirSync(outDir, {recursive: true});
const exe = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const rec = (name, pass, detail) => { results.push({name, pass, detail}); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };
const PICKS = [/candy jar/i, /^multi.?stream chat widget/i, /ghost alert/i];
const b = await puppeteer.launch({executablePath: exe, headless: 'new'});

async function run(vpName, vp) {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport(vp);
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
  p.on('response', (r) => { if (r.status() >= 500 && r.url().startsWith(origin)) errs.push(`HTTP ${r.status()} ${r.url()}`); });
  p.on('dialog', (d) => d.accept());
  let step = 0;
  const shot = async (n) => { step++; await p.screenshot({path: `${outDir}/${tag}-${vpName}-${String(step).padStart(2, '0')}-${n}.png`}); };
  const cart = async () => p.evaluate(async () => {
    const j = await (await fetch('/api/v', {cache: 'no-store'})).json();
    const lines = j.cart?.lines?.nodes ?? [];
    const isB = (l) => (l.attributes || []).some((a) => a.key === '_bundle');
    const b = lines.filter(isB), o = lines.filter((l) => !isB(l));
    const sum = (ls, k) => ls.reduce((s, l) => s + Number(l.cost?.[k]?.amount ?? 0), 0);
    return {
      bLines: b.length, bQty: b.reduce((s, l) => s + l.quantity, 0),
      oLines: o.length, oQty: o.reduce((s, l) => s + l.quantity, 0),
      oIds: o.map((l) => l.merchandise.id).join(','),
      bTotal: +sum(b, 'totalAmount').toFixed(2),
      bList: +b.reduce((s, l) => s + Number(l.cost?.amountPerQuantity?.amount ?? 0) * l.quantity, 0).toFixed(2),
    };
  });
  const bodyHas = async (re) => p.evaluate((src) => new RegExp(src, 'i').test(document.body.innerText), re.source);
  const no500 = async () => !(await bodyHas(/Oops|Cannot read properties/));
  const cards = async () => p.$$eval('button.bb-card', (bs) => bs.map((b, i) => ({i, name: b.querySelector('.bb-name')?.textContent || '', on: b.classList.contains('on'), dis: b.disabled})));
  const clickCard = async (i) => { await p.evaluate((i) => document.querySelectorAll('button.bb-card')[i].click(), i); await sleep(150); };
  const pickN = async (n) => {
    // picks PICKS first, then the next unselected cards, until n are on
    let cs = await cards();
    for (const re of PICKS) { const c = cs.find((c) => re.test(c.name)); if (c && !c.on && cs.filter((c) => c.on).length < n) await clickCard(c.i); cs = await cards(); }
    for (const c of cs) { if (cs.filter((c) => c.on).length >= n) break; if (!c.on && !c.dis) { await clickCard(c.i); cs = await cards(); } }
    return (await cards()).filter((c) => c.on).length;
  };
  const addKit = async () => {
    const sel = vp.width < 700 ? '.bb-sticky button[type=submit]' : '.bb-add button[type=submit]';
    await p.evaluate((sel) => document.querySelector(sel).click(), sel);
    await sleep(800);
    for (let i = 0; i < 40; i++) { const t = await p.$eval(sel, (b) => b.textContent); if (/In (your )?cart/.test(t)) break; await sleep(300); }
    await sleep(1500);
  };
  const pageKit = async () => p.evaluate(() => { const m = document.querySelector('.bb-add button')?.textContent.match(/\$([\d.,]+)/); return m ? Number(m[1].replace(',', '')) : null; });
  const noteText = async () => p.evaluate(() => document.querySelector('.bb-cart-note')?.innerText.split('\n')[0] ?? '');
  const closeCart = async () => { await p.keyboard.press('Escape'); await sleep(400); };

  // 0. non-bundle item via PDP
  await p.goto(origin + '/products/celestial-stream-kit', {waitUntil: 'networkidle2', timeout: 60000});
  await p.evaluate(() => [...document.querySelectorAll('button.add-to-cart-button')].find((b) => !b.disabled)?.click());
  for (let i = 0; i < 30; i++) { const c = await cart(); if (c.oLines >= 1) break; await sleep(500); }
  let c = await cart(); const other = c.oIds;
  await shot('pdp-non-bundle-added');
  rec(`${vpName}: non-bundle item added from PDP`, c.oLines === 1 && c.bLines === 0, JSON.stringify(c));

  await p.goto(origin + '/bundle', {waitUntil: 'networkidle2', timeout: 60000}); await sleep(1500);
  await shot('bundle-loaded');
  rec(`${vpName}: /bundle loads, no 500`, await no500());

  const tiers = vpName === 'desktop' ? [[3, 25], [6, 35], [9, 45]] : [[3, 25], [6, 35]];
  for (const [n, pct] of tiers) {
    await pickN(n); await shot(`picked-${n}`);
    const kitPrice = await pageKit();
    await addKit(); c = await cart(); const note = await noteText();
    await shot(`added-${n}`);
    rec(`${vpName}: Add kit ${n} -> exactly ${n} bundle units, non-bundle untouched`, c.bQty === n && c.bLines === n && c.oLines === 1 && c.oIds === other, JSON.stringify(c));
    const expPct = Math.round((1 - c.bTotal / c.bList) * 100);
    rec(`${vpName}: tier ${n} = ${pct}% (cart note + Shopify line prices)`, note.includes(`${n} widgets`) && note.includes(`${pct}% off`) && Math.abs(expPct - pct) <= 1, `note="${note}" shopify=${expPct}% total=$${c.bTotal} list=$${c.bList}`);
    if (vpName === 'desktop') rec(`${vpName}: page kit price matches cart (tier ${n})`, kitPrice !== null && Math.abs(kitPrice - c.bTotal) <= 0.02, `page=$${kitPrice} cart=$${c.bTotal}`);
    await closeCart();
    await addKit(); c = await cart();
    rec(`${vpName}: Add kit again at ${n} -> still ${n} (no duplicate)`, c.bQty === n && c.bLines === n && c.oLines === 1, JSON.stringify(c));
    await closeCart();
  }
  const top = tiers[tiers.length - 1][0];

  // reload keeps cart + selection
  await p.reload({waitUntil: 'networkidle2'}); await sleep(2500);
  c = await cart(); const onCount = (await cards()).filter((x) => x.on).length;
  const btn = await p.$eval(vp.width < 700 ? '.bb-sticky button[type=submit]' : '.bb-add button[type=submit]', (b) => b.textContent);
  await shot('reloaded');
  rec(`${vpName}: reload keeps cart and shows picks as in cart`, c.bQty === top && c.oLines === 1 && onCount === top && /In (your )?cart/.test(btn), `cart=${JSON.stringify(c)} selected=${onCount} button="${btn}"`);

  if (vpName === 'desktop') {
    // switch down tier: 9 -> 6 by unselecting 3, Add kit
    let cs = await cards(); const ons = cs.filter((x) => x.on).slice(-3);
    for (const o of ons) await clickCard(o.i);
    await addKit(); c = await cart(); let note = await noteText(); await shot('switched-9-to-6');
    rec(`desktop: switch 9 -> 6 replaces bundle (6 units, 35%)`, c.bQty === 6 && c.bLines === 6 && c.oLines === 1 && note.includes('35% off'), `${JSON.stringify(c)} note="${note}"`);

    // + on a bundle line: 6 -> 7 units, still 35% in Shopify
    await p.evaluate(() => { const li = [...document.querySelectorAll('.cart-line')].filter((l) => !/Celestial Stream Kit/i.test(l.innerText))[0]; li?.querySelector('button[name=increase-quantity]')?.click(); });
    for (let i = 0; i < 30; i++) { c = await cart(); if (c.bQty === 7) break; await sleep(500); }
    await sleep(1500); note = await noteText(); await shot('plus-on-bundle-line');
    const pctPlus = Math.round((1 - c.bTotal / c.bList) * 100);
    rec(`desktop: + on a bundle line works, discount still right`, c.bQty === 7 && c.bLines === 6 && Math.abs(pctPlus - 35) <= 1 && note.includes('7 widgets') && note.includes('35% off'), `${JSON.stringify(c)} shopify=${pctPlus}% note="${note}"`);

    // remove a single line
    await p.evaluate(() => { const li = [...document.querySelectorAll('.cart-line')].filter((l) => !/Celestial Stream Kit/i.test(l.innerText))[1]; li?.querySelector('.cart-remove-btn')?.click(); });
    for (let i = 0; i < 30; i++) { c = await cart(); if (c.bLines === 5) break; await sleep(500); }
    await sleep(1500); note = await noteText(); await shot('removed-one-line');
    rec(`desktop: remove a single line from cart`, c.bLines === 5 && c.bQty === 6 && c.oLines === 1, `${JSON.stringify(c)} note="${note}"`);
    await closeCart();

    // clear selection
    await p.evaluate(() => document.querySelector('.bb-clear')?.click()); await sleep(500);
    const sel = (await cards()).filter((x) => x.on).length; c = await cart(); await shot('cleared-selection');
    rec(`desktop: Clear selection empties picks, cart untouched`, sel === 0 && c.bLines === 5 && c.oLines === 1, `selected=${sel} ${JSON.stringify(c)}`);
  }

  // Clear cart from drawer
  await p.evaluate(() => document.querySelector('.header-cart, [href="/cart"]')?.click()); await sleep(1200);
  const hasClear = await p.evaluate(() => !!document.querySelector('.cart-clear'));
  await p.evaluate(() => document.querySelector('.cart-clear')?.click());
  for (let i = 0; i < 30; i++) { c = await cart(); if (c.bLines + c.oLines === 0) break; await sleep(500); }
  await sleep(1200); await shot('cleared-cart');
  rec(`${vpName}: Clear cart empties the cart`, hasClear && c.bLines + c.oLines === 0, JSON.stringify(c));

  rec(`${vpName}: no 500, no page/console errors`, (await no500()) && errs.length === 0, errs.slice(0, 5).join(' | '));
  await ctx.close();
}
await run('desktop', {width: 1440, height: 900});
await run('mobile', {width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2});
await b.close();
fs.writeFileSync(`${outDir}/${tag}-results.json`, JSON.stringify(results, null, 1));
const fails = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);
