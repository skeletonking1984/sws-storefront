import {Await, Link, useLoaderData, useRouteLoaderData} from 'react-router';
import {Suspense, useRef} from 'react';
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
import {MobileStickyAddToCart} from '~/components/MobileStickyAddToCart';
import {ProductHighlights} from '~/components/ProductHighlights';
import {ShareRow} from '~/components/ShareRow';
import {ProductTrust} from '~/components/ProductTrust';
import {ProductIncluded} from '~/components/ProductIncluded';
import {articleFontPreload} from '~/lib/articleFont';
import {ProductItem} from '~/components/ProductItem';
import {EtsyRatingBadge} from '~/components/EtsyRating';
import {EtsyReviews} from '~/components/EtsyReviews';
import {ProductRatingBadge, ProductReviews} from '~/components/ProductReviews';
import {FaqAccordion} from '~/components/FaqAccordion';
import {Breadcrumbs} from '~/components/Breadcrumbs';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {isSmallScreenRequest} from '~/lib/smallScreen';
import {formatProductDescription} from '~/lib/productDescription';
import {buildMeta, getOrigin} from '~/lib/seo';
import {brand} from '~/lib/brand.config';
import {SHARE_CARD, shareCardUrl} from '~/lib/ogImage';
import {widgetKind as classifyWidgetKind} from '~/components/ProductItem';
import {PDP_PRIMARY_CATEGORY} from '~/lib/nav';
import {resolveCollection} from '~/lib/collectionHandles';
// Only `findVideoMedia` is needed here now: whether the product has a video
// at all, to decide whether to render the "Watch the demo" link. The
// VideoObject JSON-LD itself moved to app/routes/videos.$handle.jsx, see
// that route's header comment for why a PDP can never be a Google watch
// page. lookupVideoMetadata/pickBestMp4Source/video-metadata.json moved
// with it and are no longer imported here.
import {findVideoMedia} from '~/lib/video';
// Full per-product Etsy review dataset, review text included. SERVER USE
// ONLY (see scripts/build-etsy-reviews.mjs). This import is only ever
// referenced from loadCriticalData below, never from the component body,
// so the route's client bundle never ships it. EtsyRating.jsx has the
// small client-safe shop-stats-only slice for anything rendered directly
// in the component.
import etsyReviewsData from '~/data/etsy-reviews.json';
// Per-product delivery facts (how many archives, whether a setup doc ships),
// generated from the real Etsy file manifest by
// scripts/build-delivery-facts.mjs. SERVER USE ONLY: it is read in the
// loader and only this product's one-sentence answer block is sent to the
// client, so the whole table never reaches the browser bundle.
import deliveryFacts from '~/data/product-delivery.json';
import {buildAnswerBlock} from '~/lib/answerBlock';
import {parseWorksWith} from '~/lib/platforms';
import {compareAtIsValueSum, hasRealDiscount} from '~/lib/price';
import {subjectFromTitle} from '~/lib/productName';
import {byHandleWithAlias} from '~/lib/handleAliases';

/**
 * @type {Route.MetaFunction}
 */
/*
 * The product description now paints in Space Grotesk (--font-article), same as
 * the blog. Product pages and descriptions should carry the same font treatment as
 * blogs (same vibe). Without this preload the description would swap
 * font mid-read on the page that has to close the sale.
 *
 * @type {Route.LinksFunction}
 */
export const links = () => [articleFontPreload];

