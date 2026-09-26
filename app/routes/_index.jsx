import {Await, useLoaderData, useRouteLoaderData, Link} from 'react-router';
import {ResponsiveImage} from '~/components/ResponsiveImage';
import {Suspense, useEffect, useState} from 'react';
import {Money} from '@shopify/hydrogen';
import {ProductItem} from '~/components/ProductItem';
import {EtsyRatingBadge, SHOP_STATS} from '~/components/EtsyRating';
import {SHOP_RATING} from '~/components/EtsyReviews';
// Full per-product Etsy review dataset, review text included. SERVER USE
// ONLY (see scripts/build-etsy-reviews.mjs). Only ever referenced from
// pickHomeReviews(), which is only called from loadCriticalData below, so
// the homepage's client bundle never ships every product's review text.
import etsyReviews from '~/data/etsy-reviews.json';
// Ranked by REAL Etsy revenue, filtered for IP risk, resolved active. Small
// (8 entries), unlike etsyReviews, but still only ever read in the loader.
// Rebuilt by scripts/refresh-best-sellers.mjs (see CLAUDE.md/LAUNCH.md).
import bestSellersData from '~/data/best-sellers.json';
import {PlatformIcon} from '~/components/PlatformIcon';
import {EmailCapture} from '~/components/EmailCapture';
import {HappyClients} from '~/components/HappyClients';
import {SOCIALS} from '~/components/SocialLinks';
import {useVariantUrl} from '~/lib/variants';
import {hasRealDiscount} from '~/lib/price';
import {isIpRisky} from '~/lib/productFeed';
import {absoluteAsset, buildMeta, getOrigin} from '~/lib/seo';
import {handleNewsletterSignup} from '~/lib/newsletter.server';
import {FAN_FAVORITE_HANDLES, VIBES, WORKS_WITH_PLATFORMS} from '~/lib/nav';
import logo from '~/assets/logo.webp';
import logoStacked from '~/assets/logo.webp';
import pfp from '~/assets/pfp.webp';
import heroWidgets from '~/assets/hero-widgets-opt.webp';
import heroClipMp4 from '~/assets/hero-widgets.mp4';
import heroClipWebm from '~/assets/hero-widgets.webm';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({matches, location}) => {
  const origin = getOrigin(matches);
  return buildMeta({
    // 60 chars exactly, which is the ceiling before Google truncates. Twitch
    // stays first because it is the highest volume term and most of the
    // catalogue is Twitch; Multistream earns its place because the kits and
    // the multistream chat widgets are the highest priced products in the
    // shop and nothing else in the title reached that buyer.
    title: 'Stream Widget Shop | Twitch, Multistream Chat + Goal Widgets',
    description: HOME_DESCRIPTION,
    url: `${origin}${location.pathname}`,
  });
};

/**
 * The homepage meta description, built from the SAME shop numbers the page
 * renders, so the SERP snippet can never drift from what a visitor lands on.
 *
 * Rewritten 2026-09-17, after Todd pointed at the Google result for "stream
 * widget shop". Three things were wrong with the old line, "Chunky,
 * holographic, animated chat and goal widgets for Twitch, YouTube, Kick, and
 * multistream. Instant download, drop into OBS in minutes.":
 *
 * - It opened on two adjectives nobody searches, "Chunky, holographic",
 *   spending the only part of the snippet a scanner reads on decoration.
 * - "widgets for Twitch, YouTube, Kick" reads as a blanket claim that the
 *   catalogue supports all three. It does not: Twitch is the baseline on all
 *   122 products, and YouTube and Kick exist on the multistream products
 *   specifically. That is the exact overclaim purged from all 122 product
 *   pages on 2026-09-14 and 2026-09-17, and leaving it on the homepage let
 *   the front door contradict the standard every page behind it now meets.
 *   "plus multistream versions for YouTube and Kick" is the true sentence
 *   and sells the higher priced products rather than the cheap ones.
 * - It carried no reason to click over the Etsy result sitting above it.
 *   The shop's own real numbers are the strongest thing available and they
 *   were nowhere in the snippet.
 *
 * Google may still write its own snippet; on the day this was looked at it
 * had stitched one out of page fragments and ended it with a bare
 * "$139.82 $39.99 ... starting at $300". Nothing here can force Google's
 * hand. An accurate, specific, in-length description is the part that is
 * ours, and the stray price text is addressed separately below.
 */
