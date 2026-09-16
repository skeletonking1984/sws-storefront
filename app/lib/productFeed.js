/**
 * Google Merchant spec product feed, shared by the route and its verifier.
 *
 * Lives here rather than inside the route so `npm run verify:feed` exercises
 * the SAME code that serves /feed.xml. A verifier that reimplements the builder
 * proves only that two pieces of code agree with each other, which is exactly
 * the kind of green result that hides a real fault.
 */
// Relative, not the ~ alias: this module is imported both by the Vite build
// and by scripts/verify-feed.mjs under plain node, and node cannot resolve ~.
import {IP_TERMS} from './ipTerms.js';

export const PAGE_SIZE = 250;

export const FEED_QUERY = `#graphql
  query ProductFeed($first: Int!, $after: String, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        handle
        title
        description
        productType
        vendor
        tags
        featuredImage { url altText }
        images(first: 10) { nodes { url } }
        variants(first: 1) {
          nodes {
            id
            availableForSale
            price { amount currencyCode }
            compareAtPrice { amount currencyCode }
          }
        }
      }
    }
  }
`;

/** XML text escape. Product titles here contain & and | routinely. */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Feed descriptions are plain text, not the site's HTML, and Google caps them
 * at 5000 characters.
 */
function plain(html, limit = 4800) {
  const text = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

/**
 * Stable feed id for a product: the numeric Shopify VARIANT id.
 *
 * Three constraints decide this, and only the variant id satisfies all three.
 *
 * 1. LENGTH. Google caps `id` at 50 characters and this catalogue's handles are
 *    Etsy keyword titles: "pokemon-charizard-character-liquid-filling-goal-
 *    widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-
 *    streamelements" is 130. Merchant Center accepted a handle based feed and
 *    then reported "Value too long in attribute: id" on 119 of 122 items, so
 *    almost the whole catalogue was rejected while the feed itself looked
 *    healthy. Every variant id here is 14 digits.
 *
 * 2. PERMANENCE. A feed id must never change once a channel has ingested it:
 *    changing it orphans the old entry and creates a duplicate. A handle can be
 *    renamed and a truncated handle can collide; a numeric id cannot.
 *
 * 3. IT IS ALSO THE CHECKOUT KEY. Merchant Center's checkout link template is
 *    `https://shop.streamwidgetshop.com/cart/{id}:1`, and `{id}` substitutes
 *    THIS value. Shopify's cart permalink is /cart/<VARIANT id>:<quantity>.
 *    A product id in that slot returns 410 Gone, verified live:
 *      /cart/8962515108030:1  (product id) -> 410
 *      /cart/48854557589694:1 (variant id) -> 302 to checkout
 *    So the product id satisfies 1 and 2 and silently breaks every buy link.
 *    This id is load bearing for the sale, not just for dedupe.
 *
 * Safe here because all 124 storefront products are single variant (checked
 * 2026-09-16: 0 multi-variant, 124 unique 14 digit ids). If a product ever
 * gains a second variant it needs its own feed row plus a g:item_group_id,
 * which is the normal Google shape for variants anyway.
 *
 * @param {{id?: string, handle?: string}} product
 * @param {{id?: string}} [variant]  the variant this feed row represents
 */
export function feedId(product, variant) {
  const variantNumeric = String(variant?.id || '').split('/').pop();
  if (variantNumeric) return variantNumeric;
  // Fall back only if the variant gid is missing or unparseable, so a malformed
  // id degrades to something usable rather than emitting an empty tag. Note the
  // fallback does NOT produce a working checkout link; verify:feed fails on it.
  const productNumeric = String(product?.id || '').split('/').pop();
  return productNumeric || product?.handle || '';
}

/**
 * Refuse anything naming someone else's property, by NAME and not by status.
 *
 * Deliberately checks title AND tags: several of these products carry a clean
 * title and a tag like `pokemon_Goal`.
 */
export function isIpRisky(product) {
  const hay = `${product?.title || ''} ${(product?.tags || []).join(' ')}`;
  return IP_TERMS.some((re) => re.test(hay));
}


/**
 * How long an item in this feed stays valid, in days.
 *
 * WHY EVERY ITEM CARRIES AN EXPIRY. Without one, Merchant Center holds an
 * item for up to 30 days after it last saw it, so ANY item that stops
 * appearing in the feed lingers as a ghost listing that nothing here can
 * reach. That is not hypothetical: changing g:id from the product id to the
 * variant id on 2026-09-16 stranded the entire old set, and the account went
 * from 122 products to 244, one live and one dead copy of every product. The
 * dead half could only be cleared by deleting and re-adding the whole data
 * source.
 *
 * With an expiry, a live item is refreshed on every fetch and never expires,
 * while an orphan simply dies on its own inside this window. Google requires
 * a date under 30 days out; 25 leaves room for several missed fetches before
 * a healthy item would wrongly drop.
 */
export const FEED_EXPIRY_DAYS = 25;

/** ISO date, FEED_EXPIRY_DAYS from now. Google wants YYYY-MM-DD. */
export function feedExpiry(now = new Date()) {
  const d = new Date(now.getTime() + FEED_EXPIRY_DAYS * 86400000);
  return d.toISOString().slice(0, 10);
}

/**
 * Build the feed XML from already fetched product nodes.
 *
 * @param {Array} nodes  Storefront product nodes
 * @param {string} origin
 * @returns {{xml: string, items: number, skippedIp: number, skippedUnavailable: number}}
 */
export function buildFeedXml(nodes, origin) {
  const expiry = feedExpiry();
  const items = [];
  let skippedIp = 0;
  let skippedUnavailable = 0;

  for (const p of nodes) {
    if (isIpRisky(p)) { skippedIp++; continue; }
    const v = p.variants?.nodes?.[0];
    if (!v) { skippedUnavailable++; continue; }
    items.push({product: p, variant: v});
  }

  const entries = items.map(({product: p, variant: v}) => {
    const link = `${origin}/products/${p.handle}`;
    const extraImages = (p.images?.nodes || [])
      .map((i) => i.url)
      .filter((u) => u && u !== p.featuredImage?.url)
      .slice(0, 9)
      .map((u) => `    <g:additional_image_link>${esc(u)}</g:additional_image_link>`)
      .join('\n');

    const onSale =
      v.compareAtPrice && Number(v.compareAtPrice.amount) > Number(v.price.amount);
    const sale = onSale
      ? `    <g:sale_price>${esc(v.price.amount)} ${esc(v.price.currencyCode)}</g:sale_price>\n`
      : '';
    const listPrice = onSale
      ? `${v.compareAtPrice.amount} ${v.compareAtPrice.currencyCode}`
      : `${v.price.amount} ${v.price.currencyCode}`;

    return `  <item>
    <g:id>${esc(feedId(p, v))}</g:id>
    <title>${esc(p.title)}</title>
    <description>${esc(plain(p.description))}</description>
    <link>${esc(link)}</link>
    <g:image_link>${esc(p.featuredImage?.url || '')}</g:image_link>
${extraImages ? `${extraImages}\n` : ''}    <g:availability>${v.availableForSale ? 'in_stock' : 'out_of_stock'}</g:availability>
    <g:price>${esc(listPrice)}</g:price>
${sale}    <g:condition>new</g:condition>
    <g:brand>${esc(p.vendor || 'Stream Widget Shop')}</g:brand>
    <g:product_type>${esc(p.productType || 'Stream Widget')}</g:product_type>
    <g:identifier_exists>no</g:identifier_exists>
    <g:expiration_date>${expiry}</g:expiration_date>
    <g:is_bundle>${/kit|pack|bundle/i.test(p.title) ? 'yes' : 'no'}</g:is_bundle>
    <g:shipping>
      <g:country>US</g:country>
      <g:service>Instant download</g:service>
      <g:price>0 USD</g:price>
    </g:shipping>
  </item>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>Stream Widget Shop</title>
  <link>${esc(origin)}</link>
  <description>Animated chat and goal widgets for Twitch, Kick and OBS. Instant digital download.</description>
  <!-- ${items.length} items. Excluded: ${skippedIp} for naming third party IP, ${skippedUnavailable} with no purchasable variant. -->
${entries.join('\n')}
</channel>
</rss>
`;
  return {xml, items: items.length, skippedIp, skippedUnavailable};
}
