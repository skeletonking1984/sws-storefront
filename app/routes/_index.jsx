import {Await, useLoaderData, Link} from 'react-router';
import {Suspense} from 'react';
import {Image} from '@shopify/hydrogen';
import {ProductItem} from '~/components/ProductItem';
import {MockShopNotice} from '~/components/MockShopNotice';
import {EtsyRatingBadge, SHOP_STATS} from '~/components/EtsyRating';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [{title: 'Hydrogen | Home'}];
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
async function loadCriticalData({context}) {
  return {
    isShopLinked: Boolean(context.env.PUBLIC_STORE_DOMAIN),
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 * @param {Route.LoaderArgs}
 */
function loadDeferredData({context}) {
  // Storefront API's `query:` search doesn't support a `handle:` field
  // filter (that's Admin-only), so fetch each favorite by handle directly
  // via aliases in one request, in our curated Etsy-favorites order.
  const recommendedProducts = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY, {
      variables: Object.fromEntries(
        FAN_FAVORITE_HANDLES.map((h, i) => [`handle${i}`, h]),
      ),
    })
    .then((response) => {
      const nodes = FAN_FAVORITE_HANDLES.map(
        (_, i) => response[`product${i}`],
      ).filter(Boolean);
      return {products: {nodes}};
    })
    .catch((error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });

  return {
    recommendedProducts,
  };
}

/**
 * Curated from real StreamWidgetShop Etsy data (etsy_list_active_listings,
 * sorted by num_favorers), matched to their Shopify handles. Update this
 * list periodically as Etsy favorites shift.
 */
const FAN_FAVORITE_HANDLES = [
  'neon-aesthetic-glowy-transparent-chat-and-goal-stream-widgets-minimal-neon-light-elegant-glow-theme-clean-vibe-streamelement-only',
  'combo-goal-widget-potion-bottle-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
  'dreamy-moon-cloud-glass-goal-widget-customisable-for-twitch-and-tiktok-studio',
  'cute-peach-glass-goal-widget-cute-minimal-customizable-goal-widget-for-twitch-tiktok-studio-streamelements-streamlabs-obs',
  'spooky-cauldron-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-stream-elements',
  'boba-drink-cute-fruit-drink-goal-widget-for-twitch-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
  'cute-rabbit-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
  'goth-spell-book-spooky-vibes-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
];

export default function Homepage() {
  /** @type {LoaderReturnData} */
  const data = useLoaderData();
  return (
    <div className="home">
      {data.isShopLinked ? null : <MockShopNotice />}
      <Hero products={data.recommendedProducts} />
      <RecommendedProducts products={data.recommendedProducts} />
      <CustomCommissionCallout />
    </div>
  );
}

function CustomCommissionCallout() {
  return (
    <section className="commission-callout">
      <div className="commission-callout-inner">
        <h2>Premium Overlays + Widgets Custom Design</h2>
        <p>
          We build fully custom chat and goal widgets to match your exact
          stream aesthetic &mdash; your colors, your characters, your theme.
        </p>
        <div className="commission-callout-cta-row">
          <Link className="hero-cta" to="/pages/contact">
            Get a custom setup &mdash; starting at $300
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * @param {{
 *   products: Promise<RecommendedProductsQuery | null>;
 * }}
 */
function Hero({products}) {
  return (
    <section className="hero">
      <div className="hero-grid">
        <div className="hero-copy">
          <h1>
            Overlays that make people{' '}
            <span className="sws-holo">stop scrolling.</span>
          </h1>
          <p>
            Animated chat and goal widgets built for Twitch, YouTube, and
            multistream. Instant download, drop into OBS in minutes.
          </p>
          <div className="hero-cta-row">
            <Link className="hero-cta" to="/collections/all">
              Shop widgets
            </Link>
            <EtsyRatingBadge />
          </div>
          <p className="hero-social-proof">
            {SHOP_STATS.soldCount.toLocaleString()}+ widgets sold ·{' '}
            {SHOP_STATS.favoriteCount.toLocaleString()} favorites on Etsy
          </p>
        </div>

        <Suspense fallback={<div className="hero-collage" />}>
          <Await resolve={products}>
            {(response) => {
              const nodes = response?.products?.nodes ?? [];
              if (!nodes.length) return null;
              return (
                <div className="hero-collage">
                  {nodes.slice(0, 4).map((product) => (
                    <Link
                      key={product.id}
                      to={`/products/${product.handle}`}
                      className="hero-collage-item"
                    >
                      <Image
                        data={product.featuredImage}
                        alt={product.featuredImage?.altText || product.title}
                        sizes="180px"
                      />
                    </Link>
                  ))}
                </div>
              );
            }}
          </Await>
        </Suspense>
      </div>
    </section>
  );
}

/**
 * @param {{
 *   products: Promise<RecommendedProductsQuery | null>;
 * }}
 */
function RecommendedProducts({products}) {
  return (
    <section
      className="recommended-products"
      aria-labelledby="recommended-products"
    >
      <h2 id="recommended-products">Fan favorites</h2>
      <Suspense fallback={<div>Loading...</div>}>
        <Await resolve={products}>
          {(response) => (
            <div className="recommended-products-grid">
              {response
                ? response.products.nodes.map((product) => (
                    <ProductItem key={product.id} product={product} />
                  ))
                : null}
            </div>
          )}
        </Await>
      </Suspense>
    </section>
  );
}

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  fragment RecommendedProduct on Product {
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
      url
      altText
      width
      height
    }
  }
  query RecommendedProducts (
    $country: CountryCode
    $language: LanguageCode
    $handle0: String!
    $handle1: String!
    $handle2: String!
    $handle3: String!
    $handle4: String!
    $handle5: String!
    $handle6: String!
    $handle7: String!
  ) @inContext(country: $country, language: $language) {
    product0: product(handle: $handle0) { ...RecommendedProduct }
    product1: product(handle: $handle1) { ...RecommendedProduct }
    product2: product(handle: $handle2) { ...RecommendedProduct }
    product3: product(handle: $handle3) { ...RecommendedProduct }
    product4: product(handle: $handle4) { ...RecommendedProduct }
    product5: product(handle: $handle5) { ...RecommendedProduct }
    product6: product(handle: $handle6) { ...RecommendedProduct }
    product7: product(handle: $handle7) { ...RecommendedProduct }
  }
`;

/** @typedef {import('./+types/_index').Route} Route */
/** @typedef {import('storefrontapi.generated').RecommendedProductsQuery} RecommendedProductsQuery */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
