import {Await, useLoaderData, useRouteLoaderData, Link} from 'react-router';
import {ResponsiveImage} from '~/components/ResponsiveImage';
import {Suspense, useEffect, useState} from 'react';
import {Image, Money} from '@shopify/hydrogen';
import {ProductItem, widgetKind} from '~/components/ProductItem';
import {EtsyRatingBadge, SHOP_STATS} from '~/components/EtsyRating';
import {SHOP_RATING} from '~/components/EtsyReviews';
// Full per-product Etsy review dataset, review text included. SERVER USE
// ONLY (see scripts/build-etsy-reviews.mjs). Only ever referenced from
// pickHomeReviews(), which is only called from loadCriticalData below, so
// the homepage's client bundle never ships every product's review text.
import etsyReviews from '~/data/etsy-reviews.json';
// Ranked by REAL Etsy revenue, filtered for IP risk, resolved active. Small
// (8 entries), unlike etsyReviews, but still only ever read in the loader.
// Rebuilt by scripts/refresh-best-sellers.mjs.
import bestSellersData from '~/data/best-sellers.json';
import {PlatformIcon} from '~/components/PlatformIcon';
import {TIERS} from '~/lib/bundle';
import {EmailCapture} from '~/components/EmailCapture';
import {SOCIALS} from '~/components/SocialLinks';
import {useVariantUrl} from '~/lib/variants';
import {hasRealDiscount} from '~/lib/price';
import {isIpRisky} from '~/lib/productFeed';
import {absoluteAsset, buildMeta, getOrigin} from '~/lib/seo';
import {handleNewsletterSignup} from '~/lib/newsletter.server';
import {FAN_FAVORITE_HANDLES, VIBES, WORKS_WITH_PLATFORMS} from '~/lib/nav';
import {fetchProductsByHandleWithAlias} from '~/lib/handleAliases';
import {brand} from '~/lib/brand.config';
import {
  logoWebp as logo,
  heroGoalfillWebp as heroWidgets,
  heroGoalfillPosterJpg as heroPoster,
  heroGoalfillMp4 as heroClipMp4,
  heroGoalfillWebm as heroClipWebm,
} from '~/lib/cdnAssets';

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
    title: brand.seo.defaultTitle,
    description: HOME_DESCRIPTION,
    url: `${origin}${location.pathname}`,
  });
};

