import {Await, Link} from 'react-router';
import {AgentTools} from '~/components/AgentTools';
import {Suspense, useEffect, useId, useState} from 'react';
import {Image} from '@shopify/hydrogen';
import {Aside, useAside} from '~/components/Aside';
import {LaunchOffer} from '~/components/LaunchOffer';
import {Footer} from '~/components/Footer';
import {Header, HeaderMenu} from '~/components/Header';
import {CartMain} from '~/components/CartMain';
import {SocialLinks} from '~/components/SocialLinks';
import {VIBES} from '~/lib/nav';
import {
  SEARCH_ENDPOINT,
  SearchFormPredictive,
} from '~/components/SearchFormPredictive';
import {SearchResultsPredictive} from '~/components/SearchResultsPredictive';

/**
 * @param {PageLayoutProps}
 */
export function PageLayout({
  cart,
  children = null,
  footer,
  header,
  isLoggedIn,
  publicStoreDomain,
  navData,
}) {
  return (
    <Aside.Provider>
      {/* WebMCP tools. Inside Aside.Provider because add_to_cart opens the
          cart drawer, so the shopper sees what an agent did to their basket.
          Renders nothing and is inert unless the browser has
          navigator.modelContext. */}
      <AgentTools />
      <CartAside cart={cart} />
      <SearchAside navData={navData} />
      <MobileMenuAside
        header={header}
        publicStoreDomain={publicStoreDomain}
        navData={navData}
      />
      {header && (
        <Header
          header={header}
          cart={cart}
          isLoggedIn={isLoggedIn}
          publicStoreDomain={publicStoreDomain}
          navData={navData}
        />
      )}
      <main>{children}</main>
      {/* First-visit launch offer. Inside Aside.Provider so it can stand down
          for the cart, search and menu drawers. */}
      <LaunchOffer />
      <Footer
        footer={footer}
        header={header}
        publicStoreDomain={publicStoreDomain}
      />
    </Aside.Provider>
  );
}

/**
 * @param {{cart: PageLayoutProps['cart']}}
 */
function CartAside({cart}) {
  return (
    <Aside type="cart" heading="CART">
      <Suspense fallback={<p>Loading cart ...</p>}>
        <Await resolve={cart}>
          {(cart) => {
            return <CartMain cart={cart} layout="aside" />;
          }}
        </Await>
      </Suspense>
    </Aside>
  );
}

/*
* --------------------------------------------------
* Search command palette
* --------------------------------------------------
*/

