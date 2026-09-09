# Shopify launch checklist (streamwidgetshop.com)

Daily iteration log. One pass per day until launched and selling. Owner: Claude (daily routine), approver: Todd.

## Baseline 2026-09-07
- Live domain still on old "Energy" Shopify theme. Hydrogen rebuild deployed to Oxygen prod URL, no DNS cutover.
- 90d: 1011 sessions, 14 add-to-cart, 13 reached checkout, 0 completed. 4 orders in 180d. Store does not convert.
- Catalog: 119 active, 87 archived. Many duplicates. 5/206 have video.
- Uncommitted work in repo: icon header, footer brand block, social links, description normalizer.

## Top 15 Etsy products (by revenue, Mar 1 to Sep 7 2026) that must be perfect on Shopify
| # | Etsy listing | Title | Rev |
|---|---|---|---|
| 1 | 4333471272 | Neon Animated Twitch Chat and Goal Widget | 2263 |
| 2 | 4536576701 | Multistream Chat Widget (Twitch, YouTube, Kick) | 1088 |
| 3 | 1790018033 | Animated Star Goal Widget (Celestial) | 911 |
| 4 | 4336740821 | Neon Moon Glow Chat Widget | 555 |
| 5 | 4543765531 | Y2K Sticker Chat Widget | 474 |
| 6 | 4551047317 | Animated Moon Jar Goal Widget | 454 |
| 7 | 4322617816 | Cosmic Galaxy Chat Widget | 334 |
| 8 | 4473894910 | Saber Neon Chat Widget | 327 |
| 9 | 4320003692 | Sakura Floral Chat Widget | 262 |
| 10 | 1707756402 | Moon Cloud Donation Goal Widget | 260 |
| 11 | 1797449100 | Love Skeleton Goal Widget | 255 |
| 12 | 4336744223 | Cloudy Moon Overlay | 246 |
| 13 | 4369470796 | Sakura Glassy Chat Widget | 218 |
| 14 | 1730461418 | Rabbit Goal Widget | 211 |
| 15 | 4539065835 | Neon Animated Multistream Chat Widget | 148 |
Also: Soul Blade overlay pack (4569882300, $29.99, new Sep 6) as the premium anchor.

## Checklist
### Catalog
- [ ] Top 15 mapped to Shopify products, ACTIVE, price = Etsy price, images = Etsy images, description normalized, in Top Widgets collection (sorted by revenue)
- [ ] Duplicates archived (keep one active per Etsy listing)
- [ ] Every active product: title, image, price, product type, Chat/Goal tag correct
- [ ] Digital download delivery verified end to end (order -> file)
### Storefront (Hydrogen)
- [x] Pending work committed + deployed
- [ ] Homepage sells: hero, top 15, social proof, one clear CTA
- [ ] PDP: video where available, platform badges, "what you get", FAQ
- [ ] Mobile QA
- [ ] Performance (LCP < 2.5s)
### SEO
- [x] Title/meta per product + collection (plus canonical, OG, Twitter card, JSON-LD)
- [x] Sitemap + robots verified
- [ ] Google Search Console + Merchant Center feed
### Branding
- [x] Wordmark, palette, favicon, OG image consistent with Etsy/X
### Conversion
- [x] Purchase path clean: no storefront product forces a shipping checkout, verify with `node scripts/audit-shipping.mjs` (fixed 9 products 2026-09-09)
- [ ] Checkout tested (real $ test order then refund) - verified in a browser up to the payment step, WELCOME10 applies, the actual charge still needs Todd
- [x] Email capture + welcome discount (WELCOME10, 10% off, all products, all customers, no end date)
- [ ] Pixels (X, Google) installed
- [ ] DNS cutover streamwidgetshop.com -> Hydrogen (Todd approves)

## Daily log
### 2026-09-07
- Baseline audit, checklist created, agents dispatched for catalog sync + storefront commit/deploy.

