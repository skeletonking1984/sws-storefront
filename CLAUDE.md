# SWS Storefront

Headless Shopify storefront for **Stream Widget Shop** (StreamWidgetShop on Etsy, `@streamwidget` on X). Built with Claude Code to replace the current theme-based streamwidgetshop.com with a fully custom, branded site — while keeping Etsy as the primary sales channel and Shopify's backend (checkout, inventory, orders) unchanged.

Full origin/context for this decision lives in Linear: **[BAT-131](https://linear.app/todd-kueny/issue/BAT-131/sws-shopify-hydrogen-storefront-rebuild)** — read that first for the "why" and current status.

## Stack

- **Shopify** — backend only: catalog, inventory, checkout, orders, customer accounts. Managed in Shopify Admin as normal.
- **Storefront API** — public GraphQL API this app reads from (products, collections, cart).
- **Hydrogen** (`@shopify/hydrogen`) — Shopify's React/Remix framework, wraps the Storefront API with routing, cart, SEO, caching.
- **Oxygen** — Shopify's hosting for Hydrogen apps. This is the *only* supported deploy target for Hydrogen (no custom Cloudflare Workers deploy without a bespoke adapter — don't attempt it).
- Plain CSS with design tokens in `app/styles/app.css` (no Tailwind config in active use, despite the scaffold flag).

## Where things live

- `app/routes/` — one file per URL. `_index.jsx` is home, `products.$handle.jsx` is PDP, `collections.all.jsx` / `collections.$handle.jsx` are category pages, `pages.$handle.jsx` renders Shopify Pages (with hardcoded overrides for `contact`/`how-it-works`/`faq-frequently-asked-questions` — see below).
- `app/components/` — shared UI. Notable: `ProductGallery.jsx` (image+video gallery), `EtsyRating.jsx` (shop-level rating badge + `SHOP_STATS`), `EtsyReviews.jsx`, `CollectionFilterBar.jsx`, `FaqAccordion.jsx`, `HowItWorksSteps.jsx`, `ContactPage.jsx`.
- `app/lib/` — `platforms.js` (detects Twitch/OBS/etc. from title text), `pageContent.js` (parses Shopify Page HTML into structured FAQ/steps), `blogCategories.js` (keyword-based blog categorization).
- `app/styles/app.css` — all styling. Brand tokens (colors, fonts) are CSS custom properties at the very top of the file — change those first for any rebrand, don't hunt through component-level rules.

## Brand

Dark theme, holographic pink/purple/blue gradient accents (`.sws-holo` class + `--sws-accent-1/2/3` tokens). Logo at `app/assets/logo.png`. This matches SWS's Etsy/social identity — don't diverge without checking with Todd.

## Data quirks specific to this catalog (learned the hard way — don't re-derive)

