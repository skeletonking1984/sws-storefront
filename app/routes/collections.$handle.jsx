import {useState} from 'react';
import {Link, redirect, useLoaderData, useRouteLoaderData} from 'react-router';
import {getPaginationVariables, Analytics} from '@shopify/hydrogen';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {ProductItem} from '~/components/ProductItem';
import {
  FreeChatProductCard,
  SHOW_FREE_CHAT_GRID_CARD,
} from '~/components/FreeChatProductCard';
import {CollectionFilterBar} from '~/components/CollectionFilterBar';
import {FaqAccordion} from '~/components/FaqAccordion';
import {buildMeta, getOrigin} from '~/lib/seo';
import {SHARE_CARD, shareCardUrl} from '~/lib/ogImage';
import {formatProductDescription} from '~/lib/productDescription';
import {metafieldToPlainText} from '~/lib/richTextMetafield';
import {collectionFaqToPageBodyHtml} from '~/lib/collectionFaq';
import {CHAT_WIDGETS_COLLECTION} from '~/lib/collectionHandles';
import {logoWebp as logo} from '~/lib/cdnAssets';
import {brand} from '~/lib/brand.config';
import {TIERS} from '~/lib/bundle';

/**
 * Collections that show the "Build your own bundle" callout above the grid
 * (2026-10-18): the Bundles nav item lands on the
 * pre-made bundles collection, and shoppers there should find the /bundle
 * builder without hunting for the header pill (hidden under 96em).
 */
const BUNDLE_BUILDER_CTA_COLLECTIONS = new Set(['bundles']);

function BundleBuilderCta() {
  const counts = [...TIERS].reverse().map((t) => t.min);
  const best = Math.max(...TIERS.map((t) => t.pct));
  const list = `${counts.slice(0, -1).join(', ')} or ${counts[counts.length - 1]}`;
  return (
    <section
      className="collection-bundle-cta"
      aria-labelledby="collection-bundle-cta-heading"
    >
      <div className="collection-bundle-cta-copy">
        <h2
          id="collection-bundle-cta-heading"
          className="collection-bundle-cta-title"
        >
          Build your own bundle
        </h2>
        <p className="collection-bundle-cta-sub">
          {`Pick any ${list} widgets and save up to ${best}%`}
        </p>
      </div>
      <Link
        className="sws-btn sws-btn-primary collection-bundle-cta-btn"
        to="/bundle"
        prefetch="intent"
      >
        Build a bundle
      </Link>
    </section>
  );
}

/**
 * Collections a Twitch/Kick/multistream chat shopper actually browses.
 * Both the current (`twitch-chat-widgets`) and legacy (`frontpage`) Chat
 * Widget handle are listed (see app/lib/collectionHandles.js and the
 * 2026-09-28 rename note in app/lib/nav.js), since this route is reached
 * directly by whichever handle a visitor's URL carries, not through the
 * merged nav data root.jsx builds for the mega menu. The card is injected
 * at render time only (see FreeChatProductCard.jsx), never added to
 * `collection.products.nodes`, so pagination, product counts and
 * Analytics.CollectionView stay exactly what the Storefront API returned.
 */