#### Catalog sync
- Mapped all 16 (top 15 + Soul Blade) Etsy listings to Shopify products. Mapping file: `data/etsy-shopify-map.json`.
- 8 matched to existing active Shopify products (updated title/price/description/images to match Etsy, no em dashes): Neon Animated Twitch Chat and Goal Widget, Neon Moon Glow Chat Widget, Cosmic Galaxy Chat Widget, Sakura Floral Chat Widget, Moon Cloud Donation Goal Widget, Love Skeleton Goal Widget, Cloudy Moon Overlay, Rabbit Goal Widget.
- 1 reactivated from an archived, zero-stock duplicate (no active version existed): Sakura Glassy Chat Widget.
- 7 had no Shopify product at all (mostly newer 2026 Etsy listings never imported) and were created new, ACTIVE, with Etsy images/price/description: Multistream Chat Widget, Animated Star Goal Widget (Celestial), Y2K Sticker Chat Widget, Animated Moon Jar Goal Widget, Saber Neon Chat Widget, Neon Animated Multistream Chat Widget, Demon Samurai (Soul Blade) Stream Overlay Pack.
- Set productType (Chat Widget / Goal Widget / Overlay Pack) and SEO title/meta description (<=60/<=155 chars) on all 16.
- Archived 5 confirmed zero-inventory duplicate products (kept the active/new one per Etsy listing). Never deleted anything.
- Added all 16 to "Top Widgets" collection and to "Chat Widget" or "Goal Widget" as appropriate; set Top Widgets to MANUAL sort in the LAUNCH.md revenue order (reorder queued as a Shopify background job).
- Inventory: all 16 products are purchasable (either untracked inventory on new/reactivated products, or existing positive stock on matched products).
- Could not verify: digital file delivery (order -> download) end to end - out of scope for a catalog-only pass, flagged for the "digital download delivery verified end to end" checklist item.
- Noted discrepancy: internal notes recorded Soul Blade at $29.99, but the live Etsy listing (4569882300) is currently priced at $15.99 - used the live Etsy price on Shopify.
- 3 listings (Animated Star Goal Widget, Multistream Chat Widget, Y2K Sticker/Moon Jar/Saber/Neon Multistream Chat Widgets) had no confident image/description match against similarly-themed existing Shopify products, so new products were created rather than risk mis-mapping a top-revenue item onto the wrong listing.

#### Storefront
- Reviewed uncommitted diff (header icon buttons, footer brand block, SocialLinks component, description normalizer). Build clean, lint has 15 pre-existing errors/5 warnings unrelated to this diff (unused vars, one unescaped entity, missing tsconfig.json), confirmed by diffing lint output against main before the changes.
- Commits: `56a1412` header icon buttons + footer brand block + SocialLinks; `c794396` description normalizer (app/lib/productDescription.js, scripts/normalize-descriptions.mjs) + CLAUDE.md quirk note.
- Preview deploy: https://01m1yc1q8nbcy2npcs27c2xh3e-fb73b5b73c40344d0d20.myshopify.dev (Oxygen preview auth-gated by default; needs `oxygen-auth-bypass-token` header to curl, token expires in ~2h from deploy time).
- Launch-readiness gaps found (prioritized):
  1. Every route ships the literal Hydrogen skeleton title (`Hydrogen | Home`, `Hydrogen | <product>`, etc, confirmed on homepage and a PDP) with zero branding. Files: `app/routes/_index.jsx`, `products.$handle.jsx`, `collections.$handle.jsx`, `collections.all.jsx`, `blogs.*.jsx`, `pages.$handle.jsx`, `cart.jsx`, `search.jsx`, `policies.$handle.jsx`.
  2. No `<meta name="description">` on any page (home or PDP checked, none anywhere in `app/routes/`). Same files as above.
  3. No Open Graph or Twitter Card tags anywhere in the app, no shared SEO helper exists at all (grepped for `og:`, `getSeoMeta`, found nothing). Same route files, needs a shared `seo.js` helper.
  4. No canonical `<link>` tag on any page, risk of duplicate-content indexing once DNS cuts over. Add to `app/root.jsx` or the SEO helper.
  5. No JSON-LD Product structured data on PDP (checked `sci-fi-neon-chat-widget-kick-twitch-obs`, no `application/ld+json` anywhere). `app/routes/products.$handle.jsx`.
  6. Favicon is still the default Hydrogen "H" mark, not SWS's holographic lighthouse logo. `app/assets/favicon.svg`.
  7. No og:image / social share image site-wide, links shared to X/Discord show no thumbnail. Needs a static OG image referenced from the SEO helper.
  - Not a code gap, just a note: Oxygen preview URLs are auth-gated by default (Shopify OAuth redirect), expected preview behavior, not present on production/custom domains.
  - robots.txt and sitemap.xml are correct and self-referencing the current host already (no myshopify.com hardcoding found anywhere in `app/`), no action needed there.