const soldFloor = Math.floor(SHOP_STATS.soldCount / 500) * 500;
export const HOME_DESCRIPTION =
  `Animated chat and goal widgets for Twitch, plus multistream versions for ` +
  `YouTube and Kick. Instant download, drop into OBS. ` +
  `${soldFloor.toLocaleString('en-US')}+ sold, rated ${SHOP_RATING.average}/5.`;

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
    homeReviews: pickHomeReviews(),
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

  /*
   * "Best sellers" is ordered by WHAT ACTUALLY SELLS, refreshed by
   * scripts/refresh-best-sellers.mjs into data/best-sellers.json (which in
   * turn calls scripts/build-top-sellers.mjs for the Etsy revenue pull).
   *
   * The obvious alternative, sortKey: BEST_SELLING, is worse and it is worth
   * saying why so nobody "simplifies" this back. Shopify's best-selling signal
   * counts SHOPIFY orders, and this shop took 7 of those in 90 days against
   * 769 on Etsy. Measured 2026-09-21, BEST_SELLING drops the Multistream Chat
   * Widget out of the top 6 entirely, and that is Etsy's number one by a wide
   * margin: 80 units, $1,171, 16.6% of all revenue. An ordering that hides the
   * best seller is not better than a frozen one.
   *
   * refresh-best-sellers.mjs already dropped anything do-not-use-ip tagged or
   * IP_TERMS matched before writing the file; filtered again here defensively
   * in case the committed file goes stale between refreshes.
   *
   * Falls through to the curated fan-favourites list below if the handles stop
   * resolving, which they will if a product is drafted between refreshes.
   */
  const bestSellers = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY, {
      variables: Object.fromEntries(
        BEST_SELLER_HANDLES.map((h, i) => [`handle${i}`, h]),
      ),
    })
    .then((response) =>
      BEST_SELLER_HANDLES.map((_, i) => response[`product${i}`])
        .filter(Boolean)
        .filter((product) => !isExcludedFromHome(product))
        /* Carry the real unit count onto the node so the card can show it.
         * Attached here rather than threaded through as a prop because the
         * band already passes whole product objects down two Await layers. */
        .map((product) => ({
          ...product,
          soldUnits: SOLD_UNITS.get(product.handle) ?? null,
          soldWindowDays: bestSellersData?.window?.days ?? null,
        })),
    )
    .catch((error) => {
      console.error(error);
      return null;
    });

  /*
   * "New arrivals": the newest ACTIVE products, Storefront API sortKey
   * CREATED_AT reverse. Todd asked for this alongside best sellers 2026-09-25
   * so a new pack or widget has somewhere to be seen before it has sold
   * anything (best sellers structurally can't show it yet).
   *
   * `-tag:do-not-use-ip` excludes at the API level; isExcludedFromHome below
   * is the same defensive second check as the best sellers band, catching an
   * IP-named product that hasn't been tagged yet (see app/lib/ipTerms.js).
   * Fetches 16 and slices to 8 so a few exclusions don't thin the row.
   */
  const newArrivals = context.storefront
    .query(NEW_ARRIVALS_QUERY, {
      variables: {first: 16, query: '-tag:do-not-use-ip'},
    })
    .then((response) =>
      (response?.products?.nodes ?? [])
        .filter(Boolean)
        .filter((product) => !isExcludedFromHome(product))
        .slice(0, 8),
    )
    .catch((error) => {
      console.error(error);
      return [];
    });

  /*
   * "Kits and overlay packs" reads the two collections rather than a handle
   * list, so a new pack reaches the homepage by existing, not by a deploy.
   *
   * It used to be four hardcoded handles. Slow Pour went live on 2026-09-14
   * and was still missing from this band a week later, because nothing about
   * publishing a product touches a constant in a source file. Todd asked for
   * new ones to show up on their own, and this is that.
   *
   * See pickKitsBand for the ordering. Nulls and a missing collection are both
   * survivable: the section hides itself if nothing resolves, and never blocks
   * the page.
   */
  const kitsAndOverlayPacks = context.storefront
    .query(KITS_AND_OVERLAY_PACKS_QUERY)
    .then((response) => pickKitsBand(response))
    .catch((error) => {
      console.error(error);
      return [];
    });

  // Seasonal Halloween band. Fetched only inside the season window so the
  // storefront never spends a Storefront API round trip on a section that
  // cannot render, and so the band retires itself without a deploy.
  const halloweenProducts = isHalloweenSeason()
    ? context.storefront
        .query(HALLOWEEN_COLLECTION_QUERY, {
          variables: {handle: HALLOWEEN_COLLECTION_HANDLE},
        })
        .then((response) => response?.collection?.products?.nodes ?? null)
        .catch((error) => {
          console.error(error);
          return null;
        })
    : null;

  return {
    recommendedProducts,
    bestSellers,
    newArrivals,
    kitsAndOverlayPacks,
    halloweenProducts,
  };
}

