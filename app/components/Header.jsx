import {Suspense, useEffect, useRef, useState} from 'react';
import {Await, Link, NavLink, useAsyncValue, useLocation} from 'react-router';
import {Image, Money, useAnalytics, useOptimisticCart} from '@shopify/hydrogen';
import {useAside} from '~/components/Aside';
import {PlatformIcon} from '~/components/PlatformIcon';
import {
  MEGA_MENU_LABELS,
  MEGA_MENU_PANELS,
  OVERLAY_BROWSE_TILES,
  VIBES,
  WIDGET_BROWSE_TILES,
  WORKS_WITH_PLATFORMS,
} from '~/lib/nav';
import logo from '~/assets/logo.png';
import pfp from '~/assets/pfp.png';

/**
 * @param {HeaderProps}
 */
export function Header({header, isLoggedIn, cart, publicStoreDomain, navData}) {
  const {shop, menu} = header;
  return (
    <header className="header">
      <NavLink
        className="header-brand"
        prefetch="intent"
        to="/"
        style={activeLinkStyle}
        end
      >
        <BrandMark shopName={shop.name} />
      </NavLink>
      <HeaderMenu
        menu={menu}
        viewport="desktop"
        primaryDomainUrl={header.shop.primaryDomain.url}
        publicStoreDomain={publicStoreDomain}
        navData={navData}
      />
      <HeaderCtas isLoggedIn={isLoggedIn} cart={cart} />
    </header>
  );
}

/**
 * The logo PNG is the brand mark: no text wordmark next to it. If the image
 * itself ever fails to load, fall back to the holo text so the brand is
 * never blank.
 * @param {{shopName: string}}
 */
function BrandMark({shopName}) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <>
      {/* The pfp is the shop's avatar on X and Etsy. It sits beside the
          wordmark so shoppers arriving from either place recognise the
          shop before they read anything. Decorative next to the lockup,
          so alt is empty. Remove this when the new logo is finished. */}
      <img className="brand-pfp" src={pfp} alt="" width="200" height="200" />
      {imgFailed ? (
        <strong className="sws-holo">{shopName}</strong>
      ) : (
        <img
          src={logo}
          alt={shopName}
          /* Intrinsic size of logo.png. Lets the browser reserve the box from
             the aspect ratio before the file arrives; CSS still sets the
             rendered height and leaves width auto. */
          width="900"
          height="250"
          onError={() => setImgFailed(true)}
        />
      )}
    </>
  );
}

/**
 * Resolves a Shopify menu item's URL to an internal pathname when it points
 * at this shop, or leaves it as-is for external links.
 * @param {{url?: string | null}} item
 * @param {string} primaryDomainUrl
 * @param {string} publicStoreDomain
 */
function resolveMenuUrl(item, primaryDomainUrl, publicStoreDomain) {
  if (!item.url) return null;
  return item.url.includes('myshopify.com') ||
    item.url.includes(publicStoreDomain) ||
    item.url.includes(primaryDomainUrl)
    ? new URL(item.url).pathname
    : item.url;
}

/**
 * Desktop mega menu / mobile accordion, driven off the same Shopify menu
 * and the same `MEGA_MENU_PANELS` config. Menu items not in that config
 * (or a menu edit in Admin that changes a title) always fall back to a
 * plain link, so this can never blank the nav.
 * @param {{
 *   menu: HeaderProps['header']['menu'];
 *   primaryDomainUrl: HeaderProps['header']['shop']['primaryDomain']['url'];
 *   viewport: Viewport;
 *   publicStoreDomain: HeaderProps['publicStoreDomain'];
 *   navData?: HeaderProps['navData'];
 * }}
 */
export function HeaderMenu({
  menu,
  primaryDomainUrl,
  viewport,
  publicStoreDomain,
  navData,
}) {
  const items = (menu || FALLBACK_HEADER_MENU).items;
  const resolveUrl = (item) =>
    resolveMenuUrl(item, primaryDomainUrl, publicStoreDomain);

  if (viewport === 'mobile') {
    return (
      <MobileAccordionMenu
        items={items}
        resolveUrl={resolveUrl}
        navData={navData}
      />
    );
  }

  return (
    <DesktopMegaMenu items={items} resolveUrl={resolveUrl} navData={navData} />
  );
}