#### Blockers found 2026-09-07 (need Todd)
- **Digital delivery**: Shopify Digital Products app IS installed (first-party, not visible via appInstallations API; no public API, files attach manually in Admin). 8 of the 16 top products created/reactivated today have no asset: Multistream Chat (PastelMultistreamchat.zip), Star Goal (streamelements.zip, StarGoalWidgetStreamlabs.zip, 2 PDFs), Y2K Sticker (Y2KMultiChatCode.zip + PDF), Moon Jar (MoontipjarFixedStreamelements.zip), Saber Neon (NeonChatandGoalCodefile.zip + PDF), Neon Multistream (MultistreamChatWidget-Final.zip + PDF), Soul Blade (SoulBladeOverlayPack.zip), Sakura Glassy (SakuraGlassyChatWidget.zip + PDF). Todd/Auny upload from Etsy listing manager.
- Soul Blade Etsy price is 15.99 live (memory said 29.99). Shopify set to 15.99 to match. Confirm intended price.
- Create discount code WELCOME10 for the homepage email capture.

#### Redesign
Rebuilt the storefront's visual design per `DESIGN.md` on branch `redesign/sticker-brand`, merged to main. Site now looks like the SWS logo (chunky holographic sticker on deep space purple) instead of the Hydrogen skeleton.

