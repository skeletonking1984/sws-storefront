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
- [x] Every active product: title, image, price, product type, Chat/Goal tag correct (`node scripts/audit-catalog.mjs` exits 0: 131 storefront products, 0 issues, 2026-09-10)
- [ ] Digital download delivery verified end to end (order -> file). Mechanism proven: Butterfly Galaxy has 1 real sale and 1 real download. Remaining gap is coverage: 14 products had no asset, staged at `~/Desktop/SWS-EMPTY-14/`, Todd uploading, count landed unverified (the app is a cross origin iframe)
### Storefront (Hydrogen)
- [x] Pending work committed + deployed
- [ ] Homepage sells: hero, top 15, social proof, one clear CTA
- [x] PDP: video where available (104 of 130 active), platform badges, "what you get", FAQ, real per-product Etsy reviews
- [ ] Mobile QA
- [ ] Performance (LCP < 2.5s)
### SEO
- [x] Title/meta per product + collection (plus canonical, OG, Twitter card, JSON-LD)
- [x] Sitemap + robots verified
- [ ] Google Search Console: verify `streamwidgetshop.com` as a Domain property (DNS TXT in Cloudflare), submit `/sitemap.xml`. Todd's Google account. X-in-Search-Console is already connected (@streamwidget), read-only, data lands ~2026-09-12.
- [ ] Merchant Center feed via the Google & YouTube app. After DNS cutover (product URLs must resolve on the live domain).
### Branding
- [x] Wordmark, palette, favicon, OG image consistent with Etsy/X
### Conversion
- [x] Purchase path clean: no storefront product forces a shipping checkout, verify with `node scripts/audit-shipping.mjs` (fixed 9 products 2026-09-09)
- [ ] Checkout tested (real $ test order then refund) - verified in a browser up to the payment step, WELCOME10 applies, the actual charge still needs Todd
- [x] Email capture + welcome discount (WELCOME10, 10% off, all products, all customers, no end date)
- [ ] Pixels (X, Google) installed. Tracking issue for Auny's half: BAT-145. Decided 2026-09-10:
  - GA4: reuse existing property **SpaceLabs - Shopify** (451083860), stream 8496264324, Measurement ID `G-X0978HDVTK`. Same ID the old Online Store theme already serves on streamwidgetshop.com (verified by curl 2026-09-10), so history stays continuous across cutover. Keep the Etsy property (450644449) separate. Cosmetic: Todd renames property + sets stream URL to `https://streamwidgetshop.com` (still says spacelabsshop.com, which now 404s).
  - Hydrogen ships no analytics tag on its own. Build `app/components/pixels/` (GA4.jsx, XPixel.jsx) mounted inside the existing `Analytics.Provider` in `app/root.jsx`; subscribe via `useAnalytics()` to `page_viewed`, `product_viewed`, `product_added_to_cart`; load `gtag`/`uwt.js` with `useNonce()` for CSP; fire only after consent. GA4 can go in now. X waits on Auny's 5 IDs (1 pixel + PageView/ViewContent/AddToCart/Purchase) on BAT-145.
  - Purchase events cannot come from Hydrogen (checkout is Shopify-hosted). They go in Shopify Admin > Settings > Customer events > custom pixel on `checkout_completed`, sending X `Purchase` + GA4 `purchase` with order value. Site pixel must NOT also fire Purchase, or orders double count.
  - Item stays unchecked until a real test order shows once in X Events Manager and once in GA4.
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

### 2026-09-09 (second pass)

Shipped: **Etsy demo videos attached to the Shopify catalog. 8 of 130 active products had a video, now 65 and climbing.**

Every SWS product is sold on Etsy first, and 185 of the 186 active Etsy listings carry a short mp4 of the widget actually running. Shopify had almost none of them. That clip is the strongest conversion asset the catalog has, and the PDP checklist item "video where available" was blocked on it.

Built `scripts/sync-etsy-videos.mjs`, re-runnable and idempotent. It resolves an Etsy listing to a Shopify product, skips anything that already has a VIDEO media item, downloads the mp4, does the presigned multipart POST, and records per row state so a rerun never repeats finished work.

Shopify will not fetch an arbitrary mp4 by URL for mediaContentType VIDEO. The only path is the staged upload flow: `stagedUploadsCreate` (VIDEO, real byte size, POST), multipart POST the bytes to the returned target, then `productCreateMedia` with the returned `resourceUrl`, then poll until READY. The repo holds only a READ ONLY Storefront token, so the three admin steps run through the Admin MCP tools and the script owns everything that does not need admin credentials.

Matching is deliberately conservative, because a wrong video on a product is worse than no video. The 16 hand verified rows in `etsy-shopify-map.json` seed the map. The rest are scored on normalised titles with IDF weighting, so shared filler like "Liquid Filling Goal Widget" cannot carry a match on its own. Anything that does not clear the bar is written to `data/etsy-video-candidates.json` for review instead of being guessed, and reviewed decisions live in `data/etsy-video-adjudication.json` so they survive a rerun. The full resolved map with a confidence per row is `data/etsy-video-map.json`.

Two Shopify limits govern this and both bite through `stagedUploadsCreate`, not through `productCreateMedia`:

- **200 video uploads per hour per shop.**
- **250 videos and 3D models total, a hard plan cap.** The shop holds 87 video files today, so there is room, but it is finite.

