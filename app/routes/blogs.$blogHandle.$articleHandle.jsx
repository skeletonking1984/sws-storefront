import {Await, useLoaderData} from 'react-router';
import {Suspense} from 'react';
import {Image} from '@shopify/hydrogen';
import {
  crossSellQuery,
  crossSellHeading,
  buildCrossSellShelf,
} from '~/lib/blogCrossSell';
import {ArticleCarousel} from '~/components/ArticleCarousel';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {buildMeta, getOrigin} from '~/lib/seo';
import spaceGroteskLatin from '~/assets/fonts/space-grotesk-latin.woff2?url';

/*
 * Preloaded HERE and not in root.jsx on purpose. Space Grotesk is the article
 * body face and nothing else on the site uses it, so preloading it globally
 * would cost every other page a 22KB request it never paints with. A route
 * level links export scopes the early fetch to the one page that needs it.
 *
 * latin-ext is not preloaded, same rule as the other families: its
 * unicode-range keeps it off pages with no extended-latin characters.
 *
 * @type {Route.LinksFunction}
 */
export const links = () => [
  {
    rel: 'preload',
    as: 'font',
    type: 'font/woff2',
    href: spaceGroteskLatin,
    crossOrigin: 'anonymous',
  },
];

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({data, matches, location}) => {
  const origin = getOrigin(matches);
  const article = data?.article;
  const title = article?.title ?? '';
  return buildMeta({
    title: `${title} | Stream Widget Shop Blog`,
    description:
      article?.seo?.description ||
      `${title}: a Stream Widget Shop blog post on stream setup and widgets.`,
    url: `${origin}${location.pathname}`,
    image: article?.image?.url,
    type: 'article',
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
async function loadCriticalData({context, request, params}) {
  const {blogHandle, articleHandle} = params;

  if (!articleHandle || !blogHandle) {
    throw new Response('Not found', {status: 404});
  }

  const [{blog}] = await Promise.all([
    context.storefront.query(ARTICLE_QUERY, {
      variables: {blogHandle, articleHandle},
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!blog?.articleByHandle) {
    throw new Response(null, {status: 404});
  }

  redirectIfHandleIsLocalized(
    request,
    {
      handle: articleHandle,
      data: blog.articleByHandle,
    },
    {
      handle: blogHandle,
      data: blog,
    },
  );

  const article = blog.articleByHandle;

  /*
   * Product shelf under the article.
   *
   * Derived from the article, so it cannot live in loadDeferredData, which runs
   * before the article exists. Started here and returned UNAWAITED so it
   * streams in behind the page instead of holding time-to-first-byte for a row
   * that sits below the whole article.
   *
   * Two requests at most: the themed search, then best sellers to top up.
   *
   * The fallback is not a nicety, it is most of the blog. Measured against all
   * 43 live articles on 2026-09-15, the themed query ALONE left 25 of them with
   * an EMPTY shelf, for two different reasons:
   *
   *   14 produce no query at all, because the title carries neither a theme nor
   *   a product type ("How to Make Money on Twitch as a Beginner in 2026").
   *
   *   11 query a theme the catalogue does not stock. "cyberpunk" and "sci-fi"
   *   return ZERO products in every spelling tried, yet eight articles are
   *   written around exactly those words.
   *
   * Best selling is the right pool: it needs no relevance claim, and it is the
   * likeliest thing to sell to someone who just finished reading. The heading
   * downgrades to "From the shop" whenever themed matches do not carry the
   * shelf, so the row never claims a connection the products cannot back up.
   */
  const picked = crossSellQuery(article);
  const linkedInBody = new Set(
    Array.from(
      String(article?.contentHtml || '').matchAll(/\/products\/([a-z0-9-]+)/g),
    ).map((m) => m[1]),
  );

  const crossSell = (picked
    ? context.storefront
        .query(CROSS_SELL_QUERY, {variables: {query: picked.query}})
        .catch(() => null)
    : Promise.resolve(null)
  )
    .then(async (data) => {
      const shelf = picked
        ? buildCrossSellShelf(
            data?.products?.nodes || [],
            picked,
            article.contentHtml || '',
            SHELF_SIZE,
          )
        : {products: [], matched: 0};

      if (shelf.products.length < SHELF_MIN) {
        const pool = await context.storefront
          .query(CROSS_SELL_FALLBACK_QUERY, {variables: {first: SHELF_SIZE}})
          .then((d) => d?.products?.nodes || [])
          .catch(() => []);
        const have = new Set(shelf.products.map((p) => p.handle));
        for (const p of pool) {
          if (shelf.products.length >= SHELF_SIZE) break;
          if (!p?.handle || have.has(p.handle) || linkedInBody.has(p.handle)) continue;
          have.add(p.handle);
          shelf.products.push(p);
        }
      }

      if (!shelf.products.length) return null;

      return {
        heading:
          picked && shelf.matched >= Math.ceil(shelf.products.length / 2)
            ? crossSellHeading(picked)
            : 'From the shop',
        products: shelf.products,
      };
    })
    // Never let a failed shelf take the article down with it.
    .catch(() => null);

  return {article, crossSell};
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

/**
 * Rewrites Shopify CDN <img> URLs inside a blog article's body so they are
 * sharp on a high density screen.
 *
 * The body arrives as raw HTML from Shopify's blog editor, so each image
 * carries whatever URL the author pasted, usually with a small `width`
 * baked in. Measured on the live site 2026-09-13: the lunar cat image in
 * "Best VTuber Overlays 2026" was requested at `width=400` and painted at
 * 913 CSS px. A 2x display needs roughly 1826 real pixels there, so it
 * rendered soft. The CSS half of this fix (`.article img`, app.css) stops
 * images being scaled UP past their own resolution; this half asks the CDN
 * for enough pixels in the first place.
 *
 * Only touches `cdn.shopify.com` URLs, and only ones that already carry a
 * `width` parameter, because those are the resized ones. `crop` and
 * `height` are dropped with it: they were sized for the old small width
 * and keeping them would crop the larger source to the same small box.
 * Anything else in the body, an external image, an inline SVG, a video, is
 * left exactly as the author wrote it.
 *
 * @param {string} html Raw article `contentHtml`.
 * @returns {string}
 */
function sharpenArticleImages(html) {
  if (!html) return html;

  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const srcMatch = tag.match(/\ssrc=["']([^"']+)["']/i);
    if (!srcMatch) return tag;

    const rawSrc = srcMatch[1];
    if (!rawSrc.includes('cdn.shopify.com')) return tag;

    let url;
    try {
      url = new URL(rawSrc, 'https://cdn.shopify.com');
    } catch {
      return tag;
    }
    if (!url.searchParams.has('width')) return tag;

    // Sized for the article column, which is capped well under 1000px, so
    // 1600 covers a 2x display without asking for the full original on
    // every page load.
    const widths = [800, 1200, 1600];
    const withWidth = (w) => {
      const next = new URL(url);
      next.searchParams.delete('crop');
      next.searchParams.delete('height');
      next.searchParams.set('width', String(w));
      return next.toString();
    };

    const srcSet = widths.map((w) => `${withWidth(w)} ${w}w`).join(', ');
    const rebuilt = tag
      .replace(/\ssrcset=["'][^"']*["']/i, '')
      .replace(/\ssizes=["'][^"']*["']/i, '')
      .replace(/\ssrc=["'][^"']+["']/i, ` src="${withWidth(1200)}"`)
      .replace(
        /\s*\/?>$/,
        ` srcset="${srcSet}" sizes="(min-width: 60em) 900px, 92vw" loading="lazy" decoding="async" />`,
      );
    return rebuilt;
  });
}

export default function Article() {
  /** @type {LoaderReturnData} */
  const {article, crossSell} = useLoaderData();
  const {title, image, contentHtml, author} = article;
  const bodyHtml = sharpenArticleImages(contentHtml);

  const publishedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(article.publishedAt));

  return (
    <div className="article">
      <h1>
        {title}
        <div>
          <time dateTime={article.publishedAt}>{publishedDate}</time> &middot;{' '}
          <address>{author?.name}</address>
        </div>
      </h1>

      {image && (
        /*
          Capped to the image's OWN width so a small hero is never scaled
          up. Measured on the live site 2026-09-13: this article's hero is
          475x472 and was being painted at 913 CSS px, a 2x upscale before
          device pixel ratio is even considered, which is what made it look
          blurry. 5 of the 43 articles have a hero under 900px wide, so
          this is not a one-off.

          `sizes` has to agree with the cap or the browser picks a
          candidate for the uncapped slot and downloads more than it can
          use. The real fix for those 5 is a bigger upload; this just stops
          the page making a small image look worse than it is.
        */
        <Image
          data={image}
          sizes={
            image.width
              ? `min(90vw, ${image.width}px)`
              : '90vw'
          }
          loading="eager"
          style={
            image.width
              ? {maxWidth: `${image.width}px`, width: '100%'}
              : undefined
          }
        />
      )}
      {/*
        `article-body`, not `article`: the typography rules in app.css are
        scoped to this inner block so they style the author's content without
        also hitting the h1, byline and hero above it. The class was `article`
        here, which meant the outer page padding rule applied twice, nested.
      */}
      <div
        dangerouslySetInnerHTML={{__html: bodyHtml}}
        className="article-body"
      />

      {crossSell && (
        <Suspense fallback={null}>
          <Await resolve={crossSell} errorElement={null}>
            {(data) =>
              data && data.products.length > 0 ? (
                <ArticleCarousel
                  heading={data.heading}
                  products={data.products}
                />
              ) : null
            }
          </Await>
        </Suspense>
      )}
    </div>
  );
}

/*
  Cross-sell row query. Same shape ProductItem expects everywhere else, kept
  local rather than imported so this route owns what it asks for. `first: 24`
  and not 10: filterCrossSell() throws away anything that shares no term with
  the query, because Shopify full-text search will return a Christmas goal bar
  for a Halloween query once the close matches run out, so the shelf needs
  headroom to discard from before buildCrossSellShelf trims it to SHELF_SIZE.
*/
/* How many cards the shelf holds. 10 fills a wide screen with a little to
   scroll to, without the query having to return the whole catalogue. */
const SHELF_SIZE = 10;

/* Below this many themed matches the shelf is topped up from best sellers
   rather than shipping a near empty row. */
const SHELF_MIN = 6;

/* Best sellers, the fallback pool. Sorted by BEST_SELLING rather than by a
   search term, so it needs no relevance claim and is the most likely thing to
   sell to someone who just finished reading. */
/* Shared by both shelf queries. Declared once as a JS constant and
   interpolated, so the two can never drift into asking for different fields and
   handing ProductItem two different shapes. */
const CROSS_SELL_FRAGMENTS = `#graphql
  fragment MoneyCrossSell on MoneyV2 {
    amount
    currencyCode
  }
  fragment CrossSellItem on Product {
    id
    handle
    title
    productType
    worksWith: metafield(namespace: "custom", key: "works_with") { value }
    featuredImage {
      id
      altText
      url
    }
    priceRange {
      minVariantPrice {
        ...MoneyCrossSell
      }
      maxVariantPrice {
        ...MoneyCrossSell
      }
    }
  }
`;

const CROSS_SELL_FALLBACK_QUERY = `#graphql
  ${CROSS_SELL_FRAGMENTS}
  query BlogShelfFallback($first: Int!, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: $first, sortKey: BEST_SELLING) {
      nodes {
        ...CrossSellItem
      }
    }
  }
`;

const CROSS_SELL_QUERY = `#graphql
  ${CROSS_SELL_FRAGMENTS}
  query BlogCrossSell($query: String!, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 24, query: $query, sortKey: RELEVANCE) {
      nodes {
        ...CrossSellItem
      }
    }
  }
`;


// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/blog#field-blog-articlebyhandle
const ARTICLE_QUERY = `#graphql
  query Article(
    $articleHandle: String!
    $blogHandle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(language: $language, country: $country) {
    blog(handle: $blogHandle) {
      handle
      articleByHandle(handle: $articleHandle) {
        handle
        title
        tags
        contentHtml
        publishedAt
        author: authorV2 {
          name
        }
        image {
          id
          altText
          url
          width
          height
        }
        seo {
          description
          title
        }
      }
    }
  }
`;

/** @typedef {import('./+types/blogs.$blogHandle.$articleHandle').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
