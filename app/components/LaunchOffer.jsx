import {useEffect, useRef, useState} from 'react';
import {useFetcher} from 'react-router';
import {useAside} from '~/components/Aside';
import {WELCOME_CODE} from '~/components/EmailCapture';

const STORAGE_KEY = 'sws_launch_offer';
/** Long enough that it never interrupts the first look at the page. */
const DELAY_MS = 20000;

/**
 * First-visit launch offer. Announces the site and hands over the welcome
 * code.
 *
 * The restraint here is deliberate, because this is the second modal on a
 * site whose first one covered the checkout button on phones:
 *
 * - It never appears on a first paint. 20 seconds, or an exit-intent move
 *   toward the browser chrome on a device that actually has a pointer.
 * - It shows ONCE. Dismissing or signing up writes to localStorage and it
 *   never returns, on any route.
 * - It yields to the cart, search and menu drawers: it will not open while
 *   one is open, and closes itself if one opens.
 * - On a phone it is a bottom sheet, not a full screen cover, and it never
 *   sits over the sticky Add to cart bar's own space until dismissed.
 * - Escape, the backdrop, and a 44px close button all dismiss it.
 *
 * The code is shown on screen rather than promised by email, same as the
 * homepage capture, so nobody is left waiting on a message to buy.
 */
export function LaunchOffer() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const fetcher = useFetcher();
  const {type: asideType} = useAside();
  const closeRef = useRef(null);
  const seenRef = useRef(false);

  // Remember across routes and visits. A failed read (private mode, storage
  // disabled) is treated as "already seen" so the quiet default wins.
  function remember() {
    try {
      window.localStorage.setItem(STORAGE_KEY, 'seen');
    } catch {
      // Ignore: worst case it may appear again on a later visit.
    }
  }

  useEffect(() => {
    let seen = true;
    try {
      seen = window.localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      seen = true;
    }
    if (seen) return undefined;
    seenRef.current = false;

    const show = () => {
      if (seenRef.current) return;
      seenRef.current = true;
      setOpen(true);
    };

    const timer = window.setTimeout(show, DELAY_MS);

    // Exit intent, pointer devices only. A touch screen has no cursor to
    // leave the window, and firing this on a scroll would be the spammy
    // version of this feature.
    const canHover = window.matchMedia('(hover: hover)').matches;
    const onLeave = (event) => {
      if (event.clientY <= 0) show();
    };
    if (canHover) document.addEventListener('mouseout', onLeave);

    return () => {
      window.clearTimeout(timer);
      if (canHover) document.removeEventListener('mouseout', onLeave);
    };
  }, []);

  // Never compete with a drawer.
  useEffect(() => {
    if (asideType !== 'closed' && open) {
      setOpen(false);
      remember();
    }
  }, [asideType, open]);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') dismiss();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data?.ok) {
      setDone(true);
      remember();
    }
  }, [fetcher.state, fetcher.data]);

  function dismiss() {
    setOpen(false);
    remember();
  }

  if (!open) return null;

  return (
    <div className="launch-offer-root" role="dialog" aria-modal="false" aria-labelledby="launch-offer-title">
      <button
        type="button"
        className="launch-offer-scrim"
        aria-label="Dismiss offer"
        onClick={dismiss}
      />
      <div className="launch-offer">
        <button
          type="button"
          ref={closeRef}
          className="launch-offer-close"
          aria-label="Close"
          onClick={dismiss}
        >
          &times;
        </button>

        {done ? (
          <>
            <h2 id="launch-offer-title" className="launch-offer-title">
              You&rsquo;re on the list
            </h2>
            <p className="launch-offer-copy">
              Use code <strong className="launch-offer-code">{WELCOME_CODE}</strong> at
              checkout for 10% off.
            </p>
            <button type="button" className="sws-btn sws-btn-primary launch-offer-cta" onClick={dismiss}>
              Start shopping
            </button>
          </>
        ) : (
          <>
            <p className="launch-offer-kicker">The new shop is live</p>
            <h2 id="launch-offer-title" className="launch-offer-title">
              10% off your first order
            </h2>
            <p className="launch-offer-copy">
              Animated chat and goal widgets, instant download. Drop your email
              and the code is yours.
            </p>
            <fetcher.Form method="post" action="/api/newsletter" className="launch-offer-form">
              <input type="hidden" name="source" value="launch popup" />
              <label className="sr-only" htmlFor="launch-offer-email">
                Email address
              </label>
              <input
                id="launch-offer-email"
                className="launch-offer-input"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
              />
              {/* Honeypot, same contract as the homepage capture. */}
              <div className="contact-form-honeypot" aria-hidden="true">
                <label htmlFor="launch-offer-company">Company</label>
                <input id="launch-offer-company" name="company" tabIndex={-1} autoComplete="off" />
              </div>
              <button
                type="submit"
                className="sws-btn sws-btn-primary launch-offer-cta"
                disabled={fetcher.state !== 'idle'}
              >
                {fetcher.state !== 'idle' ? 'Sending...' : 'Get my code'}
              </button>
            </fetcher.Form>
            {fetcher.data && !fetcher.data.ok ? (
              <p className="launch-offer-copy launch-offer-fallback">
                We could not add you just now, so here is the code anyway:{' '}
                <strong className="launch-offer-code">{WELCOME_CODE}</strong>
              </p>
            ) : null}
            <button type="button" className="launch-offer-decline" onClick={dismiss}>
              No thanks
            </button>
          </>
        )}
      </div>
    </div>
  );
}
