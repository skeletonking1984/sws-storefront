import {Form, Link, useLoaderData, useSearchParams} from 'react-router';
import {getPaginationVariables} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {ProductItem} from '~/components/ProductItem';

const WIDGET_TYPES = [
  {label: 'All', tag: ''},
  {label: 'Chat widgets', tag: 'Chat_widget'},
  {label: 'Goal widgets', tag: 'Goal_Widget'},
  {label: 'VTuber assets', tag: 'Vtuber_asset'},
];

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: `Hydrogen | Products`}];
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
async function loadCriticalData({context, request}) {
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 24,
  });
  const url = new URL(request.url);
  const activeType = url.searchParams.get('type') || '';
  const searchQuery = url.searchParams.get('q') || '';

  const queryParts = [];
  if (activeType) queryParts.push(`tag:${activeType}`);
  if (searchQuery) queryParts.push(`(title:*${searchQuery}* OR tag:*${searchQuery}*)`);

  const [{products}] = await Promise.all([
    storefront.query(CATALOG_QUERY, {
      variables: {
        ...paginationVariables,
        query: queryParts.length ? queryParts.join(' AND ') : undefined,
      },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);
  return {products, activeType, searchQuery};
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
  const {products, activeType, searchQuery} = useLoaderData();
  const [searchParams] = useSearchParams();

  const typeHref = (tag) => {
    const params = new URLSearchParams(searchParams);
    if (tag) {
      params.set('type', tag);
    } else {
      params.delete('type');
    }
    const query = params.toString();
    return query ? `/collections/all?${query}` : '/collections/all';
  };

  return (
    <div className="collection">
      <h1>Products</h1>
      <div className="collection-filter-bar">
        <div className="collection-filter-types">
          {WIDGET_TYPES.map(({label, tag}) => (
            <Link
              key={label}
              to={typeHref(tag)}
              className={`collection-filter-type${
                activeType === tag ? ' active' : ''
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <Form method="get" className="collection-filter-search-form">
          {activeType && <input type="hidden" name="type" value={activeType} />}
          <input
            type="search"
            name="q"
            className="collection-filter-search"
            placeholder="Search all widgets..."
            defaultValue={searchQuery}
            aria-label="Search all products"
          />
        </Form>
      </div>
      {products.nodes.length === 0 ? (
        <p className="collection-empty">
          No widgets match that search.{' '}
          <Link to="/collections/all">Clear filters →</Link>
        </p>
      ) : (
        <PaginatedResourceSection
          connection={products}
          resourcesClassName="products-grid"
        >
          {({node: product, index}) => (
            <ProductItem
              key={product.id}
              product={product}
              loading={index < 8 ? 'eager' : undefined}
            />
          )}
        </PaginatedResourceSection>
      )}
    </div>
  );
}

const COLLECTION_ITEM_FRAGMENT = `#graphql
  fragment MoneyCollectionItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment CollectionItem on Product {
    id
    handle
    title
    featuredImage {
      id
      altText
      url
      width
      height
    }
    priceRange {
      minVariantPrice {
        ...MoneyCollectionItem
      }
      maxVariantPrice {
        ...MoneyCollectionItem
      }
    }
  }
`;

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/product
const CATALOG_QUERY = `#graphql
  query Catalog(
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
    $query: String
  ) @inContext(country: $country, language: $language) {
    products(first: $first, last: $last, before: $startCursor, after: $endCursor, query: $query) {
      nodes {
        ...CollectionItem
      }
      pageInfo {
        hasPreviousPage
        hasNextPage
        startCursor
        endCursor
      }
    }
  }
  ${COLLECTION_ITEM_FRAGMENT}
`;

/** @typedef {import('./+types/collections.all').Route} Route */
/** @typedef {import('storefrontapi.generated').CollectionItemFragment} CollectionItemFragment */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
