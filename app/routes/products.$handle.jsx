import {Await, Link, useLoaderData, useRouteLoaderData} from 'react-router';
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
import {ShareRow} from '~/components/ShareRow';
import {articleFontPreload} from '~/lib/articleFont';
import {ProductItem} from '~/components/ProductItem';
import {EtsyRatingBadge} from '~/components/EtsyRating';
import {EtsyReviews} from '~/components/EtsyReviews';
import {
  ProductRatingBadge,
  ProductReviews,
  REVIEWS_ALWAYS_IN_DOM,
} from '~/components/ProductReviews';
import {FaqAccordion} from '~/components/FaqAccordion';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {formatProductDescription} from '~/lib/productDescription';
import {buildMeta, getOrigin} from '~/lib/seo';
import {SHARE_CARD, shareCardUrl} from '~/lib/ogImage';
import {
  findVideoMedia,
  lookupVideoMetadata,
  pickBestMp4Source,
} from '~/lib/video';
// Real Admin-API uploadDate/duration for every Shopify video on the shop,
// keyed by numeric video id (see the file's own sourceNote). The Storefront
// API exposes neither field, and Google requires uploadDate on VideoObject,
// so this is generated once and committed rather than derived at request
// time.
import videoMetadata from '~/data/video-metadata.json';
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
import {subjectFromTitle} from '~/lib/productName';

/**
 * @type {Route.MetaFunction}
 */
/*
 * The product description now paints in Space Grotesk (--font-article), same as
 * the blog. Todd: "we need the same font stuff on blogs with the product
 * pages/descs ... same vibe." Without this preload the description would swap
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
    title: seoTitle || `${title} | Stream Widget Shop`,
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

  // Real per-product Etsy reviews (see ProductReviews.jsx), looked up here
  // in the loader so the full etsy-reviews.json import (review text for
  // all 83 products) stays server-side and never reaches the client
  // bundle. Only this one product's slice is sent down to the component.
  const productReviews = etsyReviewsData.products[handle] || null;

  // The quotable answer block (see app/lib/answerBlock.js). Built here
  // rather than in the component so the delivery table stays server side,
  // and built from the loader's own selected variant price so the sentence
  // and the price shown next to it come from the same response.
  const answerBlock = buildAnswerBlock({
    name: product.seo?.title || product.title,
    productType: product.productType,
    platforms: parseWorksWith(product.worksWith?.value),
    price: product.selectedOrFirstAvailableVariant?.price,
    delivery: deliveryFacts.products[handle] || null,
  });

  return {
    product,
    productReviews,
    answerBlock,
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

      Browsers that send no hint (Safari, Firefox) fall through to false and
      get exactly what they get today, so this can only ever remove bytes
      from a phone, never degrade a desktop.
    */
    smallScreen: request.headers.get('Sec-CH-UA-Mobile') === '?1',
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

/** Strips tags from an HTML string and collapses whitespace, for JSON-LD text fields. */
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Cap on how many Review entries go into the Product JSON-LD. Kept
// identical to REVIEWS_ALWAYS_IN_DOM (ProductReviews.jsx) by importing it
// rather than duplicating the number, so this can never emit more reviews
// than are already sitting in the DOM before the "Show all N" expander is
// clicked, most recent first, whichever star rating they carry.
const MAX_JSONLD_REVIEWS = REVIEWS_ALWAYS_IN_DOM;

/**
 * Builds the `review` array for the Product JSON-LD from this product's real
 * Etsy reviews. Verbatim text only, never invented or edited. A review with
 * no text is skipped: a Review needs a body to be useful, and this repo
 * never fabricates one.
 * @param {{reviews: Array<{rating: number, date: string, text: string}>}} productReviews
 */
function buildReviewJsonLd(productReviews) {
  if (!productReviews?.reviews?.length) return undefined;
  const withText = productReviews.reviews.filter((review) =>
    review.text && review.text.trim(),
  );
  if (!withText.length) return undefined;
  return withText.slice(0, MAX_JSONLD_REVIEWS).map((review) => ({
    '@type': 'Review',
    reviewRating: {
      '@type': 'Rating',
      ratingValue: review.rating,
      bestRating: 5,
      worstRating: 1,
    },
    author: {
      '@type': 'Person',
      name: 'Verified Etsy buyer',
    },
    datePublished: review.date,
    reviewBody: review.text,
  }));
}

