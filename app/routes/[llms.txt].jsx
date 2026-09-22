import {FAN_FAVORITE_HANDLES} from '~/lib/nav';
import {isMultistream} from '~/lib/platforms';

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

  const [products, collectionsData] = await Promise.all([
    getTopProducts(storefront),
    storefront.query(COLLECTIONS_QUERY),
  ]);

  const collections = collectionsData?.collections?.nodes ?? [];

  const body = buildLlmsTxt({baseUrl, products, collections});

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': `max-age=${60 * 60 * 24}`,
    },
  });
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

  const fallbackData = await storefront
    .query(FALLBACK_PRODUCTS_QUERY, {
      variables: Object.fromEntries(
        FAN_FAVORITE_HANDLES.map((h, i) => [`handle${i}`, h]),
      ),
    })
    .catch(() => null);
  if (!fallbackData) return [];
  return FAN_FAVORITE_HANDLES.map((_, i) => fallbackData[`product${i}`]).filter(
    Boolean,
  );
}

function buildLlmsTxt({baseUrl, products, collections}) {
  const lines = [];

  lines.push('# Stream Widget Shop');
  lines.push('');
  lines.push(
    '> Animated chat and goal widgets and overlay packs for streamers.',
  );
  lines.push('');
  lines.push(
    'Stream Widget Shop sells animated chat widgets, goal widgets, and full ' +
      'overlay packs for streamers, delivered as an instant digital ' +
      'download. Widgets drop into OBS, and most work with StreamElements ' +
      'or Streamlabs. Platform and app support (Twitch, YouTube, Kick, ' +
      'TikTok, StreamElements, Streamlabs) varies by product; check each ' +
      "product's own listing for exactly what it works with.",
  );
  lines.push('');

  // The single most-confused thing about this catalogue, stated plainly
  // because this file exists to be quoted by something answering a stranger's
  // question. A platform name on a product means two different things
  // depending on what the product is, and an answer engine reading a title
  // like "Froggy Goal Widget for Twitch, Kick, YouTube" will otherwise
  // conclude it merges chat, which it does not.
  //
  // This paragraph said the opposite of the code under it until 2026-09-22.
  // It asserted "only a product that ships a chat widget can be multistream"
  // while the **Multistream** tag below comes from isMultistream(), which
  // Todd redefined the same day as "works on Twitch, YouTube and Kick" and
  // which therefore tags goal widgets too. An answer engine reading the two
  // together concluded the Froggy Goal Widget merges chat, which is the exact
  // error the comment above says this section exists to prevent.
  lines.push('## What multistream means here');
  lines.push('');
  lines.push(
    'Multistream means the product works on Twitch, YouTube and Kick. It is ' +
      'marked **Multistream** in the product list below. What that buys you ' +
      'depends on which kind of product it is. A CHAT widget marked ' +
      'multistream reads all three chats at the same time and shows them in ' +
      'a single overlay. A GOAL widget reads no chat at all, on any ' +
      'platform: it counts tips, subs, follows and bits through ' +
      'StreamElements or Streamlabs, so a goal widget marked multistream ' +
      'works the same whichever of the three you are live on. Never read a ' +
      'multistream mark on a goal widget as a claim that it merges chat. A ' +
      'product with no mark works on Twitch only, whatever platforms its ' +
      'title names.',
  );
  lines.push('');

  if (products.length) {
    lines.push('## Products');
    lines.push('');
    for (const product of products.slice(0, MAX_PRODUCTS)) {
      const tag = isMultistream(product) ? ' **Multistream**' : '';
      lines.push(
        `- [${product.title}](${baseUrl}/products/${product.handle})${tag}`,
      );
    }
    lines.push('');
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
  lines.push(
    `- [FAQ](${baseUrl}/pages/faq-frequently-asked-questions)`,
  );
  lines.push('');

  lines.push('## Key pages');
  lines.push('');
  lines.push(`- [Home](${baseUrl}/)`);
  lines.push(`- [Contact](${baseUrl}/pages/contact)`);

  return lines.join('\n') + '\n';
}

const TOP_WIDGETS_QUERY = `#graphql
  query LlmsTxtTopWidgets($handle: String!) {
    collection(handle: $handle) {
      products(first: 30) {
        nodes {
          title
          handle
          productType
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
    product0: product(handle: $handle0) { title handle productType worksWith: metafield(namespace: "custom", key: "works_with") { value } }
    product1: product(handle: $handle1) { title handle productType worksWith: metafield(namespace: "custom", key: "works_with") { value } }
    product2: product(handle: $handle2) { title handle productType worksWith: metafield(namespace: "custom", key: "works_with") { value } }
    product3: product(handle: $handle3) { title handle productType worksWith: metafield(namespace: "custom", key: "works_with") { value } }
    product4: product(handle: $handle4) { title handle productType worksWith: metafield(namespace: "custom", key: "works_with") { value } }
    product5: product(handle: $handle5) { title handle productType worksWith: metafield(namespace: "custom", key: "works_with") { value } }
    product6: product(handle: $handle6) { title handle productType worksWith: metafield(namespace: "custom", key: "works_with") { value } }
    product7: product(handle: $handle7) { title handle productType worksWith: metafield(namespace: "custom", key: "works_with") { value } }
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
