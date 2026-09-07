import {Await, Link, useLoaderData} from 'react-router';
import {Suspense} from 'react';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import {ProductPrice} from '~/components/ProductPrice';
import {ProductGallery} from '~/components/ProductGallery';
import {ProductForm} from '~/components/ProductForm';
import {ProductHighlights} from '~/components/ProductHighlights';
import {ProductItem} from '~/components/ProductItem';
import {EtsyRatingBadge} from '~/components/EtsyRating';
import {EtsyReviews} from '~/components/EtsyReviews';
import {FaqAccordion} from '~/components/FaqAccordion';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {formatProductDescription} from '~/lib/productDescription';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({data}) => {
  const title = data?.product.title ?? '';
  return [
    {title: `${title} | Stream Widget Shop`},
    {
      name: 'description',
      content:
        data?.product.seo?.description ||
        `${title}: animated stream widget, instant digital download for Twitch, YouTube, and multistream.`,
    },
    {
      rel: 'canonical',
      href: `/products/${data?.product.handle}`,
    },
  ];
};

/**
 * Some titles in this catalog mention both words (e.g. "Sakura Floral Chat
 * Widget ... Chat Goal, VTuber Streamer"), so a plain "does it contain
 * goal?" test misclassifies real chat widgets as goal widgets. Whichever
 * word appears first in the title is the more reliable signal of what the
 * product actually is.
 * @param {string} title
 * @returns {'goal' | 'chat' | null}
 */
function widgetKindFromTitle(title) {
  const goalIndex = title.search(/goal/i);
  const chatIndex = title.search(/chat/i);
  if (goalIndex === -1 && chatIndex === -1) return null;
  if (goalIndex === -1) return 'chat';
  if (chatIndex === -1) return 'goal';
  return goalIndex < chatIndex ? 'goal' : 'chat';
}

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  // Kick off non-critical data (related products, FAQ) without blocking
  // the response. Needs the product's title to decide the widget kind, so
  // it starts after critical data rather than in parallel with it.
  const deferredData = loadDeferredData(args, criticalData.product);

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

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const [{product}] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: product});

  return {
    product,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 * @param {Route.LoaderArgs}
 */
function loadDeferredData({context, params}, product) {
  const {storefront} = context;

  // "More Chat/Goal widgets": same widget kind, same real catalog data,
  // filtered client-side to exclude the current product. Title text is the
  // reliable signal here (see CLAUDE.md on product tags being unreliable).
  const kind = widgetKindFromTitle(product.title);

  const relatedProducts = kind
    ? storefront
        .query(RELATED_PRODUCTS_QUERY, {
          variables: {query: `title:*${kind}*`},
        })
        .then((response) =>
          (response.products?.nodes ?? [])
            // The Storefront search query above is fuzzy and can leak in
            // the other widget kind (e.g. "chat" results inside a "goal"
            // search). Titles like "Sakura Floral Chat Widget ... Chat
            // Goal" mention both words, so a plain substring test still
            // misclassifies them — re-run the same first-word-wins check
            // used for the current product before trusting a result.
            .filter(
              (p) => p.handle !== params.handle && widgetKindFromTitle(p.title) === kind,
            )
            .slice(0, 4),
        )
        .catch(() => [])
    : Promise.resolve([]);

  // Real site FAQ, reused on the PDP so buyers see setup answers without
  // leaving the product page.
  const faq = storefront
    .query(PRODUCT_FAQ_PAGE_QUERY, {
      cache: storefront.CacheLong(),
    })
    .then((response) => response?.page?.body ?? null)
    .catch(() => null);

  return {relatedProducts, faq};
}

export default function Product() {
  /** @type {LoaderReturnData} */
  const {product, relatedProducts, faq} = useLoaderData();

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {title, description, descriptionHtml} = product;
  const media = product.media?.nodes ?? [];
  const formattedDescription = formatProductDescription(descriptionHtml, title);
  const kindLabel = widgetKindFromTitle(title);
  const widgetKind = kindLabel
    ? kindLabel.charAt(0).toUpperCase() + kindLabel.slice(1)
    : null;

  return (
    <div className="product">
      <div className="product-top">
        <ProductGallery media={media} />
        <div className="product-main sws-glass-card">
          <h1>{title}</h1>
          <EtsyRatingBadge compact />
          <ProductPrice
            price={selectedVariant?.price}
            compareAtPrice={selectedVariant?.compareAtPrice}
          />
          <ProductHighlights title={title} description={description} />
          <ProductForm
            productOptions={productOptions}
            selectedVariant={selectedVariant}
          />
        </div>
      </div>
      <div className="product-description">
        <h2>Description</h2>
        <div
          className="product-description-body"
          dangerouslySetInnerHTML={{__html: formattedDescription}}
        />
      </div>
      <Suspense fallback={null}>
        <Await resolve={faq}>
          {(faqHtml) =>
            faqHtml ? (
              <div className="product-faq">
                <h2>Setup questions</h2>
                <FaqAccordion html={faqHtml} />
                <Link to="/pages/faq-frequently-asked-questions" className="product-faq-link">
                  See all FAQs →
                </Link>
              </div>
            ) : null
          }
        </Await>
      </Suspense>
      <EtsyReviews />
      <Suspense fallback={null}>
        <Await resolve={relatedProducts}>
          {(nodes) =>
            nodes && nodes.length > 0 ? (
              <div className="product-related">
                <h2>
                  More {widgetKind ? `${widgetKind} widgets` : 'widgets'}
                </h2>
                <div className="product-related-grid">
                  {nodes.map((related) => (
                    <ProductItem key={related.id} product={related} />
                  ))}
                </div>
              </div>
            ) : null
          }
        </Await>
      </Suspense>
      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </div>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
`;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    encodedVariantExistence
    encodedVariantAvailability
    media(first: 10) {
      nodes {
        __typename
        ... on MediaImage {
          id
          image {
            id
            url
            altText
          }
        }
        ... on Video {
          id
          previewImage {
            url
          }
          sources {
            url
            mimeType
          }
        }
      }
    }
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
`;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
`;

// "More Chat/Goal widgets": reuses the query:title trick (Storefront API
// has no reliable tag search for this catalog, see CLAUDE.md) to find same
// kind products. Client-side filter drops the current product.
const RELATED_PRODUCTS_QUERY = `#graphql
  query RelatedProducts(
    $country: CountryCode
    $language: LanguageCode
    $query: String
  ) @inContext(country: $country, language: $language) {
    products(first: 16, query: $query) {
      nodes {
        id
        title
        handle
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        featuredImage {
          id
          altText
          url
        }
      }
    }
  }
`;

// Reuses the real site FAQ page body on the PDP (see pages.$handle.jsx for
// the same page rendered in full).
const PRODUCT_FAQ_PAGE_QUERY = `#graphql
  query ProductFaqPage($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    page(handle: "faq-frequently-asked-questions") {
      body
    }
  }
`;

/** @typedef {import('./+types/products.$handle').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
