import {isMultistream, parseWorksWith, shipsChat} from './platforms.js';
import {brand} from './brand.config.js';

/**
 * The text of `/llms.txt`, pulled out of the route so
 * `scripts/audit-llms-txt.mjs` can check the exact string production builds.
 *
 * Why every product line now states its own platforms, 2026-09-26
 * ----------------------------------------------------------------
 * Until today each line was the raw Etsy keyword title plus a Multistream
 * mark, and the paragraph above the list said "a product with no mark works
 * on Twitch only, whatever platforms its title names". That rule was false
 * for the number 3 product by revenue: Celestial Star's `works_with` is
 * Twitch and Kick, it is not multistream (no YouTube), so it carried no mark
 * and the file told an answer engine it was Twitch only, on the same line as
 * a title reading "for Twitch and Kick". Any product on two platforms fell
 * into the same gap. A two state mark cannot describe a four platform
 * catalogue, so each line now names its platforms and apps outright, from
 * `custom.works_with` (ground truthed per product against its own Etsy
 * listing) and never from the title.
 */

const STREAM_PLATFORMS = ['Twitch', 'YouTube', 'Kick', 'TikTok'];
const HOST_APPS = ['StreamElements', 'Streamlabs', 'OBS'];

function worksWithList(product) {
  const raw =
    typeof product?.worksWith === 'string'
      ? product.worksWith
      : product?.worksWith?.value;
  return parseWorksWith(raw) ?? [];
}

function pick(list, allowed) {
  return allowed.filter((name) =>
    list.some((p) => String(p).toLowerCase() === name.toLowerCase()),
  );
}