The trap is that a staged upload **reserves a slot against both limits the moment it is created**, whether or not bytes are ever posted to it, and the reservation is only released when the target expires about 70 minutes later. Creating targets you do not use is therefore not free. Both limits report as per input entries in `userErrors` with a null `url` for the rejected elements, while the earlier elements succeed, so the mutation looks partially successful and must be checked element by element rather than by whether it threw.

Practical rule: request exactly the targets you intend to upload, in batches well under 200, and never speculatively.

Verified:
- Re-queried the whole active catalog after the run: 65 of 130 products carry a VIDEO media item, every one `status: READY`, zero `fileErrors`.
- Media was only ever added. Image counts per product are unchanged.
- No Shopify product is referenced by two Etsy listings: 101 products referenced, 101 unique.

#### Video sync stalled on a misread limit 2026-09-09
The remaining 39 videos are blocked, and not by the hourly rate limit two agent runs assumed. `stagedUploadsCreate` fails with "Your plan does not permit more than 250 videos and 3D models", which is a hard cap, not a throttle, so waiting on a timer for the hourly window to clear does nothing.

The shop is nowhere near 250 in real assets. `files(query: "media_type:VIDEO")` returns 87 videos, `media_type:MODEL_3D` returns 0, and no video is stuck processing. The gap is reservations: a staged upload target counts against the cap the moment it is created, even if no bytes are ever posted, and only releases when that target expires. The first bulk run created many more targets than it used and pinned the shop at the ceiling.

So the cap does clear on its own, once the abandoned targets expire, and 87 real videos plus the outstanding 39 is 126, comfortably under 250. Nothing needs deleting and no plan upgrade is needed.

To finish, once staging succeeds again, work the 39 rows from `node scripts/sync-etsy-videos.mjs pending` one at a time: create a single staged target immediately before posting its bytes, never a batch up front. Quirk recorded in CLAUDE.md.

Current state: 65 of 130 active products have video (was 8). 39 matched and waiting, 83 Etsy listings with no confident Shopify match (left alone deliberately), 1 listing with no video on Etsy.

Follow up on the cap, measured rather than assumed: archived and draft products hold ZERO videos (all their media is images), so nothing is reclaimable there. Of the 87 real video files, 65 are attached to active products and about 22 are unattached in the Files library. 3D models: 0. That accounts for 87 of the 250 slots, so roughly 163 are held by something that is not a visible file, which points at unconsumed staged upload reservations. Retries at 17:38Z and again after 17:58Z both still returned the cap error, so they had not aged out yet. Nothing to delete, nothing to upgrade, just not ready yet.

### 2026-09-09 (third pass)
Metrics (2026-09-09 so far): 11 sessions, 1 add to cart, 2 reached checkout, 0 completed, 0 orders, $0 net sales. The 2 checkouts are this routine's own browser test of the shipping fix, not a buyer. Sep 8 was 21 sessions / 0 add to cart. All of this traffic is still hitting the OLD Energy theme on streamwidgetshop.com, not the Hydrogen build, so none of the storefront work moves these numbers until Todd cuts DNS over.

Shipped: **real per-product Etsy reviews on the PDP.**

Every product page was showing the same 3 hardcoded shop-wide quotes. The shop has 990 real Etsy reviews and `getReviewsByShop` returns a `listing_id` per review, so they can be attached to the exact product they were written about. 76 of the 100 most recent now do, across 26 products. Coverage on the sellers that matter: Star Goal 13, Neon Animated 10, Multistream 8, Sakura Floral 5, Moon Cloud 4, Cosmic Galaxy 4, Y2K 4, Sakura Glassy 3, Neon Moon Glow 3.

`scripts/build-etsy-reviews.mjs` joins `data/etsy-reviews-raw.json` (the raw API pull, kept in the repo so the build is offline and re-runnable) to `data/etsy-video-map.json` and writes `app/data/etsy-reviews.json`. A review only attaches when its listing maps to a handle at trusted confidence, because a review on the wrong product is worse than no review at all. The 24 dropped reviews belong to Etsy listings with no confident Shopify match, the same 83-listing gap the video sync left alone.

Honesty constraints held deliberately:
- Reviews render most recent first whatever the rating, not filtered to 5 stars. The 2 star reviews on Star Goal and Moon Cloud are in the set and show in the distribution bars.
- Stars floor rather than round. A 4.5 average painting 5 solid stars overstates the product, and the exact number sits right beside it.
- Attribution is "Verified Etsy buyer". Etsy's API exposes no reviewer name and inventing one is out.
- Labeled as reviews left on this widget's Etsy listing, never implied to have been left on this site.
- `aggregateRating` JSON-LD only where 3 or more reviews actually render, using exactly the average and count on the page. No shop-wide numbers smuggled into a product rating.

Conversion detail worth keeping: the rating block beside the price used to be a link straight to Etsy. Sending a ready-to-buy visitor to the Etsy listing from next to the Add to Cart button is a leak, so the buy panel now shows this widget's own rating and anchors down the page to the reviews. One outbound proof link remains at the bottom of the review section.

Shop stats were stale and duplicated across two components. They now come from one generated source: 4.75 from 990 reviews, 7504 sold, 1274 favorites (was 981 / 7383 / 1249).