/**
 * Builds the VideoObject JSON-LD for a product's demo video. Returns
 * `undefined` (emitting no VideoObject at all) whenever any required field
 * is missing: `video-metadata.json` has no entry for this video's id, there
 * is no mp4 source, or there is no preview image. A wrong or guessed
 * `uploadDate` is worse than no VideoObject, so nothing here is ever
 * substituted or invented.
 * @param {{title: string, videoMedia: any, meta: {uploadDate: string, duration: string} | undefined}}
 */
function buildVideoJsonLd({title, videoMedia, meta}) {
  if (!meta) return undefined;
  const contentUrl = pickBestMp4Source(videoMedia?.sources)?.url;
  const thumbnailUrl = videoMedia?.previewImage?.url;
  if (!contentUrl || !thumbnailUrl) return undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    // Real alt text on the Shopify video ("Animated Star Goal Widget
    // demo") when present; otherwise a plain factual name derived from the
    // product title, never invented marketing copy.
    name: videoMedia.alt || `${title} demo video`,
    description: `A demo video of the ${title} running on stream.`,
    thumbnailUrl,
    uploadDate: meta.uploadDate,
    duration: meta.duration,
    contentUrl,
  };
}

export default function Product() {
  /** @type {LoaderReturnData} */
  const {
    product,
    relatedProducts,
    faq,
    productReviews,
    answerBlock,
    smallScreen,
  } = useLoaderData();
  const rootData = useRouteLoaderData('root');
  const origin = rootData?.origin || 'https://streamwidgetshop.com';

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
  const imageUrls = media
    .map((item) => item.image?.url)
    .filter(Boolean);
  if (!imageUrls.length && product.featuredImage?.url) {
    imageUrls.push(product.featuredImage.url);
  }

  // Real per-product Etsy reviews (see ProductReviews.jsx and the loader
  // above). One review is the floor for any own-product number anywhere on
  // this page: the JSON-LD aggregateRating, the badge beside the price, and
  // the summary in the review section all use it, so the structured data,
  // the buy panel and the visible page can never disagree. Below the floor
  // (zero reviews) there is nothing real to show or emit, so both stay off.
  // Gated on the RATING count, not on how many reviews carry text. A 5 star
  // rating with an empty comment is a real rating; it is already in `count`
  // and `average`, and keying this off `reviews.length` suppressed the
  // page's aggregateRating for it. See ProductReviews.jsx for the full note.
  const showsProductReviews =
    Boolean(productReviews) && productReviews.count >= 1;
  const hasEnoughReviewsForJsonLd =
    showsProductReviews && productReviews.count >= 1;
  const reviewJsonLd = hasEnoughReviewsForJsonLd
    ? buildReviewJsonLd(productReviews)
    : undefined;

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
      name: 'Stream Widget Shop',
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
             * Mirrors /policies/refund-policy, which is the authoritative
             * statement and is dated 2026-09-09: a refund is given within 30
             * days when the download never arrived, the files are corrupt or
             * incomplete, the widget is not what the listing described, the
             * buyer was charged twice, or it cannot be made to run on a
             * platform the listing claims to support. Change of mind on a
             * working file is not refundable.
             *
             * This previously said MerchantReturnNotPermitted, quoting the
             * FAQ's older "we do not offer refunds once the file has been
             * downloaded". That FAQ line contradicted the refund policy page
             * and was corrected in Shopify on 2026-09-15 so all three now
             * agree. If the policy ever changes, change it in the policy page
             * first and bring this and the FAQ to match, not the other way
             * round.
             *
             * `returnMethod` used to be omitted here, with the note that
             * "nothing is ever sent back, so every schema.org value for it
             * would be a lie". That was written against GOOGLE's list, which
             * documents three physical values (ReturnAtKiosk, ReturnByMail,
             * ReturnInStore). **schema.org has a fourth**, KeepProduct,
             * defined as "the consumer can keep the product, even when
             * receiving a refund or store credit", which is precisely what
             * happens here. So the field can be stated truthfully after all,
             * and Search Console flagged its absence on 5 items on
             * 2026-09-15.
             *
             * Google does not document KeepProduct. It is valid schema.org
             * and it is true, and `returnMethod` is a RECOMMENDED field, so
             * the worst case is that Google ignores a value it does not use
             * and the non-critical warning stays exactly as it is today.
             * ReturnByMail would clear the warning and would be a lie about
             * the refund process, which is not a trade this shop makes.
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
                'US', 'CA', 'GB', 'AU', 'NZ', 'IE', 'DE', 'FR', 'ES', 'IT',
                'NL', 'BE', 'AT', 'CH', 'DK', 'FI', 'NO', 'SE', 'PL', 'PT',
                'CZ', 'IL', 'AE', 'HK', 'JP', 'KR', 'MY', 'SG',
              ],
              returnPolicyCategory:
                'https://schema.org/MerchantReturnFiniteReturnWindow',
              merchantReturnDays: 30,
              returnFees: 'https://schema.org/FreeReturn',
              // Nothing is posted back. A qualifying refund is issued and the
              // buyer keeps the files they already downloaded.
              returnMethod: 'https://schema.org/KeepProduct',
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
               * the free-return signal this block exists to state. The link
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
                'US', 'CA', 'GB', 'AU', 'NZ', 'IE', 'DE', 'FR', 'ES', 'IT',
                'NL', 'BE', 'AT', 'CH', 'DK', 'FI', 'NO', 'SE', 'PL', 'PT',
                'CZ', 'IL', 'AE', 'HK', 'JP', 'KR', 'MY', 'SG',
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
    ...(hasEnoughReviewsForJsonLd
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: productReviews.average,
            reviewCount: productReviews.count,
          },
        }
      : {}),
    ...(reviewJsonLd ? {review: reviewJsonLd} : {}),
  };

  const videoMedia = findVideoMedia(media);
  const videoMeta = videoMedia
    ? lookupVideoMetadata(videoMetadata, videoMedia.id)
    : undefined;
  const videoJsonLd = videoMedia
    ? buildVideoJsonLd({title, videoMedia, meta: videoMeta})
    : undefined;

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {'@type': 'ListItem', position: 1, name: 'Home', item: origin},
      {
        '@type': 'ListItem',
        position: 2,
        name: 'All Widgets',
        item: `${origin}/collections/all`,
      },
      {'@type': 'ListItem', position: 3, name: title, item: productUrl},
    ],
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
      {videoJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(videoJsonLd).replace(/</g, '\\u003c'),
          }}
        />
      )}
      <div className="product-top">
        <ProductGallery media={media} title={title} smallScreen={smallScreen} />
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

            The full keyword title is still on the page, under the name, and
            still carries every word it did: the meta title, the OG tags, the
            Product JSON-LD `name` and the answer block are all untouched, so
            nothing that a crawler reads lost a keyword. `subjectFromTitle` is
            the same cleaner the gallery and the alt-text generator use, so
            the three cannot drift. Across the catalog it yields 36 chars on
            average, 0 empty, 0 collisions between products (checked against
            the live feed, 123 products, 2026-09-21).
          */}
          <div className="product-heading">
            <h1>{shortTitle}</h1>
            {shortTitle !== title ? (
              <p className="product-title-full">{title}</p>
            ) : null}
          </div>
          <div className="product-buybox">
            {hasEnoughReviewsForJsonLd ? (
              <ProductRatingBadge data={productReviews} />
            ) : (
              <EtsyRatingBadge compact />
            )}
            <ProductPrice
              price={selectedVariant?.price}
              compareAtPrice={selectedVariant?.compareAtPrice}
            />
          </div>
          <ProductHighlights
            description={description}
            worksWith={worksWith?.value}
            productType={product.productType}
          />
          <ProductForm
            productOptions={productOptions}
            selectedVariant={selectedVariant}
          />
          <ShareRow title={title} />
        </div>
      </div>
      <div className="product-description">
        {/* The one passage on this page written to be lifted whole by an
            answer engine: product, platforms, price, what arrives and in
            what format, with nothing in it that depends on the page around
            it. Visible to buyers on purpose, never crawler-only. */}
        {answerBlock ? (
          <p className="product-answer">{answerBlock}</p>
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
                <Link to="/pages/faq-frequently-asked-questions" className="product-faq-link">
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
          {(nodes) =>
            nodes && nodes.length > 0 ? (
              <div className="product-related">
                <h2>
                  More {widgetKind ? `${widgetKind} widgets` : 'widgets'}
                </h2>
                <div className="product-related-grid">
                  {nodes.map((related, index) => (
                    <ProductItem
                      key={related.id}
                      product={related}
                      listId="related-products"
                      listName="Related products"
                      index={index}
                      /* sits under the "More widgets" <h2> */
                      headingLevel={3}
                    />
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
    descriptionHtml
    worksWith: metafield(namespace: "custom", key: "works_with") { value }
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
        worksWith: metafield(namespace: "custom", key: "works_with") { value }
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
