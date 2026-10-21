import {FAN_FAVORITE_HANDLES} from '~/lib/nav';
import {buildLlmsTxt} from '~/lib/llmsTxt';
import {fetchProductsByHandleWithAlias} from '~/lib/handleAliases';

const MAX_PRODUCTS = 30;

/**
 * llms.txt (https://llmstxt.org/) for LLMs and AI crawlers: a plain-text
 * summary of the site plus links to the pages worth reading. Built from
 * real Storefront API data at request time so it can't drift out of date
 * the way a hand-written copy would.
 * @param {Route.LoaderArgs}
 */
export async function loader({request, context: {storefront}}) {
  const baseUrl = new URL(request.url).origin;

  const [products, collectionsData, catalog] = await Promise.all([
    getTopProducts(storefront),
    storefront.query(COLLECTIONS_QUERY),
    getFullCatalog(storefront),
  ]);

  const collections = collectionsData?.collections?.nodes ?? [];

  const body = buildLlmsTxt({
    baseUrl,
    products,
    collections,
    maxProducts: MAX_PRODUCTS,
    catalog: catalog ?? [],
  });

  // A failed catalog fetch still serves the curated list, but must not be
  // pinned in caches for a day as if it were the whole file.
  const maxAge = catalog === null ? 60 * 5 : 60 * 60 * 24;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': `max-age=${maxAge}`,
    },
  });
}

/**
 * Every product the Storefront API returns (active and published to this
 * storefront), 250 per page, which is the API maximum. `buildLlmsTxt` groups
 * them by product type and drops the ones already in the curated list.
 * Returns null if any page fails, so the caller can shorten the cache.
 * `MAX_PAGES` is a runaway guard, not a catalog size limit (40 pages = 10000
 * products).
 */
const MAX_PAGES = 40;
async function getFullCatalog(storefront) {
  const all = [];
  let cursor = null;
  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const data = await storefront.query(ALL_PRODUCTS_QUERY, {
        variables: {cursor},
      });
      const connection = data?.products;
      if (!connection) return null;
      all.push(...connection.nodes);
      if (!connection.pageInfo.hasNextPage) return all;
      cursor = connection.pageInfo.endCursor;
    }
    return all;
  } catch {
    return null;
  }
}

/**
 * "Top widgets" comes from the real Top Widgets collection when it exists,
 * same fallback order as the homepage (`app/routes/_index.jsx`): if the
 * collection is missing or empty, fall back to the curated Etsy-favorites
 * handle list.
 */
async function getTopProducts(storefront) {
  const collectionData = await storefront
    .query(TOP_WIDGETS_QUERY, {variables: {handle: 'top-widgets'}})
    .catch(() => null);
  const collectionProducts = collectionData?.collection?.products?.nodes;
  if (collectionProducts?.length) return collectionProducts;

  // FAN_FAVORITE_HANDLES carries the NEW handles for the 75 products being
  // renamed to drop a false TikTok claim; falls back to the OLD handle
  // (still live in Shopify) until the store owner runs the rename. See
  // app/lib/handleAliases.js.
  const fallbackData = await fetchProductsByHandleWithAlias(
    storefront,
    FALLBACK_PRODUCTS_QUERY,
    FAN_FAVORITE_HANDLES,
  ).catch(() => null);
  if (!fallbackData) return [];
  return FAN_FAVORITE_HANDLES.map((_, i) => fallbackData[`product${i}`]).filter(
    Boolean,
  );
}

const TOP_WIDGETS_QUERY = `#graphql
  query LlmsTxtTopWidgets($handle: String!) {
    collection(handle: $handle) {
      products(first: 30) {
        nodes {
          title
          handle
          productType
          seo { title }
          worksWith: metafield(namespace: "custom", key: "works_with") { value }
        }
      }
    }
  }
`;

// Mirrors app/routes/_index.jsx's RECOMMENDED_PRODUCTS_QUERY: one aliased
// `product(handle:)` field per entry in FAN_FAVORITE_HANDLES (currently 8),
// since the Storefront API's `query:` search has no `handle:` field filter.
// If FAN_FAVORITE_HANDLES ever grows or shrinks, add or remove a
// `$handleN`/`productN` pair here to match.
const FALLBACK_PRODUCTS_QUERY = `#graphql
  query LlmsTxtFallbackProducts(
    $handle0: String!
    $handle1: String!
    $handle2: String!
    $handle3: String!
    $handle4: String!
    $handle5: String!
    $handle6: String!
    $handle7: String!
  ) {
    product0: product(handle: $handle0) { title handle productType seo { title } worksWith: metafield(namespace: "custom", key: "works_with") { value } }
    product1: product(handle: $handle1) { title handle productType seo { title } worksWith: metafield(namespace: "custom", key: "works_with") { value } }
    product2: product(handle: $handle2) { title handle productType seo { title } worksWith: metafield(namespace: "custom", key: "works_with") { value } }
    product3: product(handle: $handle3) { title handle productType seo { title } worksWith: metafield(namespace: "custom", key: "works_with") { value } }
    product4: product(handle: $handle4) { title handle productType seo { title } worksWith: metafield(namespace: "custom", key: "works_with") { value } }
    product5: product(handle: $handle5) { title handle productType seo { title } worksWith: metafield(namespace: "custom", key: "works_with") { value } }
    product6: product(handle: $handle6) { title handle productType seo { title } worksWith: metafield(namespace: "custom", key: "works_with") { value } }
    product7: product(handle: $handle7) { title handle productType seo { title } worksWith: metafield(namespace: "custom", key: "works_with") { value } }
  }
`;

const ALL_PRODUCTS_QUERY = `#graphql
  query LlmsTxtAllProducts($cursor: String) {
    products(first: 250, after: $cursor, sortKey: ID) {
      pageInfo { hasNextPage endCursor }
      nodes {
        title
        handle
        productType
        seo { title }
        worksWith: metafield(namespace: "custom", key: "works_with") { value }
      }
    }
  }
`;

const COLLECTIONS_QUERY = `#graphql
  query LlmsTxtCollections {
    collections(first: 20) {
      nodes {
        title
        handle
      }
    }
  }
`;

/** @typedef {import('./+types/[llms.txt]').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