/**
 * The homepage meta description, built from the SAME shop numbers the page
 * renders, so the SERP snippet can never drift from what a visitor lands on.
 *
 * Rewritten 2026-09-17, after reviewing the Google result for "stream
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
    // Stream Chat Lite homepage slot (launched 2026-09-26), see Header.jsx for
    // the same gate on the nav link.
    showPreviewFeatures: true,
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
  // FAN_FAVORITE_HANDLES carries the NEW handles for the 75 products being
  // renamed in Shopify to drop a false TikTok claim (see app/lib/
  // handleAliases.js). Until the store owner actually runs that rename, the live
  // Shopify handle is still the OLD one, and a Storefront API `product
  // (handle:)` lookup on the new handle returns null, so this falls back to
  // the alias for whichever slots come back empty.
  const recommendedProducts = fetchProductsByHandleWithAlias(
    context.storefront,
    RECOMMENDED_PRODUCTS_QUERY,
    FAN_FAVORITE_HANDLES,
  )
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
   * counts SHOPIFY orders, and most of this shop's sales history lives on Etsy.
   * BEST_SELLING drops the Multistream Chat Widget out of the top 6 entirely,
   * and that is the shop's best seller. An ordering that hides the
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
   * CREATED_AT reverse. Requested alongside best sellers 2026-09-25
   * so a new pack or widget has somewhere to be seen before it has sold
   * anything (best sellers structurally can't show it yet).
   *
   * `-tag:do-not-use-ip` excludes at the API level; isExcludedFromHome below
   * is the same defensive second check as the best sellers band, catching an
   * IP-named product that hasn't been tagged yet (see app/lib/ipTerms.js).
   * Row is 8: up to FRESH_SLOTS (2) from `fresh`, then the rest (at least 6)
   * newest-first by CREATED_AT. Fetches 16 and slices to 8, so exclusions and
   * up to FRESH_SLOTS duplicates against `fresh` still leave 6 to fill.
   *
   * The `fresh` collection (manual sort, Admin) leads the row, up to
   * FRESH_SLOTS. CREATED_AT can't see an old product that was just
   * activated or just gained a feature, so adding it to `fresh` is how it
   * reaches the homepage without a deploy (2026-10-01: keep the
   * homepage fresh). Remove it from the collection to retire it.
   */
  const newArrivals = context.storefront
    .query(NEW_ARRIVALS_QUERY, {
      variables: {
        first: 16,
        query: '-tag:do-not-use-ip',
        freshHandle: FRESH_COLLECTION_HANDLE,
        freshFirst: FRESH_SLOTS,
      },
    })
    .then((response) => {
      const seen = new Set();
      return [
        ...(response?.fresh?.products?.nodes ?? []),
        ...(response?.products?.nodes ?? []),
      ]
        .filter(Boolean)
        .filter((product) => !isExcludedFromHome(product))
        .filter((product) => !seen.has(product.id) && seen.add(product.id))
        .slice(0, 8);
    })
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
   * publishing a product touches a constant in a source file. New ones should
   * show up on their own, and this is that.
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

  /*
   * "Latest from the blog": the three newest articles from the `news` blog.
   * sortKey PUBLISHED_AT + reverse is required, the Storefront API default is
   * oldest first (see blogs.$blogHandle._index.jsx). A failed or empty query
   * resolves to null and LatestArticles renders nothing, so the page never
   * breaks on it.
   */
  const latestArticles = context.storefront
    .query(LATEST_ARTICLES_QUERY)
    .then((response) => {
      const nodes = (response?.blog?.articles?.nodes ?? []).filter(Boolean);
      return nodes.length ? nodes : null;
    })
    .catch((error) => {
      console.error(error);
      return null;
    });

  /*
   * Bundle promo art: six hand-picked products (2026-10-17: include
   * some halloween ones and fall ones in this image + the multistream
   * chat). All four are in the `widgets` collection, so they are bundle
   * eligible. If any handle stops resolving, BundlePromo fills the gap from
   * the best sellers pool, so the card never shows fewer tiles.
   */
  const bundlePromoTiles = context.storefront
    .query(BUNDLE_PROMO_TILES_QUERY, {
      variables: Object.fromEntries(
        BUNDLE_PROMO_HANDLES.map((h, i) => [`handle${i}`, h]),
      ),
    })
    .then((response) =>
      BUNDLE_PROMO_HANDLES.map((_, i) => response[`product${i}`]).filter(
        (product) =>
          product?.featuredImage?.url && !isExcludedFromHome(product),
      ),
    )
    .catch((error) => {
      console.error(error);
      return [];
    });

  return {
    recommendedProducts,
    bestSellers,
    bundlePromoTiles,
    newArrivals,
    kitsAndOverlayPacks,
    halloweenProducts,
    latestArticles,
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
  return (
    tags.includes('do-not-use-ip') || isIpRisky({title: product?.title, tags})
  );
}

/** Manual collection in Shopify Admin; its first FRESH_SLOTS products lead New arrivals. */
export const FRESH_COLLECTION_HANDLE = 'fresh';
const FRESH_SLOTS = 2;

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
 * @param {number} day  days since epoch; picks the rotating slot
 * @returns {any[]}
 */
