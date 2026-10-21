/**
 * Mukala pixel (first party to Mukala, the app that runs this shop's Grow dashboard). Added 2026-10-18.
 *
 * Loads https://app.mukala.ai/static/mk.js with data-org = PUBLIC_MUKALA_PIXEL_ORG ("sws"). Inert until that env var is set:
 * isConfigured() is false, so PixelBus never loads or sends anything (same switch as every other adapter here).
 *
 * What mk.js sends (anonymous, no cookies, nothing typed, nothing under Do Not Track / GPC): page_view, scroll depth, time on page.
 * This adapter adds the shop funnel on the same two event names the Mukala dashboard already reads, so the Grow tab shows them as:
 *   add_to_cart     -> mk('signup_started')    shown as "Added to cart"
 *   begin_checkout  -> mk('signup_completed')  shown as "Went to checkout"
 *   page_view       -> mk('page_view')         client side navigations (mk.js itself counts the first load)
 * Internal traffic (internalTraffic.js) is sent as test traffic (mk_test), hidden on the dashboard by default.
 * CSP: app.mukala.ai is in defaultSrc (script) and connectSrc (sendBeacon to /api/pixel/collect) in entry.server.jsx.
 */
export const id = 'mukala';

export const envKeys = {
  org: 'PUBLIC_MUKALA_PIXEL_ORG',
};

const SRC = 'https://app.mukala.ai/static/mk.js';
let firstPageView = true;

export function isConfigured(config) {
  return Boolean(config?.org) && /^[a-z][a-z0-9_]{0,30}$/.test(config.org);
}

function queue() {
  if (typeof window === 'undefined') return null;
  if (!window.mk) {
    const q = function mk(...args) {
      (q.q = q.q || []).push(args);
    };
    window.mk = q;
  }
  return window.mk;
}

export function loadScript(config, nonce, internal) {
  if (!isConfigured(config) || typeof document === 'undefined') return;
  if (document.querySelector('script[data-mukala-pixel]')) return;
  if (internal) {
    try {
      window.sessionStorage.setItem('mk_t', '1');
    } catch {
      /* storage blocked: the visit is simply not marked as test */
    }
  }
  queue();
  const script = document.createElement('script');
  script.src = SRC;
  script.defer = true;
  script.dataset.org = config.org;
  script.dataset.mukalaPixel = '1';
  if (nonce) script.nonce = nonce;
  document.head.appendChild(script);
}

const MAP = {add_to_cart: 'signup_started', begin_checkout: 'signup_completed'};

export function send(event, config) {
  if (!isConfigured(config) || !event) return;
  const mk = queue();
  if (!mk) return;
  if (event.name === 'page_view') {
    if (firstPageView) {
      firstPageView = false; // mk.js already sent this one when it loaded
      return;
    }
    mk('page_view');
    return;
  }
  const name = MAP[event.name];
  if (name) mk(name);
}
