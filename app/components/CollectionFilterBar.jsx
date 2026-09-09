import {Link} from 'react-router';

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
 * is `frontpage` and Goal Widget is `stream-widgets-templates`.
 */
export const CATEGORY_LINKS = [
  {label: 'All widgets', handle: 'widgets'},
  {label: 'Chat widgets', handle: 'frontpage'},
  {label: 'Goal widgets', handle: 'stream-widgets-templates'},
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
        {CATEGORY_LINKS.map(({label, handle}) => (
          <Link
            key={handle}
            to={`/collections/${handle}`}
            className={`collection-filter-type${
              collectionHandle === handle ? ' active' : ''
            }`}
            aria-current={collectionHandle === handle ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
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
