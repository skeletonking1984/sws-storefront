import {Link, useFetcher, useNavigate} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import {useEffect, useMemo, useRef, useState} from 'react';
import {
  getEmptyPredictiveSearchResult,
  urlWithTrackingParams,
} from '~/lib/search';
import {useAside} from './Aside';
import {SEARCH_ENDPOINT} from './SearchFormPredictive';

/**
 * Component that renders predictive search results
 * @param {SearchResultsPredictiveProps}
 * @return {React.ReactNode}
 */
export function SearchResultsPredictive({children}) {
  const aside = useAside();
  const navigate = useNavigate();
  const {term, inputRef, fetcher, total, items, highlightIndex, setHighlightIndex, flatResults} =
    usePredictiveSearch();

  /*
   * Utility that resets the search input
   */
  function resetInput() {
    if (inputRef.current) {
      inputRef.current.blur();
      inputRef.current.value = '';
    }
  }

  /**
   * Utility that resets the search input and closes the search aside
   */
  function closeSearch() {
    resetInput();
    aside.close();
  }

  /** Navigates to a result URL and closes the palette. */
  function goToResult(url) {
    closeSearch();
    navigate(url);
  }

  /**
   * Arrow Up/Down moves the highlighted result, Enter opens it. With
   * nothing highlighted, Enter falls back to "view all results".
   * @param {React.KeyboardEvent<HTMLInputElement>} event
   */
  function onInputKeyDown(event) {
    if (event.key === 'ArrowDown') {
      if (!flatResults.length) return;
      event.preventDefault();
      setHighlightIndex((i) => (i + 1) % flatResults.length);
    } else if (event.key === 'ArrowUp') {
      if (!flatResults.length) return;
      event.preventDefault();
      setHighlightIndex((i) => (i <= 0 ? flatResults.length - 1 : i - 1));
    } else if (event.key === 'Enter') {
      const highlighted = flatResults[highlightIndex];
      if (highlighted) {
        event.preventDefault();
        goToResult(highlighted.url);
      } else if (term.current) {
        event.preventDefault();
        goToResult(
          urlWithTrackingParams({baseUrl: SEARCH_ENDPOINT, term: term.current}),
        );
      }
    }
  }

  return children({
    items,
    closeSearch,
    inputRef,
    state: fetcher.state,
    term,
    total,
    highlightIndex,
    setHighlightIndex,
    flatResults,
    onInputKeyDown,
  });
}

SearchResultsPredictive.Articles = SearchResultsPredictiveArticles;
SearchResultsPredictive.Collections = SearchResultsPredictiveCollections;
SearchResultsPredictive.Pages = SearchResultsPredictivePages;
SearchResultsPredictive.Products = SearchResultsPredictiveProducts;
SearchResultsPredictive.Queries = SearchResultsPredictiveQueries;
SearchResultsPredictive.Empty = SearchResultsPredictiveEmpty;
SearchResultsPredictive.Skeleton = SearchResultsPredictiveSkeleton;

/**
 * @param {PartialPredictiveSearchResult<'articles'> & HighlightProps}
 */
