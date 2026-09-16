# Product feeds

One catalogue, three serialisations, one source of truth.

| Channel | URL | Format | Spec |
|---|---|---|---|
| Google Merchant Center | `/feed.xml` | RSS 2.0 + `g:` namespace | [Google product data spec](https://support.google.com/merchants/answer/7052112) |
| X Shopping | `/feed.csv` | CSV | [X shopping specs](https://business.x.com/en/help/shopping-specs.html) |
| Pinterest | `/feed.pinterest.csv` | CSV | [Pinterest catalog spec](https://help.pinterest.com/en/business/article/before-you-get-started-with-catalogs) |

All three are generated live from the Storefront API. Nothing is uploaded by
hand and there is no build step.

## Why three files and not one

Because "they all accept the Google format" is false, and believing it cost a
full ingest cycle on 2026-09-16: X accepted `/feed.xml`, then failed **all 122
items**, reporting every one as missing a title, a description and a link, with
an invalid availability. The file was well formed. The vocabulary was wrong.

| | Google | X | Pinterest |
|---|---|---|---|
| availability | `in_stock` | `in stock` | `in stock` |
| field names | `g:` namespace | plain | plain |
| extra images | repeated element | comma separated | comma separated, quoted |
| `id` cap | 50 | 100 | 127 |
| `title` cap | none | 150 | 500 |
| `description` cap | 5,000 | 5,000 | 10,000 |
| `link` cap | none | none | 511 |

Pinterest is the least forgiving: a required field that is *"missing, or
formatted incorrectly"* fails **the entire catalog**, not the row.

## What is shared, and why that matters more than the formatting

`app/lib/productFeed.js` owns the parts that must never differ:

- `FEED_QUERY` — the product list
- `isIpRisky()` — the exclusion, by NAME not by status
- `feedId()` — the identifier

Each feed may format differently. None may disagree about **which products
exist** or **what they are called**. A channel advertising something the
storefront no longer sells is the failure that actually costs money, and a
second independently-derived product list is how you get there silently.

## The id is the checkout key

`feedId()` returns the numeric **variant** id, not the product id. Merchant
Center's checkout link template is `https://shop.streamwidgetshop.com/cart/{id}:1`
and `{id}` substitutes this value. Shopify's cart permalink needs a variant id.
Verified live:

```
/cart/8962515108030:1   (product id) -> 410 Gone
/cart/48854557589694:1  (variant id) -> 302 to checkout
```

**A feed id must never change once a channel has ingested it.** Changing it
orphans the old entry and creates a duplicate rather than updating anything.
When `g:id` moved from handle to product id, Merchant Center went from 122
products to 244 and the stale half could only be cleared by deleting and
re-adding the data source.

`/feed.xml` also emits `g:expiration_date` 25 days out, refreshed every fetch,
so a future orphan expires on its own instead of lingering for Google's
default 30 days after last sight.

## Prefer these over the Shopify sales channels

Every channel here also has a Shopify sales-channel app that can sync the
catalogue itself. Use the feed instead, and do not run both.

- **Both at once produces duplicates.** Merchant Center held 246 products for a
  122-product catalogue because two primary sources both claimed it.
- **The channels drift, silently.** X: 124 products published to the channel,
  13 actually delivered. Pinterest: 98 published, most with an epoch
  `publishDate`.
- **The channels do not apply the IP exclusion.** Products named after someone
  else's property reach the ad network, and those complaints land at the
  account level.
- **Freshness is not an argument.** Pinterest ingests once per 24 hours and does
  not support on-demand ingestion, so a live connector is no fresher than a
  daily feed.

## Verifying

```bash
npm run verify:feed           # Google
npm run verify:feed:csv       # X
npm run verify:feed:pinterest # Pinterest
npm run verify:all            # all of the above, plus the rest of channel health
```

Every one of these asserts **accepted values**, never merely populated fields.
That distinction is the whole lesson: the feed that failed 122 of 122 on X had
every required field present.

Each verifier has been proved to fail. Reverting availability to Google's
`in_stock`, or breaking CSV quoting, or emitting a bare handle as a link, each
turns the relevant one red. A check that has never failed proves nothing.

## Adding a channel

1. Read that channel's published spec. Do not assume it matches one of these.
2. Add a builder to `app/lib/productFeedCsv.js` (or a new module for a non-CSV
   shape) that imports the query, the exclusion and the id from
   `productFeed.js`.
3. Add a route under `app/routes/[feed.<channel>.<ext>].jsx`.
4. Write a verifier asserting that channel's accepted values and caps, then
   deliberately break the builder to prove the verifier catches it.
5. Register it in `package.json` and `scripts/verify-all.mjs`.
6. Add a row to the table at the top of this file.
