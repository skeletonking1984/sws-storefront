/**
 * ChatGPT Ads (OpenAI) Measurement Pixel adapter.
 *
 * Spec read 2026-10-05: https://developers.openai.com/ads/measurement-pixel
 * Same shape as the other adapters (see registry.js): id, envKeys,
 * isConfigured, loadScript, send.
 *
 * Set PUBLIC_OPENAI_PIXEL_ID (Ads Manager, Conversions tab) to switch this
 * on. Until it is set this adapter is a complete no-op: isConfigured() is
 * false, so PixelBus.jsx never injects the script and never calls send.
 *
 * Loaded on every page, not only the landing page, on purpose: the pixel is
 * what captures the `oppref` click reference from the landing URL into a
 * first-party `__oppref` cookie, and it has to be running on the page the ad
 * click lands on.
 *
 * Consent: the SDK is injected only when Shopify's consent API (canTrack())
 * allows tracking, and then with `consent true`, never `consent false`
 * (that call deletes the click-reference cookie, see loadScript). A visitor
 * who declined never loads it and sends no measurement pings.
 *
 * Only ONE event is mapped: the commission inquiry lead (`generate_lead` with
 * method `custom-widgets`) becomes `lead_created`. The Stream Chat Lite
 * signup also emits generate_lead and is deliberately NOT sent here: it is
 * not an ad conversion for this campaign. No purchase mapping: checkout is
 * Shopify hosted, see app/lib/analytics/events.js.
 *
 * The browser and server (app/lib/conversions/openaiAds.server.js) copies of
 * the lead share `event.eventId` as the dedup id.
 *
 * CSP: script-src bzrcdn.openai.com, connect-src bzr.openai.com and
 * bzrcdn.openai.com, img-src bzr.openai.com (app/entry.server.jsx).
 */

export const id = 'openai';

export const envKeys = {
  pixelId: 'PUBLIC_OPENAI_PIXEL_ID',
};

const SDK_URL = 'https://bzrcdn.openai.com/sdk/oaiq.min.js';

let savedNonce;

/**
 * @param {{pixelId?: string}} config
 * @returns {boolean}
 */
export function isConfigured(config) {
  return Boolean(config?.pixelId);
}

/**
 * @param {{pixelId?: string}} config
 * @param {string} nonce
 * @param {boolean} [_internal] Unused, see PixelBus.jsx.
 * @param {boolean} [allowed] Shopify's canTrack() at mount time.
 *
 * The SDK is only injected once tracking is allowed, and it is initialised
 * with consent TRUE. It used to be injected on every visit with
 * `consent false` first, and per OpenAI's pixel docs `consent false` also
 * DELETES the `__oppref`/`__obref` cookies, so the ChatGPT click reference
 * was wiped on the landing page and every lead arrived unattributed
 * (measured live 2026-10-05: `?oppref=...` landing, Shopify canTrack true,
 * cookie jar held only `__oaiq_consent=false`). A visitor Shopify has not
 * cleared never loads the SDK at all; send() loads it on demand, and send()
 * is only ever called after canTrack() passes (PixelBus.jsx).
 */
export function loadScript(config, nonce, _internal, allowed) {
  if (nonce) savedNonce = nonce;
  if (allowed === true || shopifyAllows()) {
    inject(config, nonce);
    return;
  }
  waitForConsent(config);
}

/**
 * canTrack() is usually still false when PixelBus mounts, because Shopify's
 * Customer Privacy API loads after hydration, and PixelBus does not re-run
 * when it settles (measured live 2026-10-05 on `45831a3`: landing with
 * `?oppref=`, canTrack() true a few seconds later, SDK never injected). So
 * wait for it here: Shopify fires `visitorConsentCollected` on document when
 * a choice is made, and a short poll covers a visitor whose choice was
 * already stored (no event fires for them). Gives up after 15s, after which
 * send() still loads the SDK on a lead.
 */
let waiting = false;
function waitForConsent(config) {
  if (waiting || typeof document === 'undefined') return;
  waiting = true;
  let tries = 0;
  const check = () => {
    if (window.oaiq) return stop();
    if (shopifyAllows()) {
      inject(config);
      return stop();
    }
    tries += 1;
    if (tries >= 30) stop();
  };
  const timer = setInterval(check, 500);
  const onConsent = () => check();
  document.addEventListener('visitorConsentCollected', onConsent);
  function stop() {
    clearInterval(timer);
    document.removeEventListener('visitorConsentCollected', onConsent);
  }
}

function shopifyAllows() {
  try {
    return (
      typeof window !== 'undefined' &&
      window.Shopify?.customerPrivacy?.analyticsProcessingAllowed?.() === true
    );
  } catch {
    return false;
  }
}

function inject(config, nonce) {
  if (!isConfigured(config)) return;
  if (typeof document === 'undefined') return;
  if (nonce) savedNonce = nonce;
  if (window.oaiq) return;

  // The vendor snippet, with a nonce added so this app's CSP allows it.
  const q = function oaiq(...args) {
    q.q.push(args);
  };
  q.q = [];
  window.oaiq = q;

  const script = document.createElement('script');
  script.async = true;
  script.src = SDK_URL;
  if (savedNonce) script.nonce = savedNonce;
  document.head.appendChild(script);

  window.oaiq('consent', true);
  window.oaiq('init', {pixelId: config.pixelId});
}

/**
 * @param {object} event Normalized event, see app/lib/analytics/events.js.
 * @param {{pixelId?: string}} config
 */
export function send(event, config) {
  if (!isConfigured(config)) return;
  if (event.name !== 'generate_lead' || event.method !== 'custom-widgets')
    return;
  // Only reached after canTrack() passed, so loading here is consented.
  inject(config);
  if (typeof window.oaiq !== 'function') return;

  window.oaiq('consent', true);
  window.oaiq(
    'measure',
    'lead_created',
    {type: 'customer_action'},
    event.eventId ? {event_id: event.eventId} : undefined,
  );
}
