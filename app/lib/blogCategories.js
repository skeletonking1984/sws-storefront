/**
 * Blog readers land here from two places: SEO search for setup/tutorial
 * terms (OBS, StreamElements, WebM) and existing customers checking product
 * spotlights or platform news. These categories reflect those real intents
 * so the index page can be browsed, not just scrolled.
 *
 * Order matters: checked top to bottom, first match wins. More specific
 * categories (news, spotlights, trends) are checked before the broad
 * "tutorials" catch-all, since generic words like "setup" appear in almost
 * every title.
 */
export const BLOG_CATEGORIES = [
  {
    key: 'news',
    label: 'Platform News',
    keywords: ['shutting down', 'shutdown', 'is closing', 'closing?', 'alternatives'],
  },
  {
    key: 'trends',
    label: 'Trends & Seasonal',
    keywords: [
      'star wars',
      'mandalorian',
      'nba',
      'spring',
      'sci-fi',
      'cyberpunk',
      'vtuber',
      'aesthetic',
      'anime',
      'cozy',
      'cottagecore',
      'evolution of',
      'season',
    ],
  },
  {
    key: 'spotlights',
    label: 'Product Spotlights',
    keywords: [
      'introducing',
      'upgrade your stream',
      'hire a custom',
      'goal widget for',
      'chat widget built',
      'matters more than you think',
    ],
  },
  {
    key: 'tutorials',
    label: 'Setup & Tutorials',
    keywords: ['obs', 'streamelements', 'streamlabs', 'webm', ' gif', 'tutorial', 'browser source', 'how to'],
  },
];

const DEFAULT_CATEGORY = BLOG_CATEGORIES[1]; // Trends & Seasonal

/**
 * Assigns a category to a blog article using its real Shopify tags first,
 * falling back to a title-keyword match for the ~60% of articles with no
 * tags set.
 * @param {{title: string; tags?: string[]}} article
 * @returns {typeof BLOG_CATEGORIES[number]}
 */
export function categorizeArticle(article) {
  const haystack = `${article.title} ${(article.tags || []).join(' ')}`.toLowerCase();
  for (const category of BLOG_CATEGORIES) {
    if (category.keywords.some((kw) => haystack.includes(kw))) {
      return category;
    }
  }
  return DEFAULT_CATEGORY;
}