/** @param {{navData: PageLayoutProps['navData']}} */
function SearchAside({navData}) {
  const {open} = useAside();

  // Global accelerators: "/" and Cmd+K / Ctrl+K open the palette, but never
  // while the user is already typing in another input, textarea, select,
  // or contenteditable region.
  useEffect(() => {
    function handleKeyDown(event) {
      const target = event.target;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isTyping) return;

      const isCmdK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (isCmdK || event.key === '/') {
        event.preventDefault();
        open('search');
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <Aside type="search" heading="Search widgets">
      <div className="search-palette">
        <SearchResultsPredictive>
          {(resultsArgs) => (
            <SearchFormPredictive className="search-palette-form">
              {({fetchResults, inputRef}) => (
                <SearchPaletteBody
                  {...resultsArgs}
                  fetchResults={fetchResults}
                  inputRef={inputRef}
                  navData={navData}
                />
              )}
            </SearchFormPredictive>
          )}
        </SearchResultsPredictive>
      </div>
    </Aside>
  );
}

/**
 * Owns the palette's own UI: input row, empty state, loading skeleton,
 * grouped results, and footer. The predictive fetch itself stays inside
 * SearchFormPredictive/SearchResultsPredictive; this only restyles and
 * wires keyboard nav on top of what they already expose.
 */
function SearchPaletteBody({
  items,
  total,
  term,
  state,
  closeSearch,
  highlightIndex,
  setHighlightIndex,
  flatResults,
  onInputKeyDown,
  fetchResults,
  inputRef,
  navData,
}) {
  const {type: asideType, close} = useAside();
  const queriesDatalistId = useId();
  const [hasValue, setHasValue] = useState(false);

  // Autofocus whenever the palette opens, not just on first mount.
  useEffect(() => {
    if (asideType === 'search') {
      const raf = requestAnimationFrame(() => inputRef.current?.focus());
      return () => cancelAnimationFrame(raf);
    }
  }, [asideType, inputRef]);

  function handleChange(event) {
    setHasValue(Boolean(event.target.value));
    fetchResults(event);
  }

  function handleClear() {
    if (inputRef.current) {
      inputRef.current.value = '';
      inputRef.current.focus();
    }
    setHasValue(false);
    fetchResults({target: {value: ''}});
  }

  const hasTerm = Boolean(term.current);
  const isLoading = state === 'loading' && hasTerm;
  const {articles, collections, pages, products, queries} = items;
  const highlightedKey = flatResults[highlightIndex]?.key;

  function onHover(id) {
    const index = flatResults.findIndex((result) => result.key === id);
    if (index > -1) setHighlightIndex(index);
  }

  return (
    <>
      <div className="search-palette-input-row">
        <SearchGlyph className="search-palette-input-icon" />
        <input
          className="search-palette-input"
          name="q"
          list={queriesDatalistId}
          onChange={handleChange}
          onFocus={fetchResults}
          onKeyDown={onInputKeyDown}
          placeholder="Search widgets, vibes, platforms..."
          ref={inputRef}
          type="search"
          autoComplete="off"
          aria-label="Search widgets, vibes, platforms"
        />
        {hasValue && (
          <button
            type="button"
            className="search-palette-clear reset"
            onClick={handleClear}
            aria-label="Clear search"
          >
            &times;
          </button>
        )}
        <button
          type="button"
          className="search-palette-close reset"
          onClick={close}
          aria-label="Close search"
        >
          <kbd>Esc</kbd>
        </button>
      </div>
      <SearchResultsPredictive.Queries
        queries={queries}
        queriesDatalistId={queriesDatalistId}
      />

      <div className="search-palette-body">
        {!hasTerm && (
          <SearchPaletteEmptyState navData={navData} onNavigate={close} />
        )}
        {hasTerm && isLoading && <SearchResultsPredictive.Skeleton />}
        {hasTerm && !isLoading && !total && (
          <SearchResultsPredictive.Empty term={term} />
        )}
        {hasTerm && !isLoading && total > 0 && (
          <>
            <SearchResultsPredictive.Products
              products={products}
              closeSearch={closeSearch}
              term={term}
              highlightedKey={highlightedKey}
              onHover={onHover}
            />
            <SearchResultsPredictive.Collections
              collections={collections}
              closeSearch={closeSearch}
              term={term}
              highlightedKey={highlightedKey}
              onHover={onHover}
            />
            <SearchResultsPredictive.Pages
              pages={pages}
              closeSearch={closeSearch}
              term={term}
              highlightedKey={highlightedKey}
              onHover={onHover}
            />
            <SearchResultsPredictive.Articles
              articles={articles}
              closeSearch={closeSearch}
              term={term}
              highlightedKey={highlightedKey}
              onHover={onHover}
            />
          </>
        )}
      </div>

      {hasTerm && !isLoading && total > 0 ? (
        <div className="search-palette-footer">
          <Link
            onClick={closeSearch}
            to={`${SEARCH_ENDPOINT}?q=${term.current}`}
            className="search-palette-view-all"
          >
            View all results for <q>{term.current}</q> &rarr;
          </Link>
          <span className="search-palette-hints">
            <kbd>&uarr;</kbd>
            <kbd>&darr;</kbd> navigate <kbd>&crarr;</kbd> open
          </span>
        </div>
      ) : (
        <div className="search-palette-footer search-palette-footer-hints-only">
          <span className="search-palette-hints">
            <kbd>&uarr;</kbd>
            <kbd>&darr;</kbd> navigate <kbd>&crarr;</kbd> open <kbd>Esc</kbd> close
          </span>
        </div>
      )}
    </>
  );
}

/** Real-content empty state: popular vibe chips + real Top Widgets thumbnails. */
function SearchPaletteEmptyState({navData, onNavigate}) {
  return (
    <div className="search-palette-empty">
      <div className="search-palette-empty-section">
        <h4 className="search-palette-empty-heading">Popular searches</h4>
        <div className="search-palette-chip-row">
          {VIBES.map((vibe) => (
            <Link
              key={vibe}
              to={`/collections/all?q=${encodeURIComponent(vibe)}`}
              className="sws-chip"
              onClick={onNavigate}
            >
              {vibe}
            </Link>
          ))}
        </div>
      </div>
      <div className="search-palette-empty-section">
        <h4 className="search-palette-empty-heading">Top widgets</h4>
        <Suspense fallback={<SearchPaletteThumbSkeleton />}>
          <Await resolve={navData} errorElement={null}>
            {(data) => (
              <TopWidgetsThumbRow
                products={data?.topWidgets?.thumbs?.nodes}
                onNavigate={onNavigate}
              />
            )}
          </Await>
        </Suspense>
      </div>
    </div>
  );
}

function TopWidgetsThumbRow({products, onNavigate}) {
  const list = (products || []).slice(0, 6);
  if (!list.length) return null;
  return (
    <div className="search-palette-thumb-row">
      {list.map((product) => (
        <Link
          key={product.id}
          to={`/products/${product.handle}`}
          className="search-palette-thumb"
          onClick={onNavigate}
          prefetch="intent"
        >
          <span className="search-palette-thumb-image">
            {product.featuredImage && (
              // No aspectRatio/width/height on this Image, see CLAUDE.md:
              // the wrapper frames it square via CSS instead.
              <Image
                data={product.featuredImage}
                alt={product.featuredImage.altText || product.title}
                loading="eager"
                sizes="190px"
              />
            )}
          </span>
          <span className="search-palette-thumb-title">{product.title}</span>
        </Link>
      ))}
    </div>
  );
}

function SearchPaletteThumbSkeleton() {
  return (
    <div className="search-palette-thumb-row" aria-hidden="true">
      {Array.from({length: 4}).map((_, i) => (
        <span className="search-palette-thumb-skeleton shimmer" key={i} />
      ))}
    </div>
  );
}

function SearchGlyph({className}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/*
* --------------------------------------------------
* Mobile menu aside
* --------------------------------------------------
*/

/**
 * @param {{
 *   header: PageLayoutProps['header'];
 *   publicStoreDomain: PageLayoutProps['publicStoreDomain'];
 *   navData: PageLayoutProps['navData'];
 * }}
 */
function MobileMenuAside({header, publicStoreDomain, navData}) {
  const {close} = useAside();
  return (
    header.menu &&
    header.shop.primaryDomain?.url && (
      <Aside type="mobile" heading="Menu">
        <HeaderMenu
          menu={header.menu}
          viewport="mobile"
          primaryDomainUrl={header.shop.primaryDomain.url}
          publicStoreDomain={publicStoreDomain}
          navData={navData}
        />
        <div className="mobile-menu-footer">
          <Link
            to="/account"
            onClick={close}
            className="mobile-menu-account-link"
          >
            My account
          </Link>
          <SocialLinks />
        </div>
      </Aside>
    )
  );
}

/**
 * @typedef {Object} PageLayoutProps
 * @property {Promise<CartApiQueryFragment|null>} cart
 * @property {Promise<FooterQuery|null>} footer
 * @property {HeaderQuery} header
 * @property {Promise<boolean>} isLoggedIn
 * @property {string} publicStoreDomain
 * @property {Promise<any>} [navData]
 * @property {React.ReactNode} [children]
 */

/** @typedef {import('storefrontapi.generated').CartApiQueryFragment} CartApiQueryFragment */
/** @typedef {import('storefrontapi.generated').FooterQuery} FooterQuery */
/** @typedef {import('storefrontapi.generated').HeaderQuery} HeaderQuery */
