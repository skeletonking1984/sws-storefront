import {Await, useLoaderData, useRouteLoaderData, Link} from 'react-router';
import {Suspense} from 'react';
import {Image, Money} from '@shopify/hydrogen';
import {ProductItem} from '~/components/ProductItem';
import {EtsyRatingBadge, SHOP_STATS} from '~/components/EtsyRating';
import {SAMPLE_REVIEWS, SHOP_RATING} from '~/components/EtsyReviews';
import {PlatformIcon} from '~/components/PlatformIcon';
import {EmailCapture} from '~/components/EmailCapture';
import {SOCIALS} from '~/components/SocialLinks';
import {useVariantUrl} from '~/lib/variants';
import {buildMeta, getOrigin} from '~/lib/seo';
import logo from '~/assets/logo.png';
import heroWidgets from '~/assets/hero-widgets.webp';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({matches, location}) => {
  const origin = getOrigin(matches);
  return buildMeta({
    title: 'Stream Widget Shop | Animated Twitch Chat + Goal Widgets',
    description:
      'Chunky, holographic, animated chat and goal widgets for Twitch, YouTube, Kick, and multistream. Instant download, drop into OBS in minutes.',
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

  // "Kits and overlay packs" fetches four specific products by handle, same
  // aliased product(handle:) pattern as RECOMMENDED_PRODUCTS_QUERY. Some of
  // these may be brand new listings that resolve to null for a while after
  // creation in Shopify Admin, so the section below skips nulls and hides
  // itself entirely if nothing resolves. This never blocks the page.
  const kitsAndOverlayPacks = context.storefront
    .query(KITS_AND_OVERLAY_PACKS_QUERY, {
      variables: Object.fromEntries(
        KITS_AND_OVERLAY_PACKS_HANDLES.map((h, i) => [`handle${i}`, h]),
      ),
    })
    .then((response) =>
      KITS_AND_OVERLAY_PACKS_HANDLES.map((_, i) => response[`product${i}`]).filter(
        Boolean,
      ),
    )
    .catch((error) => {
      console.error(error);
      return [];
    });

  return {
    recommendedProducts,
    topWidgets,
    kitsAndOverlayPacks,
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

/**
 * Handles for the "Kits and overlay packs" homepage band. Two of these
 * (the two "stream kit" bundles) are being created in Shopify Admin
 * alongside this change and may resolve to null for a few minutes.
 */
const KITS_AND_OVERLAY_PACKS_HANDLES = [
  'spooky-stream-kit',
  'celestial-stream-kit',
  'multistream-chat-widget-pack',
  'demon-samurai-stream-overlay-pack-animated-katana-goal-bar-multistream-chat-alerts-digital-download',
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
  const rootData = useRouteLoaderData('root');
  const origin = rootData?.origin || 'https://streamwidgetshop.com';

  // Organization JSON-LD, homepage only. Real social links (single source:
  // SocialLinks.jsx), no fake reviews or data.
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Stream Widget Shop',
    url: origin,
    logo: `${origin}${logo}`,
    sameAs: SOCIALS.map((social) => social.href),
  };

  return (
    <div className="home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <Hero />
      <ShopByVibe />
      <KitsAndOverlayPacks kits={data.kitsAndOverlayPacks} />
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

function Hero() {
  return (
    <section className="hero">
      <div className="hero-grid">
        <div className="hero-copy">
          <img src={logo} alt="Stream Widget Shop" className="hero-logo" />
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

        <div className="hero-stream-frame">
          <div className="hero-stream-scanline" aria-hidden="true" />
          <img
            className="hero-stream-media"
            src={heroWidgets}
            alt="Real Stream Widget Shop widgets composited on a stream backdrop: neon animated chat and goal, a moon jar tip goal, a star goal bar, and a Y2K sticker chat"
            width={1600}
            height={1000}
            loading="eager"
            fetchPriority="high"
          />
          <Link
            to="/collections/top-widgets"
            className="hero-stream-label sws-chip"
          >
            Real widgets. Real chat. Drop into OBS.
          </Link>
        </div>
      </div>
    </section>
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

/** Strips tags from a plain-text/HTML string and collapses whitespace. */
function stripHtml(text) {
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** First sentence of `text`, capped at 110 characters. */
function firstSentenceHook(text) {
  if (!text) return null;
  const clean = stripHtml(text);
  if (!clean) return null;
  const match = clean.match(/^[^.!?]*[.!?]/);
  const sentence = (match ? match[0] : clean).trim();
  if (sentence.length <= 110) return sentence;
  return `${sentence.slice(0, 109).trimEnd()}...`;
}

/** Maps a product's productType to the sticker tag shown on its kit card. */
function kitTagLabel(productType) {
  const normalized = (productType || '').toLowerCase();
  if (normalized.includes('overlay')) return 'OVERLAY PACK';
  if (normalized.includes('bundle')) return 'KIT';
  return null;
}

/** "Save $X", or null if there's no compareAtPrice or it isn't a real discount. */
function formatSavings(price, compareAtPrice) {
  if (!price || !compareAtPrice) return null;
  const priceAmount = parseFloat(price.amount);
  const compareAmount = parseFloat(compareAtPrice.amount);
  const diff = compareAmount - priceAmount;
  if (!(diff > 0)) return null;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: price.currencyCode,
    minimumFractionDigits: diff % 1 === 0 ? 0 : 2,
  }).format(diff);
}

/**
 * @param {{
 *   kits: Promise<any[]>;
 * }}
 */
function KitsAndOverlayPacks({kits}) {
  return (
    <Suspense fallback={null}>
      <Await resolve={kits}>
        {(nodes) => {
          const products = (nodes || []).filter(Boolean);
          if (!products.length) return null;
          return (
            <section className="kits-band" aria-labelledby="kits-heading">
              <p className="sws-section-eyebrow kits-eyebrow">
                Save with a kit
              </p>
              <h2 id="kits-heading" className="sws-section-heading kits-heading">
                Whole-stream looks in one download
              </h2>
              <div className="kits-grid">
                {products.map((product) => (
                  <KitCard key={product.id} product={product} />
                ))}
              </div>
              <div className="kits-band-links">
                <Link
                  className="sws-btn sws-btn-ghost"
                  to="/collections/bundles"
                >
                  See all kits
                </Link>
                <Link
                  className="sws-btn sws-btn-ghost"
                  to="/collections/overlays"
                >
                  All overlays
                </Link>
              </div>
            </section>
          );
        }}
      </Await>
    </Suspense>
  );
}

function KitCard({product}) {
  const variantUrl = useVariantUrl(product.handle);
  const variant = product.selectedOrFirstAvailableVariant;
  const price = variant?.price;
  const compareAtPrice = variant?.compareAtPrice;
  const savings = formatSavings(price, compareAtPrice);
  const tagLabel = kitTagLabel(product.productType);
  const hook = firstSentenceHook(product.description);

  return (
    <Link className="kit-card" to={variantUrl} prefetch="intent">
      {product.featuredImage && (
        <div className="kit-card-image">
          {tagLabel && <span className="kit-card-tag">{tagLabel}</span>}
          <Image
            alt={product.featuredImage.altText || product.title}
            data={product.featuredImage}
            sizes="(min-width: 45em) 600px, 100vw"
          />
        </div>
      )}
      <div className="kit-card-body">
        <h3>{product.title}</h3>
        {hook && <p className="kit-card-hook">{hook}</p>}
        <div className="kit-card-footer">
          {price && (
            <span className="kit-card-price-pill">
              {compareAtPrice && (
                <s className="kit-card-compare-price">
                  <Money data={compareAtPrice} />
                </s>
              )}
              <Money data={price} />
            </span>
          )}
          {savings && (
            <span className="kit-card-savings">Save {savings}</span>
          )}
        </div>
      </div>
    </Link>
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

const KITS_AND_OVERLAY_PACKS_QUERY = `#graphql
  fragment KitOrOverlayPackProduct on Product {
    id
    title
    handle
    productType
    description
    featuredImage {
      id
      url
      altText
    }
    selectedOrFirstAvailableVariant {
      price {
        amount
        currencyCode
      }
      compareAtPrice {
        amount
        currencyCode
      }
    }
  }
  query KitsAndOverlayPacks (
    $country: CountryCode
    $language: LanguageCode
    $handle0: String!
    $handle1: String!
    $handle2: String!
    $handle3: String!
  ) @inContext(country: $country, language: $language) {
    product0: product(handle: $handle0) { ...KitOrOverlayPackProduct }
    product1: product(handle: $handle1) { ...KitOrOverlayPackProduct }
    product2: product(handle: $handle2) { ...KitOrOverlayPackProduct }
    product3: product(handle: $handle3) { ...KitOrOverlayPackProduct }
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
          }
        }
      }
    }
  }
`;

/** @typedef {import('./+types/_index').Route} Route */
/** @typedef {import('storefrontapi.generated').RecommendedProductsQuery} RecommendedProductsQuery */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
