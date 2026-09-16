/**
 * Pick products worth showing at the end of a blog article.
 *
 * Todd, 2026-09-15: "cross sell widgets on there that make sense ... lol".
 * The "make sense" is the whole problem. Four random widgets under a guide
 * about neon chat overlays is worse than nothing: it reads as filler and it
 * trains the reader to ignore the block.
 *
 * WHY NOT JUST SEARCH THE TITLE. Every article title in this blog contains
 * "Twitch", most contain "OBS" or "StreamElements", and nearly every product
 * title does too, because they are all Etsy keyword titles. Searching on those
 * returns essentially the whole catalogue in arbitrary order, which looks
 * personalised and is not. So platform words are deliberately ignored and only
 * THEME and TYPE words are used to build the query.
 *
 * The split:
 *   THEME  what the article is actually about, and the only real relevance
 *          signal: neon, sakura, halloween, y2k, celestial...
 *   TYPE   what kind of product the reader is being sent to: chat widget,
 *          goal widget, overlay pack.
 *
 * A theme hit is required for a themed row. With no theme, the article is a
 * general tutorial and the honest thing is to fall back to the TYPE alone
 * rather than invent a connection.
 */

/**
 * Words that appear in almost every article AND almost every product title, so
 * they carry no signal and actively hurt. Kept explicit rather than as a stop
 * list buried in a regex, because the temptation to "just add twitch" is
 * exactly the mistake.
 */
const NOISE = new Set([
  'twitch',
  'obs',
  'streamelements',
  'streamlabs',
  'stream',
  'streamer',
  'streamers',
  'widget',
  'widgets',
  'overlay',
  'overlays',
  'kick',
  'youtube',
  'tiktok',
  'digital',
  'download',
  'best',
  'guide',
  'how',
  'setup',
  '2025',
  '2026',
]);

/** Theme vocabulary the catalogue actually uses, longest phrases first. */
const THEMES = [
  'cottagecore',
  'multistream',
  'celestial',
  'cyberpunk',
  'halloween',
  'christmas',
  'butterfly',
  'aesthetic',
  'minimalist',
  'sci-fi',
  'spooky',
  'sakura',
  'pastel',
  'floral',
  'galaxy',
  'gothic',
  'kawaii',
  'anime',
  'vtuber',
  'froggy',
  'lotus',
  'neon',
  'moon',
  'star',
  'glow',
  'y2k',
  'retro',
  'cozy',
  'glass',
  'witch',
  'skull',
  'ghost',
];

/** Product kinds, mapped to the words that actually appear in product titles. */
const TYPES = [
  {match: ['chat widget', 'chat box', 'chat overlay', 'chat ui'], term: 'chat widget'},
  {match: ['goal bar', 'goal widget', 'sub goal', 'donation goal', 'tip jar'], term: 'goal widget'},
  {match: ['emote'], term: 'emotes'},
  {match: ['bundle', 'kit', 'pack'], term: 'kit'},
];

/**
 * Word-START matching, not substring.
 *
 * Caught 2026-09-15 by running the matcher over real article titles before
 * shipping it: `'Best Twitch and Kick Chat Widgets'.includes('witch')` is TRUE,
 * because "Twitch" ends in "witch". Every article about Twitch, which is all of
 * them, was being tagged with the witch theme and would have been sold witch
 * widgets. A leading \b fixes it, since T and w are both word characters so
 * there is no boundary between them.
 *
 * The boundary is only on the START of the term on purpose, so "star" still
 * matches "starry night" and "glass" still matches "glassy".
 *
 * @param {string} haystack
 * @param {string} term
 */
