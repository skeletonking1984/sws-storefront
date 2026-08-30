import {Link, useLocation, useSearchParams} from 'react-router';

const WIDGET_TYPES = [
  {label: 'All', tag: ''},
  {label: 'Chat widgets', tag: 'Chat_widget'},
  {label: 'Goal widgets', tag: 'Goal_Widget'},
  {label: 'VTuber assets', tag: 'Vtuber_asset'},
];

/**
 * Search + widget-type filter bar shown above a collection's product grid.
 * Type filter is server-side (accurate across the whole collection); search
 * is client-side over the currently loaded page.
 * @param {{
 *   activeType: string;
 *   searchTerm: string;
 *   onSearchChange: (value: string) => void;
 * }}
 */
export function CollectionFilterBar({activeType, searchTerm, onSearchChange}) {
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
        {WIDGET_TYPES.map(({label, tag}) => (
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