export const meta = ({data, matches, location}) => {
  const title = data?.product.title ?? '';
  const origin = getOrigin(matches);
  // `featuredImage` is the share image on purpose, and it is the one field
  // here that CANNOT be a video. The Storefront API defines it as equivalent to
  // `images(first: 1)`, and `images` excludes video media entirely, so a
  // product whose gallery leads with its demo clip still yields its first
  // real photo. Checked against the live catalogue 2026-09-17: 122 products,
  // 0 with no featured image, and 0 whose featured image is a video preview
  // URL. Never switch this to `media.nodes[0]`, which CAN be a `Video` and
  // would put a frame grab on every share card.
  const featuredImageUrl = data?.product.featuredImage?.url;
  // Prefer the product's own `seo.title` over its display title. Catalog
  // titles here are Etsy titles, median 122 characters of stuffed platform
  // names, and appending the shop name pushed every one of them past 140.
  // Google renders about 60, so the differentiator and the brand were both
  // cut off on every product page. `seo.title` is written to the 60
  // character cap in docs/COPY-STANDARD.md and already carries the product
  // name, so it is used verbatim, with no shop suffix appended.
  const seoTitle = data?.product.seo?.title;
  return buildMeta({
    title: seoTitle || `${title} | ${brand.name}`,
    description:
      data?.product.seo?.description ||
      `${title}: animated stream widget, instant digital download for Twitch, YouTube, and multistream.`,
    url: `${origin}${location.pathname}`,
    // Every product card is rendered at the one share size, whole image
    // inside it, brand background filling the rest. See ~/lib/ogImage: the
    // size is a constant because a padded CDN request returns exactly the
    // size asked for, whatever shape the source is.
    image: featuredImageUrl ? shareCardUrl(featuredImageUrl) : undefined,
    imageWidth: featuredImageUrl ? SHARE_CARD.width : undefined,
    imageHeight: featuredImageUrl ? SHARE_CARD.height : undefined,
  });
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

  const [
    {
      product,
      chatWidgetsCurrent,
      chatWidgetsLegacy,
      goalWidgetsCurrent,
      goalWidgetsLegacy,
    },
  ] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  // Which of the two breadcrumb target collections is live right now (see
  // PRODUCT_QUERY above and app/lib/collectionHandles.js). Only the pair
  // matching this product's own kind is resolved; the other pair's result
  // is simply unused, cheaper than a second request. Falls back to
  // PDP_PRIMARY_CATEGORY's safe-default (legacy) handle when BOTH aliases
  // come back null, which would mean the collection itself is missing, not
  // just mid-rename.
  const primaryCategoryKind = classifyWidgetKind(
    product.title,
    product.productType,
  );
  const primaryCategoryHandle =
    primaryCategoryKind === 'Chat'
      ? resolveCollection(chatWidgetsCurrent, chatWidgetsLegacy)?.handle
      : primaryCategoryKind === 'Goal'
        ? resolveCollection(goalWidgetsCurrent, goalWidgetsLegacy)?.handle
        : null;

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, {handle, data: product});

  // Real per-product Etsy reviews (see ProductReviews.jsx), looked up here
  // in the loader so the full etsy-reviews.json import (review text for
  // all 83 products) stays server-side and never reaches the client
  // bundle. Only this one product's slice is sent down to the component.
  const productReviews =
    byHandleWithAlias(etsyReviewsData.products, handle) || null;

  // The quotable answer block (see app/lib/answerBlock.js). Built here
  // rather than in the component so the delivery table stays server side,
  // and built from the loader's own selected variant price so the sentence
  // and the price shown next to it come from the same response.
  const delivery = byHandleWithAlias(deliveryFacts.products, handle) || null;
  const answerBlock = buildAnswerBlock({
    name: product.seo?.title || product.title,
    productType: product.productType,
    platforms: parseWorksWith(product.worksWith?.value),
    price: product.selectedOrFirstAvailableVariant?.price,
    delivery,
    noAccount: (product.tags || []).includes('no-account'),
  });

  return {
    product,
    productReviews,
    answerBlock,
    // Only this product's two delivery facts reach the client, for the
    // "What's included" block. Same lookup the answer block uses.
    delivery: delivery
      ? {archives: delivery.archives ?? 0, setupDoc: delivery.setupDoc ?? null}
      : null,
    primaryCategoryHandle,
    /*
      Which video rendition this request gets, decided here because it
      cannot be decided in the browser.

      Chrome sends `Sec-CH-UA-Mobile: ?1` on every request from a phone by
      default, no opt-in and no extra round trip. The alternative, checking
      the viewport after hydration, needs the `<video>` to have no `autoPlay`
      attribute (or the 1080p file is already downloading before any JS
      runs), and without that attribute Chrome's autoplay policy killed the
      clip 84ms in: measured 2026-09-21, play at 199ms, pause at 283ms,
      currentTime never left 0.

      FIXED 2026-09-27: the comment this replaced said browsers that send no
      hint "fall through to false and get exactly what they get today", on
      the theory that this can only ever remove bytes from a phone, never
      degrade a desktop. That theory was wrong for the single largest phone
      population there is. Client Hints (`Sec-CH-UA-Mobile`) are a Chromium
      feature. Apple's WebKit has never implemented them, and iOS requires
      EVERY browser engine on the platform to be WebKit, so Safari, Chrome
      for iOS, Firefox for iOS, and every in-app WebKit browser (the X app's
      own in-app browser included, confirmed live with a
      "Twitter for iPhone" WKWebView UA 2026-09-27) all send NO
      `Sec-CH-UA-Mobile` header, ever. Every one of them fell through to
      `false` and was served the same 1080p/2.5Mbps rendition as a desktop
      visitor: measured live on a throttled (Slow-4G-equivalent, 1.6Mbps/
      150ms) connection with that exact UA, the 4.46MB HD-1080p file alone
      pushed the Add to cart button's ready-to-tap time to ~12.5s. Android's
      WebView is Chromium-based and was never affected; this was iOS-only,
      which given the X-ads mobile traffic this storefront gets is not a
      small slice.

      Fixed by adding a User-Agent fallback for exactly the browsers that
      can never send the client hint: an iPhone/iPod/Android-with-"Mobile"
      token in the UA, checked only when the hint itself is absent so a
      client that DOES send `Sec-CH-UA-Mobile: ?0` (a real desktop faking
      nothing) is never overridden by the fallback.
    */
    smallScreen: isSmallScreenRequest(request),
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

  // "More Chat/Goal widgets" / "You might also like": title text is still
  // the reliable widget-kind signal here, used only to label the section and as the fallback
  // search below, not to pick the related products themselves anymore.
  const kind = widgetKindFromTitle(product.title);

  // Real per-product recommendations from Shopify's own model, not a fuzzy
  // title search. FIXED 2026-10-01: the old `title:*chat*`/`title:*goal*`
  // search took the first 4 hits of a fuzzy match against the WHOLE
  // catalog, so every chat PDP showed the same 4 products (Sakura, Lotus,
  // Neon Glow, Floral Purple) and a goal PDP could surface a chat widget
  // whose title happened to contain "Goal" (Demon Samurai's "Goal Bar").
  // `productRecommendations` is specific to the product it is asked about.
  // The old search stays below as a top-up only, for the rare product with
  // fewer than 3 real recommendations.
  const relatedProducts = storefront
    .query(RECOMMENDED_PRODUCTS_QUERY, {variables: {productId: product.id}})
    .then(async (response) => {
      const recommended = (response.productRecommendations ?? []).filter(
        (p) => p.handle !== params.handle && p.availableForSale !== false,
      );
      const fromRecommendations = recommended.length > 0;
      let nodes = recommended.slice(0, 4);

      // Top up from the old fuzzy kind search, never throws, only runs
      // when recommendations alone left fewer than 3 (de-dupe by handle,
      // and re-run the same first-word-wins kind check as before, see the
      // comment that used to sit here: titles like "Sakura Floral Chat
      // Widget ... Chat Goal" mention both words).
      if (nodes.length < 3 && kind) {
        const fallback = await storefront
          .query(RELATED_PRODUCTS_QUERY, {
            variables: {query: `title:*${kind}*`},
          })
          .catch(() => null);
        const fallbackNodes = (fallback?.products?.nodes ?? []).filter(
          (p) =>
            p.handle !== params.handle &&
            widgetKindFromTitle(p.title) === kind &&
            !nodes.some((n) => n.handle === p.handle),
        );
        nodes = [...nodes, ...fallbackNodes].slice(0, 4);
      }

      // Whether every node landed in the current product's own kind (e.g.
      // a chat PDP whose real recommendations happen to be chat widgets
      // too): that is the one case the heading should still read "More
      // X widgets" rather than the more honest default below.
      const allSameKind =
        Boolean(kind) &&
        nodes.length > 0 &&
        nodes.every((p) => widgetKindFromTitle(p.title) === kind);

      return {nodes, fromRecommendations, allSameKind};
    })
    .catch(() => ({nodes: [], fromRecommendations: false, allSameKind: false}));

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

/** Strips tags from an HTML string and collapses whitespace, for JSON-LD text fields. */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function Product() {
  /** @type {LoaderReturnData} */
  const {
    product,
    relatedProducts,
    faq,
    productReviews,
    answerBlock,
    delivery,
    smallScreen,
    primaryCategoryHandle,
  } = useLoaderData();
  const rootData = useRouteLoaderData('root');
  const origin = rootData?.origin || brand.origin;

  // Shared with MobileStickyAddToCart below: that bar has no form of its
  // own, it just clicks this real button, see that component's file header.
  const addToCartButtonRef = useRef(null);

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

  const {title, description, descriptionHtml, worksWith} = product;
  // The name a person would say, cut out of the Etsy keyword title. Falls
  // back to the full title so a product whose title is nothing but keywords
  // still has a heading.
  const shortTitle = subjectFromTitle(title) || title;
  const media = product.media?.nodes ?? [];
  const formattedDescription = formatProductDescription(descriptionHtml, title);
  const kindLabel = widgetKindFromTitle(title);
  const widgetKind = kindLabel
    ? kindLabel.charAt(0).toUpperCase() + kindLabel.slice(1)
    : null;

  const productUrl = `${origin}/products/${product.handle}`;
  const imageUrls = media.map((item) => item.image?.url).filter(Boolean);
  if (!imageUrls.length && product.featuredImage?.url) {
    imageUrls.push(product.featuredImage.url);
  }

  // Real per-product Etsy reviews (see ProductReviews.jsx and the loader
  // above). One review is the floor for the rating badge beside the price
  // and the summary in the review section, so the buy panel and the
  // visible review list can never disagree. Below the floor (zero reviews)
  // there is nothing real to show, so both stay off.
  //
  // NOT in the Product JSON-LD (see productJsonLd below): Google's review
  // snippet guidelines, https://developers.google.com/search/docs/appearance/
  // structured-data/review-snippet (updated 2026-07-10, read 2026-09-28):
  // "Don't aggregate reviews or ratings from other websites." These reviews
  // are pulled verbatim from Etsy, a different website, so `aggregateRating`
  // and `review` were removed from the structured data on 2026-09-28. The
  // visible EtsyRatingBadge / ProductRatingBadge / ProductReviews UI below
  // is unaffected, a shopper reading the page is not "aggregation" the way
  // a search result snippet borrowing another site's stars would be.
  const showsProductReviews =
    Boolean(productReviews) && productReviews.count >= 1;

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    description: stripHtml(description || descriptionHtml),
    image: imageUrls,
    // This catalog has no merchant SKUs (checked, all variants null); the
    // Shopify variant id is the only real per-offer identifier, so it's
    // used as productID instead rather than inventing a SKU string.
    ...(selectedVariant?.sku
      ? {sku: selectedVariant.sku}
      : selectedVariant?.id
        ? {productID: selectedVariant.id}
        : {}),
    brand: {
      '@type': 'Brand',
      name: brand.name,
    },
    ...(selectedVariant?.price
      ? {
          offers: {
            '@type': 'Offer',
            price: selectedVariant.price.amount,
            priceCurrency: selectedVariant.price.currencyCode,
            availability: selectedVariant.availableForSale
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            // Every widget is a finished digital file, never a used or
            // refurbished item.
            itemCondition: 'https://schema.org/NewCondition',
            url: productUrl,
            /*
             * Mirrors /policies/refund-policy (2026-09-25, approved): a
             * broken widget is fixed first and refunded if it cannot be; a
             * file that never arrived, an item not as described, or a double
             * charge is refunded; a working file the buyer changed their mind
             * about is NOT refundable. Ask within 30 days. If the policy
             * changes, change the policy page first and bring this, the FAQ
             * page and PRODUCT_REFUND_LINE in app/lib/policyContent.js to
             * match, then run `npm run audit:policy`.
             *
             * How that maps onto Google's MerchantReturnPolicy, per
             * https://developers.google.com/search/docs/appearance/structured-data/return-policy
             * (read 2026-09-25, page updated 2026-09-08):
             *
             * - returnPolicyCategory stays MerchantReturnFiniteReturnWindow
             *   with merchantReturnDays 30. Refunds ARE granted for 30 days,
             *   so MerchantReturnNotPermitted would be the lie in the other
             *   direction, and audit-policy-claims.mjs rejects it for a
             *   policy that grants refunds.
             * - The blanket `returnFees: FreeReturn` is GONE. returnFees is
             *   the fee for returns in general, with the customerRemorse* and
             *   itemDefect* fields as the per-reason versions, so a bare
             *   FreeReturn read as free change-of-mind returns, which this
             *   shop does not give. The fee
             *   statement now sits on `itemDefectReturnFees`, the documented
             *   field for defective items, which is the case we refund.
             * - The customerRemorse* fields are deliberately NOT set. Neither
             *   Google nor schema.org has a value for "change-of-mind returns
             *   not accepted" (ReturnFeesEnumeration is FreeReturn,
             *   ReturnFeesCustomerResponsibility, ReturnShippingFees), and
             *   every one of those would claim such returns exist.
             *
             * `returnMethod` is deliberately NOT set. Google accepts only
             * three physical values (ReturnAtKiosk, ReturnByMail,
             * ReturnInStore), and none is true for a download. schema.org's
             * KeepProduct was tried from 2026-09-25 on the bet that Google
             * would ignore a value it does not use. It did not: Search
             * Console flagged "Invalid enum value in field returnMethod" on
             * all 48 merchant listings (seen 2026-09-28). An absent
             * recommended field is honest; ReturnByMail would be a lie.
             */
            hasMerchantReturnPolicy: {
              '@type': 'MerchantReturnPolicy',
              // applicableCountry is REQUIRED by Google for a merchant
              // listing. Search Console flagged it missing on 29 items on
              // 2026-09-16. The refund policy applies wherever we sell, and
              // the shop's two delivery zones are US plus 27 international
              // countries, so the policy is not US-only. Listing the real set
              // rather than defaulting to US, which would be untrue for most
              // of the countries that can actually buy.
              applicableCountry: [
                'US',
                'CA',
                'GB',
                'AU',
                'NZ',
                'IE',
                'DE',
                'FR',
                'ES',
                'IT',
                'NL',
                'BE',
                'AT',
                'CH',
                'DK',
                'FI',
                'NO',
                'SE',
                'PL',
                'PT',
                'CZ',
                'IL',
                'AE',
                'HK',
                'JP',
                'KR',
                'MY',
                'SG',
              ],
              returnPolicyCategory:
                'https://schema.org/MerchantReturnFiniteReturnWindow',
              merchantReturnDays: 30,
              // Refunds are for a defect (broken and unfixable, never
              // arrived, not as described, double charge) and cost the buyer
              // nothing. See the note above for why this is not the blanket
              // `returnFees`.
              itemDefectReturnFees: 'https://schema.org/FreeReturn',
              // Money back, not store credit and not an exchange. That is
              // what /policies/refund-policy grants.
              refundType: 'https://schema.org/FullRefund',
              // Recommended, and the same condition the Offer already states.
              itemCondition: 'https://schema.org/NewCondition',
              /*
               * `merchantReturnLink` is deliberately NOT set. Google treats
               * it as an ALTERNATIVE to applicableCountry plus
               * returnPolicyCategory, so supplying both invites it to follow
               * the link and ignore the detail, losing the 30 day window and
               * the defect-refund terms this block exists to state. The link
               * is one click away in the footer either way.
               */
            },
            // Instant digital download: nothing ships, nothing costs to
            // ship. Variants on this catalog are set requiresShipping:
            // false, so a zero shipping rate is accurate, not a placeholder.
            shippingDetails: {
              '@type': 'OfferShippingDetails',
              shippingRate: {
                '@type': 'MonetaryAmount',
                value: '0',
                currency: 'USD',
              },
              /*
               * shippingDestination and deliveryTime were both flagged
               * missing on 29 items by Search Console on 2026-09-16.
               *
               * Every value here is literally true for an instant download
               * rather than a shipping placeholder: it is delivered to every
               * country we sell to, there is nothing to handle, and there is
               * nothing in transit. Zero is the honest number, not a
               * convenient one, which is why this can be stated at all.
               */
              shippingDestination: [
                'US',
                'CA',
                'GB',
                'AU',
                'NZ',
                'IE',
                'DE',
                'FR',
                'ES',
                'IT',
                'NL',
                'BE',
                'AT',
                'CH',
                'DK',
                'FI',
                'NO',
                'SE',
                'PL',
                'PT',
                'CZ',
                'IL',
                'AE',
                'HK',
                'JP',
                'KR',
                'MY',
                'SG',
              ].map((code) => ({
                '@type': 'DefinedRegion',
                addressCountry: code,
              })),
              deliveryTime: {
                '@type': 'ShippingDeliveryTime',
                handlingTime: {
                  '@type': 'QuantitativeValue',
                  minValue: 0,
                  maxValue: 0,
                  unitCode: 'DAY',
                },
                transitTime: {
                  '@type': 'QuantitativeValue',
                  minValue: 0,
                  maxValue: 0,
                  unitCode: 'DAY',
                },
              },
            },
            // No fixed sale window on these listings, so no priceValidUntil
            // date could be defended as real; omitted rather than guessed.
          },
        }
      : {}),
    // Deliberately no `aggregateRating` and no `review` here. See the note
    // above `showsProductReviews`: both would be aggregating another
    // website's (Etsy's) reviews, which Google's review snippet guidelines
    // say not to do.
  };

  // Whether to show the "Watch the demo" link, and nothing else: the
  // VideoObject JSON-LD that used to be built from this now lives on the
  // dedicated watch page (app/routes/videos.$handle.jsx).
  const hasVideo = Boolean(findVideoMedia(media));

  // Primary category crumb: Chat Widget -> twitch-chat-widgets (or its
  // pre-rename handle frontpage, whichever the loader found live), Goal
  // Widget -> twitch-goal-widgets (or stream-widgets-templates), anything
  // else -> the generic widgets collection. Reuses widgetKind() from
  // ProductItem.jsx (imported here as classifyWidgetKind -- this file
  // already has its own local `widgetKind` string below), the same
  // productType-first classifier the card's own Chat/Goal badge and the
  // smart collections are built on, so this can never disagree with what
  // the product's own card already says it is. `label` always comes from
  // PDP_PRIMARY_CATEGORY in app/lib/nav.js; `handle` prefers the loader's
  // live `primaryCategoryHandle` (see loadCriticalData) and only falls
  // back to that constant's safe-default handle if the live lookup came
  // back empty, so this link is never a redirect hop on either side of the
  // 2026-09-28 collection rename. See app/lib/collectionHandles.js.
  const primaryCategory =
    PDP_PRIMARY_CATEGORY[classifyWidgetKind(title, product.productType)] ||
    PDP_PRIMARY_CATEGORY.Other;
  const primaryCategoryLinkHandle =
    primaryCategoryHandle || primaryCategory.handle;

  // Single source for both the visible trail and its JSON-LD, built from
  // the same array so the two can never disagree. `shortTitle` (not the
  // raw keyword-stuffed title) because that is what the H1 and the visible
  // page actually say the product is.
  const breadcrumbItems = [
    {name: 'Home', to: '/'},
    {
      name: primaryCategory.label,
      to: `/collections/${primaryCategoryLinkHandle}`,
    },
    {name: shortTitle},
  ];
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.to ? `${origin}${item.to}` : productUrl,
    })),
  };

  return (
    <div className="product">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(productJsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <Breadcrumbs items={breadcrumbItems} />
      <div className="product-top">
        {/*
          Keyed on the product id. ProductGallery seeds activeIndex from a lazy
          useState (the video, or 0), and a client navigation from one PDP to
          another keeps this component mounted, so without a key the old index
          survives. When it exceeds the new product's media count the main
          viewer renders blank. The key remounts it per product.
        */}
        <ProductGallery
          key={product.id}
          media={media}
          title={title}
          smallScreen={smallScreen}
        />
        <div className="product-main sws-glass-card">
          {/*
            The buy box sits ABOVE the name on a phone, and the name is the
            name rather than the search string.

            Measured on the live PDP at 375x812 on 2026-09-21: the h1 was the
            raw Etsy title (139 chars on the Celestial kit, 99 chars on
            average across all 123 products), 168px tall, and it pushed the
            price to y=811 of an 812px viewport. A phone buyer reached the
            end of the first screen without ever seeing what the thing cost.
            Mobile added to cart 1.30% against desktop 6.86% in the same
            period.

            The full keyword title is NOT repeated on the page any more (it
            ran as a one-line truncated copy of the name under the h1, a
            duplicate a phone buyer read twice). It is still in the meta
            title, the OG tags, the Product JSON-LD `name` and the answer
            block, so nothing that a crawler reads lost a keyword.
            `subjectFromTitle` is the same cleaner the gallery, the cards,
            the cart and the alt-text generator use, so they cannot drift.
          */}
          <div className="product-heading">
            <h1>{shortTitle}</h1>
          </div>
          <div className="product-buybox">
            {showsProductReviews ? (
              <ProductRatingBadge data={productReviews} />
            ) : (
              <EtsyRatingBadge compact />
            )}
            <ProductPrice
              price={selectedVariant?.price}
              compareAtPrice={selectedVariant?.compareAtPrice}
              compareAtIsValue={compareAtIsValueSum(product.productType)}
              showSavings
            />
            {/* The slot under the price: a real saving or a kit's value when
                there is one, otherwise the one pricing fact every product
                shares (the answer block above says the same: a one-time
                price, no subscription). Nothing here is a discount claim. */}
            {hasRealDiscount(
              selectedVariant?.price,
              selectedVariant?.compareAtPrice,
            ) ? null : (
              <p className="product-price-note">
                One-time price, no subscription
              </p>
            )}
          </div>
          <ProductHighlights
            description={description}
            worksWith={worksWith?.value}
            productType={product.productType}
            tags={product.tags}
            gifSupport={product.gifSupport?.value}
          />
          <ProductForm
            productOptions={productOptions}
            selectedVariant={selectedVariant}
            buttonRef={addToCartButtonRef}
          />
          {/* The shop rating line only when the badge above shows this
              product's own reviews; otherwise the badge already says it. */}
          <ProductTrust showShopRating={showsProductReviews} />
          <ShareRow title={title} />
        </div>
      </div>
      <ProductIncluded
        delivery={delivery}
        platforms={parseWorksWith(worksWith?.value)}
        productType={product.productType}
        noAccount={(product.tags || []).includes('no-account')}
      />
      <MobileStickyAddToCart
        targetRef={addToCartButtonRef}
        price={selectedVariant?.price}
        compareAtPrice={selectedVariant?.compareAtPrice}
        compareAtIsValue={compareAtIsValueSum(product.productType)}
        available={Boolean(selectedVariant?.availableForSale)}
      />
      <div className="product-description">
        {/* The one passage on this page written to be lifted whole by an
            answer engine: product, platforms, price, what arrives and in
            what format, with nothing in it that depends on the page around
            it. Visible to buyers on purpose, never crawler-only. */}
        {answerBlock ? <p className="product-answer">{answerBlock}</p> : null}
        {hasVideo ? (
          // Discovery path for Googlebot (and buyers) to the dedicated watch
          // page: the sitemap alone is not a crawl link. See
          // app/routes/videos.$handle.jsx. Kept BELOW the buy box: between
          // the gallery and the buy box it pushed Add to cart down on phones.
          <p className="product-watch">
            <Link
              to={`/videos/${product.handle}`}
              className="product-watch-link"
            >
              Watch the demo →
            </Link>
          </p>
        ) : null}
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
                <Link
                  to="/pages/faq-frequently-asked-questions"
                  className="product-faq-link"
                >
                  See all FAQs →
                </Link>
              </div>
            ) : null
          }
        </Await>
      </Suspense>
      {showsProductReviews ? (
        <ProductReviews data={productReviews} />
      ) : (
        <EtsyReviews />
      )}
      <Suspense fallback={null}>
        <Await resolve={relatedProducts}>
          {(related) => {
            const nodes = related?.nodes ?? [];
            if (!nodes.length) return null;
            // Default heading for real per-product recommendations is the
            // more honest "You might also like": it is no longer
            // guaranteed to be the same widget kind. Keep the old "More X
            // widgets" wording only when every recommended product landed
            // in the current product's own kind, or when this fell all
            // the way back to the kind search with no recommendations at
            // all (see loadDeferredData above).
            const heading =
              related.fromRecommendations && !related.allSameKind
                ? 'You might also like'
                : widgetKind
                  ? `More ${widgetKind} widgets`
                  : 'More widgets';
            return (
              <div className="product-related">
                <h2>{heading}</h2>
                <div className="product-related-grid">
                  {nodes.map((relatedProduct, index) => (
                    <ProductItem
                      key={relatedProduct.id}
                      product={relatedProduct}
                      listId="related-products"
                      listName="Related products"
                      index={index}
                      /* sits under the heading above */
                      headingLevel={3}
                    />
                  ))}
                </div>
                <Link
                  to={`/collections/${primaryCategoryLinkHandle}`}
                  className="product-related-browse-link"
                >
                  Browse all {primaryCategory.label} →
                </Link>
              </div>
            );
          }}
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
              productType: product.productType,
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
    productType
    tags
    descriptionHtml
    worksWith: metafield(namespace: "custom", key: "works_with") { value }
    # Ground-truth GIF-support flag for chat widgets. Not yet
    # exposed to the Storefront API (checked 2026-09-26, resolves null) --
    # left in the query so it starts working the moment storefront access is
    # granted on the definition, with no code change needed. Until then
    # hasGifSupport falls back to the public gif-support tag above.
    gifSupport: metafield(namespace: "custom", key: "gif_support") { value }
    description
    encodedVariantExistence
    encodedVariantAvailability
    featuredImage {
      id
      url
      altText
      # width/height feed og:image:width/height. Without them the share card
      # either lies about the shape of the image or says nothing, and this
      # catalogue has no 1.91:1 art at all. See the meta function above.
      width
      height
    }
    # 25, not 10. This catalog runs to 15 images plus a demo video, and the
    # video was imported last on nearly every product, so a cap of 10 silently
    # dropped the video on 13 products: it was never fetched, so the gallery
    # could not render it however correct the component was. It also truncated
    # the image gallery on anything with more than 10 photos.
    media(first: 25) {
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
          alt
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
    # Breadcrumb target collections, queried under both their current and
    # legacy handle (see app/lib/collectionHandles.js and the 2026-09-28
    # rename note on PDP_PRIMARY_CATEGORY in app/lib/nav.js). Handle-only:
    # this is purely to find out which of the two currently resolves, not to
    # render the collection itself, so the extra cost is four small root
    # fields, not four full collection fetches. Only one pair is ever used
    # (see classifyWidgetKind below), fetching both is what lets a single
    # query serve every product without knowing its kind in advance.
    #
    # Handles are literal here, not interpolated from
    # app/lib/collectionHandles.js: @shopify/graphql-codegen statically
    # parses this tagged template and cannot resolve a JS expression inside
    # it (confirmed 2026-09-28, codegen throws "Variable ... not found" on
    # an interpolated handle). collectionHandles.js stays the source of
    # truth for every non-query use; if either handle changes there, mirror
    # it here too.
    chatWidgetsCurrent: collection(handle: "twitch-chat-widgets") { handle }
    chatWidgetsLegacy: collection(handle: "frontpage") { handle }
    goalWidgetsCurrent: collection(handle: "twitch-goal-widgets") { handle }
    goalWidgetsLegacy: collection(handle: "stream-widgets-templates") { handle }
  }
  ${PRODUCT_FRAGMENT}
`;

// Real per-product recommendations (see loadDeferredData above for why this
// replaced a fuzzy title search). Node field selection is kept identical to
// RELATED_PRODUCTS_QUERY below (minus the `products(first, query)` wrapper,
// `productRecommendations` returns the array directly) plus
// `availableForSale`, so ProductItem renders a recommended card exactly the
// same as a fallback one.
const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  query ProductRecommendations(
    $country: CountryCode
    $language: LanguageCode
    $productId: ID!
  ) @inContext(country: $country, language: $language) {
    productRecommendations(productId: $productId, intent: RELATED) {
      id
      title
      handle
      availableForSale
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
    }
  }
`;

// "More Chat/Goal widgets" top-up only now (see loadDeferredData above):
// reuses the query:title trick (Storefront API has no reliable tag search
// for this catalog) to find same kind products when real
// recommendations leave fewer than 3. Client-side filter drops the current
// product.
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
