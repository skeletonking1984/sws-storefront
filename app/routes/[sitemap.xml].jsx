import {
  ARTICLES_PAGE_SIZE,
  SITEMAP_COUNTS_QUERY,
  SITEMAP_INDEX_CLOSE,
  SITEMAP_INDEX_OPEN,
  getAllArticles,
} from '~/lib/sitemap';

/**
 * Custom sitemap index. Replaces the stock `getSitemapIndex` helper, which
 * only supplies pagination for types it knows about and doesn't leave room
 * for the static/homepage sitemap this storefront needs.
 * @param {Route.LoaderArgs}
 */
export async function loader({request, context: {storefront}}) {
  const baseUrl = new URL(request.url).origin;

  const [counts, articles] = await Promise.all([
    storefront.query(SITEMAP_COUNTS_QUERY),
    getAllArticles(storefront),
  ]);

  const articlesPageCount = Math.max(
    1,
    Math.ceil(articles.length / ARTICLES_PAGE_SIZE),
  );

  const entries = [
    // Static/homepage sitemap is always a single page.
    `${baseUrl}/sitemap/static/1.xml`,
    ...sitemapUrlsForType(baseUrl, 'products', counts?.products?.pagesCount?.count),
    ...sitemapUrlsForType(
      baseUrl,
      'collections',
      counts?.collections?.pagesCount?.count,
    ),
    ...sitemapUrlsForType(baseUrl, 'pages', counts?.pages?.pagesCount?.count),
    ...sitemapUrlsForType(baseUrl, 'blogs', counts?.blogs?.pagesCount?.count),
    ...sitemapUrlsForType(baseUrl, 'articles', articlesPageCount),
  ];

  const body =
    SITEMAP_INDEX_OPEN +
    '\n' +
    entries
      .map((url) => `  <sitemap><loc>${url}</loc></sitemap>`)
      .join('\n') +
    '\n' +
    SITEMAP_INDEX_CLOSE;

  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': `max-age=${60 * 60 * 24}`,
    },
  });
}

function sitemapUrlsForType(baseUrl, type, pageCount) {
  const count = pageCount ?? 0;
  const urls = [];
  for (let page = 1; page <= count; page++) {
    urls.push(`${baseUrl}/sitemap/${type}/${page}.xml`);
  }
  return urls;
}

/** @typedef {import('./+types/[sitemap.xml]').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
