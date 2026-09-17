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
import {isIpRisky, feedId, GOOGLE_PRODUCT_CATEGORY} from './productFeed.js';

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
  'google_product_category',
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
      GOOGLE_PRODUCT_CATEGORY,
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

/*
 * ---------------------------------------------------------------------------
 * Pinterest.
 *
 * WHY A THIRD SHAPE AND NOT JUST REUSING THE X ONE. Pinterest and X agree on
 * the field that broke us ("in stock", not Google's "in_stock"), so the X feed
 * would very likely have worked. "Very likely" is exactly the reasoning that
 * sent 122 items into X and got 400 errors back. Pinterest publishes its own
 * sample CSV with its own column set, so this matches that sample rather than
 * hoping one file satisfies two specs.
 *
 * It costs one column list. The QUERY, the IP exclusion, the id, and the
 * escaping all still come from one place, so the three feeds can never
 * disagree about which products exist.
 *
 * What Pinterest's template carries that X's does not:
 *
 *   item_group_id            required only for multi-variant products. Every
 *                            product here is single variant, so this is the
 *                            product id: a stable parent for the day one of
 *                            them does gain variants.
 *   google_product_category  optional, improves how Pinterest matches a
 *                            product to a browsing person.
 *   shipping                 country:region:service:price. Free, and true:
 *                            every product is an instant download. This is the
 *                            same declaration that unblocked Merchant Center.
 *   custom_label_0           used for building product groups in the Pinterest
 *                            UI without re-deriving categories by hand.
 *
 * Fields in their sample that are deliberately EMPTY here: gender, age_group,
 * size, size_type. They describe apparel. Emitting a guess would be worse than
 * emitting nothing, because Pinterest would use it to target.
 */

export const PINTEREST_COLUMNS = [
  'id',
  'item_group_id',
  'title',
  'description',
  'link',
  'image_link',
  'price',
  'availability',
  'condition',
  'google_product_category',
  'product_type',
  'additional_image_link',
  'sale_price',
  'brand',
  'shipping',
  'custom_label_0',
];



/** Pinterest's shipping syntax: country:region:service:price. Region may be empty. */
const SHIPPING = 'US::Instant download:0 USD';

/**
 * Pinterest quotes EVERY field in its own sample. Ours only quotes when a
 * field needs it, which is equally valid RFC 4180, but matching their template
 * removes one more thing for their parser to disagree with us about.
 */
function qAlways(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

/**
 * @param {Array} nodes Storefront product nodes (same shape as FEED_QUERY)
 * @param {string} origin
 * @returns {{csv: string, items: number, skippedIp: number, skippedUnavailable: number}}
 */
export function buildPinterestCsv(nodes, origin) {
  let skippedIp = 0;
  let skippedUnavailable = 0;
  const rows = [];

  for (const p of nodes) {
    if (isIpRisky(p)) { skippedIp++; continue; }
    const v = p.variants?.nodes?.[0];
    if (!v) { skippedUnavailable++; continue; }

    const onSale =
      v.compareAtPrice && Number(v.compareAtPrice.amount) > Number(v.price.amount);

    // Pinterest allows 500; nothing here is close. Truncate anyway so a future
    // title cannot fail the whole row.
    const title = p.title.length > 500 ? `${p.title.slice(0, 499)}…` : p.title;

    /*
     * FOUR additional images, not ten, and the limit is about rate limiting
     * rather than taste.
     *
     * Pinterest creates a separate Pin for every additional_image_link, so
     * more looks strictly better. It is not: on the first successful ingest
     * (2026-09-16, 121 of 122) it asked Shopify's CDN for roughly 1,200
     * images in one burst and the CDN began answering 429. Result was
     * Warning 1306 on 9 products and Error 1300 on one, whose PRIMARY image
     * was refused. All 122 image_link URLs return 200 when fetched at a sane
     * rate, so nothing was broken; there were simply too many requests at
     * once.
     *
     * Four cuts the burst by well over half and still gives each product
     * several Pins. An image that 429s produces no Pin at all, so fewer
     * requests that succeed beat more that get refused.
     *
     * Pinterest only. Google and X ingest the same catalogue without
     * complaint, so their builders are untouched.
     */
    const extra = (p.images?.nodes || [])
      .map((i) => i.url)
      .filter((u) => u && u !== p.featuredImage?.url)
      .slice(0, 4)
      .join(', ');

    const productId = String(p.id || '').split('/').pop();

    rows.push([
      feedId(p, v),
      productId,
      title,
      plain(p.description, 9900),
      `${origin}/products/${p.handle}`,
      p.featuredImage?.url || '',
      onSale
        ? money(v.compareAtPrice.amount, v.compareAtPrice.currencyCode)
        : money(v.price.amount, v.price.currencyCode),
      v.availableForSale ? 'in stock' : 'out of stock',
      'new',
      GOOGLE_PRODUCT_CATEGORY,
      p.productType || 'Stream Widget',
      extra,
      onSale ? money(v.price.amount, v.price.currencyCode) : '',
      p.vendor || 'Stream Widget Shop',
      SHIPPING,
      p.productType || 'Stream Widget',
    ].map(qAlways).join(','));
  }

  return {
    csv: `${PINTEREST_COLUMNS.map(qAlways).join(',')}\n${rows.join('\n')}\n`,
    items: rows.length,
    skippedIp,
    skippedUnavailable,
  };
}
