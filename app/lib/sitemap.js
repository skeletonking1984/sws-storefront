/**
 * Custom sitemap generation. Replaces the stock `getSitemap`/`getSitemapIndex`
 * helpers from `@shopify/hydrogen`, which shipped with an example
 * `locales: ['EN-US', 'EN-CA', 'FR-CA']` config for a multi-locale store.
 * This shop is single locale, so that config made every sitemap entry
 * advertise three `xhtml:link rel="alternate"` URLs that all 404
 * (there is no `/EN-US/...`, `/EN-CA/...` or `/FR-CA/...` route on this
 * storefront). This module builds every sitemap by hand instead, with no
 * locale alternates, a real homepage entry, and a page exclusion list.
 */

/**
 * Shopify Pages that must never appear in the sitemap, keyed by handle, with
 * the reason next to each one. Add a page here (with a reason) to keep it
 * out of search results.
 */
export const EXCLUDED_PAGE_HANDLES = {
  // Body is nothing but leftover Swym wishlist app <script> tags. Swym is
  // not loaded on this Hydrogen storefront, so the page renders no content.
  'swym-wishlist': 'dead Swym app page, renders no content on Hydrogen',
  'swym-share-wishlist': 'dead Swym app page, renders no content on Hydrogen',
  // Body is completely empty in Shopify Admin.
  custlo: 'empty page body',
};

/**
 * Static routes that are not backed by a Storefront API sitemap resource
 * (the homepage, and the "shop all" collection view, which is a route on
 * this storefront but not a real Shopify Collection object). No `lastmod`
 * is set for these since there is no real "last updated" data to report;
 * inventing today's date would just train crawlers to ignore the tag.
 */
export const STATIC_ROUTES = [
  {path: '/', changefreq: 'daily', priority: '1.0'},
  {path: '/collections/all', changefreq: 'daily', priority: '0.9'},
];

/** Per-type `<changefreq>`/`<priority>` hints used when rendering `<url>` entries. */
export const SITEMAP_TYPE_CONFIG = {
  products: {urlPrefix: 'products', changefreq: 'weekly', priority: '0.8'},
  collections: {urlPrefix: 'collections', changefreq: 'weekly', priority: '0.7'},
  blogs: {urlPrefix: 'blogs', changefreq: 'weekly', priority: '0.5'},
  pages: {urlPrefix: 'pages', changefreq: 'monthly', priority: '0.3'},
  articles: {changefreq: 'monthly', priority: '0.5'},
};

/** Number of article URLs per child sitemap page. */
export const ARTICLES_PAGE_SIZE = 250;

export const SITEMAP_XML_HEADER = '<?xml version="1.0" encoding="UTF-8"?>';

export const SITEMAP_URLSET_OPEN = `${SITEMAP_XML_HEADER}\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
export const SITEMAP_URLSET_CLOSE = '</urlset>';

export const SITEMAP_INDEX_OPEN = `${SITEMAP_XML_HEADER}\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;
export const SITEMAP_INDEX_CLOSE = '</sitemapindex>';

/** Escapes text for safe inclusion inside XML element content. */
export function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Renders one `<url>` entry. `lastmod` is only written when a real date is
 * passed; `changefreq`/`priority` are only written when provided.
 */
export function renderUrlTag({loc, lastmod, changefreq, priority}) {
  const parts = [`  <url>`, `    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  parts.push(`  </url>`);
  return parts.join('\n');
}

/** Query for the per-type `pagesCount` used to build the sitemap index. */
export const SITEMAP_COUNTS_QUERY = `#graphql
  query SitemapCounts {
    products: sitemap(type: PRODUCT) {
      pagesCount {
        count
      }
    }
    collections: sitemap(type: COLLECTION) {
      pagesCount {
        count
      }
    }
    pages: sitemap(type: PAGE) {
      pagesCount {
        count
      }
    }
    blogs: sitemap(type: BLOG) {
      pagesCount {
        count
      }
    }
  }
`;

export const PRODUCT_SITEMAP_QUERY = `#graphql
  query SitemapProductsPage($page: Int!) {
    sitemap(type: PRODUCT) {
      resources(page: $page) {
        items {
          handle
          updatedAt
        }
      }
    }
  }
`;

export const COLLECTION_SITEMAP_QUERY = `#graphql
  query SitemapCollectionsPage($page: Int!) {
    sitemap(type: COLLECTION) {
      resources(page: $page) {
        items {
          handle
          updatedAt
        }
      }
    }
  }
`;

export const PAGE_SITEMAP_QUERY = `#graphql
  query SitemapPagesPage($page: Int!) {
    sitemap(type: PAGE) {
      resources(page: $page) {
        items {
          handle
          updatedAt
        }
      }
    }
  }
`;

export const BLOG_SITEMAP_QUERY = `#graphql
  query SitemapBlogsPage($page: Int!) {
    sitemap(type: BLOG) {
      resources(page: $page) {
        items {
          handle
          updatedAt
        }
      }
    }
  }
`;

/** Lists every blog handle on the shop, paginating in case there is more than one page. */
const BLOGS_HANDLES_QUERY = `#graphql
  query SitemapBlogHandles($cursor: String) {
    blogs(first: 250, after: $cursor) {
      nodes {
        handle
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

/** Lists every article (handle + publishedAt) under one blog, fully paginated. */
const BLOG_ARTICLES_QUERY = `#graphql
  query SitemapBlogArticles($blogHandle: String!, $cursor: String) {
    blog(handle: $blogHandle) {
      articles(first: 250, after: $cursor) {
        nodes {
          handle
          publishedAt
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;

/**
 * Articles don't carry their parent blog's handle on the Storefront API's
 * generic sitemap resource, and article URLs on this storefront are
 * `/blogs/<blogHandle>/<articleHandle>` (see
 * `app/routes/blogs.$blogHandle.$articleHandle.jsx`), not `/articles/<handle>`.
 * So articles are fetched through `blogs`/`blog.articles` instead of
 * `sitemap(type: ARTICLE)`, walking every cursor page of every blog so
 * nothing is silently capped at the first page.
 */
export async function getAllArticles(storefront) {
  const blogHandles = [];
  let blogCursor;
  for (;;) {
    const data = await storefront.query(BLOGS_HANDLES_QUERY, {
      variables: {cursor: blogCursor},
    });
    const blogs = data?.blogs;
    for (const node of blogs?.nodes ?? []) {
      blogHandles.push(node.handle);
    }
    if (!blogs?.pageInfo?.hasNextPage) break;
    blogCursor = blogs.pageInfo.endCursor;
  }

  const articles = [];
  for (const blogHandle of blogHandles) {
    let articleCursor;
    for (;;) {
      const data = await storefront.query(BLOG_ARTICLES_QUERY, {
        variables: {blogHandle, cursor: articleCursor},
      });
      const connection = data?.blog?.articles;
      for (const node of connection?.nodes ?? []) {
        articles.push({
          blogHandle,
          handle: node.handle,
          publishedAt: node.publishedAt,
        });
      }
      if (!connection?.pageInfo?.hasNextPage) break;
      articleCursor = connection.pageInfo.endCursor;
    }
  }

  return articles;
}
