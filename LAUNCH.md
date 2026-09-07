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
- [ ] Pending work committed + deployed
- [ ] Homepage sells: hero, top 15, social proof, one clear CTA
- [ ] PDP: video where available, platform badges, "what you get", FAQ
- [ ] Mobile QA
- [ ] Performance (LCP < 2.5s)
### SEO
- [ ] Title/meta per product + collection
- [ ] Sitemap + robots verified
- [ ] Google Search Console + Merchant Center feed
### Branding
- [ ] Wordmark, palette, favicon, OG image consistent with Etsy/X
### Conversion
- [ ] Checkout tested (real $ test order then refund)
- [ ] Email capture + welcome discount
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
