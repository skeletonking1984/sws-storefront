import * as React from 'react';
import {Pagination} from '@shopify/hydrogen';

/**
 * How many pages load on their own before the button comes back.
 *
 * Not unlimited, deliberately. Collections page by 24, so three auto loads is
 * 96 products before a visitor has to ask for more, and the footer stays
 * reachable. A list that grows forever as you scroll never lets anyone reach
 * the policy links, the contact link or the socials, and mobile is 76 to 83
 * percent of sessions here, where the footer is the only place those live.
 */
const AUTO_LOAD_PAGES = 3;

/**
 * Loads the next page when the end of the list comes into view.
 *
 * The real <a> stays in the DOM and stays clickable: this only presses it
 * early. So a crawler still follows a href, a keyboard user still has a
 * control to activate, and with JS off the button behaves exactly as it did
 * before. Nothing here is the only way to reach page two.
 *
 * Hydrogen's own NextLink carries `preventScrollReset` and `replace`, so an
 * auto press appends in place without moving the viewport or stacking a
 * history entry per page.
 *
 * @param {{
 *   NextLink: React.ComponentType<any>,
 *   isLoading: boolean,
 *   hasNextPage: boolean,
 *   label: React.ReactNode,
 * }} props
 */
function AutoLoadNext({NextLink, isLoading, hasNextPage, label}) {
  const sentinelRef = React.useRef(null);
  const linkRef = React.useRef(null);
  const [inView, setInView] = React.useState(false);
  const [autoLoads, setAutoLoads] = React.useState(0);

  const exhausted = autoLoads >= AUTO_LOAD_PAGES;

  React.useEffect(() => {
    // No IntersectionObserver means no auto load and a visible button, which
    // is the pre-2026-09-23 behaviour rather than a broken page.
    if (exhausted || !hasNextPage) return;
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      // Fire before the visitor actually reaches the bottom, so the next row
      // is usually already there by the time they scroll to it.
      {rootMargin: '800px 0px'},
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [exhausted, hasNextPage]);

  React.useEffect(() => {
    if (!inView || exhausted || !hasNextPage || isLoading) return;
    // Counted before the click, not after. A click that fails to navigate
    // would otherwise leave this effect firing on every render.
    setAutoLoads((n) => n + 1);
    linkRef.current?.click();
  }, [inView, exhausted, hasNextPage, isLoading]);

  return (
    <div ref={sentinelRef}>
      <NextLink ref={linkRef}>
        {isLoading ? 'Loading...' : label}
      </NextLink>
    </div>
  );
}

/**
 * <PaginatedResourceSection> encapsulates the previous and next pagination behaviors throughout your application.
 * @param {Class<Pagination<NodesType>>['connection']>}
 */
export function PaginatedResourceSection({
  connection,
  children,
  ariaLabel,
  resourcesClassName,
  autoLoad = true,
}) {
  return (
    <Pagination connection={connection}>
      {({nodes, isLoading, hasNextPage, PreviousLink, NextLink}) => {
        const resourcesMarkup = nodes.map((node, index) =>
          children({node, index}),
        );

        const nextLabel = (
          <span>
            Load more <span aria-hidden="true">↓</span>
          </span>
        );

        return (
          <div>
            <PreviousLink>
              {isLoading ? (
                'Loading...'
              ) : (
                <span>
                  <span aria-hidden="true">↑</span> Load previous
                </span>
              )}
            </PreviousLink>
            {resourcesClassName ? (
              <div
                aria-busy={isLoading || undefined}
                aria-label={ariaLabel}
                className={resourcesClassName}
                role={ariaLabel ? 'region' : undefined}
              >
                {resourcesMarkup}
              </div>
            ) : (
              resourcesMarkup
            )}
            {autoLoad ? (
              <AutoLoadNext
                // Remounting on a new first node resets the auto load budget.
                // Appending a page keeps the same first node, so scrolling
                // does not reset it; changing a filter or a sort does, which
                // is the only time a visitor should get a fresh three.
                key={nodes[0]?.id ?? 'empty'}
                NextLink={NextLink}
                isLoading={isLoading}
                hasNextPage={hasNextPage}
                label={nextLabel}
              />
            ) : (
              <NextLink>{isLoading ? 'Loading...' : nextLabel}</NextLink>
            )}
          </div>
        );
      }}
    </Pagination>
  );
}