Verified:
- `node scripts/build-etsy-reviews.mjs`: 100 source reviews, 76 kept, 24 dropped for no handle, 0 dropped for low confidence, 26 products covered.
- `npm run build` exits 0. `npx eslint` on all 6 touched files: 0 errors, only the array-index-key and no-console warnings this repo already ships everywhere.
- Curled against a real dev server: Star Goal PDP reads 4.5 from 13 with an 11/0/0/2/0 distribution, buy panel badge `4.5 from 13 Etsy reviews of this widget`, JSON-LD `aggregateRating 4.5 / 13`. Neon Animated 5.0 from 10, JSON-LD matching. A no-review PDP (Saber Neon) renders the shop-wide fallback, the shop badge, and has no `aggregateRating` key at all. Homepage quotes are real verbatim reviews and the shop line reads 990.
- No em or en dash anywhere in the new files or the generated JSON.

Not verified: the "Show all 13 written reviews" expander was never clicked in a real browser, and no 375px visual pass was done. Dev servers and the browser tools are both blocked in an unattended scheduled run. The expander is plain `useState` and the CSS is fluid (`minmax(220px, 1fr)` grid, `max-width: 320px` on the distribution, no fixed widths), but it is untested by eye.

Also checked and closed out:
- Probed whether the Digital Products app exposes attachments as metafields, so the #1 blocker could be fixed from here. It does not. A product that HAS a file and one that does not both return only `global.title_tag` / `global.description_tag`. The app keeps its attachments in its own store. Confirmed dead end, stop re-testing it.
- Retried `stagedUploadsCreate` for the stalled video sync. Still `Your plan does not permit more than 250 videos and 3D models`. The abandoned staged targets have not aged out yet. 39 videos still pending, unchanged.

Needs Todd:
- **Still the #1 blocker**: 8 of the top 16 products plus all 3 bundles have no digital file attached. A completed purchase delivers nothing. Manual upload in Admin > Apps > Digital Products, file list in the 2026-09-07 blockers section. No API, confirmed twice now.
- **Worth saying plainly**: the daily storefront work is all pre-launch. streamwidgetshop.com still serves the old Energy theme, so every improvement since 2026-09-07 is invisible to real traffic until the DNS cutover. The purchase path is clean and the pages are ready. The two things standing between here and a working sale are the digital files and the cutover, and both are his.
- Google Search Console + Merchant Center still need his account.
- Soul Blade price still unconfirmed (Etsy live 15.99, notes said 29.99, Shopify matched to 15.99).

Next: finish the 39 pending videos if the staged upload cap has cleared, otherwise homepage conversion (the hero nits from 2026-09-07: star bar overlapping the jar lid, chat too small) and a mobile pass.

Preview deploy: https://01m23p68ccxc8zqghk3m120sjc-fb73b5b73c40344d0d20.myshopify.dev
Commit: `d0bad39`.

#### Digital files staged for Todd 2026-09-09
Todd asked for the delivery blocker as clickable steps, so the files were tracked down and staged instead of just re-listed.

`~/Desktop/SWS-Shopify-Uploads/` now holds 17 of the 19 needed files in 11 numbered folders, one per product, plus a READ ME FIRST.txt with the Admin path and the per-product upload order. Every file was byte-checked against `etsy_list_listing_files`, which is the authoritative answer to what each live Etsy listing actually delivers, so nothing staged is a stale or wrong-sized copy.

Sources were scattered: `content/catalog/<listing_id>/files/` held most of the widget code, several setup PDFs are shared across listings and were pulled from another listing's catalog folder after a byte match, and 3 files only existed in `~/Downloads`. The bundle zips were already built under `products/bundles/*/upload/`.

Two files exist nowhere on the machine and have to come off Etsy Shop Manager: `NeonChatandGoalCodefile.zip` (34472 bytes, Saber Neon, listing 4473894910) and `SakuraGlassyChatWidget.zip` (21578 bytes, Sakura Glassy, listing 4369470796).

Corrected a stale note while verifying: the 2026-09-07 entry lists a third `Celestial-Stream-Kit-Guides.zip` for the Celestial bundle. No such file was ever built and none is needed, the Shared Guides PDFs are already inside `Celestial-Stream-Kit.zip` (confirmed by listing the archive). Celestial ships 2 files, not 3.

