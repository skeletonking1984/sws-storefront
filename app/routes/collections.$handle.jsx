import {useState} from 'react';
import {redirect, useLoaderData} from 'react-router';
import {getPaginationVariables, Analytics} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {ProductItem} from '~/components/ProductItem';
import {CollectionFilterBar} from '~/components/CollectionFilterBar';
import {buildMeta, getOrigin} from '~/lib/seo';
import logo from '~/assets/logo.png';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({data, matches, location}) => {
  const origin = getOrigin(matches);
  return buildMeta({
    title: `${data?.collection.title ?? ''} | Stream Widget Shop`,
    description:
      data?.collection.description ||
      `Animated ${data?.collection.title ?? ''} widgets for Twitch, YouTube, and multistream. Instant digital download.`,
    url: `${origin}${location.pathname}`,
  });
};

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 * @param {Route.LoaderArgs}
 */
async function loadCriticalData({context, params, request}) {
  const {handle} = params;
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 24,
  });
  if (!handle) {
    throw redirect('/collections');
  }

  const [{collection}] = await Promise.all([
    storefront.query(COLLECTION_QUERY, {
      variables: {handle, ...paginationVariables},
      // Add other queries here, so that they are loaded in parallel
    }),
  ]);

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: collection});

  return {
    collection,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 * @param {Route.LoaderArgs}
 */
function loadDeferredData({context}) {
  return {};
}

export default function Collection() {
  /** @type {LoaderReturnData} */
  const {collection} = useLoaderData();
  const [searchTerm, setSearchTerm] = useState('');

  const matchesSearch = (product) =>
    !searchTerm ||
    product.title.toLowerCase().includes(searchTerm.toLowerCase());
  const hasMatches = collection.products.nodes.some(matchesSearch);

  return (
    <div className="collection">
      <h1>{collection.title}</h1>
      <p className="collection-description">{collection.description}</p>
      <CollectionFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        collectionHandle={collection.handle}
      />
      {!hasMatches && (
        <div className="collection-empty">
          <img src={logo} alt="" />
          <p>No widgets match &ldquo;{searchTerm}&rdquo; in this collection.</p>
        </div>
      )}
      <PaginatedResourceSection
        connection={collection.products}
        resourcesClassName="products-grid"
      >
        {({node: product, index}) => {
          if (!matchesSearch(product)) {
            return null;
          }
          return (
            <ProductItem
              key={product.id}
              product={product}
              loading={index < 8 ? 'eager' : undefined}
              listId={collection.handle}
              listName={collection.title}
              index={index}
            />
          );
        }}
      </PaginatedResourceSection>
      <Analytics.CollectionView
        data={{
          collection: {
            id: collection.id,
            handle: collection.handle,
            title: collection.title,
          },
          // Extra field on top of Hydrogen's CollectionPayload shape (which
          // is only {collection: {id, handle}}), read back in GA4.jsx's
          // collection_viewed subscriber to build view_item_list's items.
          // The generic view component spreads this whole data object into
          // the published payload, so it survives the round trip.
          products: collection.products.nodes.map((node, i) => ({
            id: node.id,
            title: node.title,
            price: node.priceRange?.minVariantPrice?.amount,
            productType: node.productType,
            index: i,
          })),
        }}
      />
    </div>
  );
}

const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
    id
    handle
    title
    productType
    worksWith: metafield(namespace: "custom", key: "works_with") { value }
    featuredImage {
      id
      altText
      url
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
  }
`;

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
      ) {
        nodes {
          ...ProductItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
`;

/** @typedef {import('./+types/collections.$handle').Route} Route */
/** @typedef {import('storefrontapi.generated').ProductItemFragment} ProductItemFragment */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
