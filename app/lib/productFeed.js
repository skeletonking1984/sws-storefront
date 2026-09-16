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
 * Build the feed XML from already fetched product nodes.
 *
 * @param {Array} nodes  Storefront product nodes
 * @param {string} origin
 * @returns {{xml: string, items: number, skippedIp: number, skippedUnavailable: number}}
 */
export function buildFeedXml(nodes, origin) {
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
    <g:id>${esc(p.handle)}</g:id>
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