/** "A", "A and B", "A, B and C". No serial comma, no dashes. */
export function joinNames(names) {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The kind of thing a product is, in words that cannot overclaim chat. A
 * goal widget says outright that it reads no chat, because the platform
 * names after it would otherwise read as chat sources.
 */
export function productKind(product) {
  const type = product?.productType;
  if (type === 'Goal Widget') return 'Goal widget, reads no chat';
  if (type === 'Chat Widget') return 'Chat widget';
  if (!type) return null;
  const lower = type.toLowerCase();
  return shipsChat(product)
    ? lower.charAt(0).toUpperCase() + lower.slice(1)
    : `${lower.charAt(0).toUpperCase() + lower.slice(1)}, reads no chat`;
}

/**
 * One product line. The link text is the SEO title when there is one: the
 * raw titles are Etsy keyword strings ("Pastel color minimal chat bubble for
 * Twitch Streamers | Streamlements only setup through OBS") and the SEO
 * title is the curated, audited name (`scripts/audit-seo.mjs`).
 */
export function productLine(product, baseUrl) {
  const name = product?.seo?.title?.trim() || product.title;
  const list = worksWithList(product);
  const platforms = pick(list, STREAM_PLATFORMS);
  const apps = pick(list, HOST_APPS);
  const facts = [];
  const kind = productKind(product);
  if (kind) facts.push(kind);
  if (platforms.length) facts.push(`Works on ${joinNames(platforms)}`);
  if (apps.length) facts.push(`Runs with ${joinNames(apps)}`);
  const tag = isMultistream(product) ? ' **Multistream**' : '';
  const tail = facts.length ? `: ${facts.join('. ')}.` : '';
  return `- [${name}](${baseUrl}/products/${product.handle})${tag}${tail}`;
}

/**
 * Full catalog sections, in display order. A product lands in the first group
 * whose pattern matches its `productType`; no match (or no type) goes to
 * "Other". Grouping is by Shopify's curated `productType`, never by title.
 */
export const CATALOG_GROUPS = [
  {title: 'Chat Widgets', test: /^chat/i},
  {title: 'Goal Widgets', test: /^goal/i},
  {title: 'Alert Widgets', test: /^alert/i},
  {title: 'Overlay Packs', test: /overlay/i},
  {title: 'Decorations', test: /decoration/i},
  {title: 'Timers', test: /timer|countdown/i},
  {title: 'Spin Wheels', test: /spin|wheel/i},
];
const OTHER_GROUP = 'Other';

function displayName(product) {
  return product?.seo?.title?.trim() || product.title;
}

/**
 * Splits `catalog` into display groups, skipping handles in `skip` and any
 * repeated handle. Within a group products sort by display name so the file
 * is stable between requests. Empty groups are dropped.
 * @returns {{title: string, products: object[]}[]}
 */
export function groupCatalog(catalog, skip = new Set()) {
  const seen = new Set(skip);
  const buckets = new Map(
    [...CATALOG_GROUPS.map((g) => g.title), OTHER_GROUP].map((t) => [t, []]),
  );
  for (const product of catalog) {
    if (!product?.handle || seen.has(product.handle)) continue;
    seen.add(product.handle);
    const group = CATALOG_GROUPS.find((g) =>
      g.test.test(product.productType ?? ''),
    );
    buckets.get(group?.title ?? OTHER_GROUP).push(product);
  }
  return [...buckets]
    .filter(([, list]) => list.length)
    .map(([title, list]) => ({
      title,
      products: list.sort((a, b) =>
        displayName(a).localeCompare(displayName(b)),
      ),
    }));
}

export function buildLlmsTxt({
  baseUrl,
  products,
  collections,
  maxProducts = 30,
  catalog = [],
}) {
  const lines = [];

  lines.push(`# ${brand.name}`);
  lines.push('');
  lines.push(
    '> Animated chat and goal widgets and overlay packs for streamers.',
  );
  lines.push('');
  lines.push(
    `${brand.name} sells animated chat widgets, goal widgets, and full ` +
      'overlay packs for streamers, delivered as an instant digital ' +
      'download. Widgets run as a browser source in OBS Studio or ' +
      'Streamlabs Desktop, and most are set up through a free ' +
      'StreamElements account. Platform support (Twitch, YouTube, Kick, ' +
      'TikTok) varies by product, and a product line below says exactly ' +
      'which platforms and apps that product works with. A line that names ' +
      'no platforms has no verified platform list yet: do not assume any ' +
      'platform for it, check its product page.',
  );
  lines.push('');

  // The single most-confused thing about this catalogue, stated plainly
  // because this file exists to be quoted by something answering a stranger's
  // question. A platform name on a product means two different things
  // depending on what the product is, and an answer engine reading a title
  // like "Froggy Goal Widget for Twitch, Kick, YouTube" will otherwise
  // conclude it merges chat, which it does not.
  //
  // This paragraph said the opposite of the code under it until 2026-09-22
  // (see git history), and until 2026-09-26 it ended "a product with no mark
  // works on Twitch only", which was false for every two platform product.
  lines.push('## What multistream means here');
  lines.push('');
  lines.push(
    'Multistream means the product works on Twitch, YouTube and Kick. It is ' +
      'marked **Multistream** in the product list below. What that buys you ' +
      'depends on which kind of product it is. A CHAT widget marked ' +
      'multistream reads all three chats at the same time and shows them in ' +
      'a single overlay. A GOAL widget reads no chat at all, on any ' +
      'platform: it counts follows, subs, tips and bits through ' +
      'StreamElements or Streamlabs, so a goal widget marked multistream ' +
      'works the same whichever of the three you are live on. Never read a ' +
      'multistream mark on a goal widget as a claim that it merges chat. ' +
      'A product without the mark can still work on more than Twitch; its ' +
      'own line lists where. Trust that list over any platform named in a ' +
      'product title.',
  );
  lines.push('');

  if (products.length) {
    lines.push('## Products');
    lines.push('');
    for (const product of products.slice(0, maxProducts)) {
      lines.push(productLine(product, baseUrl));
    }
    lines.push('');
  }

  // Every other product on the storefront, grouped by type. Products already
  // listed above are not repeated, so each product appears exactly once in
  // the file. Same line format and same honesty rule as the curated list:
  // platforms come from `custom.works_with` only, and a product without it
  // gets no platform claim at all.
  const listed = new Set(products.slice(0, maxProducts).map((p) => p.handle));
  const groups = groupCatalog(catalog, listed);
  if (groups.length) {
    lines.push('## Full catalog');
    lines.push('');
    lines.push(
      'Every other product in the store, grouped by type. Products listed ' +
        'under Products above are not repeated here.',
    );
    lines.push('');
    for (const group of groups) {
      lines.push(`### ${group.title}`);
      lines.push('');
      for (const product of group.products) {
        lines.push(productLine(product, baseUrl));
      }
      lines.push('');
    }
  }

  if (collections.length) {
    lines.push('## Collections');
    lines.push('');
    for (const collection of collections) {
      lines.push(
        `- [${collection.title}](${baseUrl}/collections/${collection.handle})`,
      );
    }
    lines.push('');
  }

  lines.push('## Guides');
  lines.push('');
  lines.push(`- [Blog](${baseUrl}/blogs/news)`);
  lines.push(`- [How It Works](${baseUrl}/pages/how-it-works)`);
  lines.push(`- [FAQ](${baseUrl}/pages/faq-frequently-asked-questions)`);
  lines.push('');

  lines.push('## Key pages');
  lines.push('');
  lines.push(`- [Home](${baseUrl}/)`);
  lines.push(`- [Contact](${baseUrl}/pages/contact)`);

  return lines.join('\n') + '\n';
}
