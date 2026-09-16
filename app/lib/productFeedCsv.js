/**
 * X (Twitter) Shopping product feed, as CSV.
 *
 * WHY A SECOND FEED EXISTS AT ALL. /feed.xml is the Google Merchant RSS 2.0
 * shape, and Google ingests it happily at 122 items. X accepted the same file
 * and then failed all 122, reporting that every item was missing a title, a
 * description, a link and a valid availability. It is not a format problem,
 * it is a SPEC problem: X publishes its own field spec at
 * https://business.x.com/en/help/shopping-specs.html and it differs from
 * Google's in ways that are invisible until something rejects them.
 *
 *   availability   Google "in_stock"      X "in stock"      (a space)
 *   field names    Google g: namespace    X plain names
 *   extra images   Google repeats the     X one comma
 *                  element                  separated field
 *   title cap      Google none            X 150 characters
 *   id cap         Google 50              X 100
 *
 * X's spec is written entirely as CSV columns, so CSV is the shape it
 * actually documents. Their XML option exists but its schema is not published
 * anywhere, and guessing at it is what produced 400 errors the first time.
 * CSV is documented, unambiguous, and the same data.
 *
 * SHARED SOURCE OF TRUTH. The query, the IP exclusion and the id all come
 * from productFeed.js. Two feeds that derive their own product list would
 * drift, and the drift would be silent: X would advertise something the
 * storefront no longer sells, or keep selling a product Google had already
 * dropped for naming somebody else's property.
 */
import {isIpRisky, feedId} from './productFeed.js';

/**
 * CSV field escaping, RFC 4180.
 *
 * NOT optional politeness: 32 of 122 product titles contain a comma, because
 * these are Etsy keyword titles ("Classical Floral Purple Chat and Goal
 * Widget •Minimal, Starry, Mystical• ..."). An unquoted comma shifts every
 * column after it, so the price lands in the link field and the row fails
 * validation for reasons that have nothing to do with the data.
 */
function csv(value) {
  const s = String(value ?? '');
  if (!/[",\n\r]/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Plain text, no HTML. X's spec says the description field does not support it. */
function plain(html, limit = 4900) {
  const text = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

/** X's spec: a number, a space, then the 3 letter ISO currency. "29.99 USD". */
function money(amount, currencyCode) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  return `${n.toFixed(2)} ${currencyCode || 'USD'}`;
}

export const X_COLUMNS = [
  'id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'link',
  'image_link',
  'brand',
  'additional_image_link',
  'product_type',
  'sale_price',
  'inventory',
];

/** X's five accepted availability values. Note the spaces. */
export const X_AVAILABILITY = new Set([
  'in stock',
  'available for order',
  'preorder',
  'out of stock',
  'discontinued',
]);

/**
 * @param {Array} nodes Storefront product nodes (same shape as FEED_QUERY)
 * @param {string} origin
 * @returns {{csv: string, items: number, skippedIp: number, skippedUnavailable: number}}
 */
export function buildFeedCsv(nodes, origin) {
  let skippedIp = 0;
  let skippedUnavailable = 0;
  const rows = [];

  for (const p of nodes) {
    if (isIpRisky(p)) { skippedIp++; continue; }
    const v = p.variants?.nodes?.[0];
    if (!v) { skippedUnavailable++; continue; }

    const onSale =
      v.compareAtPrice && Number(v.compareAtPrice.amount) > Number(v.price.amount);

    // Title cap is 150. Nothing in this catalogue exceeds it today (longest is
    // 140), but a new Etsy keyword title easily could, and X rejects the ROW
    // rather than trimming it.
    const title = p.title.length > 150 ? `${p.title.slice(0, 149)}…` : p.title;

    const extra = (p.images?.nodes || [])
      .map((i) => i.url)
      .filter((u) => u && u !== p.featuredImage?.url)
      .slice(0, 10)
      .join(', ');

    rows.push([
      feedId(p, v),
      title,
      plain(p.description),
      // A digital download is never out of stock, but availableForSale is the
      // storefront's own answer and it is the one a buyer would see.
      v.availableForSale ? 'in stock' : 'out of stock',
      'new',
      // price is the LIST price and sale_price the discounted one, same
      // convention as the XML feed. X requires sale_price < price, so it is
      // emitted only when there is a real compare-at above the current price.
      onSale
        ? money(v.compareAtPrice.amount, v.compareAtPrice.currencyCode)
        : money(v.price.amount, v.price.currencyCode),
      `${origin}/products/${p.handle}`,
      p.featuredImage?.url || '',
      p.vendor || 'Stream Widget Shop',
      extra,
      p.productType || 'Stream Widget',
      onSale ? money(v.price.amount, v.price.currencyCode) : '',
      // Digital downloads are unlimited. X's spec: an item marked "in stock"
      // must carry inventory >= 1 or it is not shown to users.
      v.availableForSale ? '9999' : '0',
    ].map(csv).join(','));
  }

  return {
    csv: `${X_COLUMNS.join(',')}\n${rows.join('\n')}\n`,
    items: rows.length,
    skippedIp,
    skippedUnavailable,
  };
}
