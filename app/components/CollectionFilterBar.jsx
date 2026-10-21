import {Link} from 'react-router';
import {
  CHAT_WIDGETS_COLLECTION,
  GOAL_WIDGETS_COLLECTION,
  safeDefaultHandle,
  matchesCollectionHandle,
} from '~/lib/collectionHandles';

/**
 * Category chips. These are plain links into the real collections, not
 * query-param filters.
 *
 * They used to be `?type=<tag>` filters passed to the Storefront API as
 * `products(filters: [{tag}])`, which silently returned unfiltered results:
 * the Storefront API only honours filters that are configured in Shopify's
 * Search & Discovery settings, and this shop only has Availability and Price
 * configured. Querying `collection.products.filters` returns exactly those
 * two and nothing else, so a tag filter was always a no-op and "Chat widgets"
 * happily listed goal widgets.
 *
 * The smart collections below are already curated on `product_type` (the
 * field the category pass set on every active product), so routing to them
 * is both correct and consistent with the mega menu, which links to the same
 * handles. Note the two counterintuitive handles, they are real: Chat Widget
 * is `frontpage` (renaming to `twitch-chat-widgets`, 2026-09-28) and Goal
 * Widget is `stream-widgets-templates` (renaming to `twitch-goal-widgets`).
 *
 * `handle` (the `to` target) is the safe-default LEGACY handle: this
 * component has no live Storefront data behind it, so unlike the mega menu
 * (see Header.jsx's NavCollectionTile) it cannot know which of the two is
 * actually live right now. Legacy resolves directly before the rename and,
 * after it, Shopify's own redirect carries it forward with one 301; the
 * current handle would instead 404 for the whole gap before the rename.
 * `pair`, present only on the two renamed rows, lets the active-chip check
 * below match EITHER handle regardless of which one the current page
 * resolved under. See app/lib/collectionHandles.js.
 */
export const CATEGORY_LINKS = [
  {label: 'All widgets', handle: 'widgets'},
  {
    label: 'Chat widgets',
    handle: safeDefaultHandle(CHAT_WIDGETS_COLLECTION),
    pair: CHAT_WIDGETS_COLLECTION,
  },
  {
    label: 'Goal widgets',
    handle: safeDefaultHandle(GOAL_WIDGETS_COLLECTION),
    pair: GOAL_WIDGETS_COLLECTION,
  },
  {label: 'Overlays', handle: 'overlays'},
  {label: 'Kits', handle: 'bundles'},
];

/**
 * Search + category bar shown above a collection's product grid. Search is
 * client-side over the currently loaded page; the category chips route to a
 * different collection outright.
 * @param {{
 *   searchTerm: string;
 *   onSearchChange: (value: string) => void;
 *   collectionHandle?: string;
 * }}
 */
export function CollectionFilterBar({
  searchTerm,
  onSearchChange,
  collectionHandle,
}) {
  return (
    <div className="collection-filter-bar">
      <div className="collection-filter-types">
        {CATEGORY_LINKS.map(({label, handle, pair}) => {
          // `pair` is only set on the two renamed rows (Chat/Goal widgets).
          // Matching against both its current and legacy handle means the
          // chip still highlights correctly whichever one the current page
          // actually resolved under, even though `handle` (the link target)
          // is a single fixed string. See the CATEGORY_LINKS header comment.
          const isActive = pair
            ? matchesCollectionHandle(pair, collectionHandle)
            : collectionHandle === handle;
          return (
            <Link
              key={handle}
              to={`/collections/${handle}`}
              className={`collection-filter-type${isActive ? ' active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              {label}
            </Link>
          );
        })}
      </div>
      <input
        type="search"
        className="collection-filter-search"
        placeholder="Search this collection..."
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="Search products in this collection"
      />
    </div>
  );
}