export function pickKitsBand(
  response,
  limit = KITS_BAND_SIZE,
  day = Math.floor(Date.now() / 86400000),
) {
  const nodes = (key) => response?.[key]?.products?.nodes ?? [];

  const newest = [...nodes('overlaysNewest'), ...nodes('bundlesNewest')]
    .filter(Boolean)
    .sort(
      (a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0),
    );
  const best = [...nodes('bundlesBest'), ...nodes('overlaysBest')].filter(
    Boolean,
  );

  const out = [];
  const seen = new Set();
  const push = (product) => {
    if (!product || out.length >= limit || seen.has(product.id)) return;
    seen.add(product.id);
    out.push(product);
  };

  push(newest[0]);

  // SLOT 2 ROTATES THROUGH THE KITS THIS BAND WOULD OTHERWISE NEVER SHOW.
  // Newest plus best sellers is a closed loop: a kit that is neither new nor
  // selling can never appear, so it can never start selling. One kit per day, in best-selling order, so every kit
  // gets a turn on the homepage.
  // limit - 1: the kit this slot displaces joins the rotation too.
  const shownByDefault = new Set(
    [newest[0], ...best]
      .filter(Boolean)
      .slice(0, limit - 1)
      .map((p) => p.id),
  );
  const unseen = best.filter((product) => !shownByDefault.has(product.id));
  if (unseen.length) push(unseen[day % unseen.length]);

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
  const origin = rootData?.origin || brand.origin;

  // Organization JSON-LD, homepage only. Real social links (single source:
  // SocialLinks.jsx), no fake reviews or data.
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: brand.name,
    url: origin,
    logo: absoluteAsset(origin, logo),
    sameAs: SOCIALS.map((social) => social.href),
  };

  /*
   * Order, redesigned 2026-10-17 (the previous layout was too blocky and not
   * organized well): hero, the Bundle Builder promo, best sellers, then the rest in two
   * groups. SHOP (vibe chips, new arrivals, the seasonal shelf, kits) is all
   * the same row. PROOF AND MORE (reviews + platforms + streamers in one band,
   * custom work + free chat side by side, blog, email) closes the page. Every
   * band uses SectionHead and one spacing scale (--home-gap in app.css).
   * Best sellers keeps id="best-sellers": the hero's "See it live" links there.
   */
  return (
    <div className="home">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationJsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <Hero />
      <BundlePromo
        tiles={data.bundlePromoTiles}
        bestSellers={data.bestSellers}
        fallback={data.recommendedProducts}
      />
      <BestSellers
        bestSellers={data.bestSellers}
        fallback={data.recommendedProducts}
      />
      <ShopByVibe />
      <NewArrivals newArrivals={data.newArrivals} />
      <HalloweenBand products={data.halloweenProducts} />
      <KitsAndOverlayPacks kits={data.kitsAndOverlayPacks} />
      <TrustBand homeReviews={data.homeReviews} />
      <MoreFromSws showFreeChat={data.showPreviewFeatures} />
      <LatestArticles articles={data.latestArticles} />
      <EmailCapture />
    </div>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="hero-grid">
        <div className="hero-copy">
          {/*
            Redesigned 2026-09-28 (coordinator review pass): dropped the
            stacked pfp + logo lockup that used to open this column. The
            header already carries the logo on every page including this
            one, so repeating it here at ~260-420px wide before the h1 was
            purely a first screen the eye had to cross before reaching the
            actual message, and on a phone it pushed the h1 well down the
            fold. The eyebrow now leads instead.
          */}
          <p className="sws-section-eyebrow hero-eyebrow">
            Real widgets. Live chat and goal.
          </p>
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
          <img
            className="hero-stream-media"
            src={heroWidgets}
            alt="The real Stream Widget Shop Moon Jar goal widget filling inside a goal ring while multistream chat from YouTube, Twitch and Kick cheers it on"
            width={1200}
            height={900}
            loading="eager"
            fetchPriority="high"
          />
          <HeroStreamClip />
          <Link
            to="/collections/top-widgets"
            className="hero-stream-label sws-chip"
          >
            The real widget. Filling live.
          </Link>
        </div>
      </div>
    </section>
  );
}

