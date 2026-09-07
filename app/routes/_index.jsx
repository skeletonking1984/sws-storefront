import {Await, useLoaderData, Link} from 'react-router';
import {Suspense} from 'react';
import {Image} from '@shopify/hydrogen';
import {ProductItem} from '~/components/ProductItem';
import {EtsyRatingBadge, SHOP_STATS} from '~/components/EtsyRating';
import {SAMPLE_REVIEWS, SHOP_RATING} from '~/components/EtsyReviews';
import {PlatformIcon} from '~/components/PlatformIcon';
import {EmailCapture} from '~/components/EmailCapture';

/**
 * @type {Route.MetaFunction}
 */
export const meta = () => {
  return [
    {
      title:
        'Stream Widget Shop | Animated Twitch Chat + Goal Widgets',
    },
    {
      name: 'description',
      content:
        'Chunky, holographic, animated chat and goal widgets for Twitch, YouTube, Kick, and multistream. Instant download, drop into OBS in minutes.',
    },
  ];
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

  // "Top widgets" should come from the real Top Widgets collection when it
  // exists in Admin. If it's missing or empty, the section below falls
  // back to the curated fan-favorites list above.
  const topWidgets = context.storefront
    .query(TOP_WIDGETS_COLLECTION_QUERY, {
      variables: {handle: 'top-widgets'},
    })
    .then((response) => response?.collection?.products?.nodes ?? null)
    .catch(() => null);

  return {
    recommendedProducts,
    topWidgets,
  };
}

/**
 * Curated from real StreamWidgetShop Etsy data (etsy_list_active_listings,
 * sorted by num_favorers), matched to their Shopify handles. Used for the
 * hero composite and as a fallback for Top Widgets if that collection
 * doesn't exist or is empty. Update this list periodically as Etsy
 * favorites shift.
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

/** Sticker chips for "Shop by vibe", linking into the all-products search. */
const VIBES = [
  'Neon',
  'Celestial',
  'Sakura',
  'Spooky',
  'Cozy',
  'Y2K',
  'Multistream',
];

/** Platforms shown in the "Works with" strip, in the order they read best. */
const WORKS_WITH_PLATFORMS = [
  'Twitch',
  'YouTube',
  'Kick',
  'TikTok',
  'OBS',
  'Streamlabs',
  'StreamElements',
];