### 2026-09-10
Metrics (2026-09-09): 23 sessions, 2 add to cart, 3 reached checkout, 0 completed, 0 orders, $0 net sales. Conversion 0.0%. (2 of those 3 checkouts were this routine's own browser test of the shipping fix, not buyers.) Sep 8 was 21 sessions / 0 add to cart. All of it is still hitting the OLD Energy theme on streamwidgetshop.com, not the Hydrogen build.

Shipped: **the stalled Etsy video sync is finished. Every matched product now carries its demo clip. 65 of 130 active products had video yesterday, 104 do now.**

The 250 video and 3D model cap that blocked this on 2026-09-09 had cleared on its own, exactly as the diagnosis predicted: abandoned staged upload reservations aged out, nothing was deleted and no plan was changed. First `stagedUploadsCreate` of the run succeeded with zero `userErrors`.

All 39 remaining rows were downloaded first (`node scripts/sync-etsy-videos.mjs fetch`), then staged, posted and attached in four batches of 10, 10, 10 and 9. Every target was created immediately before its bytes went up and every one was consumed, so the run added no new abandoned reservations. `productCreateMedia` ran as an aliased batch per group, one alias per product, and every alias was checked individually rather than trusting that the mutation did not throw.

One thing worth recording, because it cost a slot: the signed policy pins `content-length-range` to EXACTLY the `fileSize` declared in `stagedUploadsCreate`. A probe target created with a placeholder size can never accept a real file, and it still holds a cap slot until it expires. Always fetch the file and pass its real byte count. Written into CLAUDE.md's quirks list.

Verified:
- Storefront API sweep of the whole catalog: 130 storefront-visible products, 104 carry a VIDEO media node, 26 do not. That is +39, matching exactly what was attached.
- Admin API: `media_type:VIDEO AND status:FAILED` returns 0 files, `status:PROCESSING` returns 0. Nothing is stuck or broken.
- Media was only ever added. No image or existing video was touched, no product was deleted or archived.
- `node scripts/audit-shipping.mjs` exits 0: 130 storefront products, none require shipping.
- `npm run build` exits 0.

Not verified: the PDP was not opened in a real browser. Dev servers are blocked in an unattended scheduled run and both the Oxygen preview and production URLs are auth-gated behind Shopify OAuth, so there is no way to fetch a rendered page from here. The check that was possible is the data layer, and that is the exact source `ProductGallery` reads, which has been rendering video on 65 products since yesterday. No code changed today, only catalog media.

The 26 products still without video are the deliberate gap, not a failure: they are Etsy listings with no confident Shopify match, left alone rather than guessed, because a wrong video on a product is worse than no video.

Needs Todd:
- **Still the #1 blocker**: 8 of the top 16 products plus all 3 bundles have no digital file attached, so a completed purchase delivers nothing. 17 of the 19 files are already staged for him at `~/Desktop/SWS-Shopify-Uploads/` in 11 numbered folders with a READ ME FIRST.txt. Upload path is Admin > Apps > Digital Products. No API exists, confirmed twice.
- The 2 files that exist nowhere on this machine and have to come off Etsy Shop Manager: `NeonChatandGoalCodefile.zip` (Saber Neon, listing 4473894910) and `SakuraGlassyChatWidget.zip` (Sakura Glassy, listing 4369470796).
- Google Search Console + Merchant Center still need his account.
- Soul Blade price still unconfirmed (Etsy live 15.99, notes said 29.99, Shopify matched to 15.99).
- The DNS cutover. Every storefront improvement since 2026-09-07 is invisible to real traffic until he makes it.

Next: homepage and PDP conversion. The purchase path is clean, the catalog is now as good as it can get without Todd, and traffic that arrives is still bouncing at roughly 0% add to cart. Starting with the hero nits logged on 2026-09-07 (star bar overlapping the jar lid, chat too small) and a 375px mobile pass.

Preview deploy: https://01m26j05y45c663dg4shv60yhe-fb73b5b73c40344d0d20.myshopify.dev
Commit: `3166dd5`.

### 2026-09-10 (Todd + Claude, analytics decisions)
- GA4 property/stream/ID settled, X pixel plan written, ownership split. All recorded in the Conversion + SEO checklist items above so the daily pass picks it up. Linear: BAT-145 (Auny: X Events Manager side). Code side is the routine's job once GA4 is unblocked (it is) and X IDs arrive.
- Hydrogen analytics bus already exists: `Analytics.Provider` with consent in `app/root.jsx:105-109,227-235`, `Analytics.ProductView` in `products.$handle.jsx:361`. Nothing subscribes to it yet.

### 2026-09-10 (second pass, Todd present)
Metrics (2026-09-10 so far): 29 sessions, 1 add to cart, 1 reached checkout, 0 completed, 0 orders, $0 net sales. Sep 9 was 23 sessions / 2 add to cart / 3 reached checkout. Still all on the OLD Energy theme, not the Hydrogen build.

Todd reset the priorities mid-pass: launch with what is there plus the top 10 to 20 Etsy products, every one of them with full images and at least one video, every title and description standardized and optimized for SEO and AEO, simple checkout, and analytics plus X pixel conversion tracking ASAP because ads start within a week. He also asked for the full GA4 enhanced ecommerce event set, not just add to cart.

Shipped, in four parts.

**1. Analytics (commits `399c0ea`, `d4bd205`).**
`app/components/pixels/GA4.jsx` and `XPixel.jsx`, mounted inside the existing `Analytics.Provider`, all IDs read from `PUBLIC_*` env vars, nothing hardcoded. CSP extended in `app/entry.server.jsx` for googletagmanager, google-analytics, static.ads-twitter, analytics.twitter and t.co, including a real `connectSrc` directive, or the beacons fail silently the way the video CSP trap did.

Full enhanced ecommerce: `page_view`, `view_item`, `view_item_list`, `select_item`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`, `search`. Hydrogen publishes no event for `select_item` or `begin_checkout`, so those are published as `custom_*` events from `ProductItem.jsx` and `CartSummary.jsx`. `item_category` was missing from the cart fragments and was added to `CartLine` and `CartLineComponent` so every cart event gets it at once.

`purchase` is deliberately never sent from the storefront. Checkout is Shopify hosted, so it comes from a separate Admin custom pixel. Both firing would double count every order.

**Answered for Todd: yes, gtag is needed.** Measurement Protocol alone means inventing and persisting `client_id` yourself and losing auto source/medium, which kills ad attribution. GTM loads gtag anyway. Shopify's Google and YouTube channel instruments the Online Store theme only and gives a headless Hydrogen storefront nothing.

**2. Catalog, the launch set (commit `3fded55`).**
All 20 top products now carry full images and one demo video. Two gaps closed: Celestial Moon Goal Widget had no video, and Sakura Chat and Goal Widget (Etsy 4505167275, $138, rank 18) had no Shopify product at all and was created from scratch, published to all three channels with `requiresShipping: false`.

Browse hole fixed: 25 products titled "Chat & Goal Widgets" were typed Chat Widget only and never appeared in the Goal Widget collection, the number 1 seller among them. `productType` is a single string, so the two widget collections are now disjunctive on TYPE or TAG and the tag carries the second membership. Goal collection went 93 to 118 storefront products.

New `scripts/audit-catalog.mjs` checks title, image, price, description, productType and tag agreement. Run it with `audit-shipping.mjs` after any catalog write. Two traps it now encodes, both of which bit during this pass:
- **Shopify matches and dedupes tags case-insensitively.** Adding `Goal_Widget` to a product already carrying `goal_widget` keeps the old casing, so a case-sensitive check reported 30 correctly tagged products as broken. Had that been trusted, 30 correct products would have been "fixed".
- **Shortened Shopify titles lose the combo signal.** Neon Moon Glow (rank 4) reads chat-only but its Etsy listing ships `ChatCode.zip` AND `GoalCode.zip`, so the audit reads the handle as well as the title. Title alone would have stripped a correct tag off a top-five seller.

**3. Copy standardization (commit `67e8b01`).**
Titles and descriptions standardized across the 18 launch-set products, plus `seo.title` and `seo.description`. Standard written to `docs/COPY-STANDARD.md` for the remaining catalog. Descriptions end in a 3 to 5 question FAQ whose answers are self-contained, which is the AEO layer.

Every claim ground-truthed against that product's own Etsy listing and file manifest, which removed inherited false claims: Kick and YouTube dropped from seven StreamElements-only chat products, TikTok dropped from three whose handles say `tiktok-studio` but whose listing bodies never mention it, no one-click-install claim on Potion Bottle because its manifest shows a manual install. Originals backed up to `data/copy-backup-2026-09-10.json`, one command to revert.

`audit-catalog.mjs` immediately caught a regression the rewrite introduced: retitling Sakura Glassy to "Chat and Goal Widget" left it without the `Goal_Widget` tag and hid it from the Goal collection. Its Etsy listing does ship a StreamElements goal widget, so the title is honest and the tag was added.

**4. A mapping bug worth more attention than anything else here. NOT FIXED, needs Todd.**
`data/etsy-video-map.json` has Etsy 1706402816 and 4339053159 mapped to the wrong Shopify products, swapped with each other. Proof, two independent lines:
- Shopify `celestial-butterfly-...` has featured image `il_fullxfull.7087440965_gsg6.jpg`, which is the exact `og_image` of Etsy **4339053159**, whose description text is literally the celestial-butterfly Shopify handle spelled out.
- Shopify stores the source listing id in the video filename. `celestial-butterfly-...` carries `1706402816.mp4` and `sakura-butterfly-pastel-cozy-...` carries `4339053159.mp4`. They hold each other's videos.

**Both bad rows are marked `confidence: reviewed`, so that field is not trustworthy.** This matters beyond video: `scripts/build-etsy-reviews.mjs` joins reviews to products through this same map. Verified consequence so far: `celestial-butterfly-...` displays **2 real customer reviews written about a different product**. `sakura-butterfly-...` has no reviews, so it is unaffected on that axis.

Found only because the copy pass produced a mapping that disagreed with the stored map, and the disagreement was checked instead of resolved in favour of the stored value.

A full audit of all 104 mapped rows completed: **86 confirmed** by direct image id overlap, **16 with no overlap**, **2 unknown** (the Spooky and Multistream kits, whose Shopify art is custom marketing images with no Etsy filenames to compare, which is expected and fine).

Of the 16 no-overlap rows, exactly ONE pair is a proven mispairing: celestial-butterfly and sakura-butterfly, which appear in the broken list from opposite directions (1706402816 and 4339053159) and is consistent with the swap. The other 14 carry the stale-photo signature described below and are very likely benign, but each still needs the cross-match before being closed out.

**Do not read "no image overlap" as "mispaired".** Working through the no-overlap rows showed two distinct failure modes with different fixes, and one agent overcalled its rows as "genuinely wrong" on evidence that does not support it:

- **Stale photos, benign.** The Shopify image ids are strictly OLDER than the listing's current Etsy ids, and the title still matches. Potion Bottle (1790033028) is the clear case: Shopify holds 6863633024 and friends, Etsy now serves 7915097144 and friends. The listing's photos were refreshed on Etsy after the Shopify import. Product and video are correctly paired. Nothing is wrong for a buyer, the Shopify art is just an older cut.
  The decisive proof that this mode is benign: the audit also flagged Celestial Moon Goal Widget (1728594513) as broken, and that is the exact product whose Etsy and Shopify hero art were compared side by side by eye earlier the same day and confirmed to be the same widget. Same crescent with an orbital ring, same hanging planet beads. Zero id overlap, correct pairing.
- **Genuine mispairing, serious.** The Shopify image id is an EXACT match for a DIFFERENT listing's current `og_image`. That is what proved the celestial-butterfly case (7087440965 belongs to 4339053159).

So the discriminating test is a cross-match, not a self-match: for a row with no overlap, ask whether some OTHER Etsy listing's current image ids match this Shopify product. Only then is it a mispairing. A self-comparison alone cannot tell the two apart, which is why the partial results overstate the damage.

Method for finishing it: extract the numeric CDN id from each Etsy image URL (`il_fullxfull.<ID>_xxxx.jpg`) and from the Shopify product's image filenames (Shopify keeps the Etsy filename behind a hash prefix), build a reverse index of id to listing across ALL active Etsy listings once, then resolve every no-overlap row through that index. Cross-check with the video filename, which independently names the source listing the sync used.

Verified this pass:
- `node scripts/audit-catalog.mjs`: 131 storefront products, 0 issues on title, image, price, description, productType and tags.
- `node scripts/audit-shipping.mjs`: exit 0, no product forces a shipping checkout.
- `npm run build` exit 0. No em or en dash in any commit from this pass.
- Both new videos READY, 0 fileErrors. Storefront API re-queried for both products directly rather than trusting the agent that attached them.
- Checkout host measured, not assumed: a real cart's `checkoutUrl` is on `streamwidgetshop.com`.

Not verified: nothing was opened in a browser. Dev servers and the browser tools are blocked in this session, so no GA4 event has been watched firing, consent gating is untested at runtime, and the `remove_from_cart` quantity delta is unexercised. Build, type and lint level only.

Corrected a wrong conclusion before it reached Todd: a research pass concluded checkout ran on a `myshopify.com` host and that every paid conversion would land unattributed, needing a cart-attribute `client_id` relay. It inferred that from `PUBLIC_CHECKOUT_DOMAIN` being unset. Measuring the actual `checkoutUrl` showed checkout is on `streamwidgetshop.com`, the same registrable domain as the storefront, so `_ga` is readable at `checkout_completed` and campaign attribution works. `docs/checkout-purchase-pixel.md` carries the correction. Attribution must still be tested AFTER the DNS cutover, because before it the storefront is on an `o2.myshopify.dev` host and the test would fail for a reason that will not exist in production.

Needs Todd:
- **DNS cutover.** Every improvement since 2026-09-07 is invisible to real traffic until this happens. Running ads before it sends paid clicks to the old Energy theme.
- **The digital files.** 8 of the top 16 plus all 3 bundles still deliver nothing on purchase. 17 of 19 staged at `~/Desktop/SWS-Shopify-Uploads/`. Ads before this is paying for a broken fulfilment.
- **Hydrogen environment variables**, Admin > Hydrogen > SWS Storefront, for both Preview and Production: `PUBLIC_GA4_MEASUREMENT_ID = G-X0978HDVTK` and `PUBLIC_CHECKOUT_DOMAIN = streamwidgetshop.com`. Oxygen does not read the repo `.env`. `npx shopify hydrogen env push` would work but pushes the whole local `.env` and would overwrite the remote `SESSION_SECRET`, logging out every session, so it was not used.
- **Go-ahead to swap the two videos back**, which means deleting the wrong video from each product first.
- **Go-ahead to create the `checkout_completed` pixel** in Admin, a live-store settings change. Draft ready at `docs/checkout-purchase-pixel.md`, needs a GA4 API secret Todd generates.
- **Auny's 5 X pixel IDs** (BAT-145). Four env vars, no code change.
- Google Search Console and Merchant Center still need his account.
- Soul Blade price still unconfirmed (Etsy live 15.99, notes said 29.99, Shopify matched to 15.99).

Next: finish the 104-row map audit with the method above, correct the confirmed bad rows, rebuild reviews, then apply `docs/COPY-STANDARD.md` to the remaining ~110 products.

Preview deploy: https://01m26pp7c2pwvvrjdawjb7ejpg-fb73b5b73c40344d0d20.myshopify.dev
Commits: `399c0ea`, `d4bd205`, `3fded55`, `67e8b01`.

#### Videos were there all along, buried 2026-09-10 (evening)
Todd looked at the catalog and at a production PDP and reported the videos were missing. They were not. 106 of 131 storefront products carried a video, all healthy (Admin reports 0 FAILED and 0 PROCESSING). Three unrelated causes stacked up and together made them invisible.

1. **Ordering.** The Etsy sync appended each clip as the LAST media item, so on 101 of 106 products the video sat behind 5 to 15 images: the final thumbnail on the PDP and the end of the media grid in Admin. Reordered all 105 eligible products to put the hero image at position 0 and the video at position 1. The one product that already had video at position 0 was left alone rather than demoted.
2. **A real query bug.** `products.$handle.jsx` asked for `media(first: 10)`. Thirteen products had their video at index 10 or beyond, so it was never fetched at all and could not render however correct `ProductGallery` was. Raised to 25, which also stops the image gallery truncating on products with more than 10 photos. Commit `dc71e2c`.
3. **A stale URL.** Todd was looking at the Oxygen PRODUCTION url, which only updates when he runs the production deploy himself. Local `main` was 50 commits ahead of `origin/main` at the time, and production had none of the recent work. Preview deploys from an agent are fine, production is his.

Worth keeping: `ProductGallery.jsx` and the `__typename` selection were correct throughout. The instinct to go read the rendering component was the wrong first move, and the answer came from measuring where the video sat in each media list instead.

A production deploy also failed once on `Uncommitted changes detected: M storefrontapi.generated.d.ts`. That file is codegen output regenerated by `npm run build` whenever a query changes, and it was left out of its commit. Anything that edits a GraphQL query must commit the regenerated types with it.

Verified: video at index 1 on 105 products and index 0 on 1, none last. `audit-catalog.mjs` exit 0 (131 products, 0 issues), `audit-shipping.mjs` exit 0. Media counts unchanged on all 18 checked top-20 products and no product had a video promoted to hero. `npm run build` exit 0.

Not verified: still nothing opened in a browser from this session. Whether the video visibly plays is unconfirmed by eye.

Preview deploy with the media fix: https://01m26rgc01zap8zdpvtwhyfqkf-fb73b5b73c40344d0d20.myshopify.dev

#### Correction: the Digital Products "dead end" was overstated 2026-09-10
Earlier entries say the Digital Products app is a confirmed dead end and tell future agents to stop re-testing it. That was half right and the wrong half got propagated.

What is true: the app exposes nothing through the Admin API. It is invisible to `appInstallations` and it does not store attachments in metafields, so a product that HAS a file and one that does not are indistinguishable over the API. That was tested properly.

What was wrong: "no API" was allowed to become "unknowable and unfixable", and nobody opened the app's own interface. Driving Chrome into Admin > Apps > Digital Products > Open app shows a full product table with an **Assets column giving the file count per product**, plus a "Filter digital files" control and a Sort control. The state is entirely visible, and editable, in the UI. That conclusion sat in this file from 2026-09-07 and told four days of agents to stop looking at the number one launch blocker.

Observed while there, which also contradicts the assumption that most products are empty: 10x FROG Emotes 1 file, Angel Love Bar 3, Boba Drink 6, Broken Heart Bar 3, Broken Heart First Aid 3, Broken Star Bar 3, Butterfly Galaxy Chat and Goal 7, Butterfly Liquid Filling 3. Many products already have files attached.

What still blocks an agent-driven fix: the app renders in a cross-origin iframe. `get_page_text` returns only the Admin shell, `find` reports no matching elements, `document.querySelectorAll('iframe')` finds it but `contentDocument` is blocked, and synthetic clicks, typing and scrolling inside its area all fail to register (verified by clicking the Draft tab, the Filter control and the search box with no state change). The window cannot be resized taller than the screen either, so only the first eight or so rows can be read without scrolling.

So the honest position: the audit is a two minute job for a human in that UI and currently not completable by this tooling. In the app, Sort by assets, or the "Filter digital files" control, surfaces the zero-file products immediately.

Do not re-run the API probe. Do go look at the UI.

#### Digital delivery: the real number was 14, and Todd has been uploading them 2026-09-10 (evening, parallel session)
Written into this file after the fact, because it was not. A second session that evening (`Shopify daily launch pass`, `local_ecc7bf4f`) did the work with Todd live, and the scheduled night pass then re-reported the four day old blocker as if nothing had happened. **A scheduled run reads this file and nothing else. Work done with Todd in another session does not exist until it is written here.**

What that session established, which corrects several claims above:

- The Digital Products app's own product table has a **Assets** column and an empty-assets view. The true list of products with no file attached was **14**, not "8 of the top 16 plus all 3 bundles". Everything else in the shop already delivered a file.
- **The number one revenue product (Neon Animated, Etsy 4333471272) was NOT on that list.** It already has assets attached in Shopify. The 2026-09-10 digital delivery audit flagged it as "ZERO files found locally", which is true and irrelevant: local staging state is not Shopify attachment state, and this file let the two be confused.
- The two files previously said to be obtainable only from Etsy Shop Manager, `NeonChatandGoalCodefile.zip` and `SakuraGlassyChatWidget.zip`, were found. They are staged in folders 09 and 11 below. That ask is closed.
- Staging for the 14 lives at **`~/Desktop/SWS-EMPTY-14/`**, folders named to match the app's product names exactly and ordered A to Z like the app, files numbered in upload order, with `CHECKLIST.txt`. The older `~/Desktop/SWS-Shopify-Uploads/` (104 folders, all mapped products) stays as the long term reference.
- Todd uploaded a batch on the evening of 2026-09-10. **How many of the 14 landed is not verified.** That session could not read the result: the app renders in a cross origin iframe, so `get_page_text` returns only the Admin shell and synthetic clicks, typing and scrolling inside it do not register. The checkboxes in `CHECKLIST.txt` are a paper form, not state.
- Also observed there, and worth more than it looks: **Butterfly Galaxy shows 1 sale and 1 download.** A real customer bought and successfully downloaded. The delivery mechanism works when a file is attached.
- Flagged in passing and still open: product 12 is titled "Sci-Fi Neon Twitch Chat Widget Star Wars" and ships `StarWarsTwitchChatcode.zip`. That is Disney IP on a live product about to be advertised. Rename both before ads run.

Open question for Todd, 5 seconds in the app versus an hour of agent fumbling: filter the Digital Products table to empty assets and say which of the 14 still show the blue "Add asset" link.

#### The Etsy map was wrong in four places, and the proof was sitting in the filenames 2026-09-10 (night)
Metrics (2026-09-10, day not closed): 30 sessions, 2 add to cart, 2 reached checkout, 0 completed, 0 orders, $0 net sales. Sep 9 was 23 / 2 / 3 / 0. Still all on the OLD Energy theme, not the Hydrogen build.

Shipped: **`data/etsy-video-map.json` rebuilt from image identity instead of title similarity, and the 15 products that unlocked now carry their demo video. 106 of 131 products had video, 121 do.**

The map is not a video lookup table, it is the join that decides which customer reviews appear on which product page, so a wrong row is fake social proof by accident. The 2026-09-10 second pass found one bad pair and left 16 no-overlap rows unresolved with a method written down but not run. Run properly, the method is `scripts/audit-etsy-mapping.mjs`.

The discriminating test is a CROSS match, not a self match. Both sides expose the same numeric Etsy CDN id, because Shopify keeps the original `il_fullxfull.<ID>_xxxx.jpg` filename behind a hash prefix. A row with no self overlap is only mispaired when some OTHER active listing currently serves that product's exact ids. Otherwise the listing's photos were simply refreshed on Etsy after the Shopify import and the pairing is fine.

Result across all 186 active listings and all 131 storefront products:
- **108 rows confirmed** by direct id overlap.
- **13 stale photos**, no overlap in either direction, left untouched. That is the benign mode, and reading it as damage is what overstated the problem last time.
- **4 mispaired**, up from the 1 previously known. Not a swap, as assumed: three of the four are one-directional chains.
- **1 ambiguous** listing (1806978669) whose art appears on two Shopify products, which means a duplicate product, not a bad row. Left alone.

The four, each proven by an exact id match against a different listing's current images:

| Shopify product | was mapped to | actually is |
|---|---|---|
| celestial-butterfly | 1706402816 | 4339053159 Butterfly Chat Widget (x10 ids) |
| sakura-butterfly | 4339053159 | 4336747713 Floral Pastel Chat Widget (x10) |
| broken-heart-bar | 1785508867 | 1902602881 Broken Heart Goal Widget (x4) |
| pastel chat bubble | 4459400046 | 4341725255 Pastel Glow Chat Widget (x5) |

`--apply` rewrote the map from that proof: 2 rows corrected, **19 listings paired for the first time** (title matching had never matched them at all), 2 rows unmapped because their product provably belongs to someone else. Unmapping drops those reviews rather than moving them to a page they were not written about. New rows carry `confidence: image_verified`, a tier `build-etsy-reviews.mjs` now trusts, because byte identical image ids beat every inference-based tier already in that list.

An order-of-operations trap worth recording: a row can be unmapped by one proven pair and then mapped by its own a few iterations later, so classifying a change against the live object reports the same row as both a delete and an add. The apply step snapshots the starting state and classifies against that.

**Reviews rebuilt: 791 real reviews across 98 products, up from 727 across 83.** No product lost a review. 15 products got their first ones, among them Bulbasaur 21, Butterfly Galaxy 7, Pikachu 7, Star Bottle Glass 6, Eevee 6.

**Then the 15 newly paired products got their Etsy demo clip**, additive only, nothing deleted. Staged in two batches of 8 and 7, every target created immediately before its bytes went up and every one consumed, so no abandoned reservations against the 250 cap. Video moved to media index 1 on each, per the ordering lesson from this morning, or it lands last and is invisible.

Verified:
- `node scripts/audit-etsy-mapping.mjs` after the rewrite: 121 mapped rows, 108 confirmed, 13 stale photos, **0 mispaired**.
- Storefront API sweep: 131 products, 121 carry a VIDEO node, **all 121 at media index 0 or 1**, none buried.
- Admin API: `media_type:VIDEO AND status:PROCESSING` returns 0, `status:FAILED` returns 0. All 15 new clips READY.
- `node scripts/audit-catalog.mjs` exit 0 (131 products, 0 issues), `node scripts/audit-shipping.mjs` exit 0.
- `npm run build` exit 0. `npx eslint` on both touched scripts: 0 errors, only this repo's standard no-console warnings.
- Review diff computed against the committed file, not asserted: 0 products lost reviews, 15 gained, 0 counts changed.

Not verified: nothing was opened in a browser. Dev servers and browser tools are blocked in an unattended run, and both the Oxygen preview and production URLs sit behind Shopify OAuth, so no rendered page could be fetched from here.

Needs Todd:
- **Go-ahead to swap 4 wrong demo videos.** Each of the four mispaired products is currently playing a different widget's clip, which is worse than no clip. Fixing it means deleting the wrong video first, and a delete is his call. The replacements are already identified in the table above. This is now 4 products, not the 2 reported this morning.
- Everything else on the list is unchanged: **the DNS cutover**, **the digital files** (see the entry above, the real list is 14 products staged at `~/Desktop/SWS-EMPTY-14/` and Todd has already uploaded a batch), the two Hydrogen env vars (`PUBLIC_GA4_MEASUREMENT_ID`, `PUBLIC_CHECKOUT_DOMAIN`), the `checkout_completed` pixel, Auny's 5 X pixel IDs (BAT-145), Google Search Console and Merchant Center, and the Soul Blade price.

Next: apply `docs/COPY-STANDARD.md` to the remaining catalog beyond the 18 launch-set products, since the catalog's structural data is now clean and copy is the last thing standing between the storefront and an ads launch.

Preview deploy: https://01m271dhd8afwfya6h8kdgcdg2-fb73b5b73c40344d0d20.myshopify.dev
Commit: `72175c5`.