/**
 * Shared IP-safety gate for the homepage's non-curated bands (best sellers,
 * new arrivals). The curated bands (kits, Halloween) already read from named
 * collections a human maintains; these two are built from raw rankings/sort
 * orders, so nothing stops an IP-named product from earning or shipping its
 * way in. `do-not-use-ip` is the tag; IP_TERMS (app/lib/ipTerms.js, shared
 * with the product feed) is the same check applied to title/tags, for a
 * product that earns under a renamed title before the tag lands on it.
 * @param {{title?: string; tags?: string[]}} product
 */
function isExcludedFromHome(product) {
  const tags = product?.tags || [];
  return tags.includes('do-not-use-ip') || isIpRisky({title: product?.title, tags});
}

/** Smart collection in Shopify Admin, rule: TAG EQUALS `halloween`. */
export const HALLOWEEN_COLLECTION_HANDLE = 'halloween';

/**
 * The window the Halloween band is allowed to show in, as [month, day]
 * inclusive, evaluated in UTC. Starts mid-September because that is when
 * streamers start building October scenes, and runs two days past the 31st
 * so anyone who streamed on the night still lands on it.
 *
 * Keeping the season here, rather than flipping a boolean by hand, means
 * the band appears and disappears on its own every year. Widen it by
 * editing these two pairs.
 */
const HALLOWEEN_SEASON = {start: [9, 15], end: [11, 2]};