const FREE_CHAT_CARD_COLLECTIONS = new Set([
  CHAT_WIDGETS_COLLECTION.current,
  CHAT_WIDGETS_COLLECTION.legacy,
  'widgets',
]);

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({data, matches, location}) => {
  const origin = getOrigin(matches);
  const collectionShareImage = data?.collection?.image?.url;
  return buildMeta({
    title:
      data?.collection.seo?.title ||
      `${data?.collection.title ?? ''} | ${brand.name}`,
    description:
      data?.collection.seo?.description ||
      data?.collection.description ||
      `Animated ${data?.collection.title ?? ''} widgets for Twitch, YouTube, and multistream. Instant digital download.`,
    url: `${origin}${location.pathname}`,
    // A collection with its own image in Shopify shares that real product
    // art as a square card, same recipe as product pages (padded, never
    // cropped). No image falls back to the default banner.
    image: collectionShareImage
      ? shareCardUrl(collectionShareImage)
      : undefined,
    imageWidth: collectionShareImage ? SHARE_CARD.width : undefined,
    imageHeight: collectionShareImage ? SHARE_CARD.height : undefined,
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
function loadDeferredData() {
  return {};
}

export default function Collection() {
  /** @type {LoaderReturnData} */
  const {collection} = useLoaderData();
  const rootData = useRouteLoaderData('root');
  const origin = rootData?.origin || brand.origin;
  const [searchTerm, setSearchTerm] = useState('');

  const matchesSearch = (product) =>
    !searchTerm ||
    product.title.toLowerCase().includes(searchTerm.toLowerCase());
  const hasMatches = collection.products.nodes.some(matchesSearch);

  // The landing-page treatment (H1 override, intro, long guide, FAQ) is
  // gated on `custom.h1` existing, not on `descriptionHtml`/`description`
  // alone. Those two already carry real Admin content on some collections
  // today, and rendering a new "guide" section the moment they are
  // non-empty would change pages nobody has written landing copy for yet.
  // `custom.h1` is a brand new field with zero values across the catalogue
  // until the store owner creates the metafield definition and writes it in per
  // collection, so keying off it means every current page
  // renders byte-for-byte the same until that copy exists.
  const h1 = collection.h1?.value;
  const isLandingPage = Boolean(h1);
  const intro = isLandingPage
    ? metafieldToPlainText(collection.intro?.value)
    : '';
  const guideHtml =
    isLandingPage && collection.descriptionHtml
      ? formatProductDescription(collection.descriptionHtml, collection.title)
      : '';
  const faqHtml = isLandingPage
    ? collectionFaqToPageBodyHtml(collection.faq?.value)
    : '';

  // JSON-LD only here, deliberately, not a visible breadcrumb nav: this
  // route's page (H1 + description + grid) does not have a breadcrumb
  // trail in its design today, and adding one visibly would be a page
  // change nobody asked for on every collection, not just landing pages.
  // See app/components/Breadcrumbs.jsx for the visible version PDPs use.
  const collectionUrl = `${origin}/collections/${collection.handle}`;
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {'@type': 'ListItem', position: 1, name: 'Home', item: origin},
      {
        '@type': 'ListItem',
        position: 2,
        name: h1 || collection.title,
        item: collectionUrl,
      },
    ],
  };
  // The visible products on THIS page (respects pagination), never the
  // whole collection, so this can never claim a product is at a position it
  // does not actually occupy on the page being crawled.
  const itemListJsonLd = collection.products.nodes.length
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: collection.products.nodes.map((product, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${origin}/products/${product.handle}`,
          name: product.title,
        })),
      }
    : null;

  return (
    <div className="collection">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c'),
        }}
      />
      {itemListJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(itemListJsonLd).replace(/</g, '\\u003c'),
          }}
        />
      )}
      <h1>{h1 || collection.title}</h1>
      <p className="collection-description">{collection.description}</p>
      {intro && <p className="collection-intro">{intro}</p>}
      {BUNDLE_BUILDER_CTA_COLLECTIONS.has(collection.handle) && (
        <BundleBuilderCta />
      )}
      <CollectionFilterBar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        collectionHandle={collection.handle}
      />
      {!hasMatches && (
        <div className="collection-empty">
          <img src={logo} alt="" aria-hidden="true" />
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
          const showFreeChatCard =
            SHOW_FREE_CHAT_GRID_CARD &&
            index === 0 &&
            !searchTerm &&
            FREE_CHAT_CARD_COLLECTIONS.has(collection.handle);
          return (
            <>
              {showFreeChatCard && (
                <FreeChatProductCard
                  key="free-chat-lite"
                  placement={`collection-${collection.handle}`}
                />
              )}
              <ProductItem
                key={product.id}
                product={product}
                loading={index < 8 ? 'eager' : undefined}
                listId={collection.handle}
                listName={collection.title}
                index={index}
              />
            </>
          );
        }}
      </PaginatedResourceSection>
      {guideHtml && (
        <div className="product-description collection-guide">
          <h2>Guide</h2>
          <div
            className="product-description-body"
            dangerouslySetInnerHTML={{__html: guideHtml}}
          />
        </div>
      )}
      {faqHtml && (
        <div className="product-faq collection-faq">
          <h2>FAQ</h2>
          <FaqAccordion html={faqHtml} />
        </div>
      )}
      <Analytics.CollectionView
        data={{
          collection: {
            id: collection.id,
            handle: collection.handle,
            title: collection.title,
          },
          // Extra field on top of Hydrogen's CollectionPayload shape (which
          // is only {collection: {id, handle}}), read back in
          // app/lib/analytics/events.js's collection_viewed handling to
          // build view_item_list's items.
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
    tags
    gifSupport: metafield(namespace: "custom", key: "gif_support") { value }
    featuredImage {
      id
      altText
      url
    }
    media(first: 25) {
      nodes {
        __typename
        ... on Video {
          id
          previewImage {
            url
          }
          sources {
            url
            mimeType
            format
            width
            height
          }
        }
      }
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
    compareAtPriceRange {
      minVariantPrice {
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
      descriptionHtml
      image {
        url
        width
        height
      }
      seo {
        title
        description
      }
      h1: metafield(namespace: "custom", key: "h1") { value }
      intro: metafield(namespace: "custom", key: "intro") { value }
      faq: metafield(namespace: "custom", key: "faq") { value }
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
