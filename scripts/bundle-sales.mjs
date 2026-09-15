/**
 * Bundle watch: are the three kits actually selling?
 *
 * Todd, 2026-09-15: "we gotta watch sales on these, if low/no sales, we need to
 * try different bundles or adjust." This is the measurement half of that, so
 * the decision is made against a number rather than a feeling.
 *
 * It reports each kit's units and revenue over a window, next to the SINGLE
 * widgets that kit is made of. That comparison is the point. The singles sell
 * fine, so "the bundles are not selling" is never a statement about demand for
 * the widgets, it is a statement about the bundle as an offer, and only the
 * side-by-side shows that.
 *
 * Etsy only, deliberately. Shopify bundle orders were zero at the baseline and
 * Shopify order history needs the Admin API, which these scripts do not have
 * (they hold a read-only Storefront token). Etsy is where essentially all the
 * volume is, so an Etsy number is the decision-grade one. Check Shopify by hand
 * in Admin, or through the Shopify MCP, before concluding anything about it.
 *
 * Usage:
 *   ETSY_PACKAGE_ROOT=../sws-etsy-mcp node scripts/bundle-sales.mjs
 *   ETSY_PACKAGE_ROOT=../sws-etsy-mcp node scripts/bundle-sales.mjs --days 30
 *   ETSY_PACKAGE_ROOT=../sws-etsy-mcp node scripts/bundle-sales.mjs --json
 *
 * WITHOUT ETSY_PACKAGE_ROOT the shared client resolves its .env and token file
 * from process.cwd() and dies with a misleading "Not authorized yet", which is
 * a lie about auth and a truth about paths. Same trap as audit-ip-risk.mjs.
 */
import {productRevenue} from '../../sws-etsy-mcp/dist/api.js';

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const days = Number(argv[argv.indexOf('--days') + 1]) || 30;

/**
 * The three kits and the listings each is assembled from.
 *
 * Component ids come from each bundle's components.json under
 * products/bundles/<slug>/. They are duplicated here on purpose: this script
 * lives in a different repo from those manifests and should not reach across
 * into a sibling checkout to run. If a kit's contents change, update both.
 */
const KITS = [
  {
    name: 'Spooky Stream Kit',
    listingId: 4570446087,
    shopifyHandle: 'spooky-stream-kit',
    note: 'seasonal, offer ends 31 Oct 2026',
    components: [4358908164, 4362041097, 4563233208, 4498126600, 1785478023, 1747633766, 1797449100],
  },
  {
    name: 'Celestial Stream Kit',
    listingId: null, // no Etsy listing exists for this one
    shopifyHandle: 'celestial-stream-kit',
    note: 'Shopify only, no Etsy listing',
    components: [1790018033, 4551047317, 1707756402, 1728594513, 4336744223, 4336740821, 4322617816, 4361409311, 4348440142],
  },
  {
    name: 'Multistream Chat Widget Pack',
    listingId: 4570739034,
    shopifyHandle: 'multistream-chat-widget-pack',
    components: [4536576701, 4563220365, 4563217939, 4563219287, 4563221543, 4563215553, 4548547541, 4548549876, 4548554250, 4548545907],
  },
];

const data = await productRevenue({days});
const byId = new Map(data.products.map((p) => [p.listing_id, p]));
const money = (n) => `$${n.toFixed(2)}`;

const report = KITS.map((kit) => {
  const row = kit.listingId ? byId.get(kit.listingId) : null;
  const comps = kit.components
    .map((id) => byId.get(id))
    .filter(Boolean);
  return {
    name: kit.name,
    note: kit.note,
    listingId: kit.listingId,
    kitUnits: row?.units ?? 0,
    kitRevenue: row?.revenue ?? 0,
    componentsSold: comps.length,
    componentsTotal: kit.components.length,
    componentUnits: comps.reduce((s, c) => s + c.units, 0),
    componentRevenue: comps.reduce((s, c) => s + c.revenue, 0),
  };
});

if (asJson) {
  console.log(JSON.stringify({days, shopUnits: data.total_units, shopRevenue: data.total_revenue, kits: report}, null, 2));
  process.exit(0);
}

console.log(`Etsy, last ${days} days. Shop total ${data.total_units} units, ${money(data.total_revenue)}.\n`);

let kitUnits = 0;
for (const r of report) {
  kitUnits += r.kitUnits;
  console.log(r.name + (r.note ? `  (${r.note})` : ''));
  if (r.listingId === null) {
    console.log('  kit:        no Etsy listing, cannot be measured here');
  } else {
    console.log(`  kit:        ${r.kitUnits} units, ${money(r.kitRevenue)}`);
  }
  console.log(
    `  its parts:  ${r.componentUnits} units, ${money(r.componentRevenue)} ` +
      `across ${r.componentsSold}/${r.componentsTotal} components that sold at all`,
  );
  if (r.componentUnits > 0) {
    const ratio = r.kitUnits / r.componentUnits;
    console.log(`  kit is ${(ratio * 100).toFixed(1)}% of its own parts' unit volume`);
  }
  console.log();
}

const share = data.total_units ? (kitUnits / data.total_units) * 100 : 0;
console.log(`All kits: ${kitUnits} units, ${share.toFixed(2)}% of shop units.`);
console.log(
  '\nRead it against the parts, not against zero. These widgets sell well on\n' +
    'their own, so a kit selling nothing is evidence about the OFFER (price,\n' +
    'anchor, discoverability, whether anyone wants a bundle at all), not about\n' +
    'whether people want the widgets.',
);