export default function Homepage() {
  /** @type {LoaderReturnData} */
  const data = useLoaderData();
  return (
    <div className="home">
      <Hero products={data.recommendedProducts} />
      <ShopByVibe />
      <TopWidgets
        topWidgets={data.topWidgets}
        fallback={data.recommendedProducts}
      />
      <WorksWithStrip />
      <ReviewsSection />
      <CustomCommissionCallout />
      <EmailCapture />
    </div>
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
          <h1 className="sws-glow">
            Widgets that make chat <span className="sws-holo">pop.</span>
          </h1>
          <p>
            Animated chat and goal widgets built for Twitch, YouTube, and
            multistream. Instant download, drop into OBS in minutes.
          </p>
          <div className="hero-cta-row">
            <Link className="sws-btn sws-btn-primary" to="/collections/all">
              Shop widgets
            </Link>
            <Link className="sws-btn sws-btn-ghost" to="#top-widgets">
              See it live
            </Link>
          </div>
          <div className="hero-trust-row">
            <EtsyRatingBadge />
            <span className="hero-trust-sep" aria-hidden="true">
              ·
            </span>
            <span className="hero-trust-stat">
              {SHOP_STATS.soldCount.toLocaleString()}+ widgets sold
            </span>
            <span className="hero-trust-sep" aria-hidden="true">
              ·
            </span>
            <span className="hero-trust-stat">
              {SHOP_STATS.favoriteCount.toLocaleString()} Etsy favorites
            </span>
          </div>
        </div>

        <Suspense fallback={<div className="hero-stream-frame" />}>
          <Await resolve={products}>
            {(response) => {
              const nodes = response?.products?.nodes ?? [];
              const chatWidget = nodes[0];
              const goalWidget = nodes[1];
              if (!chatWidget && !goalWidget) return null;
              return (
                <div className="hero-stream-frame">
                  <div className="hero-stream-scanline" aria-hidden="true" />
                  {chatWidget && (
                    <HeroWidgetMedia
                      product={chatWidget}
                      className="hero-widget-chat"
                    />
                  )}
                  {goalWidget && (
                    <HeroWidgetMedia
                      product={goalWidget}
                      className="hero-widget-goal"
                    />
                  )}
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
 * Renders a product's video if it has one, otherwise its featured image,
 * composited into the hero mock stream frame.
 * @param {{product: any; className: string}}
 */
function HeroWidgetMedia({product, className}) {
  const video = product.media?.nodes?.find((n) => n.__typename === 'Video');
  return (
    <Link
      to={`/products/${product.handle}`}
      className={`hero-widget-media ${className}`}
    >
      {video ? (
        <video autoPlay loop muted playsInline poster={video.previewImage?.url}>
          {video.sources?.map((source) => (
            <source key={source.url} src={source.url} type={source.mimeType} />
          ))}
        </video>
      ) : (
        <Image
          data={product.featuredImage}
          alt={product.featuredImage?.altText || product.title}
          sizes="280px"
        />
      )}
    </Link>
  );
}

function ShopByVibe() {
  return (
    <section className="shop-by-vibe" aria-labelledby="shop-by-vibe-heading">
      <h2 id="shop-by-vibe-heading" className="sws-section-eyebrow">
        Shop by vibe
      </h2>
      <div className="vibe-chip-row">
        {VIBES.map((vibe) => (
          <Link
            key={vibe}
            to={`/collections/all?q=${encodeURIComponent(vibe)}`}
            className="sws-chip"
          >
            {vibe}
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * @param {{
 *   topWidgets: Promise<any[] | null>;
 *   fallback: Promise<RecommendedProductsQuery | null>;
 * }}
 */
function TopWidgets({topWidgets, fallback}) {
  return (
    <section
      className="top-widgets"
      id="top-widgets"
      aria-labelledby="top-widgets-heading"
    >
      <h2 id="top-widgets-heading" className="sws-section-heading">
        Top widgets
      </h2>
      <Suspense fallback={<div className="top-widgets-grid" />}>
        <Await resolve={topWidgets}>
          {(topWidgetNodes) => (
            <Await resolve={fallback}>
              {(fallbackResponse) => {
                const nodes =
                  topWidgetNodes && topWidgetNodes.length
                    ? topWidgetNodes
                    : fallbackResponse?.products?.nodes ?? [];
                if (!nodes.length) return null;
                return (
                  <div className="top-widgets-grid">
                    {nodes.slice(0, 6).map((product) => (
                      <ProductItem key={product.id} product={product} />
                    ))}
                  </div>
                );
              }}
            </Await>
          )}
        </Await>
      </Suspense>
    </section>
  );
}

function WorksWithStrip() {
  return (
    <section className="works-with" aria-labelledby="works-with-heading">
      <p id="works-with-heading" className="works-with-label">
        One click install, instant download
      </p>
      <div className="works-with-row">
        {WORKS_WITH_PLATFORMS.map((platform) => (
          <span key={platform} className="works-with-item">
            <PlatformIcon platform={platform} />
            {platform}
          </span>
        ))}
      </div>
    </section>
  );
}

function ReviewsSection() {
  const fullStars = Math.round(SHOP_RATING.average);
  return (
    <section className="home-reviews" aria-labelledby="home-reviews-heading">
      <h2 id="home-reviews-heading" className="sws-section-heading">
        What streamers say
      </h2>
      <div className="home-reviews-grid">
        {SAMPLE_REVIEWS.slice(0, 3).map((review, i) => (
          <div className="chat-bubble-review" key={i}>
            <div className="chat-bubble-review-head">
              <span className="chat-bubble-review-name">Verified buyer</span>
              <span className="chat-bubble-review-stars" aria-hidden="true">
                {'★'.repeat(review.rating)}
                {'☆'.repeat(fullStars < 5 ? 5 - review.rating : 0)}
              </span>
            </div>
            <p>{review.text}</p>
          </div>
        ))}
      </div>
      <a
        href={SHOP_RATING.url}
        target="_blank"
        rel="noopener noreferrer"
        className="home-reviews-link"
      >
        {SHOP_RATING.average.toFixed(2)} stars from {SHOP_RATING.count} Etsy
        reviews →
      </a>
    </section>
  );
}

function CustomCommissionCallout() {
  return (
    <section className="commission-callout">
      <div className="commission-callout-inner sws-chip-panel">
        <h2>Premium Overlays + Widgets Custom Design</h2>
        <p>
          We build fully custom chat and goal widgets to match your exact
          stream aesthetic. Your colors, your characters, your theme.
        </p>
        <div className="commission-callout-cta-row">
          <Link className="sws-btn sws-btn-primary" to="/pages/contact">
            Get a custom setup, starting at $300
          </Link>
        </div>
      </div>
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
    media(first: 1) {
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
          }
        }
      }
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

const TOP_WIDGETS_COLLECTION_QUERY = `#graphql
  query TopWidgetsCollection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      products(first: 6) {
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
            url
            altText
            width
            height
          }
        }
      }
    }
  }
`;

/** @typedef {import('./+types/_index').Route} Route */
/** @typedef {import('storefrontapi.generated').RecommendedProductsQuery} RecommendedProductsQuery */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