/**
 * The real Neon chat + goal widgets, running, layered over the still.
 *
 * Redesigned 2026-09-28 (the previous hero was too weak and needed to
 * look good). The old hero was a 4-widget collage (neon chat+goal, moon jar,
 * star bar, Y2K chat) tilted 3deg on a busy starfield; it read cluttered and
 * dated rather than premium. This is one clean 16:9 OBS-style scene holding
 * ONE real product, the shop's own #1 revenue listing (Neon Animated Twitch
 * Chat and Goal Widget, Etsy 4333471272): the real chat box with real
 * messages animating in, and the real tip goal bar filling to its target,
 * both booted live from the actual sold widget bundles through the same
 * StreamElements shim the Widget Stage uses. No AI art anywhere in this
 * frame, same as before, just fewer, bigger, real things.
 *
 * `hero/hero-v2-video.html` boots both widgets in iframes and drives them
 * with a scripted burst of real message/tip events (see the SCRIPT const in
 * that file); `hero/compose-v2.mjs` captures a still mid-burst for the
 * poster, `hero/record-v2.mjs` records the full 13s loop. The goal hits its
 * $100 target and both widgets reboot to empty in the last 2.5s so the clip
 * loops with no visible jump.
 *
 * Three deliberate choices carried over from the original build, all about
 * not making the hero worse:
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
 * `.hero-stream-frame` no longer tilts or carries its own scanline layer (see
 * app.css), the composite's own faint scanline/vignette is the only one now,
 * so the clip inherits just the rounded border and the frame's soft ambient
 * glow.
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
      poster={heroPoster}
      aria-hidden="true"
      tabIndex={-1}
      onCanPlay={() => setReady(true)}
    >
      <source src={heroClipWebm} type="video/webm" />
      <source src={heroClipMp4} type="video/mp4" />
    </video>
  );
}

/**
 * Section header shared by every homepage band: optional eyebrow, one h2, and
 * up to two text links on the right. One look for every band is the point:
 * the page used to mix centred eyebrows, left h2s with ghost buttons, and
 * boxed bands, which read as stacked blocks (2026-10-17: too blocky
 * and not organized well).
 * @param {{id: string; eyebrow?: string; title: string; links?: {to: string; label: string}[]}} props
 */
