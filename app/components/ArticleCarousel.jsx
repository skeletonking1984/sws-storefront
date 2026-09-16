import {useCallback, useEffect, useRef, useState} from 'react';
import {ProductItem} from '~/components/ProductItem';

/**
 * Horizontal product shelf under a blog article.
 *
 * A carousel and not the previous four-item grid because the grid could only
 * ever show four, and it sat inside the article's 68ch measure, so it read as
 * part of the prose rather than as a shelf of things you can buy. This breaks
 * out wider than the text column on purpose: the change in width is what tells
 * the eye the article has ended and the shop has started.
 *
 * Native scroll does the work. The arrows are an enhancement layered on top, so
 * with JavaScript off, or before hydration, the shelf is still fully usable by
 * dragging, trackpad, or touch. Scroll snapping keeps cards from stopping half
 * out of frame.
 */
export function ArticleCarousel({heading, products}) {
  const trackRef = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  // Arrows stay hidden until we know the track actually overflows. On a wide
  // screen with few products there is nothing to scroll and a dead arrow is
  // worse than no arrow.
  const [overflows, setOverflows] = useState(false);

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setOverflows(max > 4);
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft >= max - 4);
  }, []);

  useEffect(() => {
    measure();
    const el = trackRef.current;
    if (!el) return;
    // ResizeObserver and not a resize listener: the track also changes width
    // when images finish decoding and when the column reflows, neither of which
    // fires a window resize.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, products]);

  const scrollBy = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    // Page by whole cards rather than a fixed pixel count, so a card never
    // ends up half visible at the edge after a click.
    const card = el.querySelector('[data-carousel-item]');
    const step = card ? card.getBoundingClientRect().width + 16 : el.clientWidth * 0.8;
    const pages = Math.max(1, Math.floor(el.clientWidth / step));
    el.scrollBy({left: dir * step * pages, behavior: 'smooth'});
  };

  if (!products?.length) return null;

  return (
    <aside className="article-shelf" aria-label={heading}>
      <div className="article-shelf-head">
        <h2>{heading}</h2>
        {overflows && (
          <div className="article-shelf-nav">
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              disabled={atStart}
              aria-label="Previous products"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => scrollBy(1)}
              disabled={atEnd}
              aria-label="Next products"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div className="article-shelf-track" ref={trackRef} onScroll={measure}>
        {products.map((product) => (
          <div className="article-shelf-item" data-carousel-item key={product.id}>
            <ProductItem product={product} headingLevel={3} />
          </div>
        ))}
      </div>
    </aside>
  );
}
