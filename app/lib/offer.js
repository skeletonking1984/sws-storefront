/**
 * Shared "this visitor has already been offered the discount" flag.
 *
 * Both entry points write it: the homepage capture and the first-visit popup.
 * Without that, someone could sign up in the footer form and be asked to sign
 * up again by the popup seconds later, which is exactly what happened to Todd
 * on 2026-09-14.
 *
 * Storage can throw (private mode, blocked site data). A failed READ is
 * treated as "already seen" so the quiet default wins, and a failed write is
 * ignored: the worst case is the offer appears again on a later visit, which
 * is much better than it appearing over someone who just used it.
 */
export const OFFER_STORAGE_KEY = 'sws_launch_offer';

/** @returns {boolean} */
export function hasSeenOffer() {
  try {
    return window.localStorage.getItem(OFFER_STORAGE_KEY) !== null;
  } catch {
    return true;
  }
}

export function markOfferSeen() {
  try {
    window.localStorage.setItem(OFFER_STORAGE_KEY, 'seen');
  } catch {
    // Ignore, see the note above.
  }
}
