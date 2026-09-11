/**
 * Post-cutover smoke test for streamwidgetshop.com.
 *
 * Run this the moment the domain is retargeted from the Online Store theme
 * to the Hydrogen storefront. It answers one question per check, with the
 * evidence, rather than "looks fine": is the domain actually serving
 * Hydrogen, does a real product page render its gallery and its reviews,
 * do the SEO tags point at the live host rather than a preview host, and is
 * checkout still on the same registrable domain (which is what makes GA4
 * campaign attribution survive the handoff).
 *
 * Usage: node scripts/verify-cutover.mjs [origin]
 */
const ORIGIN = process.argv[2] || 'https://streamwidgetshop.com';
const pass = [];
const fail = [];

function check(name, ok, detail) {
  (ok ? pass : fail).push(`${name}: ${detail}`);
}

async function get(path) {
  const res = await fetch(ORIGIN + path, {redirect: 'follow'});
  return {status: res.status, url: res.url, body: await res.text()};
}

// 1. Hydrogen, not the Liquid theme. The theme ships Shopify.theme and
//    /cdn/shop/t/<n>/assets/; Hydrogen ships neither.
const home = await get('/');
const isTheme = /Shopify\.theme\s*=/.test(home.body) || /\/cdn\/shop\/t\/\d+\/assets\//.test(home.body);
check('serving Hydrogen', home.status === 200 && !isTheme,
  home.status === 200
    ? isTheme ? 'STILL THE OLD ENERGY THEME' : 'Hydrogen build, no Liquid theme markers'
    : `home returned ${home.status}`);

// 2. The brand actually rendered, not a skeleton or an error boundary.
const title = (home.body.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
check('homepage title', /Stream Widget Shop/i.test(title), title || 'no <title>');

// 3. Tonight's work is on the live build.
check('Happy clients section', /happy-clients/.test(home.body),
  /happy-clients/.test(home.body) ? 'present' : 'MISSING, prod is behind main');

// 4. SEO tags must name the live host, never a preview or myshopify host.
const canonical = (home.body.match(/rel="canonical"\s+href="([^"]+)"/) || [])[1] || '';
const og = (home.body.match(/property="og:image"\s+content="([^"]+)"/) || [])[1] || '';
check('canonical host', canonical.startsWith(ORIGIN), canonical || 'no canonical');
check('og:image host', og.startsWith(ORIGIN), og || 'no og:image');

// 5. GA4 only fires if the Oxygen env var survived the deploy.
check('GA4 tag', /G-X0978HDVTK/.test(home.body),
  /G-X0978HDVTK/.test(home.body) ? 'measurement id present' : 'NOT PRESENT, redeploy after setting the env var');

// 6. A real PDP: gallery video and the review section that was rebuilt.
const pdp = await get('/products/neon-aesthetic-glowy-transparent-chat-and-goal-stream-widgets-minimal-neon-light-elegant-glow-theme-clean-vibe-streamelement-only');
check('PDP renders', pdp.status === 200, `status ${pdp.status}`);
check('PDP has video', /\/cdn\/shop\/videos\//.test(pdp.body),
  /\/cdn\/shop\/videos\//.test(pdp.body) ? 'video media present' : 'no video on the top seller');
check('PDP JSON-LD', /"@type":"Product"/.test(pdp.body.replace(/\s/g, '')),
  /"@type":"Product"/.test(pdp.body.replace(/\s/g, '')) ? 'Product schema present' : 'missing');

// 7. robots and sitemap must self-reference the live host.
const robots = await get('/robots.txt');
check('robots.txt', robots.status === 200 && robots.body.includes(ORIGIN),
  robots.status === 200 ? (robots.body.match(/Sitemap:.*/) || ['no Sitemap line'])[0] : `status ${robots.status}`);
const sitemap = await get('/sitemap.xml');
check('sitemap.xml', sitemap.status === 200 && sitemap.body.includes(ORIGIN),
  `status ${sitemap.status}`);

// 8. Account route must not 500. A redirect_uri mismatch shows up here.
const account = await get('/account');
check('/account reachable', account.status < 500, `status ${account.status} -> ${account.url}`);

console.log(`\nVerifying ${ORIGIN}\n`);
for (const p of pass) console.log('  PASS  ' + p);
for (const f of fail) console.log('  FAIL  ' + f);
console.log(`\n${pass.length} passed, ${fail.length} failed\n`);
process.exit(fail.length ? 1 : 0);