function hasTerm(haystack, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}`, 'i').test(haystack);
}

/**
 * Build a Storefront search query for an article, or null when there is no
 * honest match to make.
 *
 * @param {{title?: string, tags?: string[], contentHtml?: string}} article
 * @returns {{query: string, themes: string[], type: string | null} | null}
 */
export function crossSellQuery(article) {
  const title = String(article?.title || '').toLowerCase();
  const tags = (article?.tags || []).map((t) => String(t).toLowerCase());
  const haystack = `${title} ${tags.join(' ')}`;

  const themes = THEMES.filter((t) => hasTerm(haystack, t)).slice(0, 2);

  let type = null;
  for (const candidate of TYPES) {
    if (candidate.match.some((m) => hasTerm(haystack, m))) {
      type = candidate.term;
      break;
    }
  }

  const terms = [...themes, type].filter(Boolean);

  /*
   * TERMS ARE OR-ed, NOT SPACE JOINED.
   *
   * Shopify's product search ANDs bare space separated terms. Measured against
   * the live catalogue on 2026-09-15: `celestial kawaii` returns 0 products and
   * `celestial OR kawaii` returns 5, because almost nothing is titled with both
   * words. The old space-joined query was quietly producing an empty shelf on
   * every article that matched more than one theme.
   */
  const query = terms.length ? terms.map((t) => `"${t}"`).join(' OR ') : null;

  // Nothing to go on. The caller falls back to best sellers rather than
  // inventing a relevance claim.
  if (!query) return null;

  return {query, themes, type, terms};
}

/**
 * Heading for the row, written from what actually matched so it never promises
 * a relationship the products do not have.
 *
 * @param {{themes: string[], type: string | null} | null} picked
 * @returns {string}
 */
export function crossSellHeading(picked) {
  if (!picked) return 'From the shop';
  const theme = picked.themes[0];
  if (theme && picked.type) {
    return `${titleCase(theme)} ${picked.type}s from the shop`;
  }
  if (theme) return `${titleCase(theme)} widgets from the shop`;
  return `${titleCase(picked.type || '')}s from the shop`;
}

/** @param {string} s */
function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Drop any product already linked from the article body, and anything the
 * search returned that shares no term with the query. Shopify's full-text
 * search is fuzzy and will happily return a Christmas goal bar for a Halloween
 * query when the catalogue is thin on matches.
 *
 * @param {Array<{title?: string, handle?: string}>} products
 * @param {{query: string, themes: string[], type: string | null}} picked
 * @param {string} contentHtml
 */
export function filterCrossSell(products, picked, contentHtml = '') {
  const linked = new Set(
    Array.from(String(contentHtml).matchAll(/\/products\/([a-z0-9-]+)/g)).map((m) => m[1]),
  );
  const needles = picked.themes.length ? picked.themes : [picked.type].filter(Boolean);

  return (products || []).filter((p) => {
    if (!p?.handle || linked.has(p.handle)) return false;
    const hay = `${p.title || ''} ${p.handle}`.toLowerCase();
    return needles.some((n) => n && hasTerm(hay, n));
  });
}

/**
 * Fill the carousel up to `want` items.
 *
 * filterCrossSell is deliberately strict: it throws away anything that shares
 * no term with the query, because Shopify's full-text search happily returns a
 * Christmas goal bar for a Halloween query once the close matches run out. That
 * is the right call for a four-item row, where one bad match is a quarter of
 * the row and the whole thing reads as random.
 *
 * A carousel is a shelf, not a row, and an almost-empty shelf reads as broken.
 * So strict matches come FIRST, in order, and the remaining slots are topped up
 * from the same search's weaker hits. Those are still hits for the article's
 * theme, just ones that did not clear the word-boundary test, which is a much
 * better neighbour than an unrelated product pulled from a second query.
 *
 * Anything already linked in the article body stays excluded either way: the
 * reader has been offered it once already.
 *
 * Returns {products, matched} so the caller can title the row honestly. A shelf
 * that is mostly top-up should not claim to be "Celestial chat widgets".
 *
 * @param {Array<{title?: string, handle?: string}>} products raw search results
 * @param {{query: string, themes: string[], type: string | null}} picked
 * @param {string} contentHtml
 * @param {number} want
 */
export function buildCrossSellShelf(products, picked, contentHtml = '', want = 10) {
  const strict = filterCrossSell(products, picked, contentHtml);
  const taken = new Set(strict.map((p) => p.handle));
  const linked = new Set(
    Array.from(String(contentHtml).matchAll(/\/products\/([a-z0-9-]+)/g)).map((m) => m[1]),
  );

  const topUp = [];
  for (const p of products || []) {
    if (strict.length + topUp.length >= want) break;
    if (!p?.handle || taken.has(p.handle) || linked.has(p.handle)) continue;
    taken.add(p.handle);
    topUp.push(p);
  }

  return {products: [...strict, ...topUp].slice(0, want), matched: strict.length};
}

export const CROSS_SELL_NOISE = NOISE;
