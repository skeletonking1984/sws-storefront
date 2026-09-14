import {createContext, useContext, useEffect, useState} from 'react';
import {useId} from 'react';
import {useLocation} from 'react-router';

/**
 * A side bar component with Overlay
 * @example
 * ```jsx
 * <Aside type="search" heading="SEARCH">
 *  <input type="search" />
 *  ...
 * </Aside>
 * ```
 * @param {{
 *   children?: React.ReactNode;
 *   type: AsideType;
 *   heading: React.ReactNode;
 * }}
 */
export function Aside({children, heading, type}) {
  const {type: activeType, close} = useAside();
  const expanded = type === activeType;
  const id = useId();
  useEffect(() => {
    const abortController = new AbortController();

    if (expanded) {
      document.addEventListener(
        'keydown',
        function handler(event) {
          if (event.key === 'Escape') {
            close();
          }
        },
        {signal: abortController.signal},
      );
    }
    return () => abortController.abort();
  }, [close, expanded]);

  return (
    <div
      aria-modal
      className={`overlay ${expanded ? 'expanded' : ''}`}
      role="dialog"
      aria-labelledby={id}
    >
      <button className="close-outside" onClick={close} />
      <aside>
        <header>
          <h3 id={id}>{heading}</h3>
          <button className="close reset" onClick={close} aria-label="Close">
            &times;
          </button>
        </header>
        <main>{children}</main>
      </aside>
    </div>
  );
}

const AsideContext = createContext(null);

Aside.Provider = function AsideProvider({children}) {
  const [type, setType] = useState('closed');
  const location = useLocation();

  /*
   * Close whatever aside is open as soon as a navigation commits.
   *
   * Without this the mobile menu is a full screen overlay that never goes
   * away: tapping "Chat widgets" in the accordion DID navigate, the route
   * behind it really did become /collections/frontpage, but the menu stayed
   * covering the whole viewport, so the only thing a visitor sees is the
   * same menu they just tapped. Todd reported it as "clicking, no redirect
   * happens and gets buggy", and that is exactly how it reads. Verified on
   * production 2026-09-14: after the tap, location.pathname was
   * /collections/frontpage, document.title was "Chat Widget", and the
   * overlay was still expanded.
   *
   * Keyed on location.key rather than pathname so that tapping a link to the
   * page you are already on still closes the menu.
   *
   * Safe for the cart drawer: add to cart goes through CartForm, which
   * submits with a fetcher and never changes location, so opening the drawer
   * from the PDP is not undone by this.
   */
  useEffect(() => {
    setType('closed');
  }, [location.key]);

  return (
    <AsideContext.Provider
      value={{
        type,
        open: setType,
        close: () => setType('closed'),
      }}
    >
      {children}
    </AsideContext.Provider>
  );
};

export function useAside() {
  const aside = useContext(AsideContext);
  if (!aside) {
    throw new Error('useAside must be used within an AsideProvider');
  }
  return aside;
}

/** @typedef {'search' | 'cart' | 'mobile' | 'closed'} AsideType */
/**
 * @typedef {{
 *   type: AsideType;
 *   open: (mode: AsideType) => void;
 *   close: () => void;
 * }} AsideContextValue
 */

/** @typedef {import('react').ReactNode} ReactNode */
