import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Link} from 'react-router';
import {AnnotatedCartForm} from '~/components/AnnotatedCartForm';
import {PlatformIcon} from '~/components/PlatformIcon';
import {ResponsiveImage} from '~/components/ResponsiveImage';
import {useAside} from '~/components/Aside';
import {BundleQuickView} from '~/components/BundleQuickView';
import {
  BUNDLE_ATTR,
  BUNDLE_SIZE_ATTR,
  BUNDLE_SYNC_ACTION,
  MAX_ITEMS,
  MIN_ITEMS,
  TIERS,
  money,
  priceKit,
} from '~/lib/bundle';

export const BUNDLE_PLATFORMS = [
  'Twitch',
  'Kick',
  'YouTube',
  'Streamlabs',
  'OBS',
  'StreamElements',
];

const FILTERS = [
  {id: 'all', label: 'All'},
  {id: 'top', label: 'Top sellers'},
  {id: 'chat', label: 'Chat'},
  {id: 'goal', label: 'Goal'},
];

/**
 * Build-your-own bundle. Pick 3 to 9 widgets; 3 save 25%, 6 save 35%, 9 save
 * 45%. Build-your-own sits first and biggest, the curated kits come after
 * with "Customize this" loading a kit's widgets into the builder.
 */
export function BundleBuilder({items, curated, reviews, rating}) {
  const [picked, setPicked] = useState([]);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const topRef = useRef(null);
  const {open} = useAside();
  // Quick-view (2026-10-18): the open widget's id, and the element to give
  // focus back to when it closes.
  const [quick, setQuick] = useState(null);
  const quickReturn = useRef(null);
  const openQuick = (id, el) => {
    quickReturn.current = el || null;
    setQuick(id);
  };
  const closeQuick = useCallback(() => {
    setQuick(null);
    const el = quickReturn.current;
    if (el) requestAnimationFrame(() => el.focus({preventScroll: true}));
  }, []);

  const byId = useMemo(() => new Map(items.map((w) => [w.id, w])), [items]);
  const byVariant = useMemo(
    () => new Map(items.map((w) => [w.variantId, w.id])),
    [items],
  );
  // Widget ids the cart's bundle lines hold right now (null = not known yet).
  const [inCart, setInCart] = useState(null);
  const readBundle = (cart) =>
    (cart?.lines?.nodes ?? [])
      .filter((l) => (l.attributes || []).some((a) => a.key === BUNDLE_ATTR))
      .map((l) => byVariant.get(l.merchandise?.id))
      .filter(Boolean);
  // On load, show what is already in the cart: the page is edge cached, so
  // read the visitor's own cart from /api/v (never cached).
  useEffect(() => {
    let cancelled = false;
    fetch('/api/v', {credentials: 'same-origin', cache: 'no-store'})
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled || !j) return;
        const ids = readBundle(j.cart);
        setInCart(ids);
        if (ids.length) setPicked((cur) => (cur.length ? cur : ids));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byVariant]);
  const sameAsCart =
    inCart !== null &&
    inCart.length === picked.length &&
    picked.every((id) => inCart.includes(id));
  const chosen = picked.map((id) => byId.get(id)).filter(Boolean);
  const kit = priceKit(chosen.map((w) => w.price));
  const full = picked.length >= MAX_ITEMS;

  const shown = items.filter((w) => {
    if (filter === 'top' && w.top === null) return false;
    if (filter === 'chat' && !/chat/i.test(w.type)) return false;
    if (filter === 'goal' && !/goal/i.test(w.type)) return false;
    if (q && !w.title.toLowerCase().includes(q.trim().toLowerCase()))
      return false;
    return true;
  });

  function toggle(id) {
    setPicked((cur) =>
      cur.includes(id)
        ? cur.filter((x) => x !== id)
        : cur.length >= MAX_ITEMS
          ? cur
          : [...cur, id],
    );
  }

  function customize(k) {
    setPicked(k.components.filter((id) => byId.has(id)).slice(0, MAX_ITEMS));
    topRef.current?.scrollIntoView({behavior: 'smooth', block: 'start'});
  }

  // One id per distinct kit, so the cart can group its lines.
  const bundleId = useMemo(() => {
    let h = 0;
    for (const ch of [...picked].sort().join('|'))
      h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return `bb-${h.toString(36)}`;
  }, [picked]);
  const lines = chosen.map((w) => ({
    merchandiseId: w.variantId,
    quantity: 1,
    attributes: [
      {key: BUNDLE_ATTR, value: bundleId},
      {key: BUNDLE_SIZE_ATTR, value: String(chosen.length)},
    ],
  }));

  const addLabel = !kit.ready
    ? `Pick ${MIN_ITEMS - kit.count} more to unlock`
    : sameAsCart
      ? `In your cart: ${money(kit.total)}`
      : inCart?.length
        ? `Update kit in cart: ${money(kit.total)}`
        : `Add kit: ${money(kit.total)}`;
  const syncProps = {
    lines,
    disabled: !kit.ready,
    onClick: () => open('cart'),
    onSynced: (cart) => setInCart(readBundle(cart)),
  };

  return (
    <div className="bb" ref={topRef}>
      <header className="bb-hero">
        <p className="bb-eyebrow">Build your own bundle</p>
        <h1>Pick your widgets. The more you pick, the more you save.</h1>
        <ul className="bb-tiers" aria-label="Bundle savings">
          {[...TIERS].reverse().map((t) => (
            <li
              key={t.min}
              className={kit.pct === t.pct ? 'bb-tier on' : 'bb-tier'}
            >
              <b>{t.min}</b> widgets <span>save {t.pct}%</span>
            </li>
          ))}
        </ul>
        <PlatformRow />
      </header>

      <ol className="bb-steps">
        <li className={kit.count > 0 ? 'done' : ''}>
          <span>1</span> Pick 3 to 9 widgets
        </li>
        <li className={kit.ready ? 'done' : ''}>
          <span>2</span> Watch the goal ring fill
        </li>
        <li>
          <span>3</span> Add your kit
        </li>
      </ol>

      <div className="bb-main">
        <section className="bb-pick" aria-label="Pick widgets">
          <div className="bb-toolbar">
            <div className="bb-filters" role="tablist">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  className={filter === f.id ? 'on' : ''}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <input
              className="bb-search"
              type="search"
              placeholder="Search widgets"
              aria-label="Search widgets"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <ul className="bb-grid">
            {shown.map((w) => {
              const on = picked.includes(w.id);
              const off = !on && full;
              return (
                <li key={w.id} className="bb-li">
                  <button
                    type="button"
                    className={`bb-card${on ? ' on' : ''}${off ? ' off' : ''}`}
                    aria-pressed={on}
                    disabled={off}
                    onClick={(e) => {
                      // A pointer click on the image (not the + / check)
                      // opens the quick-view; everything else, keyboard
                      // included, toggles exactly as before.
                      const t = e.target;
                      if (
                        e.detail > 0 &&
                        t instanceof Element &&
                        t.closest('.bb-img') &&
                        !t.closest('.bb-check')
                      ) {
                        openQuick(w.id, e.currentTarget);
                        return;
                      }
                      toggle(w.id);
                    }}
                  >
                    <span className="bb-img">
                      {w.image ? (
                        <ResponsiveImage
                          data={w.image}
                          alt={w.image.alt}
                          sizes="(min-width: 1024px) 200px, 45vw"
                          widths={[240, 400]}
                          fallbackWidth={400}
                        />
                      ) : null}
                      {w.top !== null && w.top < 12 ? (
                        <em className="bb-badge">Top seller</em>
                      ) : null}
                      <i className="bb-check" aria-hidden="true">
                        {on ? '✓' : '+'}
                      </i>
                    </span>
                    <span className="bb-name">{shortTitle(w.title)}</span>
                    {on ? <span className="bb-selected">Selected</span> : null}
                    <span className="bb-price">{money(w.price)}</span>
                  </button>
                  <button
                    type="button"
                    className="bb-qv"
                    aria-label={`Quick view: ${shortTitle(w.title)}`}
                    aria-haspopup="dialog"
                    onClick={(e) => openQuick(w.id, e.currentTarget)}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      <circle cx="12" cy="12" r="3" fill="currentColor" />
                    </svg>
                    <span className="bb-qv-t">Quick view</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {shown.length === 0 ? (
            <p className="bb-empty">No widgets match that search.</p>
          ) : null}
        </section>

        <div className="bb-side" role="complementary" aria-label="Your kit">
          <div className="bb-panel">
            <GoalRing count={kit.count} pct={kit.pct} />
            <Summary kit={kit} />
            <ul className="bb-tray" aria-label="Picked widgets">
              {chosen.map((w) => (
                <li key={w.id}>
                  <span>{shortTitle(w.title)}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${w.title}`}
                    onClick={() => toggle(w.id)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <div className="bb-add">
              <BundleSyncButton {...syncProps}>{addLabel}</BundleSyncButton>
              {picked.length ? (
                <button
                  type="button"
                  className="bb-clear"
                  onClick={() => setPicked([])}
                >
                  Clear selection
                </button>
              ) : null}
            </div>
            <ReviewSnippets reviews={reviews.slice(0, 3)} rating={rating} />
          </div>
        </div>
      </div>

      {curated.length ? (
        <section className="bb-kits" aria-labelledby="bb-kits-h">
          <h2 id="bb-kits-h">Or start from a kit</h2>
          <p className="bb-sub">
            Ready-made sets. Customize one to swap widgets in or out.
          </p>
          <ul className="bb-kit-grid">
            {curated.map((k) => (
              <li key={k.handle} className="bb-kit">
                <Link to={`/products/${k.handle}`} className="bb-kit-img">
                  {k.image ? (
                    <ResponsiveImage
                      data={k.image}
                      alt={k.image.alt}
                      sizes="(min-width: 1024px) 280px, 90vw"
                      widths={[320, 560]}
                      fallbackWidth={560}
                    />
                  ) : null}
                </Link>
                <div className="bb-kit-body">
                  <b>{k.name}</b>
                  <span>{money(k.price)}</span>
                  <div className="bb-kit-actions">
                    <button
                      type="button"
                      className="sws-btn sws-btn-primary"
                      onClick={() => customize(k)}
                    >
                      Customize this
                    </button>
                    <Link to={`/products/${k.handle}`}>View kit</Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="bb-reviews" aria-labelledby="bb-rev-h">
        <h2 id="bb-rev-h">What streamers say on Etsy</h2>
        <ReviewSnippets reviews={reviews} rating={rating} wide />
      </section>

      {quick && byId.get(quick) ? (
        <BundleQuickView
          item={byId.get(quick)}
          on={picked.includes(quick)}
          full={full}
          count={picked.length}
          onToggle={toggle}
          onClose={closeQuick}
        />
      ) : null}

      <div className={`bb-sticky${kit.count ? ' show' : ''}`}>
        <span className="bb-sticky-n">
          {kit.count}/{MAX_ITEMS}
        </span>
        <span className="bb-sticky-p">
          {kit.ready ? (
            <>
              <b>{money(kit.total)}</b> save {money(kit.save)}
            </>
          ) : (
            `Pick ${MIN_ITEMS - kit.count} more`
          )}
        </span>
        <BundleSyncButton {...syncProps}>
          {!kit.ready ? 'Locked' : sameAsCart ? 'In cart' : 'Add kit'}
        </BundleSyncButton>
      </div>
    </div>
  );
}

/**
 * Add kit. Posts the BundleSync cart action: the server swaps the cart's
 * earlier bundle lines for the current picks, so the cart holds one bundle
 * and a second click never doubles it. Non-bundle lines are left alone.
 */
function BundleSyncButton({lines, disabled, onClick, onSynced, children}) {
  return (
    <AnnotatedCartForm
      route="/cart"
      inputs={{lines}}
      action={BUNDLE_SYNC_ACTION}
      toolname="add_bundle_to_cart"
      tooldescription="Put the picked widgets in the cart as one bundle, replacing any bundle already there. Fills the cart only, the shopper still completes checkout themselves."
    >
      {(fetcher) => (
        <SyncWatch fetcher={fetcher} onSynced={onSynced}>
          <button
            type="submit"
            className="add-to-cart-button sws-btn sws-btn-primary"
            onClick={onClick}
            disabled={disabled || fetcher.state !== 'idle'}
          >
            {children}
          </button>
        </SyncWatch>
      )}
    </AnnotatedCartForm>
  );
}

function SyncWatch({fetcher, onSynced, children}) {
  const cart = fetcher.data?.cart;
  useEffect(() => {
    if (fetcher.state === 'idle' && cart) onSynced(cart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher.state, cart]);
  return children;
}

/** Goal ring in the SWS goal-fill style: fills as widgets are picked, ticks at 3, 6 and 9. */
function GoalRing({count, pct}) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const fill = Math.min(count, MAX_ITEMS) / MAX_ITEMS;
  return (
    <div
      className="bb-ring"
      role="img"
      aria-label={`${count} of ${MAX_ITEMS} widgets picked${pct ? `, ${pct}% off` : ''}`}
    >
      <svg viewBox="0 0 128 128" aria-hidden="true">
        <defs>
          <linearGradient id="bbRingGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--sws-holo-1)" />
            <stop offset="55%" stopColor="var(--sws-holo-2)" />
            <stop offset="100%" stopColor="var(--sws-holo-4)" />
          </linearGradient>
        </defs>
        <circle className="bb-ring-track" cx="64" cy="64" r={r} />
        <circle
          className="bb-ring-fill"
          cx="64"
          cy="64"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fill)}
        />
        {[3, 6, 9].map((t) => {
          const a = (t / MAX_ITEMS) * 2 * Math.PI - Math.PI / 2;
          return (
            <circle
              key={t}
              className={count >= t ? 'bb-ring-tick on' : 'bb-ring-tick'}
              cx={64 + r * Math.cos(a)}
              cy={64 + r * Math.sin(a)}
              r="5"
            />
          );
        })}
      </svg>
      <div className="bb-ring-c">
        <b>{count}</b>
        <span>of {MAX_ITEMS}</span>
        {pct ? <em>{pct}% off</em> : null}
      </div>
    </div>
  );
}

function Summary({kit}) {
  return (
    <div className="bb-sum" aria-live="polite">
      {kit.ready ? (
        <>
          <div className="bb-sum-row">
            <span>{kit.count} widgets</span>
            <s>{money(kit.list)}</s>
          </div>
          <div className="bb-sum-total">
            <b>{money(kit.total)}</b>
            <span className="bb-save">You save {money(kit.save)}</span>
          </div>
        </>
      ) : (
        <div className="bb-sum-row">
          <span>
            {kit.count
              ? `Pick ${MIN_ITEMS - kit.count} more to unlock 25% off`
              : 'Pick any 3 widgets to start saving'}
          </span>
        </div>
      )}
      {kit.next ? (
        <p className="bb-nudge">
          Add {kit.next.more} more for {kit.next.pct}% off
        </p>
      ) : kit.count >= MAX_ITEMS ? (
        <p className="bb-nudge max">Best price unlocked: 45% off</p>
      ) : null}
    </div>
  );
}

export function PlatformRow() {
  return (
    <ul className="bb-platforms" aria-label="Works with">
      {BUNDLE_PLATFORMS.map((p) => (
        <li key={p} title={p}>
          <PlatformIcon platform={p} />
          <span>{p}</span>
        </li>
      ))}
    </ul>
  );
}

export function ReviewSnippets({reviews, rating, wide = false}) {
  if (!reviews?.length) return null;
  return (
    <div className={wide ? 'bb-revs wide' : 'bb-revs'}>
      {rating ? (
        <p className="bb-rating">
          <span aria-hidden="true">★★★★★</span>{' '}
          {Number(rating.average).toFixed(2)} from{' '}
          {Number(rating.count).toLocaleString('en-US')} Etsy reviews
        </p>
      ) : null}
      <ul>
        {reviews.map((r) => (
          <li key={r.text}>
            <span aria-hidden="true">★★★★★</span>
            <q>{r.text}</q>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Product titles are long SEO strings; the card shows the part before the first separator. */
function shortTitle(t) {
  return String(t)
    .split(/\s[|•:–-]\s|,\s/)[0]
    .trim();
}
