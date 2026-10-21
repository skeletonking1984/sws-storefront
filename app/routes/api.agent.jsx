/**
 * `/api/agent`: the catalog behind the WebMCP tools in
 * app/components/AgentTools.jsx.
 *
 * A resource route rather than a reuse of `/search?predictive`, because that
 * one is a page loader whose payload is shaped for the command palette and
 * comes back in React Router's data format. A tool handler wants plain JSON
 * with a stable shape it can put in front of an agent.
 *
 * Read only on purpose. Everything here is a GET that returns public catalog
 * data the storefront already renders. The one tool that changes state,
 * add_to_cart, goes through the app's own `/cart` action so it is subject to
 * exactly the same validation as a shopper clicking the button.
 *
 * The interesting field is `platforms`. It comes from the `custom.works_with`
 * metafield and nothing else, which is the single source docs/COPY-STANDARD.md
 * and app/lib/platforms.js already treat as authoritative. Titles in this
 * catalog are Etsy keyword titles that name YouTube, Kick and TikTok on
 * widgets that support none of them (80 of 125 products claimed a platform
 * their own Etsy listing denied, corrected 2026-09-14). An agent answering
 * "does this work on Kick" from a title would resurrect that bug at machine
 * speed, so the title is never consulted here.
 */
import {parseWorksWith} from '~/lib/platforms';

const MAX_LIMIT = 12;

/** Shape one Storefront product into the flat record a tool hands an agent. */
function toRecord(product, origin) {
  const price = product?.priceRange?.minVariantPrice;
  const variant = product?.selectedOrFirstAvailableVariant;
  return {
    title: product.title,
    handle: product.handle,
    url: `${origin}/products/${product.handle}`,
    type: product.productType || null,
    price: price?.amount ? Number(price.amount) : null,
    currency: price?.currencyCode || 'USD',
    // Never derived from the title. See the note at the top of this file.
    platforms: parseWorksWith(product.worksWith?.value) || [],
    available: Boolean(variant?.availableForSale),
    // The agent needs this to call add_to_cart without a second round trip.
    variantId: variant?.id || null,
  };
}

export async function loader({request, context}) {
  const url = new URL(request.url);
  const op = url.searchParams.get('op') || 'search';
  const origin = url.origin;
  const {storefront} = context;

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        'Content-Type': 'application/json',
        // Public catalog data, so it is cacheable, but keep it short: price
        // and availability are the two fields an agent must not read stale.
        'Cache-Control': 'public, max-age=60',
      },
    });

  if (op === 'details') {
    const handle = url.searchParams.get('handle');
    if (!handle) return json({error: 'handle is required'}, 400);

    const {product} = await storefront.query(PRODUCT_QUERY, {
      variables: {handle},
    });
    if (!product) return json({error: 'No widget with that handle'}, 404);

    return json({
      ...toRecord(product, origin),
      description: (product.description || '').slice(0, 1200),
    });
  }

  if (op === 'search') {
    const q = (url.searchParams.get('q') || '').trim();
    const platform = (url.searchParams.get('platform') || '').trim();
    const type = (url.searchParams.get('type') || '').trim();
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(url.searchParams.get('limit')) || 6),
    );

    // Ask for more than requested so the platform filter, which Shopify
    // cannot do (the claim lives in a metafield, not an indexed field), still
    // has something to return after filtering.
    const query = [q, type ? `product_type:${JSON.stringify(type)}` : '']
      .filter(Boolean)
      .join(' ');

    const {products} = await storefront.query(SEARCH_QUERY, {
      variables: {query: query || '*', first: MAX_LIMIT * 4},
    });

    let records = (products?.nodes || []).map((p) => toRecord(p, origin));

    if (platform) {
      const wanted = platform.toLowerCase();
      records = records.filter((r) =>
        r.platforms.some((p) => p.toLowerCase() === wanted),
      );
    }

    return json({
      query: q || null,
      platform: platform || null,
      type: type || null,
      count: records.length,
      results: records.slice(0, limit),
    });
  }

  return json({error: `Unknown op: ${op}`}, 400);
}

const PRODUCT_FIELDS = `#graphql
  fragment AgentProduct on Product {
    id
    title
    handle
    productType
    worksWith: metafield(namespace: "custom", key: "works_with") { value }
    priceRange { minVariantPrice { amount currencyCode } }
    selectedOrFirstAvailableVariant(ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      id
      availableForSale
    }
  }
`;

const SEARCH_QUERY = `#graphql
  ${PRODUCT_FIELDS}
  query AgentSearch($query: String!, $first: Int!, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: $first, query: $query) {
      nodes { ...AgentProduct }
    }
  }
`;

const PRODUCT_QUERY = `#graphql
  ${PRODUCT_FIELDS}
  query AgentProductByHandle($handle: String!, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...AgentProduct
      description
    }
  }
`;
