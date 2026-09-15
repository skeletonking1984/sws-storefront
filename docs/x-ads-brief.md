# Running X ads to streamwidgetshop.com

Written 2026-09-15 for Auny, who is building the first campaigns that point at
the storefront rather than at Etsy. Everything below is verified live, not
planned.

## The short version

The site is instrumented and ready. Point ads at any page, optimise for the
**SWS Purchase** event, and there is nothing else to configure.

## 1. Which conversion event to optimise for

**`SWS Purchase`** — event ID **`tw-q7mwb-rf9yi`**, on pixel **`q7mwb`**.

Events manager listed a second Purchase event, `Shopify:72470e-33:PURCHASE`,
plus a duplicate page view and a duplicate checkout, all published by Shopify's X
sales channel onto the same pixel. **All three are now deleted, 2026-09-15.**

They mattered: for a while both Purchase events were live and recording, so one
order could be counted twice and the optimiser split its learning across the two.
Nobody switched them on, which was the real lesson. The sales channel activates
its own events, so an instruction not to enable something was never enough.

**Every event on this pixel is now ours**, and there is nothing left to avoid:

| Event | ID | How it is sent |
|---|---|---|
| `SWS PageView` | `tw-q7mwb-rf9ym` | browser |
| `SWS ViewContent` | `tw-q7mwb-rf9yv` | browser |
| `SWS AddToCart` | `tw-q7mwb-rf9yt` | browser |
| `SWS Checkout` | `tw-q7mwb-rfbdk` | browser |
| **`SWS Purchase`** | **`tw-q7mwb-rf9yi`** | **server side, Conversion API** |

**Optimise for `SWS Purchase`.** It is safe to do so now; an earlier version of
this brief told you not to, while the duplicate existed.

Two reasons ours are better than the sales channel's, both verified: our browser
events fall back to a same-origin relay when an ad blocker kills the pixel
script, and Purchase never touches the browser at all. Theirs were browser-only,
so Brave and uBlock silenced them entirely.

`SWS Checkout` also builds a **retargeting audience** of people who started
checkout and did not finish, which is the highest-intent pool on the account.

## 2. Click ID, and what NOT to worry about

**There is nothing to enable.** X generates `twclid` at ad click time and
appends it to the landing page URL automatically. An earlier draft of this
document said it was a campaign setting Auny had to switch on. That was wrong.

The one thing that CAN break it is a destination URL that passes through
something which strips query parameters, for example a third party tracking
link or a URL shortener. Point ads straight at a streamwidgetshop.com URL and
the parameter arrives.

Our own redirects are safe, tested: `http` to `https`, `www` to apex, and 301s
from older product URLs all preserve it.

Once the click id arrives, the storefront captures it on the landing request,
holds it in a first party cookie for 90 days, and attaches it to the order.
That whole chain is verified end to end on production.

## 3. Destination URLs

Any page works. Home, a collection, or a single product.

All redirect paths preserve the click ID, tested: `http` to `https`, `www` to
apex, and 301s from older product URLs. So you do not need to worry about
which form of the URL you use.

## 3b. The LINK CARD is the thing that matters

This is the failure mode most likely to waste the budget, and it is invisible
in Ads Manager because the campaign looks perfectly healthy.

A campaign can be pointed at this site while its **creative's link card still
points at Etsy**. The card is what people actually click. If it goes to Etsy,
the click leaves for a place where none of our tracking runs and where Etsy
reports no traffic source at all, so the sale is unattributable no matter how
well the campaign is configured.

**Worked example, a real post from 2026-08-20:**

> "2003 called. It wants your chat box back." Y2K Sticker Chat.
> 257,300 views, 207 likes.
> Card reads **"From etsy.com"**, button reads **"See it on Etsy"**.

A quarter of a million views and not one of them could ever be attributed to
the storefront, because the card sends them to Etsy.

So when building a campaign for this site, check the creative itself: the
image card's destination, and any link in the post body, must be a
`streamwidgetshop.com` URL. Not just the campaign's destination field.

Existing Etsy-linked posts are fine as they are. They are simply a different
channel with different, and much weaker, measurement.

## 4. What is already measured, with no work from you

| Event | How |
|---|---|
| Page views | browser pixel, live |
| Product views | browser pixel, live |
| Add to cart | browser pixel, live |
| Checkout started | browser pixel, `SWS Checkout` `tw-q7mwb-rfbdk` |
| **Purchase** | **server side, via the Conversion API** |

`SWS Checkout` replaced Shopify's `CHECKOUT_INITIATED`, which is now deleted.
Verified live on 2026-09-15: a real checkout click sent value $110.85 across 7
items, summing the whole cart rather than the first line.

Purchase is deliberately never sent from the browser. It comes from Shopify's
order webhook, so an ad blocker cannot hide a sale. X confirms this is working:
"Conversion API: Working, matching users via hashed email."

## 5. What attribution to expect, honestly

Two ways X can tie a sale back to an ad:

- **Click ID** (`twclid`). Strongest, and automatic, provided the destination
  URL is a direct link to this site.
- **Hashed email.** Works, and is confirmed matching real users, but only when
  the buyer checks out with the same email as their X account. Many will not.

Click id attribution starts working on its own the first time someone clicks
an ad pointed at this site and buys. Until then Ads Manager will keep showing
"Click ID tracking: Not detected", which is accurate rather than a fault: no
ad has sent anyone here yet. It cannot be faked either, which was tested.

## 6. The site is ready to receive paid traffic

This was not true a week ago. As of 2026-09-15, on a product page:
Performance 100, Accessibility 100, Best practices 100, SEO 100.

- Prices match the Etsy listings for the individual widgets, so there is no
  cheaper version of the same widget one click away. **Correction, 2026-09-15:
  this did not hold for the KITS, and one of them is now fixed.** Spooky Stream
  Kit was $39.99 here against $29.99 on Etsy, so our own Etsy shop was the
  cheaper click; Shopify was matched down to **$29.99** the same day, on Auny's
  call, and both channels now agree. Multistream Chat Widget Pack still runs the
  other way, $29.99 here against $48.38 on Etsy, which is the harmless
  direction. Celestial Stream Kit has no Etsy listing at all. **Safe to point
  ads at any kit.**
- Checkout works on phones, including narrow Android widths
- 788 real Etsy reviews render on the product pages, across 98 products
- Every product page carries a demo video where one exists

## 7. Existing campaigns

The three currently active campaigns do not send traffic here: 3,411 clicks in
the last 7 days produced 21 social sessions on the storefront. Leave them as
they are unless Todd says otherwise. Etsy exposes no traffic source data to
sellers at all, so the only way to attribute an Etsy sale is a per channel Etsy
promo code.

## Questions that need Todd, not Auny

- Rotating the connector token
- Anything touching `PRIVATE_*` environment variables