Shipped:
- **Tokens/fonts**: new `:root` palette (deep purple bg, 5-stop holo gradient, cream/ink sticker chrome), Baloo 2 + Nunito loaded from Google Fonts, aurora + twinkling-star body atmosphere (CSS only, respects `prefers-reduced-motion`), a reusable sticker button/chip/glass-card system (`.sws-btn-primary`, `.sws-btn-ghost`, `.sws-chip`, `.sws-glass-card`).
- **Header/footer**: glass-blur sticky header with a holo bottom border, 44px logo lockup, pill nav; footer gets an "Also on Etsy" link. Header brand text now hides below 30em so the icon row doesn't get crushed on small phones.
- **Homepage**, all 9 sections from DESIGN.md: full-height hero with a real chat+goal widget composite over a mock stream frame, "Shop by vibe" sticker chips linking into `/collections/all?q=`, "Top widgets" (queries a `top-widgets` collection, falls back to the curated fan-favorites list if that collection doesn't exist yet), a "Works with" platform strip, 3 real Etsy reviews as chat bubbles, a cream sticker commission panel, and a real email capture posting to Shopify's customer form endpoint.
- **PDP**: glass buy panel, price pill, "instant download, works with" + "what you get" labels, sticker Add to Cart with a fixed bottom bar on mobile, a real FAQ accordion (reused from the live FAQ page), and a "More Chat/Goal widgets" related section.
- **Collections/cart/search**: sticker filter chips, glass product cards everywhere, a logo-based empty state on both collection routes, glass-blur cart drawer and search aside, sticker checkout button.
- **Titles/meta**: every route now renders a real title (`<Thing> | Stream Widget Shop`) and, on the highest-traffic pages, a real meta description. No `Hydrogen | ` string remains in `app/`. `MockShopNotice` component deleted (was already unused going into this pass).
- **Real bug fix along the way**: found that CLAUDE.md's documented image-cropping fix (drop the `aspectRatio` prop) doesn't actually stop Hydrogen's `<Image>` from center-cropping, because it auto-derives an aspect ratio from `data.width`/`data.height` even with no prop set, so `crop=center` still applied server-side. Fixed properly by dropping `width`/`height` from the featuredImage/media GraphQL fragments feeding card art (home, collections, PDP gallery), so the CDN only scales by width and never crops non-square art.

Verified: `npm run build` clean; home, a real PDP (`neon-aesthetic-glowy-...`), `/collections/all`, `/cart`, `/search`, and a policy page all return 200 with correct titles; desktop (1440x900) and mobile (390x844) screenshots reviewed for home, PDP, and collection.

Left for a follow-up pass (not done here, out of strict visual-redesign scope or blocked on an asset):
- Favicon is still the default Hydrogen mark, not the SWS lighthouse logo (needs a proper SVG export, a design asset task not a CSS one).
- No Open Graph / Twitter Card tags or a shared SEO helper site-wide (per-page `<meta name="description">` exists now, OG/Twitter don't).
- No JSON-LD Product structured data on PDP.
- "Shop by vibe" chips ship text-only; DESIGN.md asked for a "tiny emoji-free icon" per chip, skipped for scope/time.
- Home reviews render as "Verified buyer" rather than a first name. DESIGN.md asked for "the reviewer's first name" but no real reviewer names exist anywhere in this codebase's data (checked `EtsyReviews.jsx` and the wider repo); inventing one would violate the no-fake-social-proof rule, so it's labeled honestly instead.
- WELCOME10 discount code still needs creating in Admin (same open item as the catalog-sync blocker above) for the new email capture's promised 10% off to actually work.
- `collections._index.jsx` (the collection *directory*, not `/collections/all`) still uses `aspectRatio="1/1"` on its tile images; DESIGN.md's collections section is about the all/`$handle` results pages, so this was left alone, but it's the same crop pattern if it ever needs fixing.

#### Categories 2026-09-07
- product_type set on 112 active products (Goal Widget 91, Chat Widget 33, Overlay Pack 2, Emotes 1, Bundle 0). Map: data/product-types.json.
- Smart collections: widgets (124), overlays (2), bundles (0, empty until the Spooky Stream Kit / Multistream Chat Pack are listed on Shopify with product_type Bundle). Chat Widget + Goal Widget converted to smart on product_type. All published to Online Store, Headless, SWS Storefront.
- Main menu rebuilt: Widgets (Chat, Goal, Top) / Overlays / Bundles / Creator Hub / How it works / FAQ / Contact. Header renders top level only; dropdown for the Widgets children is a follow-up.
- TODO: list the two bundles on Shopify (products/bundles/*) so Bundles is not empty at launch.

#### Hero 2026-09-07 (evening)
- AI hero concepts rejected by Todd. Hero now a composite of REAL widgets rendered via showcase capture-raw.mjs (neon chat + goal, moon jar, star bar, Y2K chat), hero/hero.html + compose.mjs, output app/assets/hero-widgets.webp. Nits left: star bar overlaps jar lid, chat could be larger.
- Categories + menu shipped (see above). Header nav picks up the Shopify menu after a dev restart (CacheLong on header query).
- Next: SEO helper (meta/OG/canonical/JSON-LD/favicon), list bundles on Shopify, Widgets dropdown in header, attach 8 missing digital files (Todd).

#### Bundles on Shopify
- All 3 bundles created ACTIVE with productType Bundle, priced/tagged/described per spec, and published to Online Store, Stream Widget Shop Headless, and SWS Storefront. Bundles smart collection is no longer empty.
- spooky-stream-kit -> products/bundles/01-spooky-stream-kit/upload/Spooky-Stream-Kit.zip
- celestial-stream-kit -> products/bundles/02-celestial-stream-kit/upload/Celestial-Stream-Kit.zip, products/bundles/02-celestial-stream-kit/upload/Celestial-Stream-Kit-Guides.zip, products/bundles/02-celestial-stream-kit/upload/Celestial-Stream-Kit-Decorations.zip
- multistream-chat-widget-pack -> products/bundles/03-multistream-chat-pack/upload/Multistream-Chat-Pack.zip
- Todd/Auny: attach the zip(s) above per product manually in Admin > Apps > Digital Products (no public API for this app).
- Resolved 2026-09-07: the duplicate-media issue above (two concurrent sessions writing the same 3 products) was cleaned up. Each product's second, unlabeled media batch was removed via `productDeleteMedia` (the first, correctly-ordered batch was kept, hero image still primary). Verified media counts now match spec exactly: Spooky 13 (12 images + 1 video), Celestial 14 (13 images + 1 video), Multistream 16 (15 images + 1 video). Titles and SEO title/description were also re-applied after a race let an earlier, shorter draft win; both are now the long spec titles and confirmed stable on re-query. Video processing status was READY for Spooky/Celestial and PROCESSING (async, expected) for Multistream at verification time.
- Copy corrected against the actual zips: Spooky = 8 widgets (3 chat incl. exclusive multistream, 5 goal, NO pumpkin decoration); Celestial = 10 (5 chat incl. exclusive, 4 goal, 1 scene overlay). Multistream = 10 skins, matched.
- Flag for Todd: Celestial image 13_one-click-install.jpg overstates (only 3 of 10 widgets have one-click links). Consider replacing or removing that image.
- 7 products created earlier today were only on Online Store; published to Headless + SWS Storefront (Hydrogen could not see them).

### 2026-09-08
Metrics (yesterday): 71 sessions, 1 add to cart, 0 reached checkout, 0 completed, 0 orders, $0 net sales. Conversion 0.0%.

Shipped:
- **WELCOME10 discount created** (10% off, all products, all customers, starts 2026-09-08, no end date, id `gid://shopify/DiscountCodeNode/2364045459646`). The homepage email capture has been promising 10% off since the redesign with no code behind it, so anyone who signed up and tried it hit an invalid-code wall at checkout. That is now real.
- **Shared SEO helper** `app/lib/seo.js` (`buildMeta` + `getOrigin`), wired into all 12 content routes plus `collections._index.jsx` and `policies._index.jsx` (which had no `meta` export at all). Emits canonical link, og:title/description/url/type/image/site_name/locale, twitter:card/title/description/image/site. `cart` and `search` and the four rendered account routes get `robots: noindex`. Blog articles use `type: article` and their own image.
- Origin resolution lives in the root loader: production domain when the request host is streamwidgetshop.com, otherwise the real request origin. Nothing hardcodes the myshopify.dev preview host. Routes read it off the root match via `getOrigin(matches)` rather than 12 loaders each computing it.
- **JSON-LD**: `Product` + `Offer` (real variant price, currency, availability, url) + `BreadcrumbList` on the PDP, `Organization` on the homepage with `sameAs` pulled from `SocialLinks.jsx`'s `SOCIALS` (single source, not a second hardcoded copy). No `aggregateRating`, no invented review data.
- **Real favicon**: the default Hydrogen "H" mark is gone. `app/assets/favicon.svg` is now a hand-authored SWS sticker lighthouse (holo tile, dark sticker outline, candy stripes, warm lamp), rasterized by `og/icons.mjs` to `favicon.png` (32) and `apple-touch-icon.png` (180), all three referenced from `root.jsx` `links()`. Checked legible at actual 32px.
- **Real OG share card** at `app/assets/og-image.jpg` (1200x630), replacing the placeholder. Built the Spooky Kit way per the no-AI-hero-art rule: the same real widget renders the homepage hero uses (neon chat+goal, moon jar) composited on the hand-built space background, with the holo wordmark, "Animated chat and goal widgets", and Twitch/YouTube/Kick/OBS chips. Source: `og/og.html` + `og/compose.mjs`, re-runnable.
- PDP prefers the product's own featured image for og:image at `?width=1200` (no `crop=center`, per the CLAUDE.md cropping quirk), falling back to the card.

Verified: `npm run build` clean. Dev server curl of home, a real PDP, `/collections/all`, `/cart`, `/search`: canonical + og:image + twitter:card present everywhere, `robots noindex` on cart/search, no `Hydrogen | ` string anywhere. All four icon/OG assets serve 200 with the right content types (og-image.jpg 122 KB, the real render not the placeholder). Both PDP JSON-LD blocks parse as valid JSON, Product offer reads price 18.99 USD InStock.

Preview deploy: https://01m220111d9vja40jh11thhc76-fb73b5b73c40344d0d20.myshopify.dev

Needs Todd:
- **Still the #1 blocker**: 8 of the top-16 products plus all 3 bundles have no digital file attached, so a purchase completes and delivers nothing. Manual upload in Admin > Apps > Digital Products (file list in the 2026-09-07 blockers section above). This is unfixable from here, there is no API.
- Google Search Console + Merchant Center need his account. Now worth doing since the pages finally have real meta and structured data.
- Soul Blade price still unconfirmed (Etsy live 15.99, notes said 29.99, Shopify matched to 15.99).

Next: Google Search Console + sitemap submission and the Merchant Center feed, or the Widgets dropdown in the header, whichever Todd prefers. Default is Search Console.

#### Navigation 2026-09-08 (evening)
Todd asked for a cooler menu and search, a mega menu with category images, easier searching, better navigation.

- **Collection art**: set real images on the 4 collections that had none or junk. Bundles got the Celestial Stream Kit hero, Overlays got Demon Samurai, Widgets got Neon Moon Glow, Top Widgets replaced a 200px favicon with the Neon Animated chat and goal art. Chat Widget and Goal Widget already had usable art. This also fixes the collections directory page.
- **Mega menu** (`app/components/Header.jsx`, new `app/lib/nav.js`): Widgets panel with image tiles (Chat 35, Goal 93, Top 31, All 124, real counts), Shop by vibe chips, Works with platform links, and a top seller card with live price. Overlays and kits panel with the overlay packs, bundles, and the 3 kits plus Soul Blade. Opens on hover with an intent delay, on click, and on focus. Escape closes and returns focus to the trigger. Panel membership is a code map with a plain link fallback, so a menu edit in Shopify Admin cannot blank the nav. Mobile aside is now an accordion with the same tiles and search pinned at the top.
- **Search command palette** (`app/components/PageLayout.jsx`, `SearchResultsPredictive.jsx`): replaces the raw Hydrogen skeleton (literal `<br />`, `&nbsp;`, a "Loading..." string). Opens on the search icon, `/`, and Cmd+K or Ctrl+K. Empty state carries popular search chips and a 6 tile Top widgets grid so it is useful before typing. Typing gives predictive results with thumbnails, 2 line clamped titles, and prices, with arrow key navigation and a shimmer loading state. `VIBES` and `WORKS_WITH_PLATFORMS` now live in `app/lib/nav.js` and are imported by both the homepage and the nav, no duplicate copies.

Six bugs were found by driving the real UI in a browser and fixed. The first build agent had no browser tools and correctly reported it could not verify rendering rather than claiming it had; the markup was right and only the rendered result was wrong.
1. Mega menu third column computed 939px wide with its right edge at 1567px against a 1425px viewport. Grid children had no `min-width: 0` and the top seller title was unclamped. Now 3 even 408px columns, zero overflowing elements at 1280, 1440, and 1920.
2. Palette inner elements were pinned to 400px inside a 640px shell. Cause was not `--aside-width` but a generic `form { max-width: 400px }` in `reset.css` catching the palette's form. Body now 638px, matching the palette.
3. Top widgets thumb row had scrollWidth 2046 vs clientWidth 345, with images rendering at 758x758. Now 6 even 185px tiles, no scrollbar.
4. Every predictive result thumbnail and 5 of 6 palette tiles never loaded at all (`naturalWidth 0`, `complete false` after 5s). Cause: `loading="lazy"`, which Chrome never fires for images injected into an already open overlay. Confirmed by forcing `eager` on one stuck image and watching it load instantly. All 11 images now load.
5. Result titles ran 3 to 4 lines. Clamped to 2, so 5 results fit instead of 4.
6. Thumb row requested a 120px source for a 183px slot and looked soft. `sizes` corrected to 190px, natural width now 190.

Not a bug, checked: the Top widgets row's repeating tile widths were a normal CSS grid artifact of 2 rows sharing 3 column tracks, not duplicate products. All 6 are distinct.

Verified in browser at 1440x900 and 375x812: panels open and close, Escape returns focus, Cmd+K opens, "neon" returns 5 real products with art and prices, mobile accordion opens with 56px tiles, `document.scrollWidth == clientWidth` on mobile, no new console errors (the remaining ones are a pre-existing homepage hero `fetchPriority` warning and an Analytics consent env var notice). `npm run build` exits 0.

Preview deploy: https://01m2230qerb2vwasnzeh18na3x-fb73b5b73c40344d0d20.myshopify.dev

Commits: `7cf8ace` mega menu and palette, `67c6321` sizing overflow fixes, `f532675` eager thumbnail loading.

#### Collection filter fix 2026-09-09
Todd reported the "Chat widgets" chip on `/collections/widgets?type=Chat_widget` was still listing goal widgets.

Root cause: the chips passed `?type=<tag>` into the Storefront API as `products(filters: [{tag}])`. **The Storefront API only honours filters configured in Shopify's Search & Discovery settings, and this shop has only Availability and Price configured**, so the tag filter was silently dropped and every chip returned the unfiltered collection. Confirmed by querying `collection.products.filters` directly, which returns exactly those two filters and nothing else. The chips had never filtered anything. Not a regression from the mega menu work.

Fix: the chips are now plain links to the smart collections already curated on `product_type`, the same handles the mega menu uses. Chat Widget is `frontpage`, Goal Widget is `stream-widgets-templates` (counterintuitive but real). Removed the dead `filters` plumbing from `collections.$handle.jsx` and its query. `/collections/all` keeps its `?type=` support, which genuinely works there because that route filters through a search query string, not the `filters` argument.

Second bug found while verifying: the product card badge tested the title for "goal" before "chat", so every combo listing (there are many named "Chat and Goal Widget") was badged Goal even sitting inside the Chat Widget collection. CLAUDE.md flags exactly this trap. The badge now prefers `productType` and only falls back to the title, chat first, when a product has no type set. Added `productType` to the three product fragments feeding the card.

Verified: `/collections/frontpage` renders 24 cards with 23 Chat badges and 0 Goal, `/collections/stream-widgets-templates` renders all Goal, chips route correctly with the right active state on both. `npm run build` exits 0. The 2 remaining eslint errors are pre-existing (`context` unused in both collection routes, confirmed by linting the stashed tree).

Preview deploy: https://01m229k1p8jnsbjj6nv8vazs97-fb73b5b73c40344d0d20.myshopify.dev
Commit: `92d8d20`.

Worth knowing for later (collection filters): if per-collection faceted filtering is ever wanted (filter within a collection rather than routing between collections), someone has to add those filters in Shopify's Search & Discovery app first. No amount of storefront code makes `filters:` work until that is configured.

### 2026-09-09
Metrics (2026-09-08): 21 sessions, 0 add to cart, 0 reached checkout, 0 completed, 0 orders, $0 net sales. Conversion 0.0%. (Sep 7 was 65 sessions / 1 add to cart, the traffic spike has not repeated.)

Shipped: **fixed a hard purchase blocker. 9 active digital products were flagged as physical goods.**

Found by auditing the actual purchase path rather than the checklist: built a real cart against the Storefront API for all 16 top products plus the 3 bundles and inspected each variant. Nine had `requiresShipping: true` on their inventory item. All 7 products created through the Admin API on 2026-09-07, the reactivated Sakura Glassy, and one bloodworm goal widget. Six of those are in the top 15 by revenue (Multistream Chat #2, Star Goal #3, Y2K Sticker #5, Moon Jar #6, Saber Neon #8, Neon Multistream #15), plus Soul Blade and Sakura Glassy #13.

Why it blocks a purchase, not just annoys: a shipping-flagged line item turns Shopify checkout into a physical checkout. The buyer is forced through a shipping-address step for a zip file, and Shopify then needs a delivery rate for their address. This shop has exactly two delivery zones, Domestic (US) and International (27 named countries), both at $0. **Any buyer outside those 28 countries hit "no shipping methods available for your address" and could not complete the purchase at all.** Etsy sells these same widgets worldwide. Confirmed before the fix: a cart with a US address returned zero `deliveryGroups`.

Fix: `productVariantsBulkUpdate` with `inventoryItem: { requiresShipping: false }` on all 9 variants. Inventory left untracked, so nothing became unpurchasable.

Also shipped: `scripts/audit-shipping.mjs`, which pages the whole storefront catalog and exits 1 if any visible product would force a shipping checkout. Products created via the Admin API default to `requiresShipping: true`, so this regresses on every API-created product and is invisible in the storefront UI. Documented in CLAUDE.md's data-quirks list. Run it after any catalog write.

Verified:
- Storefront API sweep after the fix: 130 storefront-visible products, 0 requiring shipping (was 9). `node scripts/audit-shipping.mjs` exits 0.
- Drove the real Shopify checkout in a browser with a live cart (Multistream Chat Widget, $24.99). It now renders as a digital checkout: Contact, then Payment, then Billing address. No shipping-address step, no delivery-method step, no shipping line in the order summary. The billing country selector offers the full world list, not the 28 shipping countries.
- **WELCOME10 tested for the first time on a real checkout**: applied cleanly, $24.99 subtotal, -$2.49 order discount, $22.50 total, "TOTAL SAVINGS $2.49". The code created on 2026-09-08 works.
- All 16 top products plus the 3 bundles: visible on the Storefront API, `availableForSale: true`, featured image present, price matching `etsy-shopify-map.json` (Rabbit Goal reads 10.4 vs 10.40 in the map, same number, formatting only).
- `npm run build` clean.

Not done, cannot be done from here: the checklist's "real $ test order then refund". Everything up to entering card details is now verified working; the actual charge needs Todd. Given the delivery blocker below, a real test order would currently deliver nothing anyway.

Needs Todd:
- **Still the #1 blocker, unchanged and now the only thing between the store and a working sale**: 8 of the top 16 products plus all 3 bundles have no digital file attached. A purchase completes and the buyer receives nothing. Manual upload in Admin > Apps > Digital Products, file list in the 2026-09-07 blockers section. No API exists for this app. Today's fix means buyers worldwide can now reach payment, which makes this blocker more urgent, not less.
- Google Search Console + Merchant Center still need his account.
- Soul Blade price still unconfirmed (Etsy live 15.99, notes said 29.99, Shopify matched to 15.99).
- Worth a look: the shop's International delivery zone covers only 27 countries. It no longer blocks digital sales, but if a physical product is ever sold it will block most of the world.

Next: homepage and PDP conversion work, since the purchase path itself is now clean and traffic that arrives is bouncing at 0% add to cart.

Preview deploy: https://01m2343259d7q2snv79287f16n-fb73b5b73c40344d0d20.myshopify.dev
Commit: `b011026`.