/*
* --------------------------------------------------
* Desktop mega menu
* --------------------------------------------------
*/

/**
 * @param {{
 *   items: Array<any>;
 *   resolveUrl: (item: any) => string | null;
 *   navData?: HeaderProps['navData'];
 * }}
 */
function DesktopMegaMenu({items, resolveUrl, navData}) {
  const [openId, setOpenId] = useState(null);
  const openTimerRef = useRef(null);
  const closeTimerRef = useRef(null);
  const triggerRefs = useRef({});
  const containerRef = useRef(null);
  const location = useLocation();

  // Never opens on page load or on scroll: openId only ever changes from
  // the interaction handlers below.
  useEffect(() => {
    setOpenId(null);
  }, [location.pathname, location.search]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpenId(null);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  function clearTimers() {
    clearTimeout(openTimerRef.current);
    clearTimeout(closeTimerRef.current);
  }

  /** Hover intent delay, ~130ms, so brushing past a trigger doesn't flash a panel open. */
  function scheduleOpen(id) {
    clearTimers();
    openTimerRef.current = setTimeout(() => setOpenId(id), 130);
  }

  /** Small grace period so moving the mouse from trigger into the panel doesn't close it. */
  function scheduleClose() {
    clearTimers();
    closeTimerRef.current = setTimeout(() => setOpenId(null), 120);
  }

  /** Focus and click/Enter open immediately, no intent delay. */
  function openNow(id) {
    clearTimers();
    setOpenId(id);
  }

  function closeNow() {
    clearTimers();
    setOpenId(null);
  }

  return (
    <nav className="header-menu-desktop" role="navigation" ref={containerRef}>
      {items.map((item) => {
        const url = resolveUrl(item);
        if (!url) return null;

        const panelType = MEGA_MENU_PANELS[item.title];
        if (!panelType) {
          return (
            <NavLink
              className="header-menu-item"
              end
              key={item.id}
              prefetch="intent"
              style={activeLinkStyle}
              to={url}
            >
              {item.title}
            </NavLink>
          );
        }

        const isOpen = openId === item.id;
        const panelId = `mega-panel-${item.id}`;

        return (
          <div
            className="header-mega-item"
            key={item.id}
            onMouseEnter={() => scheduleOpen(item.id)}
            onMouseLeave={scheduleClose}
          >
            <button
              type="button"
              ref={(el) => {
                triggerRefs.current[item.id] = el;
              }}
              className={`header-menu-item header-menu-trigger${isOpen ? ' is-open' : ''}`}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onFocus={() => openNow(item.id)}
              onClick={() => (isOpen ? closeNow() : openNow(item.id))}
              onKeyDown={(event) => {
                if (event.key === 'Escape' && isOpen) {
                  event.preventDefault();
                  closeNow();
                  triggerRefs.current[item.id]?.focus();
                }
              }}
            >
              {MEGA_MENU_LABELS[item.title] || item.title}
              <ChevronIcon />
            </button>
            {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- mega menu panel: hover/blur/Escape are the documented interaction contract, not a generic role misuse */}
            <div
              id={panelId}
              role="region"
              aria-label={`${item.title} menu`}
              className={`mega-panel${isOpen ? ' is-open' : ''}`}
              {...(!isOpen ? {inert: ''} : {})}
              onMouseEnter={() => openNow(item.id)}
              onMouseLeave={scheduleClose}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  closeNow();
                }
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  closeNow();
                  triggerRefs.current[item.id]?.focus();
                }
              }}
            >
              <div className="mega-panel-inner">
                {panelType === 'widgets' ? (
                  <WidgetsPanel navData={navData} />
                ) : (
                  <OverlaysPanel navData={navData} />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function ChevronIcon() {
  return (
    <svg
      className="header-menu-chevron"
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

/*
* --------------------------------------------------
* Mobile accordion menu
* --------------------------------------------------
*/

/**
 * @param {{
 *   items: Array<any>;
 *   resolveUrl: (item: any) => string | null;
 *   navData?: HeaderProps['navData'];
 * }}
 */
function MobileAccordionMenu({items, resolveUrl, navData}) {
  const {close} = useAside();
  const [openId, setOpenId] = useState(null);

  return (
    <nav className="header-menu-mobile" role="navigation">
      <MobileMenuSearchField />
      <NavLink
        end
        onClick={close}
        prefetch="intent"
        style={activeLinkStyle}
        to="/"
        className="mobile-accordion-link mobile-accordion-home"
      >
        Home
      </NavLink>
      <div className="mobile-accordion">
        {items.map((item) => {
          const url = resolveUrl(item);
          if (!url) return null;

          const panelType = MEGA_MENU_PANELS[item.title];
          if (!panelType) {
            return (
              <NavLink
                className="mobile-accordion-link"
                end
                key={item.id}
                onClick={close}
                prefetch="intent"
                style={activeLinkStyle}
                to={url}
              >
                {item.title}
              </NavLink>
            );
          }

          const isOpen = openId === item.id;
          const panelId = `mobile-accordion-panel-${item.id}`;

          return (
            <div className="mobile-accordion-item" key={item.id}>
              <button
                type="button"
                className={`mobile-accordion-trigger${isOpen ? ' is-open' : ''}`}
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenId(isOpen ? null : item.id)}
              >
                {MEGA_MENU_LABELS[item.title] || item.title}
                <ChevronIcon />
              </button>
              {isOpen && (
                <div id={panelId} className="mobile-accordion-panel">
                  {panelType === 'widgets' ? (
                    <WidgetsPanel navData={navData} />
                  ) : (
                    <OverlaysPanel navData={navData} />
                  )}
                  <Link
                    to={url}
                    className="mobile-accordion-view-all"
                    onClick={close}
                  >
                    View all {(MEGA_MENU_LABELS[item.title] || item.title).toLowerCase()}
                    {' '}
                    &rarr;
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function MobileMenuSearchField() {
  const {open} = useAside();
  return (
    <button
      type="button"
      className="mobile-menu-search-field"
      onClick={() => open('search')}
    >
      <SearchIcon />
      <span>Search widgets, vibes, platforms...</span>
    </button>
  );
}

/*
* --------------------------------------------------
* Mega panel content, shared by desktop and mobile
* --------------------------------------------------
*/

/** @param {{navData?: HeaderProps['navData']}} */
function WidgetsPanel({navData}) {
  return (
    <Suspense fallback={<MegaPanelSkeleton />}>
      <Await resolve={navData} errorElement={<MegaPanelSkeleton />}>
        {(data) => <WidgetsPanelContent data={data} />}
      </Await>
    </Suspense>
  );
}

function WidgetsPanelContent({data}) {
  return (
    <>
      <div className="mega-panel-col">
        <h3 className="mega-panel-heading">Browse</h3>
        <div className="mega-tile-grid">
          {WIDGET_BROWSE_TILES.map((tile) => (
            <NavCollectionTile
              key={tile.handle}
              tile={tile}
              collection={data?.[tile.dataKey]}
            />
          ))}
        </div>
      </div>
      <div className="mega-panel-col">
        <h3 className="mega-panel-heading">Shop by vibe</h3>
        <div className="mega-vibe-chips">
          {VIBES.map((vibe) => (
            <Link
              key={vibe}
              to={`/collections/all?q=${encodeURIComponent(vibe)}`}
              className="sws-chip mega-vibe-chip"
            >
              {vibe}
            </Link>
          ))}
        </div>
      </div>
      <div className="mega-panel-col">
        <h3 className="mega-panel-heading">Works with</h3>
        <ul className="mega-platform-list">
          {WORKS_WITH_PLATFORMS.map((platform) => (
            <li key={platform}>
              <Link
                to={`/collections/all?q=${encodeURIComponent(platform)}`}
                className="mega-platform-link"
              >
                <PlatformIcon platform={platform} />
                {platform}
              </Link>
            </li>
          ))}
        </ul>
        <NavProductCard product={data?.featuredWidget} eyebrow="Top seller" />
      </div>
    </>
  );
}

/** @param {{navData?: HeaderProps['navData']}} */
function OverlaysPanel({navData}) {
  return (
    <Suspense fallback={<MegaPanelSkeleton />}>
      <Await resolve={navData} errorElement={<MegaPanelSkeleton />}>
        {(data) => <OverlaysPanelContent data={data} />}
      </Await>
    </Suspense>
  );
}

function OverlaysPanelContent({data}) {
  const products = [
    data?.overlayFeatured0,
    data?.overlayFeatured1,
    data?.overlayFeatured2,
    data?.overlayFeatured3,
  ].filter(Boolean);

  return (
    <>
      <div className="mega-panel-col">
        <h3 className="mega-panel-heading">Browse</h3>
        <div className="mega-tile-grid">
          {OVERLAY_BROWSE_TILES.map((tile) => (
            <NavCollectionTile
              key={tile.handle}
              tile={tile}
              collection={data?.[tile.dataKey]}
            />
          ))}
        </div>
      </div>
      {products.length > 0 && (
        <div className="mega-panel-col mega-panel-col-wide">
          <h3 className="mega-panel-heading">Featured kits and packs</h3>
          <div className="mega-product-grid">
            {products.map((product) => (
              <NavProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * @param {{
 *   tile: {handle: string; label: string; dataKey: string};
 *   collection?: {
 *     image?: {url: string; altText?: string | null} | null;
 *     products?: {nodes: Array<{id: string}>} | null;
 *   } | null;
 * }}
 */
function NavCollectionTile({tile, collection}) {
  // The Storefront API has no `productsCount` field on Collection, so the
  // NavCollection fragment fetches `products(first: 250) { nodes { id } }`
  // (plenty of headroom above this catalog's largest collection) and this
  // just counts the returned nodes.
  const count = collection?.products?.nodes?.length;
  return (
    <Link to={`/collections/${tile.handle}`} className="mega-tile" prefetch="intent">
      <span className="mega-tile-image">
        {collection?.image ? (
          // No aspectRatio/width/height on this Image: this catalog's art
          // isn't square (see CLAUDE.md). The wrapper frames it square via
          // CSS aspect-ratio + object-fit so nothing gets CDN-cropped.
          <Image
            data={collection.image}
            alt={collection.image.altText || tile.label}
            sizes="180px"
          />
        ) : (
          <span className="mega-tile-image-placeholder shimmer" aria-hidden="true" />
        )}
      </span>
      <span className="mega-tile-body">
        <span className="mega-tile-title">{tile.label}</span>
        {typeof count === 'number' && count > 0 && (
          <span className="mega-tile-count">{count} widgets</span>
        )}
      </span>
    </Link>
  );
}

/**
 * @param {{
 *   product?: {
 *     id: string;
 *     handle: string;
 *     title: string;
 *     featuredImage?: {url: string; altText?: string | null} | null;
 *     selectedOrFirstAvailableVariant?: {price?: any} | null;
 *   } | null;
 *   eyebrow?: string;
 * }}
 */
function NavProductCard({product, eyebrow}) {
  if (!product) return null;
  const price = product.selectedOrFirstAvailableVariant?.price;
  return (
    <Link
      to={`/products/${product.handle}`}
      className="mega-product-card"
      prefetch="intent"
    >
      <span className="mega-product-card-image">
        {product.featuredImage && (
          <Image
            data={product.featuredImage}
            alt={product.featuredImage.altText || product.title}
            sizes="140px"
          />
        )}
      </span>
      <span className="mega-product-card-body">
        {eyebrow && <span className="mega-product-card-eyebrow">{eyebrow}</span>}
        <span className="mega-product-card-title">{product.title}</span>
        {price && (
          <span className="mega-product-card-price">
            <Money data={price} />
          </span>
        )}
      </span>
    </Link>
  );
}

function MegaPanelSkeleton() {
  return (
    <div className="mega-panel-skeleton" aria-hidden="true">
      {Array.from({length: 4}).map((_, i) => (
        <span className="mega-skeleton-tile shimmer" key={i} />
      ))}
    </div>
  );
}

/**
 * @param {Pick<HeaderProps, 'isLoggedIn' | 'cart'>}
 */
function HeaderCtas({isLoggedIn, cart}) {
  return (
    <nav className="header-ctas" role="navigation">
      <HeaderMenuMobileToggle />
      <NavLink
        prefetch="intent"
        to="/account"
        style={activeLinkStyle}
        className="header-icon-btn"
      >
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span className="header-icon-label">
          <Suspense fallback="Sign in">
            <Await resolve={isLoggedIn} errorElement="Sign in">
              {(isLoggedIn) => (isLoggedIn ? 'Account' : 'Sign in')}
            </Await>
          </Suspense>
        </span>
      </NavLink>
      <SearchToggle />
      <CartToggle cart={cart} />
    </nav>
  );
}

function HeaderMenuMobileToggle() {
  const {open} = useAside();
  return (
    <button
      className="header-menu-mobile-toggle reset"
      onClick={() => open('mobile')}
      aria-label="Open menu"
    >
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/**
 * The search icon button is the semantic "trigger" for the search palette
 * regardless of how it was actually opened (icon click, Cmd+K, or "/"), so
 * closing the palette always returns focus here.
 */
function SearchToggle() {
  const {open, type} = useAside();
  const buttonRef = useRef(null);
  const wasSearchOpenRef = useRef(false);

  useEffect(() => {
    if (type === 'search') {
      wasSearchOpenRef.current = true;
    } else if (wasSearchOpenRef.current) {
      wasSearchOpenRef.current = false;
      buttonRef.current?.focus();
    }
  }, [type]);

  return (
    <button
      ref={buttonRef}
      className="reset header-icon-btn"
      onClick={() => open('search')}
      aria-label="Search"
    >
      <SearchIcon />
      <span className="header-icon-label">Search</span>
    </button>
  );
}

/**
 * @param {{count: number}}
 */
function CartBadge({count}) {
  const {open} = useAside();
  const {publish, shop, cart, prevCart} = useAnalytics();

  return (
    <a
      href="/cart"
      className="header-icon-btn header-cart-btn"
      onClick={(e) => {
        e.preventDefault();
        open('cart');
        publish('cart_viewed', {
          cart,
          prevCart,
          shop,
          url: window.location.href || '',
        });
      }}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
      <span className="header-icon-label">Cart</span>
      {count > 0 && (
        <span className="header-cart-count" aria-label={`${count} items in cart`}>
          {count}
        </span>
      )}
    </a>
  );
}

/**
 * @param {Pick<HeaderProps, 'cart'>}
 */
function CartToggle({cart}) {
  return (
    <Suspense fallback={<CartBadge count={0} />}>
      <Await resolve={cart}>
        <CartBanner />
      </Await>
    </Suspense>
  );
}

function CartBanner() {
  const originalCart = useAsyncValue();
  const cart = useOptimisticCart(originalCart);
  return <CartBadge count={cart?.totalQuantity ?? 0} />;
}

const FALLBACK_HEADER_MENU = {
  id: 'gid://shopify/Menu/199655587896',
  items: [
    {
      id: 'gid://shopify/MenuItem/461609500728',
      resourceId: null,
      tags: [],
      title: 'Collections',
      type: 'HTTP',
      url: '/collections',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609533496',
      resourceId: null,
      tags: [],
      title: 'Blog',
      type: 'HTTP',
      url: '/blogs/journal',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609566264',
      resourceId: null,
      tags: [],
      title: 'Policies',
      type: 'HTTP',
      url: '/policies',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609599032',
      resourceId: 'gid://shopify/Page/92591030328',
      tags: [],
      title: 'About',
      type: 'PAGE',
      url: '/pages/about',
      items: [],
    },
  ],
};

/**
 * @param {{
 *   isActive: boolean;
 *   isPending: boolean;
 * }}
 */
function activeLinkStyle({isActive, isPending}) {
  return {
    fontWeight: isActive ? 'bold' : undefined,
    color: isPending ? 'grey' : undefined,
  };
}

/** @typedef {'desktop' | 'mobile'} Viewport */
/**
 * @typedef {Object} HeaderProps
 * @property {HeaderQuery} header
 * @property {Promise<CartApiQueryFragment|null>} cart
 * @property {Promise<boolean>} isLoggedIn
 * @property {string} publicStoreDomain
 * @property {Promise<any>} [navData]
 */

/** @typedef {import('@shopify/hydrogen').CartViewPayload} CartViewPayload */
/** @typedef {import('storefrontapi.generated').HeaderQuery} HeaderQuery */
/** @typedef {import('storefrontapi.generated').CartApiQueryFragment} CartApiQueryFragment */