function SectionHead({id, eyebrow, title, links = []}) {
  return (
    <header className="home-head">
      <div className="home-head-text">
        {eyebrow ? <p className="sws-section-eyebrow">{eyebrow}</p> : null}
        <h2 id={id} className="home-head-title">
          {title}
        </h2>
      </div>
      {links.length ? (
        <div className="home-head-links">
          {links.map((link) => (
            <Link key={link.to} className="home-head-link" to={link.to}>
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}

/**
 * Bundle Builder promo, directly under the hero. Discounts are live in
 * Shopify (automatic, widgets only), the tiers come from app/lib/bundle.js so
 * this copy cannot drift from /bundle or the cart. The art is real product
 * images: the hand-picked BUNDLE_PROMO_HANDLES first (multistream chat plus
 * Halloween and fall widgets), topped up from best sellers. Nothing generated.
 * @param {{
 *   tiles: Promise<any[]>;
 *   bestSellers: Promise<any[] | null>;
 *   fallback: Promise<RecommendedProductsQuery | null>;
 * }}
 */
function BundlePromo({tiles: picked, bestSellers, fallback}) {
  const [t3, t6, t9] = [...TIERS].reverse();
  return (
    <section
      className="home-sec bundle-promo"
      id="bundle-promo"
      aria-labelledby="bundle-promo-heading"
    >
      <div className="bundle-promo-inner">
        <div className="bundle-promo-copy">
          <p className="sws-section-eyebrow">Mix and match</p>
          <h2 id="bundle-promo-heading" className="bundle-promo-title">
            Build a bundle:{' '}
            <span className="bundle-promo-deal sws-holo">
              <span className="nowrap">
                {t3.min} for {t3.pct}% off,
              </span>{' '}
              <span className="nowrap">
                {t6.min} for {t6.pct}%,
              </span>{' '}
              <span className="nowrap">
                {t9.min} for {t9.pct}%
              </span>
            </span>
          </h2>
          <p className="bundle-promo-sub">
            Pick any chat and goal widgets. The more you add, the more you save,
            taken off automatically at checkout.
          </p>
          <ul className="bundle-promo-tiers" aria-label="Bundle savings">
            {[t3, t6, t9].map((t) => (
              <li key={t.min}>
                <b>{t.pct}% off</b>
                {t.min} widgets
              </li>
            ))}
          </ul>
          <Link
            className="sws-btn sws-btn-primary bundle-promo-cta"
            to="/bundle"
          >
            Build a bundle
          </Link>
        </div>
        <Suspense
          fallback={<div className="bundle-promo-art" aria-hidden="true" />}
        >
          <Await resolve={picked}>
            {(pickedNodes) => (
              <Await resolve={bestSellers}>
                {(bestNodes) => (
                  <Await resolve={fallback}>
                    {(fallbackResponse) => {
                      const pool =
                        bestNodes && bestNodes.length
                          ? bestNodes
                          : (fallbackResponse?.products?.nodes ?? []);
                      const withArt = pool.filter((p) => p?.featuredImage?.url);
                      // Widgets first (that is what the discount covers), anything
                      // else only to fill a short list.
                      const widgets = withArt.filter((p) =>
                        widgetKind(p.title, p.productType),
                      );
                      const chosen = pickedNodes ?? [];
                      const chosenIds = new Set(chosen.map((p) => p.id));
                      const tiles = [
                        ...chosen,
                        ...widgets,
                        ...withArt.filter((p) => !widgets.includes(p)),
                      ]
                        .filter(
                          (p, i) => i < chosen.length || !chosenIds.has(p.id),
                        )
                        .slice(0, 6);
                      if (!tiles.length) return null;
                      return (
                        <ul
                          className="bundle-promo-art"
                          aria-label="Widgets you can bundle"
                        >
                          {tiles.map((p) => (
                            <li key={p.id}>
                              <ResponsiveImage
                                data={p.featuredImage}
                                alt={p.featuredImage.altText || p.title}
                                sizes="(min-width: 45em) 280px, 45vw"
                                widths={[240, 400, 600]}
                                fallbackWidth={400}
                              />
                            </li>
                          ))}
                        </ul>
                      );
                    }}
                  </Await>
                )}
              </Await>
            )}
          </Await>
        </Suspense>
      </div>
    </section>
  );
}

/**
 * Up to 8 product cards: one swipe row on phones, a 2-across grid (4 rows) on
 * tablets, a 4-across grid (2 rows) on desktop.
 */
function ProductRow({products, listId, listName, badge, limit = 8}) {
  return (
    <div className="home-row">
      {products.slice(0, limit).map((product, index) => (
        <ProductItem
          key={product.id}
          product={product}
          listId={listId}
          listName={listName}
          index={index}
          /* sits under the section's own <h2> */
          headingLevel={3}
          badge={badge}
        />
      ))}
    </div>
  );
}

/**
 * Real revenue, real rank, see the loader comment above `bestSellers` for why
 * this is Etsy revenue rather than Shopify's BEST_SELLING sort. Eight cards:
 * a phone swipe row, a 2-across tablet grid, a 4-across desktop grid. "Shop all" points at the
 * real `best-sellers` Shopify collection so the same rank order holds off the
 * homepage too. Keeps id="best-sellers": the hero's "See it live" targets it.
 * @param {{
 *   bestSellers: Promise<any[] | null>;
 *   fallback: Promise<RecommendedProductsQuery | null>;
 * }}
 */
function BestSellers({bestSellers, fallback}) {
  return (
    <section
      className="home-sec best-sellers"
      id="best-sellers"
      aria-labelledby="best-sellers-heading"
    >
      <SectionHead
        id="best-sellers-heading"
        eyebrow="Most bought"
        title="Best sellers"
        links={[{to: '/collections/best-sellers', label: 'Shop all'}]}
      />
      <Suspense fallback={<div className="home-row" />}>
        <Await resolve={bestSellers}>
          {(bestSellerNodes) => (
            <Await resolve={fallback}>
              {(fallbackResponse) => {
                const nodes =
                  bestSellerNodes && bestSellerNodes.length
                    ? bestSellerNodes
                    : (fallbackResponse?.products?.nodes ?? []);
                if (!nodes.length) return null;
                return (
                  <ProductRow
                    products={nodes}
                    listId="home-best-sellers"
                    listName="Best sellers"
                  />
                );
              }}
            </Await>
          )}
        </Await>
      </Suspense>
    </section>
  );
}

/** Shop by vibe: a slim chip strip, no box and no heading block of its own. */
function ShopByVibe() {
  return (
    <section
      className="home-sec home-vibes"
      aria-labelledby="shop-by-vibe-heading"
    >
      <h2 id="shop-by-vibe-heading" className="home-vibes-label">
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
 * Newest ACTIVE products, Storefront API sortKey CREATED_AT reverse (see the
 * loader's `newArrivals` fetch). Same row as Best sellers plus a small "New"
 * chip on each card. "Shop all" sorts the full catalogue the same way.
 * @param {{newArrivals: Promise<any[]>}}
 */
function NewArrivals({newArrivals}) {
  return (
    <section
      className="home-sec new-arrivals"
      id="new-arrivals"
      aria-labelledby="new-arrivals-heading"
    >
      <SectionHead
        id="new-arrivals-heading"
        eyebrow="Just added"
        title="New arrivals"
        links={[{to: '/collections/all?sort=newest', label: 'Shop all'}]}
      />
      <Suspense fallback={<div className="home-row" />}>
        <Await resolve={newArrivals}>
          {(nodes) => {
            const items = (nodes || []).filter(Boolean);
            if (!items.length) return null;
            return (
              <ProductRow
                products={items}
                listId="home-new-arrivals"
                listName="New arrivals"
                badge="New"
              />
            );
          }}
        </Await>
      </Suspense>
    </section>
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
              className="home-sec halloween-band"
              id="halloween"
              aria-labelledby="halloween-heading"
            >
              <SectionHead
                id="halloween-heading"
                eyebrow="Spooky season"
                title="Halloween widgets"
                links={[
                  {
                    to: `/collections/${HALLOWEEN_COLLECTION_HANDLE}`,
                    label: 'Shop all Halloween',
                  },
                  {
                    to: '/products/spooky-stream-kit',
                    label: 'Spooky Stream Kit',
                  },
                ]}
              />
              <p className="halloween-sub">
                Pumpkin, ghost, cauldron and skull goal meters that fill as tips
                land, plus spooky chat boxes and full overlay kits. Instant
                download, drop into OBS.
              </p>
              <ProductRow
                products={items}
                listId="home-halloween"
                listName="Halloween"
              />
            </section>
          );
        }}
      </Await>
    </Suspense>
  );
}

/**
 * Kits and overlay packs. The daily rotation lives in pickKitsBand (commit
 * 0dddf94) and is untouched; this only lays the four it returns out as a row.
 * @param {{kits: Promise<any[]>}}
 */
function KitsAndOverlayPacks({kits}) {
  return (
    <Suspense fallback={null}>
      <Await resolve={kits}>
        {(nodes) => {
          const products = (nodes || []).filter(Boolean);
          if (!products.length) return null;
          return (
            <section
              className="home-sec kits-band"
              aria-labelledby="kits-heading"
            >
              <SectionHead
                id="kits-heading"
                eyebrow="Save with a kit"
                title="Whole-stream looks in one download"
                links={[
                  {to: '/collections/bundles', label: 'See all kits'},
                  {to: '/collections/overlays', label: 'All overlays'},
                ]}
              />
              <div className="home-row home-row--kits">
                {products.map((product) => (
                  <KitCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          );
        }}
      </Await>
    </Suspense>
  );
}

/**
 * Social proof in one band: the real Etsy reviews, the platforms the widgets
 * run on, and the streamers who bought. Was three separate full-width bands.
 * @param {{homeReviews: ReturnType<typeof pickHomeReviews>}} props
 */
function TrustBand({homeReviews}) {
  const fullStars = Math.round(SHOP_RATING.average);
  return (
    <section
      className="home-sec home-trust"
      aria-labelledby="home-reviews-heading"
    >
      <SectionHead
        id="home-reviews-heading"
        eyebrow="Real Etsy reviews"
        title="What streamers say"
      />
      <div className="home-row home-row--3">
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
      <WorksWithStrip />
    </section>
  );
}

function WorksWithStrip() {
  if (!brand.features.platformBadges) return null;
  return (
    <div
      className="works-with"
      role="group"
      aria-labelledby="works-with-heading"
    >
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
    </div>
  );
}

/**
 * Two calls to action that used to be two separate full-width bands (custom
 * work and the free chat widget), side by side on a desktop and stacked on a
 * phone.
 */
function MoreFromSws({showFreeChat}) {
  return (
    <section
      className="home-sec home-more"
      aria-label="More from Stream Widget Shop"
    >
      <div className="home-more-card home-more-card--custom">
        <h2>Premium Overlays + Widgets Custom Design</h2>
        <p>
          We build fully custom chat and goal widgets to match your exact stream
          aesthetic. Your colors, your characters, your theme.
        </p>
        <Link className="sws-btn sws-btn-primary" to="/pages/custom-widgets">
          Custom setups from $300
        </Link>
      </div>
      {showFreeChat ? (
        <div className="home-more-card home-more-card--free">
          <h2>New: Stream Chat Lite, free</h2>
          <p>
            A multistream chat overlay that merges Twitch and Kick chat into
            one. Sign up for the email list and it is yours, free.
          </p>
          <Link to="/free-chat-widget" className="sws-btn sws-btn-ghost">
            Get Stream Chat Lite free
          </Link>
        </div>
      ) : null}
    </section>
  );
}

/**
 * "Latest from the blog": three newest articles, same row as the product
 * shelves. Hides itself if the query fails or is empty.
 */
function LatestArticles({articles}) {
  return (
    <Suspense fallback={null}>
      <Await resolve={articles}>
        {(nodes) => {
          const items = (nodes || []).filter(Boolean).slice(0, 3);
          if (!items.length) return null;
          return (
            <section
              className="home-sec home-articles"
              id="latest-articles"
              aria-labelledby="latest-articles-heading"
            >
              <SectionHead
                id="latest-articles-heading"
                eyebrow="From the blog"
                title="Latest from the blog"
                links={[{to: '/blogs/news', label: 'Read the blog'}]}
              />
              <div className="home-row home-row--3">
                {items.map((article) => {
                  const blurb = articleBlurb(article);
                  return (
                    <article className="blog-article" key={article.handle}>
                      <Link to={`/blogs/news/${article.handle}`}>
                        {article.image && (
                          <div className="blog-article-image">
                            <Image
                              alt={article.image.altText || article.title}
                              data={article.image}
                              loading="lazy"
                              sizes="(min-width: 65em) 33vw, (min-width: 40em) 50vw, 78vw"
                            />
                          </div>
                        )}
                        <h3>{article.title}</h3>
                        {blurb && (
                          <p className="blog-article-excerpt home-article-excerpt">
                            {blurb}
                          </p>
                        )}
                        <small>
                          <time dateTime={article.publishedAt}>
                            {ARTICLE_DATE_FORMAT.format(
                              new Date(article.publishedAt),
                            )}
                          </time>
                        </small>
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        }}
      </Await>
    </Suspense>
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
          {savings && <span className="kit-card-savings">Save {savings}</span>}
        </div>
      </div>
    </Link>
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
  return (
    allReviews
      .filter((review) => review.rating === 5 && review.text.length >= 40)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      // One real review can be left on several listings; show each text once.
      .filter(
        (review, i, all) => all.findIndex((r) => r.text === review.text) === i,
      )
      .slice(0, 3)
  );
}

const ARTICLE_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  // UTC so server and browser render the same day (no hydration mismatch).
  timeZone: 'UTC',
});

/** One-line card blurb: the article excerpt, else a trimmed slice of the body text. */
function articleBlurb(article) {
  const text = (article.excerpt || article.content || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= 140) return text;
  return `${text
    .slice(0, 140)
    .replace(/\s+\S*$/, '')
    .replace(/[\s.,;:!?-]+$/, '')}...`;
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
    gifSupport: metafield(namespace: "custom", key: "gif_support") { value }
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

/**
 * The six products on the Bundle Builder promo card, in order. Live Shopify
 * handles, all in the `widgets` collection (bundle eligible), checked
 * 2026-10-17. Multistream Chat stays (Etsy's number one); the rest are
 * seasonal: Graveyard Shift (Halloween chat), Halloween Pumpkin (cat pumpkin
 * goal), Mushroom Chat (fall, cottagecore). Swap these after the season.
 */
const BUNDLE_PROMO_HANDLES = [
  'multistream-chat-widget-twitch-youtube-kick-overlay-digital-download-easy-setup-one-click-installation',
  'graveyard-shift-halloween-multistream-chat-widget-for-twitch-youtube-kick-tiktok',
  'halloween-pumpkin-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-and-streamelements',
  'cottagecore-mushroom-chat-widget-for-twitch-nature-theme',
  'spooky-mushroom-bar-goal-widget-for-twitch-cozy-forest-theme',
  // Included by explicit request. It is a Decoration, not in `widgets`,
  // so it does NOT count toward the bundle discount.
  'animated-autumn-leaves-stream-decoration-cozy-fall-overlay',
];

const BUNDLE_PROMO_TILES_QUERY = `#graphql
  query BundlePromoTiles(
    $country: CountryCode
    $language: LanguageCode
    $handle0: String!
    $handle1: String!
    $handle2: String!
    $handle3: String!
    $handle4: String!
    $handle5: String!
  ) @inContext(country: $country, language: $language) {
    product0: product(handle: $handle0) { ...BundlePromoTile }
    product1: product(handle: $handle1) { ...BundlePromoTile }
    product2: product(handle: $handle2) { ...BundlePromoTile }
    product3: product(handle: $handle3) { ...BundlePromoTile }
    product4: product(handle: $handle4) { ...BundlePromoTile }
    product5: product(handle: $handle5) { ...BundlePromoTile }
  }
  fragment BundlePromoTile on Product {
    id
    title
    handle
    productType
    tags
    featuredImage {
      id
      url
      altText
      width
      height
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
    $freshHandle: String!
    $freshFirst: Int!
  ) @inContext(country: $country, language: $language) {
    fresh: collection(handle: $freshHandle) {
      products(first: $freshFirst) {
        nodes { ...RecommendedProduct }
      }
    }
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
      products(first: 30, sortKey: BEST_SELLING) {
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

const LATEST_ARTICLES_QUERY = `#graphql
  query HomeLatestArticles($language: LanguageCode) @inContext(language: $language) {
    blog(handle: "news") {
      articles(first: 3, sortKey: PUBLISHED_AT, reverse: true) {
        nodes {
          handle
          title
          publishedAt
          excerpt
          content(truncateAt: 200)
          image {
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

const HALLOWEEN_COLLECTION_QUERY = `#graphql
  query HalloweenCollection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      products(first: 8, sortKey: CREATED, reverse: true) {
        nodes {
          id
          title
          handle
          productType
          worksWith: metafield(namespace: "custom", key: "works_with") { value }
          tags
          gifSupport: metafield(namespace: "custom", key: "gif_support") { value }
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
