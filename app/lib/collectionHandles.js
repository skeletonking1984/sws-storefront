/**
 * Approved renaming two collections (2026-09-28):
 *
 *   frontpage                 -> twitch-chat-widgets
 *   stream-widgets-templates  -> twitch-goal-widgets
 *
 * Shopify creates its own old -> new URL redirect automatically the moment
 * the rename happens in Admin (server.js's storefrontRedirect serves it on
 * the next 404), but the rename itself happens AFTER this code deploys.
 * For an unknown gap, only the legacy handle resolves; after the rename,
 * only the current one does. Every place that queries or links to one of
 * these two collections goes through this module so it works with EITHER
 * handle live, and so the rename itself only has to happen in one place
 * (Shopify Admin) rather than here too.
 */

export const CHAT_WIDGETS_COLLECTION = {
  current: 'twitch-chat-widgets',
  legacy: 'frontpage',
};

export const GOAL_WIDGETS_COLLECTION = {
  current: 'twitch-goal-widgets',
  legacy: 'stream-widgets-templates',
};

/**
 * Given a query that fetched a collection under BOTH the current and legacy
 * handle (as two aliased fields), returns whichever one is actually live.
 * `current` wins when both resolve (should not happen, a handle move frees
 * the old one, but a tie goes to the new name on purpose: once Shopify has
 * the rename, the resolved handle should point forward, not linger on
 * whichever alias happened to come first).
 * @template T
 * @param {T | null | undefined} currentResult
 * @param {T | null | undefined} legacyResult
 * @returns {T | null}
 */
export function resolveCollection(currentResult, legacyResult) {
  return currentResult || legacyResult || null;
}

/**
 * The handle to use when NEITHER a live query result nor another signal is
 * available (e.g. building a static link list with no Storefront data
 * behind it). Legacy, not current: legacy is guaranteed to resolve before
 * the rename and, after it, Shopify's own redirect carries it forward with
 * one 301 rather than a dead link. Current would do the opposite: a 404
 * for the entire gap before the rename, with no redirect to fall back on.
 * @param {{current: string, legacy: string}} pair
 * @returns {string}
 */
export function safeDefaultHandle(pair) {
  return pair.legacy;
}

/**
 * Whether `handle` is either the current or the legacy handle for `pair`.
 * Use this anywhere a collection handle is being matched (an active-chip
 * check, a "does this collection get the free chat card" check) instead of
 * comparing against one hardcoded string, so the match holds on both sides
 * of the rename.
 * @param {{current: string, legacy: string}} pair
 * @param {string | null | undefined} handle
 * @returns {boolean}
 */
export function matchesCollectionHandle(pair, handle) {
  return handle === pair.current || handle === pair.legacy;
}
