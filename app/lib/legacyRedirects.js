import {forwardHandleAlias} from './handleAliases.js';

/**
 * Old (pre-Hydrogen) theme URL shapes that 404 today, verified against
 * production 2026-09-28:
 *
 *   /collections/<any>/products/<handle>   ->  /products/<handle>
 *   /blogs/news/tagged/<tag>               ->  /blogs/news
 *
 * The old theme nested a PDP under whichever collection linked to it;
 * Hydrogen's canonical PDP has no collection segment, so the collection
 * handle in the old URL is always dropped, never mapped to anything. The
 * query string is preserved (a click id or a discount param can be riding
 * on it), the collection segment is not.
 */

/**
 * @param {string} productHandle
 * @param {string} search Leading-`?` query string from the incoming request,
 *   or '' when there is none.
 * @returns {string} Absolute-path redirect target, `/products/<handle>`.
 */
export function legacyNestedProductRedirectTarget(productHandle, search = '') {
  // Old backlinks and stale crawl data can still carry one of the 75 OLD
  // handles from the 2026-09-26 TikTok-claim rename (see handleAliases.js).
  // forwardHandleAlias only maps old -> new, never the reverse, so a handle
  // that is already current passes through unchanged.
  const resolved = forwardHandleAlias(productHandle) || productHandle;
  return `/products/${resolved}${search}`;
}

/** This blog has no tag filtering in Hydrogen; every tagged URL collapses to the index. */
export const LEGACY_BLOG_TAG_REDIRECT_TARGET = '/blogs/news';
