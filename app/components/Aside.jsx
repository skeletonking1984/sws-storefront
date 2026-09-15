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
      {/* The backdrop. It is a real focusable button with no content, so
          without a label it reaches the accessibility tree as an unnamed
          control sitting in front of the dialog. `tabIndex={-1}` keeps it out
          of the tab order as well: the header already carries a named Close
          button, and Escape and an outside click both close the aside. */}
      <button
        className="close-outside"
        onClick={close}
        aria-label={typeof heading === 'string' ? `Close ${heading}` : 'Close'}
        tabIndex={-1}
      />
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

  /*
   * Lock the page while an aside is open. Standard modal behaviour and its
   * absence is a real bug on touch: with the body still scrollable, a drag
   * inside the drawer that reaches its end hands the gesture to the page, so
   * the background slides around under a menu that looks frozen. Todd on a
   * Moto G5, 2026-09-14: "cant scroll, stuff cutoff".
   *
   * Position is preserved and restored rather than using `overflow: hidden`
   * alone, because on iOS Safari `overflow: hidden` on the body does not
   * stop the scroll and the page jumps to the top when the modal closes.
   */
  useEffect(() => {
    if (type === 'closed') return undefined;
    const {body} = document;
    const scrollY = window.scrollY;
    // Locking the body removes the scrollbar, which widens the layout and
    // jumps every fixed element. Measured at 1024px: the header went 1009 to
    // 1024, a visible 15px shift on every cart open. Hold the width with
    // padding. Touch devices overlay their scrollbar, so this is 0 there.
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    };
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      body.style.paddingRight = previous.paddingRight;
      window.scrollTo(0, scrollY);
    };
  }, [type]);

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
