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

import {
  findVideoMedia,
  lookupVideoMetadata,
  pickBestMp4Source,
} from '~/lib/video';

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

/**
 * Video sitemap. One page is plenty: the shop runs ~130 products, each with
 * at most one demo video, far under the 50,000-URL sitemap limit, so this
 * is never paginated like the product/collection/blog/page/article types.
 */
export const VIDEO_SITEMAP_URLSET_OPEN =
  `${SITEMAP_XML_HEADER}\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
  `xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">`;
export const VIDEO_SITEMAP_URLSET_CLOSE = '</urlset>';

/**
 * Renders one `<url>` entry carrying a `<video:video>` child. Every field
 * Google documents as required for a video sitemap entry
 * (thumbnail_loc/title/description/content_loc) is always passed in by the
 * caller; duration/publication_date are optional per the video schema and
 * are only written when present.
 */
export function renderVideoUrlTag({
  loc,
  thumbnailLoc,
  title,
  description,
  contentLoc,
  durationSeconds,
  publicationDate,
}) {
  const parts = [
    '  <url>',
    `    <loc>${escapeXml(loc)}</loc>`,
    '    <video:video>',
    `      <video:thumbnail_loc>${escapeXml(thumbnailLoc)}</video:thumbnail_loc>`,
    `      <video:title>${escapeXml(title)}</video:title>`,
    `      <video:description>${escapeXml(description)}</video:description>`,
    `      <video:content_loc>${escapeXml(contentLoc)}</video:content_loc>`,
  ];
  if (Number.isFinite(durationSeconds)) {
    parts.push(`      <video:duration>${durationSeconds}</video:duration>`);
  }
  if (publicationDate) {
    parts.push(
      `      <video:publication_date>${publicationDate}</video:publication_date>`,
    );
  }
  parts.push('    </video:video>', '  </url>');
  return parts.join('\n');
}

/**
 * Every product's handle/title plus its media, used only to build the video
 * sitemap. `sitemap(type: PRODUCT)` (used by the plain product sitemap
 * above) doesn't expose media, so this queries the catalog directly instead.
 * `first: 250` covers the whole ~130-product catalog in one page; if the
 * catalog ever grows past that this would need the same cursor pagination
 * `getAllArticles` uses above.
 */
export const VIDEO_SITEMAP_PRODUCTS_QUERY = `#graphql
  query SitemapVideoProducts {
    products(first: 250) {
      nodes {
        handle
        title
        media(first: 25) {
          nodes {
            __typename
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
      }
    }
  }
`;

/**
 * Builds the video sitemap's entries: one per product that has a demo video
 * AND a `video-metadata.json` match for it. A product with a video but no
 * metadata match is skipped entirely, same rule as the PDP's VideoObject
 * JSON-LD (see `buildVideoJsonLd` in `products.$handle.jsx`) and for the
 * same reason: `publication_date` would otherwise have to be guessed.
 * @param {import('@shopify/hydrogen').Storefront} storefront
 * @param {string} baseUrl
 * @param {{videos?: Record<string, {uploadDate: string, duration: string, durationMs: number}>}} videoMetadata
 */
export async function getVideoSitemapEntries(storefront, baseUrl, videoMetadata) {
  const data = await storefront.query(VIDEO_SITEMAP_PRODUCTS_QUERY);
  const products = data?.products?.nodes ?? [];
  const entries = [];

  for (const product of products) {
    const videoMedia = findVideoMedia(product.media?.nodes);
    if (!videoMedia) continue;

    const meta = lookupVideoMetadata(videoMetadata, videoMedia.id);
    if (!meta) continue;

    const contentUrl = pickBestMp4Source(videoMedia.sources)?.url;
    const thumbnailUrl = videoMedia.previewImage?.url;
    if (!contentUrl || !thumbnailUrl) continue;

    entries.push({
      loc: `${baseUrl}/products/${product.handle}`,
      thumbnailLoc: thumbnailUrl,
      title: videoMedia.alt || `${product.title} demo video`,
      description: `A demo video of the ${product.title} running on stream.`,
      contentLoc: contentUrl,
      durationSeconds: Number.isFinite(meta.durationMs)
        ? Math.round(meta.durationMs / 1000)
        : undefined,
      publicationDate: meta.uploadDate,
    });
  }

  return entries;
}
