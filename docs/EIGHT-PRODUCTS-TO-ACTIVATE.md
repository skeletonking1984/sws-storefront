# Eight products, built and waiting on one step only Todd can do

Created 2026-09-17. Delete this file once all eight are ACTIVE.

## Why these eight exist

They were being promoted on X while **not being buyable on streamwidgetshop.com
at all**. Found while switching the Typefully queue from Etsy links to Shopify
links: 22 scheduled posts carry a product link and 9 of them had no Shopify
product to point at.

Three of the nine turned out to already exist, **ARCHIVED**, with every known
trap set wrong at once: priced $15.00 against Etsy's $14.99,
`requiresShipping: true` (the purchase blocker that hard blocks buyers outside
the delivery zones), no product type, no `works_with` metafield, published to
**no channel at all**, and a raw Etsy description. Five did not exist in any
form. The tenth, Sci-Fi Neon, is DRAFT for IP reasons and is deliberately left
alone.

## The one remaining step

**Every one of these is DRAFT because its downloadable file is not attached.**
The Digital Products connector cannot be reached from an agent session
(`test-digital-products-connection` returns "Could not authorize this store"),
so attaching the file is Todd's, in the app UI.

They are DRAFT rather than ACTIVE on purpose: **an active product with no file
takes a buyer's money and delivers nothing**, which is worse than not being
listed. Do not flip these to Active before the file is on.

## What to attach

Download each file from its own Etsy listing, then attach it to the matching
Shopify product in the Digital Products app.

| Shopify product | Etsy listing | File(s) to attach |
|---|---|---|
| Moon Glow Chat and Goal Widget | [4348428360](https://www.etsy.com/listing/4348428360) | `MoonStarChatCode.zip`, `streamelementsglowingmoongoalcode.zip`, `DecorationWebem.zip`, `chatboxandwebcam.zip`, `manuallychatGoalWidgetTutorial.pdf` |
| Skull Ghost Chat Widget | [4362041097](https://www.etsy.com/listing/4362041097) | `ChatCode.zip`, `ManuallySetupchatWidgetTutorial.pdf` |
| Spooky Neon Chat Widget | [4358908164](https://www.etsy.com/listing/4358908164) | `SpookyNeonChatStreamElementsCode.zip`, `ManuallySetupchatWidgetTutorial.pdf` |
| Spooky Mushroom Bar Goal Widget | [4498126600](https://www.etsy.com/listing/4498126600) | `HalloweenMashroomSpookySlideGoalWidgetCode.zip`, `ManuallySetupGoalWidgetTutorial.pdf` |
| Rosa Chick Multistream Chat Widget | [4563217939](https://www.etsy.com/listing/4563217939) | `RosaChic.zip` |
| Crystal Butterfly Goal Widget | [1771365068](https://www.etsy.com/listing/1771365068) | `DiamondButterflyStreamelements.zip`, `DiamondButterflyStreamlabs.zip`, `Bluecolordata.zip`, `ManuallySetupGoalWidgetTutorial.pdf` |
| Nature Potion Bottle Goal Widget | [1707804164](https://www.etsy.com/listing/1707804164) | `naturepotioncode.zip`, `ManuallySetupGoalWidgetTutorial.pdf` |
| Cyber Bear Chat Widget | [4511799721](https://www.etsy.com/listing/4511799721) | `cyberbearchatfile.zip`, `NeonchatandgoalManuallpdf.pdf` |

## After the files are on

1. Set each to **ACTIVE**.
2. **Publish each to `Stream Widget Shop Headless` and `SWS Storefront`.** A
   `publishablePublish` while the product is DRAFT does not stick
   (`resourcePublications` reads back empty), and without those two
   publications the Storefront API returns `null` and the page 404s. This is
   the trap already in CLAUDE.md.
3. Run `node scripts/etsy-to-shopify-link.mjs <listing_id>` for all eight. It
   reports `NOT LIVE` today and will hand back a real URL once they are live.
4. Swap those eight links in the Typefully queue. Until then the posts
   correctly keep their Etsy links.
5. Run `node scripts/audit-shipping.mjs` and `npm run audit:descriptions`.

## What is already done

Prices match Etsy exactly. `requiresShipping: false` and inventory untracked on
all eight. Product type, tags, SEO title and description set. Descriptions
written to `docs/COPY-STANDARD.md` from each listing's own body and real file
manifest, carrying the approved refund paragraph. Gallery images pulled from
the Etsy CDN, 5 to 9 per product. `custom.works_with` set from each listing's
own text, never from its keyword title:

| Product | works_with |
|---|---|
| Rosa Chick Multistream | Twitch, YouTube, Kick, TikTok, StreamElements, OBS |
| Crystal Butterfly Goal | Twitch, StreamElements, Streamlabs, OBS |
| The other six | Twitch, StreamElements, OBS |

Only Crystal Butterfly ships an actual Streamlabs build
(`DiamondButterflyStreamlabs.zip`), so only its copy claims a Streamlabs
version. Nature Potion Bottle's Etsy body mentions Streamlabs but ships no
Streamlabs file, so its copy says it installs through StreamElements and
merely displays in Streamlabs Desktop.

`data/etsy-video-map.json` carries all eight rows now, previously
`state: unmatched`, so reviews and demo videos can join through them too.
