import {
  ARTICLES_PAGE_SIZE,
  BLOG_SITEMAP_QUERY,
  COLLECTION_SITEMAP_QUERY,
  EXCLUDED_PAGE_HANDLES,
  PAGE_SITEMAP_QUERY,
  PRODUCT_SITEMAP_QUERY,
  SITEMAP_TYPE_CONFIG,
  SITEMAP_URLSET_CLOSE,
  SITEMAP_URLSET_OPEN,
  STATIC_ROUTES,
  getAllArticles,
  renderUrlTag,
} from '~/lib/sitemap';

const RESOURCE_QUERIES = {
  products: PRODUCT_SITEMAP_QUERY,
  collections: COLLECTION_SITEMAP_QUERY,
  pages: PAGE_SITEMAP_QUERY,
  blogs: BLOG_SITEMAP_QUERY,
};

/**
 * Custom per-type sitemap page. Replaces the stock `getSitemap` helper,
 * which hardcoded three locale alternates onto every URL (see
 * `app/lib/sitemap.js` for why) and had no notion of a static/homepage type
 * or an excluded-pages list.
 * @param {Route.LoaderArgs}
 */
export async function loader({request, params, context: {storefront}}) {
  const {type, page} = params;
  const baseUrl = new URL(request.url).origin;
  const pageNumber = parseInt(page, 10);

  if (!type || !pageNumber) {
    throw new Response('Not found', {status: 404});
  }

  let urlTags;

  if (type === 'static') {
    urlTags = STATIC_ROUTES.map((route) =>
      renderUrlTag({
        loc: `${baseUrl}${route.path}`,
        changefreq: route.changefreq,
        priority: route.priority,
      }),
    );
  } else if (type === 'articles') {
    const config = SITEMAP_TYPE_CONFIG.articles;
    const allArticles = await getAllArticles(storefront);
    const start = (pageNumber - 1) * ARTICLES_PAGE_SIZE;
    const pageArticles = allArticles.slice(start, start + ARTICLES_PAGE_SIZE);
    urlTags = pageArticles.map((article) =>
      renderUrlTag({
        loc: `${baseUrl}/blogs/${article.blogHandle}/${article.handle}`,
        lastmod: toDateOnly(article.publishedAt),
        changefreq: config.changefreq,
        priority: config.priority,
      }),
    );
  } else if (RESOURCE_QUERIES[type]) {
    const config = SITEMAP_TYPE_CONFIG[type];
    const data = await storefront.query(RESOURCE_QUERIES[type], {
      variables: {page: pageNumber},
    });
    let items = data?.sitemap?.resources?.items ?? [];

    if (type === 'pages') {
      items = items.filter((item) => !EXCLUDED_PAGE_HANDLES[item.handle]);
    }

    urlTags = items.map((item) =>
      renderUrlTag({
        loc: `${baseUrl}/${config.urlPrefix}/${item.handle}`,
        lastmod: toDateOnly(item.updatedAt),
        changefreq: config.changefreq,
        priority: config.priority,
      }),
    );
  } else {
    throw new Response('Not found', {status: 404});
  }

  const body =
    SITEMAP_URLSET_OPEN +
    '\n' +
    urlTags.join('\n') +
    (urlTags.length ? '\n' : '') +
    SITEMAP_URLSET_CLOSE;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': `max-age=${60 * 60 * 24}`,
    },
  });
}

/** Storefront API returns full ISO datetimes; sitemaps only need the date part. */
function toDateOnly(isoDateTime) {
  if (!isoDateTime) return undefined;
  return isoDateTime.slice(0, 10);
}

/** @typedef {import('./+types/sitemap.$type.$page[.xml]').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
