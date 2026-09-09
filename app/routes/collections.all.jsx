import {Form, Link, useLoaderData, useSearchParams} from 'react-router';
import {getPaginationVariables} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {ProductItem} from '~/components/ProductItem';
import {CATEGORY_LINKS} from '~/components/CollectionFilterBar';
import {buildMeta, getOrigin} from '~/lib/seo';
import logo from '~/assets/logo.png';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({matches, location}) => {
  const origin = getOrigin(matches);
  return buildMeta({
    title: 'All Widgets | Stream Widget Shop',
    description:
      'Browse every animated chat and goal widget: Twitch, YouTube, Kick, and multistream. Instant digital download.',
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
          <Link
            to={typeHref('')}
            className={`collection-filter-type${activeType ? '' : ' active'}`}
            aria-current={activeType ? undefined : 'page'}
          >
            All products
          </Link>
          {CATEGORY_LINKS.map(({label, handle}) => (
            <Link
              key={handle}
              to={`/collections/${handle}`}
              className="collection-filter-type"
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
        <div className="collection-empty">
          <img src={logo} alt="" />
          <p>
            No widgets match that search.{' '}
            <Link to="/collections/all">Clear filters →</Link>
          </p>
        </div>
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
    productType
    featuredImage {
      id
      altText
      url
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