- **Product tags are unreliable for anything except `Chat_widget`/`Goal_Widget`**, and even those needed a bulk cleanup (88 of 206 products had wrong tags, fixed via `tagsAdd`/`tagsRemove` on 2026-08-30). If tag-based filtering looks wrong again, cross-check the tag against whether the product title actually contains "Chat" or "Goal" before trusting it.
- **Duplicate products exist.** Many items were re-imported/rebranded as "...: Customizable Stream Overlay (Digital Download)" duplicates of older active listings — the duplicates are usually **ARCHIVED with 0 inventory**. If a handle you expect to resolve returns `null` from the Storefront API, check `status` and `resourcePublications` in Admin before assuming it's a code bug — it's very likely an archived duplicate, and the real active original has a different handle/title.
- **Only 5 of 206 products have a video asset.** Image counts are healthy everywhere (one past exception, fixed: `sci-fi-neon-chat-widget-kick-twitch-obs` had zero images, only a video — pulled real images from its Etsy listing, id 4498789564).
- **A few blog articles are duplicated** (e.g. "Best VTuber Overlays 2026" appears twice, one with an empty excerpt). Not yet cleaned up — ask Todd before deleting, could be intentional drafts.
- **The Storefront API's `query:` search does not support a `handle:` field filter** (that's Admin-API-only). To fetch a specific set of products by handle, use aliased `product(handle: $h)` fields in one query — see `RECOMMENDED_PRODUCTS_QUERY` in `app/routes/_index.jsx` for the pattern (used for the real Etsy-favorites-ranked homepage list).
- **Contact/How It Works/FAQ pages are Shopify Pages**, but `contact`'s body is empty in Shopify Admin — `pages.$handle.jsx` special-cases these three handles to render custom components (`ContactPage`, `HowItWorksSteps`, `FaqAccordion`) instead of the raw HTML. If Todd fills in the Contact page body in Admin, that override becomes redundant — check before assuming it's still needed.
- **Most of this catalog's source images are NOT square** (a "square-looking" product screenshot can actually be 2801×2161 or similar). Never pass `aspectRatio="1/1"` (or any ratio) to Hydrogen's `<Image>` component for hero/gallery/card images — it makes Hydrogen append `crop=center` to the Shopify CDN URL, which force-crops non-square source art and silently chops off edge content (text, characters). Instead: omit `aspectRatio` entirely and let the wrapping container handle square framing via CSS (`aspect-ratio` + `object-fit: contain`, see `.product-item-image` / `.product-gallery-main img`). Fixed 2026-08-30 in `ProductItem.jsx` and `ProductGallery.jsx` — don't reintroduce it elsewhere (check any new `<Image>` usage for this).
- **Product videos are hosted on `streamwidgetshop.com`, not `cdn.shopify.com`.** Hydrogen's default CSP (`createContentSecurityPolicy` in `app/entry.server.jsx`) only allowlists `cdn.shopify.com`/`shopify.com` by default, so `<video>` playback silently fails (`networkState: NETWORK_NO_SOURCE`) with **no console error** — very easy to mistake for a broken video file. Fixed by adding `streamwidgetshop.com` to `defaultSrc` (there's no `mediaSrc` option in this Hydrogen version; `media-src` falls back to `default-src` per the CSP spec, so that's what to extend). If videos ever stop playing again, check this CSP config before assuming the asset itself is broken.
- The homepage hero collage and "Fan favorites" are both driven by `FAN_FAVORITE_HANDLES` in `app/routes/_index.jsx`, sourced from real Etsy `num_favorers` data matched to Shopify handles by title. A few of the initially-matched handles turned out to be **archived duplicate listings** (see above) that resolved to `null` — always verify a handle is `status: ACTIVE` before adding it to this list.
- **Customer sign-in (`/account`) needs its Customer Account API callback URLs set per-domain, and it's easy to configure the wrong app.** There are *two* separate Customer Account API configs in Admin that look similar: one under **Sales channels → Headless → Customer Account API** (tied to the Storefront API token), and a different one under **Hydrogen → SWS Storefront → Customer Account API** (tied to this actual Hydrogen deployment, client ID visible in the OAuth error's `client_id` param if sign-in breaks). **The second one is the one that matters for this app.** Both ship with empty Callback URI(s)/Javascript origin(s)/Logout URI fields by default — sign-in fails with `redirect_uri mismatch` until you fill them in with the current domain + `/account/authorize`. Fixed 2026-08-30 for the production domain; **if you ever change the production URL or add a custom domain, redo this** (Hydrogen → SWS Storefront → Customer Account API → Application setup).

## Local dev

```bash
npm run dev          # localhost:3000, uses .env (PUBLIC_STORE_DOMAIN + PUBLIC_STOREFRONT_API_TOKEN)
```

`.env` is gitignored — ask Todd for the values (domain: `72470e-33.myshopify.com`, token is the public Storefront API token from the "Stream Widget Shop Headless" sales channel in Admin). Account/login routes need `npm run dev -- --customer-account-push` locally (OAuth needs a real HTTPS tunnel domain) — otherwise they 400 locally but work fine once deployed.

## Deploying

Two Oxygen environments exist:

- **Preview** — `npx shopify hydrogen deploy --preview` (interactive prompt selects Preview) or a scripted `--shop=streamwidgetshop.com --preview`. **Gets a brand-new URL every single deploy** — fine for one-off checks, bad for a link you want to keep sharing.
- **Production** — `npx shopify hydrogen deploy --env=production`. Stable URL that never changes: **https://sws-storefront-d5b4b9b3db2436fc829d.o2.myshopify.dev**. This is *not* the live streamwidgetshop.com domain — DNS cutover is a separate, deliberate step nobody has done yet.

Production deploys require an interactive `Continue?` confirmation that only works in a real terminal — Claude Code (running non-interactively) cannot answer it. **Todd has to run the production deploy command himself.** Preview deploys work fine from an agent.

## Known gaps (as of 2026-08-30, see Linear BAT-131 for latest)

- No DNS cutover to streamwidgetshop.com yet.
- Video assets missing from ~98% of the catalog (content gap, not a bug).
- Mobile pass done but not exhaustively QA'd on real devices.
- Blog has a couple of duplicate articles.
