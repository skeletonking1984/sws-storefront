import {Link, useLocation, useSearchParams} from 'react-router';

/** Tag-based filters, applied via `?type=` on whichever collection page. */
export const TAG_TYPES = [
  {label: 'All', tag: ''},
  {label: 'Chat widgets', tag: 'Chat_widget'},
  {label: 'Goal widgets', tag: 'Goal_Widget'},
];

/**
 * Plain links into the category collections, replacing the old "VTuber
 * assets" tag chip (that tag matched 113 of 127 active products, so it
 * filtered nothing). These aren't tag filters, they just route to a
 * different collection page.
 */
export const CATEGORY_LINKS = [
  {label: 'Widgets', handle: 'widgets'},
  {label: 'Overlays', handle: 'overlays'},
  {label: 'Kits', handle: 'bundles'},
];

/**
 * Search + widget-type filter bar shown above a collection's product grid.
 * Type filter is server-side (accurate across the whole collection); search
 * is client-side over the currently loaded page. The category links route
 * to `/collections/widgets`, `/collections/overlays`, `/collections/bundles`
 * outright rather than filtering the current collection.
 * @param {{
 *   activeType: string;
 *   searchTerm: string;
 *   onSearchChange: (value: string) => void;
 *   collectionHandle?: string;
 * }}
 */
export function CollectionFilterBar({
  activeType,
  searchTerm,
  onSearchChange,
  collectionHandle,
}) {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const typeHref = (tag) => {
    const params = new URLSearchParams(searchParams);
    if (tag) {
      params.set('type', tag);
    } else {
      params.delete('type');
    }
    const query = params.toString();
    return query ? `${location.pathname}?${query}` : location.pathname;
  };

  return (
    <div className="collection-filter-bar">
      <div className="collection-filter-types">
        {TAG_TYPES.map(({label, tag}) => (
          <Link
            key={label}
            to={typeHref(tag)}
            className={`collection-filter-type${
              activeType === tag ? ' active' : ''
            }`}
          >
            {label}
          </Link>
        ))}
        {CATEGORY_LINKS.map(({label, handle}) => (
          <Link
            key={label}
            to={`/collections/${handle}`}
            className={`collection-filter-type${
              collectionHandle === handle ? ' active' : ''
            }`}
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
