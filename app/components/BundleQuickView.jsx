import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {MAX_ITEMS, money} from '~/lib/bundle';

/**
 * Quick-view for a /bundle tile (2026-10-18).
 * Desktop: centered modal. Under 768px: bottom sheet (drag handle, swipe
 * down, backdrop tap, close button or Esc closes). Media and description are
 * fetched from /api/quickview/:handle only when it opens. The Add to bundle
 * button calls the same toggle() the tile uses, so the tile ring, tray and
 * Add kit all stay in step.
 */
const cache = new Map();

export function BundleQuickView({item, on, full, count, onToggle, onClose}) {
  const [data, setData] = useState(() => cache.get(item.handle) || null);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(false);
  const panelRef = useRef(null);
  const closeRef = useRef(null);
  const drag = useRef({y: 0, dy: 0, on: false});
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    if (cache.has(item.handle)) return;
    let cancelled = false;
    fetch(`/api/quickview/${encodeURIComponent(item.handle)}`)
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error(String(r.status))),
      )
      .then((j) => {
        cache.set(item.handle, j);
        if (!cancelled) setData(j);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [item.handle]);

  // Scroll lock, Esc, focus in and focus trap.
  useEffect(() => {
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    const prevPad = html.style.paddingRight;
    const gap = window.innerWidth - html.clientWidth;
    html.style.overflow = 'hidden';
    if (gap > 0) html.style.paddingRight = `${gap}px`;
    closeRef.current?.focus({preventScroll: true});
    const raf = requestAnimationFrame(() => setShown(true));
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const f = [
        ...panelRef.current.querySelectorAll(
          'a[href], button:not([disabled]), video[controls], [tabindex]:not([tabindex="-1"])',
        ),
      ];
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!panelRef.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', onKey);
      html.style.overflow = prevOverflow;
      html.style.paddingRight = prevPad;
    };
  }, [onClose]);

  // Swipe down on the sheet's handle or header to close (phone only).
  function onTouchStart(e) {
    if (panelRef.current && panelRef.current.scrollTop > 0) return;
    drag.current = {y: e.touches[0].clientY, dy: 0, on: true};
  }
  function onTouchMove(e) {
    if (!drag.current.on) return;
    const dy = Math.max(0, e.touches[0].clientY - drag.current.y);
    drag.current.dy = dy;
    setDragY(dy);
  }
  function onTouchEnd() {
    if (!drag.current.on) return;
    drag.current.on = false;
    if (drag.current.dy > 90) onClose();
    else setDragY(0);
  }

  const images = data?.images?.length
    ? data.images
    : item.image
      ? [{url: item.image.url, alt: item.image.alt}]
      : [];
  const main = images[Math.min(active, images.length - 1)];
  const video = data?.video;
  const blocked = !on && full;
  const titleId = `bqv-title-${item.id.split('/').pop()}`;

  return createPortal(
    <div className={`bqv${shown ? ' in' : ''}`}>
      <div className="bqv-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        className="bqv-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={
          dragY
            ? {transform: `translateY(${dragY}px)`, transition: 'none'}
            : undefined
        }
      >
        <div
          className="bqv-grab"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          aria-hidden="true"
        >
          <span />
        </div>
        <button
          ref={closeRef}
          type="button"
          className="bqv-close"
          aria-label="Close quick view"
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div className="bqv-body">
          <div className="bqv-media">
            <div className="bqv-stage">
              {video && active === 0 ? (
                <video
                  key={video.url}
                  src={video.url}
                  poster={video.poster || main?.url}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  aria-label={`${item.title} preview`}
                />
              ) : main ? (
                <img
                  src={sized(main.url, 800)}
                  alt={main.alt || item.title}
                  decoding="async"
                />
              ) : null}
            </div>
            {images.length > 1 || video ? (
              <ul className="bqv-thumbs" aria-label="More images">
                {(video
                  ? [
                      {
                        url: video.poster || images[0]?.url,
                        alt: 'Animated preview',
                        video: true,
                      },
                      ...images.slice(1),
                    ]
                  : images
                ).map((im, i) => (
                  <li key={`${im.url}-${i}`}>
                    <button
                      type="button"
                      className={active === i ? 'on' : ''}
                      aria-label={
                        im.video
                          ? 'Show animated preview'
                          : `Show image ${i + 1}`
                      }
                      aria-pressed={active === i}
                      onClick={() => setActive(i)}
                    >
                      {im.url ? (
                        <img src={sized(im.url, 160)} alt="" loading="lazy" />
                      ) : null}
                      {im.video ? <i aria-hidden="true">&#9654;</i> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="bqv-info">
            <h2 id={titleId} className="bqv-title">
              {item.title}
            </h2>
            <p className="bqv-price">
              {money(item.price)}
              {on ? <span className="bb-selected">Selected</span> : null}
            </p>
            <p className="bqv-desc">
              {data?.description || (failed ? '' : '\u00a0')}
            </p>
            <div className="bqv-actions">
              <button
                type="button"
                className={`sws-btn ${on ? 'sws-btn-ghost bqv-remove' : 'sws-btn-primary'} bqv-add`}
                disabled={blocked}
                aria-pressed={on}
                onClick={() => onToggle(item.id)}
              >
                {on
                  ? 'Remove from bundle'
                  : blocked
                    ? `Bundle full (${MAX_ITEMS})`
                    : 'Add to bundle'}
              </button>
              {/* Same-origin product page: rel=noopener only, so the visit keeps
                  its referrer for analytics. */}
              {/* eslint-disable-next-line react/jsx-no-target-blank */}
              <a
                className="sws-btn sws-btn-ghost bqv-details"
                href={`/products/${item.handle}`}
                target="_blank"
                rel="noopener"
              >
                View full details
                <svg
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  aria-hidden="true"
                >
                  <path
                    d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
            <p className="bqv-count" aria-live="polite">
              {count} of {MAX_ITEMS} picked
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Shopify CDN images take a width parameter. */
function sized(url, w) {
  if (!url || !/cdn\.shopify\.com/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}width=${w}`;
}
