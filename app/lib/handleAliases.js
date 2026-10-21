import renames from '../../data/handle-renames-2026-09-26.json';

/**
 * 75 live product handles are being renamed in Shopify to drop a false
 * "TikTok Studio" claim baked into the handle text itself (see
 * data/handle-renames-2026-09-26.json, the committed copy of the rename
 * list, old -> new). The rename is a manual Shopify Admin edit the store owner runs
 * AFTER this deploy ships, so for a gap of unknown length the live Shopify
 * handle is still the OLD one while this repo's data files and nav lists
 * already point at the NEW one. Every handle-keyed lookup in the storefront
 * has to resolve both, or the gap breaks reviews/delivery facts/featured
 * lists for exactly the 75 products this was meant to fix.
 *
 * Both maps are generated from the same source so they can never disagree
 * with each other.
 */
const OLD_TO_NEW = new Map(renames.map((r) => [r.old, r.new]));
const NEW_TO_OLD = new Map(renames.map((r) => [r.new, r.old]));

/**
 * The other handle for a renamed product (old -> new or new -> old), or
 * null when `handle` isn't one of the 75 in this rename batch.
 * @param {string} handle
 * @returns {string | null}
 */
export function aliasHandle(handle) {
  return OLD_TO_NEW.get(handle) ?? NEW_TO_OLD.get(handle) ?? null;
}

/**
 * Forward-only: the NEW handle for an OLD (pre-rename) handle, or null when
 * `handle` isn't one of the 75 old handles in this rename batch. Unlike
 * `aliasHandle`, this never maps a handle that is already current back to
 * its retired predecessor, which is what a 301 redirect needs: an old
 * bookmarked or crawled URL should always land on whichever handle is live
 * now, never bounce sideways onto the one Shopify just stopped serving.
 * @param {string} handle
 * @returns {string | null}
 */
export function forwardHandleAlias(handle) {
  return OLD_TO_NEW.get(handle) ?? null;
}

/**
 * Looks up `handle` in a plain object keyed by product handle (e.g. an
 * imported JSON data file), falling back to its rename alias when the
 * direct key is missing. Use this instead of `data[handle]` for every
 * handle-keyed data file so a lookup works on both sides of the rename gap.
 * @param {Record<string, unknown> | null | undefined} map
 * @param {string} handle
 */
export function byHandleWithAlias(map, handle) {
  if (!map || !handle) return undefined;
  if (Object.prototype.hasOwnProperty.call(map, handle)) return map[handle];
  const alias = aliasHandle(handle);
  return alias ? map[alias] : undefined;
}

/**
 * Runs a `product(handle: $handleN) { ... }`-shaped Storefront API query
 * (see RECOMMENDED_PRODUCTS_QUERY in app/routes/_index.jsx and the mirrored
 * query in app/routes/[llms.txt].jsx) once with `handles` as given, then
 * only for any slot that came back null AND has a rename alias, re-queries
 * with the alias handle and merges the result in.
 *
 * The Storefront API resolves a renamed handle via redirect only for a page
 * load, never for a `product(handle:)` field lookup, so once nav.js's
 * curated handle lists move to the NEW handles (done, see FAN_FAVORITE_
 * HANDLES), those lookups return null until the rename actually happens.
 * This is what keeps them resolving through the gap without a second full
 * round trip once nothing in the list needs an alias anymore.
 * @param {{query: (query: string, opts: {variables: Record<string, string>}) => Promise<Record<string, any>>}} storefront
 * @param {string} query
 * @param {string[]} handles
 */
export async function fetchProductsByHandleWithAlias(
  storefront,
  query,
  handles,
) {
  const primaryVars = Object.fromEntries(
    handles.map((h, i) => [`handle${i}`, h]),
  );
  const primary = await storefront.query(query, {variables: primaryVars});

  const missing = handles
    .map((h, i) => (primary[`product${i}`] ? null : i))
    .filter((i) => i !== null);
  if (missing.length === 0) return primary;

  const aliasVars = {...primaryVars};
  let hasAlias = false;
  for (const i of missing) {
    const alias = aliasHandle(handles[i]);
    if (alias) {
      aliasVars[`handle${i}`] = alias;
      hasAlias = true;
    }
  }
  if (!hasAlias) return primary;

  const aliasRes = await storefront.query(query, {variables: aliasVars});
  const merged = {...primary};
  for (const i of missing) {
    merged[`product${i}`] =
      merged[`product${i}`] || aliasRes[`product${i}`] || null;
  }
  return merged;
}
