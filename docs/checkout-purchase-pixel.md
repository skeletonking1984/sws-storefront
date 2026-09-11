# Checkout purchase pixel (GA4, custom pixel)

This is a paste-ready artifact only. Nothing in this file has been sent to
Shopify. Todd creates the pixel himself in Admin.

## 1. Research findings

### Finding 1: checkout_completed payload shape

Source: [shopify.dev, checkout_completed](https://shopify.dev/docs/api/web-pixels-api/standard-events/checkout_completed)

All fields live under `event.data.checkout`:

| Data | Field path |
|---|---|
| Order id | `checkout.order.id` (null on every event except `checkout_completed`) |
| Checkout token | `checkout.token` |
| Total | `checkout.totalPrice.amount`, `checkout.totalPrice.currencyCode` |
| Subtotal | `checkout.subtotalPrice.amount` |
| Tax | `checkout.totalTax.amount` |
| Discount total | `checkout.discountsAmount.amount` |
| Discount codes/list | `checkout.discountApplications[]` |
| Shipping | `checkout.shippingLine.price.amount`, `.currencyCode` |
| Line items | `checkout.lineItems[]` |
| Line item id | `lineItems[].id` |
| Line item title | `lineItems[].title` |
| Line item quantity | `lineItems[].quantity` |
| Line item variant id | `lineItems[].variant.id` |
| Line item product id | `lineItems[].variant.product.id` |
| Line item price | `lineItems[].variant.price.amount`, `.currencyCode` |

### Finding 2: what a custom pixel sandbox can and cannot do

Sources: [Web Pixels API overview](https://shopify.dev/docs/api/web-pixels-api), [pixel privacy / customerPrivacy](https://shopify.dev/docs/api/web-pixels-api/pixel-privacy), [Shopify community, cookies in pixel sandbox](https://community.shopify.dev/t/cookies-in-pixel-sandbox/17038), [Shopify help, custom pixel document.cookie thread](https://community.shopify.com/t/using-document-cookie-in-custom-web-pixel-environment/284305/4), [Shopify help, GTM custom pixel tutorial](https://help.shopify.com/en/manual/promoting-marketing/pixels/custom-pixels/gtm-tutorial)

- An Admin-created custom pixel (not an app extension) runs in a "lax" sandbox and gets four globals: `analytics`, `browser`, `init`, `customerPrivacy`. There is no `settings` global, that one is app-extension only.
- `fetch` is available and is Shopify's own documented way to send pixel data out.
- `document.cookie` does not work reliably in this sandbox, it returns `undefined` or a stale proxy. The documented, working path is `browser.cookie.get(name)` / `browser.cookie.set(...)`, and same for `browser.localStorage` / `browser.sessionStorage`. These methods run against the top frame and are async (they return promises), so every call needs `await`.
- Script injection is technically possible in this sandbox. Shopify's own official GTM tutorial injects `gtm.js` via `document.createElement('script')` inside a custom pixel. So "can it load gtag.js" is technically yes.
- The sandbox is same-origin with whatever page the pixel is attached to, which for `checkout_completed` is the checkout / order-status page's own origin, not the storefront's origin. That is the seed of finding 4 below.

### Finding 3: Measurement Protocol vs injected gtag

Source: [GA4 Measurement Protocol reference](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag)

Measurement Protocol via `fetch` is the right call here, not an injected `gtag.js`. This is one event fired once, on a page we do not otherwise control, in a sandbox that already gives us `fetch` as first-class. Loading a full analytics library adds script-load timing risk (the thank-you page can navigate away before `gtm.js` finishes loading) and no benefit, since we are not doing page views or remarketing tags here, only one server-bound event. A direct POST to `https://www.google-analytics.com/mp/collect` is deterministic: it either lands or it does not, no dependency on Google's script finishing to load inside someone else's sandboxed frame. Shopify's own custom-pixel examples also favor a direct `fetch` call over loading a client library, for the same reason.

### Finding 4: the attribution question (read this one)

Sources: measured directly against the live Storefront API on 2026-09-10, plus [Hydrogen headless analytics consent](https://shopify.dev/docs/storefronts/headless/hydrogen/analytics/consent) and this repo's `app/root.jsx:124`.

**Corrected again 2026-09-11, after the cutover. Checkout is NOT on streamwidgetshop.com any more.**
Measured immediately after the domain was retargeted to Hydrogen:

    checkoutUrl host: 72470e-33.myshopify.com

Retargeting the apex to the Hydrogen storefront left the Online Store with no brand domain, and
checkout is Online-Store-served, so it fell back to the raw myshopify host. The same happened to the
Digital Products download page, which now serves from `72470e-33.myshopify.com/a/downloads/...` in
the old Energy theme.

Two consequences, both real:

1. The buyer changes domain at the payment step, to a host that looks nothing like the shop.
2. `_ga` is set on `streamwidgetshop.com` and is NOT readable on `72470e-33.myshopify.com`, so the
   `checkout_completed` pixel below cannot recover the client id and every paid conversion lands
   unattributed. That is the exact failure an earlier draft of this doc predicted for the wrong
   reason and this one now has for the right one.

`PUBLIC_CHECKOUT_DOMAIN` does not fix this. It only feeds the Customer Privacy API through
`Analytics.Provider` (`app/root.jsx`, `app/entry.server.jsx`); it does not decide where checkout is
served.

The fix is the pattern Shopify documents for headless: keep a SUBDOMAIN on the Online Store.
Settings > Domains > the ⋯ on `streamwidgetshop.com` > Add subdomain, then Change target on that
subdomain to Online Store and set it as the Online Store's primary. Checkout and the download proxy
then serve from that subdomain, which shares a registrable domain with the storefront, so the cookie
is readable and the buyer never leaves the brand.

Re-measure with the cart probe before trusting any of this again.

**Corrected 2026-09-10.** An earlier draft of this section concluded that checkout runs on a different registrable domain and that paid conversions would land unattributed. That was wrong. It was inferred from `PUBLIC_CHECKOUT_DOMAIN` being unset in `.env`, not from the checkout URL itself. The env var is genuinely unset, but that does not decide where checkout is served.

Measured instead: a real cart was created through the Storefront API and its `checkoutUrl` read back. It is

```
https://streamwidgetshop.com/cart/c/<token>?key=...
```

Host `streamwidgetshop.com`. That is the same registrable domain the storefront is served from, so `_ga` (written by `gtag.js` with the default `auto` cookie domain, which scopes it to `.streamwidgetshop.com`) is in scope on the checkout page and `browser.cookie.get('_ga')` can read it.

**Consequence:** the purchase event can carry the same `client_id` as the browsing session that led to it, so GA4 campaign attribution and ROAS by campaign will work. No cart-attribute relay is needed.

Two conditions this depends on, both worth confirming rather than assuming:

1. It holds once the storefront itself is served from `streamwidgetshop.com`, that is after the DNS cutover. Before then the Hydrogen build is on an `o2.myshopify.dev` host, `_ga` is written there, and checkout on `streamwidgetshop.com` cannot see it. **Verify attribution after cutover, not before, or the test will fail for a reason that will not exist in production.**
2. `PUBLIC_CHECKOUT_DOMAIN` is still unset, which is a real and separate gap. Hydrogen passes it to `Analytics.Provider` for the Customer Privacy API. Set it to `streamwidgetshop.com` in the Hydrogen environment variables alongside `PUBLIC_GA4_MEASUREMENT_ID`, or consent handling stays half wired even though attribution works.

**If the cookie is ever absent anyway** (a first-party cookie blocked, a privacy setting, a buyer who lands straight on checkout), the shipped code below falls back to a freshly generated `client_id` so the purchase still lands in GA4 with correct revenue rather than being dropped. That fallback is a safety net, not the expected path.

## 2. The pixel code

Paste this into Shopify Admin > Settings > Customer events > Add custom pixel.
Fill in `GA4_API_SECRET` before saving (see "Values to fill in" below). The
X block stays commented out until Auny supplies real IDs on Linear BAT-145.

```javascript
// GA4 purchase pixel for checkout_completed.
// Fill in GA4_API_SECRET below (Admin > Data Streams > your stream >
// Measurement Protocol API secrets > Create).
const GA4_MEASUREMENT_ID = 'G-X0978HDVTK';
const GA4_API_SECRET = ''; // TODO Todd: paste the Measurement Protocol secret here

analytics.subscribe('checkout_completed', async (event) => {
  const checkout = event.data && event.data.checkout;
  if (!checkout || !checkout.order) return;

  const orderId = String(checkout.order.id);

  // Respect consent. If the customer opted out of analytics, do nothing.
  const privacy = init && init.customerPrivacy;
  if (privacy && privacy.analyticsProcessingAllowed === false) return;

  // Idempotency: refreshing the thank-you page re-fires checkout_completed.
  // Guard per browser session against sending the same order twice. This
  // is a client-side guard only, there is no server-side dedup available
  // from inside the pixel. GA4 also drops exact duplicate hits under most
  // conditions as a second line of defense, but do not rely on that alone.
  const dedupeKey = 'ga4_purchase_sent_' + orderId;
  const alreadySent = await browser.sessionStorage.getItem(dedupeKey);
  if (alreadySent) return;

  if (!GA4_API_SECRET) return; // not configured yet, stay silent

  // client_id: try the _ga cookie so this purchase joins the same GA4
  // session as the on-site browsing. On this store, checkout does not run
  // on a subdomain of streamwidgetshop.com (no PUBLIC_CHECKOUT_DOMAIN is
  // set), so this read will very likely come back empty. See the
  // "attribution finding" section of this doc, this is a known gap, not a
  // bug in this code. Falling back to a fresh id keeps the purchase in
  // GA4 with correct revenue, marked unattributed, instead of dropping it.
  let clientId;
  try {
    const gaCookie = await browser.cookie.get('_ga');
    if (gaCookie) {
      const parts = gaCookie.split('.');
      if (parts.length >= 4) {
        clientId = parts[2] + '.' + parts[3];
      }
    }
  } catch (e) {
    clientId = undefined;
  }
  if (!clientId) {
    clientId = String(Date.now()) + '.' + String(Math.floor(Math.random() * 1e10));
  }

  const items = (checkout.lineItems || []).map(function (li) {
    const variant = li.variant || {};
    const product = variant.product || {};
    const price = variant.price || {};
    return {
      item_id: product.id,
      item_variant: variant.id,
      item_name: li.title,
      price: price.amount !== undefined ? Number(price.amount) : undefined,
      quantity: li.quantity,
    };
  });

  const total = checkout.totalPrice || {};
  const tax = checkout.totalTax || {};
  const shippingLine = checkout.shippingLine || {};
  const shippingPrice = shippingLine.price || {};

  const payload = {
    client_id: clientId,
    events: [
      {
        name: 'purchase',
        params: {
          transaction_id: orderId,
          value: total.amount !== undefined ? Number(total.amount) : undefined,
          currency: total.currencyCode || checkout.currencyCode,
          tax: tax.amount !== undefined ? Number(tax.amount) : 0,
          shipping: shippingPrice.amount !== undefined ? Number(shippingPrice.amount) : 0,
          items: items,
        },
      },
    ],
  };

  try {
    await fetch(
      'https://www.google-analytics.com/mp/collect?measurement_id=' +
        GA4_MEASUREMENT_ID +
        '&api_secret=' +
        GA4_API_SECRET,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    await browser.sessionStorage.setItem(dedupeKey, '1');
  } catch (e) {
    // Do not block or break the thank-you page on a tracking failure.
  }

  // -------------------------------------------------------------------
  // X (Twitter) Purchase event. DISABLED until Auny supplies the real
  // pixel id and Purchase event id on Linear BAT-145. Do not turn this on
  // with a placeholder id, a wrong id reports zero conversions silently.
  // Format confirmed against X's own docs:
  // https://business.x.com/en/help/campaign-measurement-and-analytics/conversion-tracking-for-websites
  //
  // const X_PIXEL_ID = ''; // from Auny, BAT-145
  // const X_PURCHASE_EVENT_ID = ''; // from Auny, BAT-145
  // if (X_PIXEL_ID && X_PURCHASE_EVENT_ID && (!privacy || privacy.marketingAllowed !== false)) {
  //   await new Promise(function (resolve) {
  //     const s = document.createElement('script');
  //     s.src = 'https://static.ads-twitter.com/uwt.js';
  //     s.onload = resolve;
  //     s.onerror = resolve;
  //     document.head.appendChild(s);
  //   });
  //   if (typeof twq === 'function') {
  //     twq('event', 'tw-' + X_PIXEL_ID + '-' + X_PURCHASE_EVENT_ID, {
  //       value: payload.events[0].params.value,
  //       currency: payload.events[0].params.currency,
  //       conversion_id: orderId, // dedup key, per X's own docs
  //       contents: items.map(function (i) {
  //         return {
  //           content_id: i.item_id,
  //           content_name: i.item_name,
  //           content_price: i.price,
  //           num_items: i.quantity,
  //         };
  //       }),
  //     });
  //   }
  // }
});
```

## 3. Values Todd must fill in

- `GA4_API_SECRET`: GA4 Admin > Data Streams > the SpaceLabs - Shopify stream (measurement id `G-X0978HDVTK`) > Measurement Protocol API secrets > Create. Paste the generated secret into the constant at the top of the code block. Source: [GA4 Measurement Protocol reference](https://developers.google.com/analytics/devguides/collection/protocol/ga4/reference?client_type=gtag).
- `X_PIXEL_ID` and `X_PURCHASE_EVENT_ID`: from Auny, tracked on Linear BAT-145. Do not enable the commented block until both are real.

## 4. Click path to create the pixel, and how to verify it

**Create:**
1. Shopify Admin > Settings > Customer events.
2. Add custom pixel, name it something like "GA4 purchase (checkout_completed)".
3. Paste the code from section 2, with `GA4_API_SECRET` filled in.
4. Save, then set the pixel to Connected.

**Verify, after one real test order:**
1. GA4 Admin > DebugView (or open the property with a debug session active): place a real test order, then watch for a `purchase` event to appear within roughly a minute, with `transaction_id` matching the Shopify order number and `value`/`currency`/`items` matching the order.
2. GA4 Realtime report: confirm the purchase event count increments and event count by event name shows `purchase`.
3. Refresh the thank-you page once after the order completes and confirm a second `purchase` hit does NOT fire, that is the `sessionStorage` idempotency guard working.
4. Check the `client_id` GA4 assigned the event in DebugView. It should match the client_id of the browsing session that placed the order, so the purchase joins that user's earlier `page_view` and `add_to_cart` hits. If it comes back as a brand-new user with no prior session, the `_ga` cookie was not readable, see section 1, finding 4. Run this check only AFTER the DNS cutover, because before then the storefront and checkout are on different hosts and it will fail for a reason that will not exist in production.

## 5. Attribution, short version

Purchases land in GA4 with correct revenue AND join the session that drove them, so campaign-level ROAS is trustworthy. Checkout is served from `streamwidgetshop.com`, the same registrable domain as the storefront, so the `_ga` cookie is readable at `checkout_completed` and the purchase carries the right `client_id`. Verified by reading a real cart's `checkoutUrl` on 2026-09-10.

Two caveats, neither of them a blocker:

- This is only true once the storefront is served from `streamwidgetshop.com`. Test attribution after the DNS cutover, not before.
- `PUBLIC_CHECKOUT_DOMAIN` is unset and should be set to `streamwidgetshop.com` for the Customer Privacy API. It does not affect attribution, but it leaves consent handling half wired.

---

## ADDENDUM 2026-09-11: use gtag, not Measurement Protocol

The Measurement Protocol recommendation above was written when checkout sat on a
host that did not share a registrable domain with the storefront. That is no
longer true, and it flips the decision.

Measured on 2026-09-11 by building a real cart against the Storefront API:

    checkout host   : shop.streamwidgetshop.com
    storefront host : streamwidgetshop.com
    same registrable domain: yes

Two consequences:

1. **The `_ga` cookie is readable at checkout.** gtag's default `cookie_domain:
   'auto'` resolves to `streamwidgetshop.com`, so the client_id set on the
   storefront carries straight through to the purchase event. Campaign
   attribution works with no relay.
2. **No API secret is needed.** Measurement Protocol would require a GA4
   Measurement Protocol API secret AND manually reading the client_id out of the
   `_ga` cookie through the async `browser.cookie.get`, then parsing it. gtag
   does both natively. Fewer moving parts, and nothing to generate.

The timing objection in Finding 3 is real but mitigated: `gtag()` calls push onto
`window.dataLayer` immediately and are replayed when `gtag.js` finishes loading,
so an event fired before the script lands is still queued, not lost. The residual
risk is a buyer closing the tab within the second or so before the script loads.
If that ever proves material, add the Measurement Protocol POST as a second,
belt-and-braces send, but do NOT send both to the same measurement id without
deduplicating on `transaction_id`, or every order counts twice.

### Paste this into Admin > Settings > Customer events > Add custom pixel

Permission: "Analytics". Name it `GA4 purchase`.

```js
const GA4_ID = 'G-X0978HDVTK';

// cookie_domain 'auto' resolves to streamwidgetshop.com, the registrable domain
// shared with the storefront, so the existing _ga client_id carries over and the
// sale is attributed to the campaign that produced it.
const s = document.createElement('script');
s.async = true;
s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_ID;
document.head.appendChild(s);

window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
gtag('js', new Date());
// send_page_view false: this pixel exists only to report the purchase. The
// storefront already reports page views and never sends purchase, so nothing
// double counts.
gtag('config', GA4_ID, { send_page_view: false });

analytics.subscribe('checkout_completed', (event) => {
  const c = event.data && event.data.checkout;
  if (!c || !c.totalPrice) return;

  const items = (c.lineItems || []).map((li, i) => {
    const variant = li.variant || {};
    const product = variant.product || {};
    return {
      item_id: product.id ? String(product.id) : String(li.id),
      item_name: li.title,
      item_variant: variant.id ? String(variant.id) : undefined,
      price: variant.price ? Number(variant.price.amount) : undefined,
      quantity: li.quantity,
      index: i,
    };
  });

  const coupon = (c.discountApplications || [])
    .map((d) => d.title || d.code)
    .filter(Boolean)
    .join(', ');

  gtag('event', 'purchase', {
    // order.id is populated only on checkout_completed. Falling back to the
    // checkout token keeps the event deduplicable if it ever arrives null.
    transaction_id: c.order && c.order.id ? String(c.order.id) : c.token,
    value: Number(c.totalPrice.amount),
    currency: c.totalPrice.currencyCode,
    tax: c.totalTax ? Number(c.totalTax.amount) : undefined,
    shipping: c.shippingLine && c.shippingLine.price ? Number(c.shippingLine.price.amount) : 0,
    coupon: coupon || undefined,
    items,
  });
});
```

### How to confirm it works

1. Create a 100 percent off discount code, place a real order through the live
   storefront, and download the file.
2. GA4 > Reports > Realtime. The `purchase` event should appear within seconds.
   Realtime is the right surface: standard reports lag up to 24 hours and will
   look broken before they are.
3. Check the event carries `value`, `currency`, `transaction_id` and `items`.
4. Then GA4 > Reports > Monetisation > Ecommerce purchases the next day, which is
   the report that read 0 purchases and $0.00 on 2026-09-11.

A $0 order still fires `purchase` with `value: 0`, which proves the wiring even
though it moves no revenue.

## Server-side webhook + Admin custom pixel: do not run both unmanaged

A second, independent purchase path now exists: `app/routes/webhooks.orders.jsx`
receives Shopify's `orders/create` webhook and sends its own GA4 Measurement
Protocol `purchase` event. It exists because Shop Pay (shop.app checkout) is
documented to not reliably fire `checkout_completed` for guest/Shop Pay
fast-path checkouts, which the Admin custom pixel above depends on entirely.

Once this webhook is live and registered in Shopify (`orders/create` topic
pointed at `/webhooks/orders` on the production domain, not done as part of
building the route, Todd registers it), the Admin custom pixel described
earlier in this doc MUST be DISCONNECTED. They must never both run against
the same GA4 measurement id at the same time. GA4 does not reliably dedupe
`purchase` events on `transaction_id` alone: real dedup needs either the
same `client_id` plus the same event within GA4's own dedup window, or
manual filtering after the fact, and neither is guaranteed here.

Both paths already use the Shopify order id as `transaction_id`, so if
someone does run both briefly, at least the two hits collide on that field
for later manual cleanup and investigation. That is a fallback for spotting
the overlap, not a fix for it.
