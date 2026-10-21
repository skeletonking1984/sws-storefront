import {Link} from 'react-router';

/**
 * Visible breadcrumb trail. `items` is the full path including the current
 * page; the last item renders as plain text (not a link) since it is where
 * the visitor already is. Callers build the matching BreadcrumbList JSON-LD
 * separately (see products.$handle.jsx) from the SAME list so the visible
 * trail and the structured data can never disagree.
 * @param {{items: Array<{name: string, to?: string}>}} props
 */
export function Breadcrumbs({items}) {
  if (!items?.length) return null;
  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            // eslint-disable-next-line react/no-array-index-key -- items is a short, static, per-render breadcrumb trail; index is stable and names can repeat
            <li key={i}>
              {isLast || !item.to ? (
                <span aria-current={isLast ? 'page' : undefined}>
                  {item.name}
                </span>
              ) : (
                <Link to={item.to}>{item.name}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