/** True while `date` sits inside HALLOWEEN_SEASON. */
export function isHalloweenSeason(date = new Date()) {
  const key = (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  const [startMonth, startDay] = HALLOWEEN_SEASON.start;
  const [endMonth, endDay] = HALLOWEEN_SEASON.end;
  return key >= startMonth * 100 + startDay && key <= endMonth * 100 + endDay;
}

/**
 * The eight handles the "Best sellers" band asks for, highest earning first.
 *
 * RECOMMENDED_PRODUCTS_QUERY declares handle0 through handle7 as non-null, so
 * this has to be exactly eight even on a thin week. Short lists are padded from
 * the curated fan favourites rather than by repeating a handle, so a padded
 * slot still renders a real product instead of a duplicate card.
 */
const BEST_SELLER_HANDLES = (() => {
  const ranked = (bestSellersData?.handles ?? []).slice(0, 8);
  const seen = new Set(ranked);
  for (const handle of FAN_FAVORITE_HANDLES) {
    if (ranked.length >= 8) break;
    if (!seen.has(handle)) {
      seen.add(handle);
      ranked.push(handle);
    }
  }
  return ranked;
})();

/**
 * handle -> units sold in the ranking window, for the proof line on a card.
 *
 * These are ETSY units. That is not a sleight of hand: the hero has always
 * shown the Etsy lifetime count as "7,576+ widgets sold", and the widget
 * genuinely sold that many. Nothing here claims they were Shopify orders, and
 * the number is never rounded, invented or padded, per the no-fake-social-proof
 * rule. If the join loses a product it shows nothing rather than a zero.
 */
const SOLD_UNITS = new Map(
  (bestSellersData?.detail ?? []).map((row) => [row.handle, row.units]),
);

/** How many cards the kits band shows. The grid is 2 across, so 4 is two rows. */
const KITS_BAND_SIZE = 4;

/**
 * Which four products the kits band shows, given the collection query.
 *
 * SLOT 1 IS ALWAYS THE NEWEST PACK. The rest are best sellers. That split is
 * the whole point: sorting purely by recency would have dropped the Spooky
 * Stream Kit mid-Halloween, which is the band's best earner right now, and
 * sorting purely by sales means a new pack never surfaces until it has already
 * sold, which it cannot do while it is invisible.
 *
 * Both collections are merged before sorting, because a kit and an overlay
 * pack compete for the same slot and Shopify keeps them apart (`bundles` is
 * productType Bundle, `overlays` is Overlay Pack).
 *
 * Exported so it can be reasoned about and tested without a network call.
 *
 * @param {any} response
 * @param {number} limit
 * @returns {any[]}
 */
export function pickKitsBand(response, limit = KITS_BAND_SIZE) {
  const nodes = (key) => response?.[key]?.products?.nodes ?? [];

  const newest = [...nodes('overlaysNewest'), ...nodes('bundlesNewest')]
    .filter(Boolean)
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  const best = [...nodes('bundlesBest'), ...nodes('overlaysBest')].filter(Boolean);

  const out = [];
  const seen = new Set();
  const push = (product) => {
    if (!product || out.length >= limit || seen.has(product.id)) return;
    seen.add(product.id);
    out.push(product);
  };

  push(newest[0]);
  best.forEach(push);
  // Backfill, for the case where best sellers are thin or a collection is
  // empty. Without this a young catalogue would render a one-card band.
  newest.forEach(push);
  return out;
}

/**
 * Newsletter signup from the homepage email capture. Returns `intent` on
 * every result so the component only reacts to its own submissions if another
 * form is ever added to this route.
 * @param {Route.ActionArgs} args
 */
export async function action({request, context}) {
  const formData = await request.formData();
  const result = await handleNewsletterSignup({
    formData,
    env: context.env,
    origin: new URL(request.url).origin,
    source: 'homepage capture',
    storefront: context.storefront,
  });
  return {intent: 'newsletter', ...result};
}

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
    logo: absoluteAsset(origin, logo),
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
      {/*
        Best sellers and New arrivals sit directly under the hero, ABOVE Shop
        by vibe, the kits band and everything else. Todd, 2026-09-25: "we need
        to promote top sellers and new ones on the home somehow" -- both rows
        used to be one section ("Top widgets") lower down the page, tuned by
        the 2026-09-13 scroll-depth measurement below; that measurement was
        about the kits band pushing sellers down, not about vibe chips, so
        moving these two rows above Shop by vibe doesn't fight it.
        The hero's "See it live" link points at #best-sellers.
      */}
      <BestSellers
        bestSellers={data.bestSellers}
        fallback={data.recommendedProducts}
      />
      <NewArrivals newArrivals={data.newArrivals} />
      <ShopByVibe />
      {/*
        Seasonal band: for the six weeks it is live it IS the highest-intent
        shelf in the shop, and it is made of products rather than decoration,
        so it does not cost a phone visitor a screen of scrolling before
        reaching something buyable. Outside the season window it renders
        nothing at all.
      */}
      <HalloweenBand products={data.halloweenProducts} />
      {/*
        Kits band sits below best sellers/new arrivals/vibe/Halloween.
        Measured on the live site at 375px on 2026-09-13: the kits band alone
        is 2372px tall, so it stays low, after the cheaper, faster-to-scan
        rows above it. The kits are also the most expensive things in the
        catalogue ($29.99 to $68.35), so this still asks for the biggest
        commitment last.
      */}
      <KitsAndOverlayPacks kits={data.kitsAndOverlayPacks} />
      <WorksWithStrip />
      <ReviewsSection homeReviews={data.homeReviews} />
      <HappyClients />
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
          {/* The pfp rides alongside the hero lockup for the same reason it
              is in the header: it is the mark people recognise from X and
              Etsy, and the wordmark on its own reads as a different shop.
              Decorative next to the lockup, so alt is empty. Remove when the
              new logo work lands. */}
          <div className="hero-brand">
            <img
              className="brand-pfp hero-pfp"
              src={pfp}
              alt=""
              aria-hidden="true"
              width="200"
              height="200"
            />
            <img
              src={logoStacked}
              alt="Stream Widget Shop"
              className="hero-logo"
              width="560"
              height="156"
              /*
               * Lighthouse named this exact element as the LCP on the live
               * homepage and its one failing check was "fetchpriority=high
               * should be applied". It was already eager and discoverable in
               * the initial document, just queued behind everything else.
               */
              fetchPriority="high"
            />
          </div>
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
            <Link className="sws-btn sws-btn-ghost" to="#best-sellers">
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
            width={1200}
            height={750}
            loading="eager"
            fetchPriority="high"
          />
          <HeroStreamClip />
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

/**
 * The moon jar, running, layered over the still.
 *
 * These are animated products and a photograph of one says nothing about what
 * it does, so the hero plays a 17 second clip of the real Moon Jar Goal widget
 * filling from real tip, sub, follow and cheer events. Built by
 * `hero/record.mjs`; `hero/hero-video.html` is the same 1600x1000 composite the
 * still comes from, with the jar swapped for the live widget.
 *
 * Three deliberate choices, all about not making the hero worse:
 *
 * 1. The <img> above stays exactly as it was and keeps rendering first. It is
 *    the LCP element on this page and PageSpeed is already tight, so the clip
 *    layers ON TOP rather than replacing it. If the video 404s, is blocked, or
 *    never decodes, the page looks precisely as it did before.
 * 2. Nothing is rendered on the server. The video element only mounts after
 *    hydration, so it cannot compete with the poster for the first paint and it
 *    adds no bytes to the critical path.
 * 3. `prefers-reduced-motion` is checked before mounting rather than after, so
 *    a reader who asked for stillness never downloads the clip at all. Pausing
 *    it afterwards would still have cost them the megabyte.
 *
 * The tilt is not baked into the video. `.hero-stream-frame` carries
 * `transform: rotate(3deg)` and the clip inherits it, along with the scanline
 * and the rounded border.
 */
function HeroStreamClip() {
  const [motionOk, setMotionOk] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setMotionOk(!mq.matches);
    const onChange = (e) => setMotionOk(!e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (!motionOk) return null;

  return (
    <video
      className={`hero-stream-clip${ready ? ' is-ready' : ''}`}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden="true"
      tabIndex={-1}
      onCanPlay={() => setReady(true)}
    >
      <source src={heroClipWebm} type="video/webm" />
      <source src={heroClipMp4} type="video/mp4" />
    </video>
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
  // formatSavings already returns null for a non-discount, but the pill
  // below used to gate the struck-through price on `compareAtPrice` being
  // merely truthy, which rendered a fake "was $12.00 now $12.00" whenever
  // Shopify had compareAtPrice set equal to (or under) price. hasRealDiscount
  // is the one shared gate every price render uses now (app/lib/price.js).
  const onSale = hasRealDiscount(price, compareAtPrice);
  const savings = formatSavings(price, compareAtPrice);
  const tagLabel = kitTagLabel(product.productType);
  const hook = firstSentenceHook(product.description);

  return (
    <Link className="kit-card" to={variantUrl} prefetch="intent">
      {product.featuredImage && (
        <div className="kit-card-image">
          {tagLabel && <span className="kit-card-tag">{tagLabel}</span>}
          <ResponsiveImage
            alt={product.featuredImage.altText || product.title}
            data={product.featuredImage}
            sizes="(min-width: 45em) 600px, 90vw"
          />
        </div>
      )}
      <div className="kit-card-body">
        <h3>{product.title}</h3>
        {hook && <p className="kit-card-hook">{hook}</p>}
        <div className="kit-card-footer">
          {price && (
            /*
             * The two prices are labelled, and not only for screen readers.
             * Stripped of markup this pill used to read as two bare numbers,
             * "$139.82 $39.99", and on 2026-09-17 Google had lifted exactly
             * that pair into the homepage search snippet, where it looks like
             * a broken price widget. A strikethrough carries its meaning in
             * CSS, so anything reading the text alone (a crawler, a screen
             * reader, an answer engine) sees a discount as a price rise.
             */
            <span className="kit-card-price-pill">
              {onSale && (
                <s className="kit-card-compare-price">
                  <span className="sr-only">Regular price </span>
                  <Money data={compareAtPrice} />
                </s>
              )}
              <span className="sr-only">
                {onSale ? 'Sale price ' : 'Price '}
              </span>
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
 * Seasonal Halloween shelf. `products` is null outside the season window
 * (see isHalloweenSeason), and the section also hides itself if the
 * `halloween` collection is missing or empty in Admin, so a collection
 * rename can never leave an empty band on the homepage.
 * @param {{products: Promise<any[] | null> | null}}
 */
function HalloweenBand({products}) {
  if (!products) return null;
  return (
    <Suspense fallback={null}>
      <Await resolve={products}>
        {(nodes) => {
          const items = (nodes || []).filter(Boolean);
          if (!items.length) return null;
          return (
            <section
              className="halloween-band"
              id="halloween"
              aria-labelledby="halloween-heading"
            >
              <div className="halloween-bats" aria-hidden="true">
                <span className="halloween-bat" />
                <span className="halloween-bat" />
                <span className="halloween-bat" />
              </div>
              <p className="sws-section-eyebrow halloween-eyebrow">
                Spooky season
              </p>
              <h2
                id="halloween-heading"
                className="sws-section-heading halloween-heading"
              >
                Halloween widgets, live before October
              </h2>
              <p className="halloween-sub">
                Pumpkin, ghost, cauldron and skull goal meters that fill as
                tips land, plus spooky chat boxes and full overlay kits.
                Instant download, drop into OBS.
              </p>
              <div className="halloween-grid">
                {items.slice(0, 8).map((product, index) => (
                  <ProductItem
                    key={product.id}
                    product={product}
                    listId="home-halloween"
                    listName="Halloween"
                    index={index}
                    /* sits under the section's own <h2> */
                    headingLevel={3}
                  />
                ))}
              </div>
              <div className="halloween-links">
                <Link
                  className="sws-btn sws-btn-primary"
                  to={`/collections/${HALLOWEEN_COLLECTION_HANDLE}`}
                >
                  Shop all Halloween
                </Link>
                <Link
                  className="sws-btn sws-btn-ghost"
                  to="/products/spooky-stream-kit"
                >
                  Get the Spooky Stream Kit
                </Link>
              </div>
            </section>
          );
        }}
      </Await>
    </Suspense>
  );
}

/**
 * Real revenue, real rank, see the loader comment above `bestSellers` for why
 * this is Etsy revenue rather than Shopify's BEST_SELLING sort. 8 cards: a
 * horizontal scroll row at phone widths (`.home-shelf-grid`), a grid from
 * tablet up. "Shop all" points at the real `best-sellers` Shopify collection
 * (created/synced by scripts/refresh-best-sellers.mjs's printed Admin
 * procedure, see LAUNCH.md) so the same rank order holds off the homepage too.
 * @param {{
 *   bestSellers: Promise<any[] | null>;
 *   fallback: Promise<RecommendedProductsQuery | null>;
 * }}
 */
function BestSellers({bestSellers, fallback}) {
  return (
    <section
      className="home-shelf best-sellers"
      id="best-sellers"
      aria-labelledby="best-sellers-heading"
    >
      <div className="home-shelf-head">
        <h2 id="best-sellers-heading" className="sws-section-heading">
          Best sellers
        </h2>
        <Link className="sws-btn sws-btn-ghost home-shelf-link" to="/collections/best-sellers">
          Shop all
        </Link>
      </div>
      <Suspense fallback={<div className="home-shelf-grid" />}>
        <Await resolve={bestSellers}>
          {(bestSellerNodes) => (
            <Await resolve={fallback}>
              {(fallbackResponse) => {
                const nodes =
                  bestSellerNodes && bestSellerNodes.length
                    ? bestSellerNodes
                    : fallbackResponse?.products?.nodes ?? [];
                if (!nodes.length) return null;
                return (
                  <div className="home-shelf-grid">
                    {nodes.slice(0, 8).map((product, index) => (
                      <ProductItem
                        key={product.id}
                        product={product}
                        listId="home-best-sellers"
                        listName="Best sellers"
                        index={index}
                        /* sits under the section's own <h2> */
                        headingLevel={3}
                      />
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

/**
 * Newest ACTIVE products, Storefront API sortKey CREATED_AT reverse (see the
 * loader's `newArrivals` fetch). Same shelf treatment as Best sellers, plus a
 * small "New" chip on each card so it reads as a distinct promise (untested,
 * just launched) rather than a second best-sellers row. "Shop all" sorts the
 * full catalogue the same way, no Admin collection needed for this one.
 * @param {{newArrivals: Promise<any[]>}}
 */
function NewArrivals({newArrivals}) {
  return (
    <section
      className="home-shelf new-arrivals"
      id="new-arrivals"
      aria-labelledby="new-arrivals-heading"
    >
      <div className="home-shelf-head">
        <h2 id="new-arrivals-heading" className="sws-section-heading">
          New arrivals
        </h2>
        <Link
          className="sws-btn sws-btn-ghost home-shelf-link"
          to="/collections/all?sort=newest"
        >
          Shop all
        </Link>
      </div>
      <Suspense fallback={<div className="home-shelf-grid" />}>
        <Await resolve={newArrivals}>
          {(nodes) => {
            const items = (nodes || []).filter(Boolean);
            if (!items.length) return null;
            return (
              <div className="home-shelf-grid">
                {items.slice(0, 8).map((product, index) => (
                  <ProductItem
                    key={product.id}
                    product={product}
                    listId="home-new-arrivals"
                    listName="New arrivals"
                    index={index}
                    /* sits under the section's own <h2> */
                    headingLevel={3}
                    badge="New"
                  />
                ))}
              </div>
            );
          }}
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

/**
 * Real, verbatim Etsy reviews for the homepage trust strip, drawn from
 * across all products rather than tied to any one listing. Picks the 3
 * most recent 5 star reviews with at least 40 characters of text, so the
 * homepage doesn't surface a one-word quote. Still real reviews, just
 * selected for length.
 */
function pickHomeReviews() {
  const allReviews = Object.values(etsyReviews.products).flatMap((product) =>
    product.reviews.map((review) => ({...review, handle: product.handle})),
  );
  return allReviews
    .filter((review) => review.rating === 5 && review.text.length >= 40)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 3);
}

/**
 * @param {{homeReviews: ReturnType<typeof pickHomeReviews>}} props
 */
function ReviewsSection({homeReviews}) {
  const fullStars = Math.round(SHOP_RATING.average);
  return (
    <section className="home-reviews" aria-labelledby="home-reviews-heading">
      <h2 id="home-reviews-heading" className="sws-section-heading">
        What streamers say
      </h2>
      <div className="home-reviews-grid">
        {homeReviews.map((review, i) => (
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
            Get a custom setup, $300
          </Link>
        </div>
      </div>
    </section>
  );
}

// Shared by RECOMMENDED_PRODUCTS_QUERY (by handle, best sellers + fan
// favourites fallback) and NEW_ARRIVALS_QUERY (by sortKey). `tags` is here so
// isExcludedFromHome (the do-not-use-ip / IP_TERMS gate) has something to
// check on every band that reads this fragment.
const RECOMMENDED_PRODUCT_FRAGMENT = `#graphql
  fragment RecommendedProduct on Product {
    id
    title
    productType
    handle
    tags
    worksWith: metafield(namespace: "custom", key: "works_with") { value }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    compareAtPriceRange {
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
  }
`;

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
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
  ${RECOMMENDED_PRODUCT_FRAGMENT}
`;

/**
 * Newest ACTIVE products, for the "New arrivals" band. `query` carries the
 * `-tag:do-not-use-ip` exclusion (see the loader); `first: 16` so a handful
 * of exclusions still leave 8 to show.
 */
const NEW_ARRIVALS_QUERY = `#graphql
  query NewArrivals(
    $country: CountryCode
    $language: LanguageCode
    $first: Int!
    $query: String
  ) @inContext(country: $country, language: $language) {
    products(first: $first, sortKey: CREATED_AT, reverse: true, query: $query) {
      nodes { ...RecommendedProduct }
    }
  }
  ${RECOMMENDED_PRODUCT_FRAGMENT}
`;

const KITS_AND_OVERLAY_PACKS_QUERY = `#graphql
  fragment KitOrOverlayPackProduct on Product {
    id
    title
    handle
    productType
    description
    createdAt
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
  ) @inContext(country: $country, language: $language) {
    bundlesNewest: collection(handle: "bundles") {
      products(first: 4, sortKey: CREATED, reverse: true) {
        nodes { ...KitOrOverlayPackProduct }
      }
    }
    bundlesBest: collection(handle: "bundles") {
      products(first: 6, sortKey: BEST_SELLING) {
        nodes { ...KitOrOverlayPackProduct }
      }
    }
    overlaysNewest: collection(handle: "overlays") {
      products(first: 4, sortKey: CREATED, reverse: true) {
        nodes { ...KitOrOverlayPackProduct }
      }
    }
    overlaysBest: collection(handle: "overlays") {
      products(first: 6, sortKey: BEST_SELLING) {
        nodes { ...KitOrOverlayPackProduct }
      }
    }
  }
`;

const HALLOWEEN_COLLECTION_QUERY = `#graphql
  query HalloweenCollection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      products(first: 8) {
        nodes {
          id
          title
          handle
          productType
          worksWith: metafield(namespace: "custom", key: "works_with") { value }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          compareAtPriceRange {
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
        }
      }
    }
  }
`;


/** @typedef {import('./+types/_index').Route} Route */
/** @typedef {import('storefrontapi.generated').RecommendedProductsQuery} RecommendedProductsQuery */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