function SearchResultsPredictiveArticles({
  term,
  articles,
  closeSearch,
  highlightedKey,
  onHover,
}) {
  if (!articles.length) return null;

  return (
    <div className="predictive-search-result" key="articles">
      <h5>Articles</h5>
      <ul>
        {articles.map((article) => {
          const articleUrl = urlWithTrackingParams({
            baseUrl: `/blogs/${article.blog.handle}/${article.handle}`,
            trackingParams: article.trackingParameters,
            term: term.current ?? '',
          });

          return (
            <li
              className={resultItemClass(article.id, highlightedKey)}
              key={article.id}
              onMouseEnter={() => onHover?.(article.id)}
            >
              <Link onClick={closeSearch} to={articleUrl}>
                <span className="predictive-search-result-item-image">
                  {article.image?.url && (
                    <Image alt={article.image.altText ?? ''} src={article.image.url} />
                  )}
                </span>
                <div>
                  <span>{article.title}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * @param {PartialPredictiveSearchResult<'collections'> & HighlightProps}
 */
function SearchResultsPredictiveCollections({
  term,
  collections,
  closeSearch,
  highlightedKey,
  onHover,
}) {
  if (!collections.length) return null;

  return (
    <div className="predictive-search-result" key="collections">
      <h5>Collections</h5>
      <ul>
        {collections.map((collection) => {
          const collectionUrl = urlWithTrackingParams({
            baseUrl: `/collections/${collection.handle}`,
            trackingParams: collection.trackingParameters,
            term: term.current,
          });

          return (
            <li
              className={resultItemClass(collection.id, highlightedKey)}
              key={collection.id}
              onMouseEnter={() => onHover?.(collection.id)}
            >
              <Link onClick={closeSearch} to={collectionUrl}>
                <span className="predictive-search-result-item-image">
                  {collection.image?.url && (
                    <Image alt={collection.image.altText ?? ''} src={collection.image.url} />
                  )}
                </span>
                <div>
                  <span>{collection.title}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * @param {PartialPredictiveSearchResult<'pages'> & HighlightProps}
 */
function SearchResultsPredictivePages({
  term,
  pages,
  closeSearch,
  highlightedKey,
  onHover,
}) {
  if (!pages.length) return null;

  return (
    <div className="predictive-search-result" key="pages">
      <h5>Pages</h5>
      <ul>
        {pages.map((page) => {
          const pageUrl = urlWithTrackingParams({
            baseUrl: `/pages/${page.handle}`,
            trackingParams: page.trackingParameters,
            term: term.current,
          });

          return (
            <li
              className={resultItemClass(page.id, highlightedKey)}
              key={page.id}
              onMouseEnter={() => onHover?.(page.id)}
            >
              <Link onClick={closeSearch} to={pageUrl}>
                <div>
                  <span>{page.title}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * @param {PartialPredictiveSearchResult<'products'> & HighlightProps}
 */
function SearchResultsPredictiveProducts({
  term,
  products,
  closeSearch,
  highlightedKey,
  onHover,
}) {
  if (!products.length) return null;

  return (
    <div className="predictive-search-result" key="products">
      <h5>Products</h5>
      <ul>
        {products.map((product) => {
          const productUrl = urlWithTrackingParams({
            baseUrl: `/products/${product.handle}`,
            trackingParams: product.trackingParameters,
            term: term.current ?? '',
          });

          const price = product?.selectedOrFirstAvailableVariant?.price;
          const image = product?.selectedOrFirstAvailableVariant?.image;
          return (
            <li
              className={resultItemClass(product.id, highlightedKey)}
              key={product.id}
              onMouseEnter={() => onHover?.(product.id)}
            >
              <Link to={productUrl} onClick={closeSearch}>
                <span className="predictive-search-result-item-image">
                  {image && (
                    // No aspectRatio/width/height: this catalog's art isn't
                    // square (see CLAUDE.md). The wrapper frames it square
                    // via CSS so the CDN never gets a crop=center request.
                    <Image alt={image.altText ?? ''} src={image.url} />
                  )}
                </span>
                <div>
                  <p>{product.title}</p>
                  <small>{price && <Money data={price} />}</small>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * @param {PartialPredictiveSearchResult<'queries', never> & {
 *   queriesDatalistId: string;
 * }}
 */
function SearchResultsPredictiveQueries({queries, queriesDatalistId}) {
  if (!queries.length) return null;

  return (
    <datalist id={queriesDatalistId}>
      {queries.map((suggestion) => {
        if (!suggestion) return null;

        return <option key={suggestion.text} value={suggestion.text} />;
      })}
    </datalist>
  );
}

/**
 * @param {{
 *   term: React.MutableRefObject<string>;
 * }}
 */
function SearchResultsPredictiveEmpty({term}) {
  if (!term.current) {
    return null;
  }

  return (
    <p className="predictive-search-no-results">
      No results found for <q>{term.current}</q>. Try a vibe like &quot;neon&quot; or a
      platform like &quot;Twitch&quot;.
    </p>
  );
}

/** Shimmer skeleton shown while a predictive search request is in flight. */
function SearchResultsPredictiveSkeleton() {
  return (
    <div className="predictive-search-skeleton" aria-hidden="true">
      {Array.from({length: 4}).map((_, i) => (
        <div className="predictive-search-skeleton-row" key={i}>
          <span className="predictive-search-skeleton-image shimmer" />
          <span className="predictive-search-skeleton-lines">
            <span className="predictive-search-skeleton-line shimmer" />
            <span className="predictive-search-skeleton-line shimmer short" />
          </span>
        </div>
      ))}
    </div>
  );
}

/** `is-highlighted` when this item is the current keyboard-highlighted result. */
function resultItemClass(id, highlightedKey) {
  return `predictive-search-result-item${id === highlightedKey ? ' is-highlighted' : ''}`;
}

/**
 * Builds one ordered list (Products, Collections, Pages, Articles) so
 * Arrow Up/Down + Enter can move across every result group as if it were
 * a single list.
 * @param {PredictiveSearchItems} items
 * @param {string} term
 */
function buildFlatResults(items, term) {
  const t = term ?? '';
  const products = (items.products || []).map((product) => ({
    key: product.id,
    url: urlWithTrackingParams({
      baseUrl: `/products/${product.handle}`,
      trackingParams: product.trackingParameters,
      term: t,
    }),
  }));
  const collections = (items.collections || []).map((collection) => ({
    key: collection.id,
    url: urlWithTrackingParams({
      baseUrl: `/collections/${collection.handle}`,
      trackingParams: collection.trackingParameters,
      term: t,
    }),
  }));
  const pages = (items.pages || []).map((page) => ({
    key: page.id,
    url: urlWithTrackingParams({
      baseUrl: `/pages/${page.handle}`,
      trackingParams: page.trackingParameters,
      term: t,
    }),
  }));
  const articles = (items.articles || []).map((article) => ({
    key: article.id,
    url: urlWithTrackingParams({
      baseUrl: `/blogs/${article.blog.handle}/${article.handle}`,
      trackingParams: article.trackingParameters,
      term: t,
    }),
  }));
  return [...products, ...collections, ...pages, ...articles];
}

/**
 * Hook that returns the predictive search results and fetcher and input ref.
 * @example
 * '''ts
 * const { items, total, inputRef, term, fetcher } = usePredictiveSearch();
 * '''
 * @return {UsePredictiveSearchReturn}
 */
function usePredictiveSearch() {
  const fetcher = useFetcher({key: 'search'});
  const term = useRef('');
  const inputRef = useRef(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);

  if (fetcher?.state === 'loading') {
    term.current = String(fetcher.formData?.get('q') || '');
  }

  // capture the search input element as a ref
  useEffect(() => {
    if (!inputRef.current) {
      inputRef.current = document.querySelector('input[type="search"]');
    }
  }, []);

  const {items, total} =
    fetcher?.data?.result ?? getEmptyPredictiveSearchResult();

  const flatResults = useMemo(
    () => buildFlatResults(items, term.current),
    [items],
  );

  // A fresh set of results (new fetcher payload) always starts unhighlighted.
  useEffect(() => {
    setHighlightIndex(-1);
  }, [fetcher.data]);

  return {
    items,
    total,
    inputRef,
    term,
    fetcher,
    highlightIndex,
    setHighlightIndex,
    flatResults,
  };
}

/** @typedef {PredictiveSearchReturn['result']['items']} PredictiveSearchItems */
/**
 * @typedef {{
 *   term: React.MutableRefObject<string>;
 *   total: number;
 *   inputRef: React.MutableRefObject<HTMLInputElement | null>;
 *   items: PredictiveSearchItems;
 *   fetcher: Fetcher<PredictiveSearchReturn>;
 * }} UsePredictiveSearchReturn
 */
/**
 * @typedef {Pick<
 *   UsePredictiveSearchReturn,
 *   'term' | 'total' | 'inputRef' | 'items'
 * > & {
 *   state: Fetcher['state'];
 *   closeSearch: () => void;
 *   highlightIndex: number;
 *   setHighlightIndex: React.Dispatch<React.SetStateAction<number>>;
 *   flatResults: Array<{key: string; url: string}>;
 *   onInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
 * }} SearchResultsPredictiveArgs
 */
/**
 * @typedef {Pick<PredictiveSearchItems, ItemType> &
 *   Pick<SearchResultsPredictiveArgs, ExtraProps> & {
 *     highlightedKey?: string;
 *     onHover?: (id: string) => void;
 *   }} PartialPredictiveSearchResult
 * @template {keyof PredictiveSearchItems} ItemType
 * @template {keyof SearchResultsPredictiveArgs} [ExtraProps='term' | 'closeSearch']
 */
/**
 * @typedef {{highlightedKey?: string; onHover?: (id: string) => void}} HighlightProps
 */
/**
 * @typedef {{
 *   children: (args: SearchResultsPredictiveArgs) => React.ReactNode;
 * }} SearchResultsPredictiveProps
 */

/** @template T @typedef {import('react-router').Fetcher<T>} Fetcher */
/** @typedef {import('~/lib/search').PredictiveSearchReturn} PredictiveSearchReturn */
