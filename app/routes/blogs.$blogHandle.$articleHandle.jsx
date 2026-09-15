import {Await, useLoaderData} from 'react-router';
import {Suspense} from 'react';
import {Image} from '@shopify/hydrogen';
import {ProductItem} from '~/components/ProductItem';
import {
  crossSellQuery,
  crossSellHeading,
  filterCrossSell,
} from '~/lib/blogCrossSell';
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
    Cross-sell is derived from the article, so it cannot live in
    loadDeferredData, which runs before the article exists. Started here and
    returned UNAWAITED so it streams in behind the page instead of holding
    time-to-first-byte for a row that sits below the whole article.

    Resolves to null when the article gives nothing honest to match on; see
    app/lib/blogCrossSell.js for why a themeless article gets no themed row.
  */
  const picked = crossSellQuery(article);
  const crossSell = picked
    ? context.storefront
        .query(CROSS_SELL_QUERY, {variables: {query: picked.query}})
        .then((data) => ({
          heading: crossSellHeading(picked),
          products: filterCrossSell(
            data?.products?.nodes || [],
            picked,
            article.contentHtml || '',
          ).slice(0, 4),
        }))
        // Never let a failed cross-sell take the article down with it.
        .catch(() => null)
    : null;

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
                <aside className="article-crosssell">
                  <h2>{data.heading}</h2>
                  <div className="article-crosssell-grid">
                    {data.products.map((product) => (
                      <ProductItem
                        key={product.id}
                        product={product}
                        headingLevel={3}
                      />
                    ))}
                  </div>
                </aside>
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
  local rather than imported so this route owns what it asks for. `first: 12`
  and not 4: filterCrossSell() throws away anything that shares no term with
  the query, because Shopify full-text search will return a Christmas goal bar
  for a Halloween query once the close matches run out, so the row needs
  headroom to discard from before it trims to 4.
*/
const CROSS_SELL_QUERY = `#graphql
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
  query BlogCrossSell($query: String!, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 12, query: $query, sortKey: RELEVANCE) {
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
