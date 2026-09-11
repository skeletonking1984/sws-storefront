/**
 * @param {Route.LoaderArgs}
 */
export function loader({request}) {
  const url = new URL(request.url);
  const body = robotsTxtData({url: url.origin});

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',

      'Cache-Control': `max-age=${60 * 60 * 24}`,
    },
  });
}

/**
 * @param {{url?: string}}
 */
function robotsTxtData({url}) {
  const sitemapUrl = url ? `${url}/sitemap.xml` : undefined;
  const llmsTxtUrl = url ? `${url}/llms.txt` : undefined;

  return `
User-agent: *
${generalDisallowRules({sitemapUrl})}

# llms.txt (https://llmstxt.org/): plain-text site summary for LLMs/AI crawlers
${llmsTxtUrl ? `# ${llmsTxtUrl}` : ''}

# Google adsbot ignores robots.txt unless specifically named!
User-agent: adsbot-google
Disallow: /cart
Disallow: /account
Disallow: /search
Allow: /search/
Disallow: /search/?*

User-agent: Nutch
Disallow: /

User-agent: AhrefsBot
Crawl-delay: 10
${generalDisallowRules({sitemapUrl})}

User-agent: AhrefsSiteAudit
Crawl-delay: 10
${generalDisallowRules({sitemapUrl})}

User-agent: MJ12bot
Crawl-Delay: 10

User-agent: Pinterest
Crawl-delay: 1
`.trim();
}

/**
 * This function generates disallow rules that generally follow what Shopify's
 * Online Store has as defaults for their robots.txt
 * @param {{sitemapUrl?: string}}
 */
/**
 * Shopify's default robots.txt disallows /policies/. That is dropped here on
 * purpose: the refund, shipping, privacy, terms, contact and legal notice
 * pages are exactly what a shopping agent needs to read before recommending
 * or buying, and Shopify's own Agentic Storefronts setup asks merchants to
 * "update your policies so AI agents can read them". Blocking them defeats
 * that, and there is nothing thin or duplicative about these pages worth
 * hiding from a crawler.
 */
function generalDisallowRules({sitemapUrl}) {
  return `Disallow: /cart
Disallow: /account
Disallow: /collections/*sort_by*
Disallow: /*/collections/*sort_by*
Disallow: /collections/*+*
Disallow: /collections/*%2B*
Disallow: /collections/*%2b*
Disallow: /*/collections/*+*
Disallow: /*/collections/*%2B*
Disallow: /*/collections/*%2b*
Disallow: /*/collections/*filter*&*filter*
Disallow: /blogs/*+*
Disallow: /blogs/*%2B*
Disallow: /blogs/*%2b*
Disallow: /*/blogs/*+*
Disallow: /*/blogs/*%2B*
Disallow: /*/blogs/*%2b*
Disallow: /search
Allow: /search/
Disallow: /search/?*
${sitemapUrl ? `Sitemap: ${sitemapUrl}` : ''}`;
}

/** @typedef {import('./+types/[robots.txt]').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
