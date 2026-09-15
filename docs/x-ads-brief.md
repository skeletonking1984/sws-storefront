# Running X ads to streamwidgetshop.com

Written 2026-09-15 for Auny, who is building the first campaigns that point at
the storefront rather than at Etsy. Everything below is verified live, not
planned.

## The short version

The site is instrumented and ready. Point ads at any page. Optimise for the
**SWS Purchase** event. Make sure **click ID tracking is on** for the campaign.

## 1. Which conversion event to optimise for

**`SWS Purchase`** — event ID **`tw-q7mwb-rf9yi`**, on pixel **`q7mwb`**.

Events manager lists a second Purchase event, `Shopify:72470e-33:PURCHASE`
(`tw-q7mwb-rfa3z`). **Do not use it and do not switch it on.** It was created
automatically by Shopify's X sales channel and nothing feeds it. If both are
live you get two competing purchase events on one pixel and the optimiser
splits across them, which looks fine in the UI and quietly wastes budget.

The `SWS` prefixed events are ours. The `Shopify:` prefixed ones are not.

## 2. Turn on click ID tracking

X only appends `?twclid=...` to the destination URL when click ID tracking is
enabled on the campaign. **Without it the ads land correctly and carry no
attribution, which looks identical to working.**

This matters because the storefront captures that click ID on the landing
request, keeps it for 90 days, and attaches it to the order. Verified end to
end on production: landing URL to cookie to cart to order to X.

If you are unsure whether it is on, the check is in Ads Manager under
Conversion Diagnostics: **"Click ID tracking"** goes from "Not detected" to
detected once a real ad click converts. It cannot be faked, which was tested.

## 3. Destination URLs

Any page works. Home, a collection, or a single product.

All redirect paths preserve the click ID, tested: `http` to `https`, `www` to
apex, and 301s from older product URLs. So you do not need to worry about
which form of the URL you use.

## 4. What is already measured, with no work from you

| Event | How |
|---|---|
| Page views | browser pixel, live |
| Product views | browser pixel, live |
| Add to cart | browser pixel, live |
| **Purchase** | **server side, via the Conversion API** |

Purchase is deliberately never sent from the browser. It comes from Shopify's
order webhook, so an ad blocker cannot hide a sale. X confirms this is working:
"Conversion API: Working, matching users via hashed email."

## 5. What attribution to expect, honestly

Two ways X can tie a sale back to an ad:

- **Click ID** (`twclid`). Strongest. Needs step 2 above.
- **Hashed email.** Works, and is confirmed matching real users, but only when
  the buyer checks out with the same email as their X account. Many will not.

So click ID tracking is the difference between most sales being attributed and
only some. It is worth getting right before spending much.

## 6. The site is ready to receive paid traffic

This was not true a week ago. As of 2026-09-15, on a product page:
Performance 100, Accessibility 100, Best practices 100, SEO 100.

- Prices match the Etsy listings, so there is no cheaper version of the same
  widget one click away
- Checkout works on phones, including narrow Android widths
- 794 real Etsy reviews render on the product pages
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
