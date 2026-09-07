# SWS storefront design direction (2026-09-07)

Todd: "every Hydrogen app looks exactly the same, fix our brand and look." Kill the skeleton look. The site must look like the logo: a chunky holographic sticker glowing on deep space purple. Streamer energy, not SaaS.

## Reference
- Logo `app/assets/logo.png` (source `content/brand/logo/sws_logo_planet.png`): bubble letters, cyan to lavender to pink to mint holographic fill, deep purple outline, neon glow, hot pink cat ears, striped lighthouse, ringed planet.
- Products: animated neon/celestial/sakura/spooky widgets on transparent. They glow. Let them be the light source on every page.
- Stage HUD (repos/sws-widget-stage/public/stage.css): cream sticker chrome `#fef8e8` with ink `#1a1024` outline. Reuse that as the "sticker" accent for badges, chips, callouts.

## Tokens (replace the current :root)
- bg `#0b0713`, bg2 `#180f28`, card `rgba(28,18,48,.72)` glass, border `rgba(183,157,242,.22)`
- ink `#f3ecff`, dim `#a89ec4`
- holo stops: cyan `#7fe6ff`, lavender `#b79df2`, pink `#f2a6d8`, hot pink `#f0509a`, mint `#87cfb2`
- sticker: cream `#fef8e8`, ink `#1a1024`, outline `#010101`
- Display font: "Baloo 2" 800 (chunky rounded, matches the logo). Body: "Nunito" 400/700. Load from fonts.googleapis.com with `display=swap`, system fallback stack.
- Radii: 18px cards, 999px pills. Thick 3px outlines on primary buttons (ink outline + holo fill + soft glow), like a sticker.

## Page atmosphere
- Body background: radial aurora blobs (lavender, pink, cyan at 10 to 15% opacity, slow drift 40s) over bg gradient, plus a sparse twinkling star layer (CSS only, pointer-events none). Subtle. Must not fight the products.
- Holo shimmer on headings via `.sws-holo` (keep), add a `.sws-glow` text shadow.
- Motion: hover lifts cards 4px and brightens the border glow; primary button holo sweeps; nothing bounces constantly. Respect `prefers-reduced-motion`.

## Homepage, top to bottom
1. **Header**: logo lockup (real PNG, 44px tall) left; nav pills; icon buttons right. Sticky, glass blur, thin holo bottom border.
2. **Hero** (full viewport height on desktop): left, headline in Baloo "Widgets that make chat *pop*." with the last word holo; sub line; two CTAs (primary sticker button "Shop widgets", secondary ghost "See it live"); trust row (4.75 stars, 981 reviews, 7,383 sold, all real numbers from `EtsyRating.jsx`). Right: a mock stream frame (rounded 16:9 dark "game" panel with a faint scanline) holding a composite of REAL live-rendered widgets (showcase capture pipeline, transparent PNGs, Spooky Kit listing-art method), tilted 3deg, glow underneath. No AI-generated imagery anywhere on the storefront (Todd, 2026-09-07). No listing posters either, they carry text.
3. **Shop by vibe**: horizontal sticker chips: Neon, Celestial, Sakura, Spooky, Cozy, Y2K, Multistream. Each links to `/collections/all?q=<term>` (search already exists). Cream sticker style with ink outline and a tiny emoji-free icon.
4. **Top widgets**: 3 per row desktop, 2 tablet, 1 mobile. Card: transparent product image centered on a dark radial glow, title, price pill, tiny platform icons, "Chat" or "Goal" sticker tag top left. The Top Widgets collection (handle `top-widgets`) drives this, not the hardcoded handle list. Keep the existing handle list only as fallback.
5. **Works with** strip: real platform icons already in `app/assets` and `PlatformBadges` (Twitch, YouTube, Kick, TikTok, OBS, Streamlabs, StreamElements) on a single row with "One click install, instant download".
6. **Reviews**: 3 real Etsy reviews rendered as chat bubbles (like a chat widget) with the reviewer's first name and stars. Source: `EtsyReviews.jsx` data. Never invent reviews.
7. **Custom commission** banner: cream sticker panel, "Custom overlay + widget pack, from $300", CTA to /pages/contact.
8. **Email capture**: "Get the next drop first" with a Shopify customer form (post to `/contact#contact_form` with `form_type=customer` and `contact[email]`), promise a 10% code (Todd to create code WELCOME10 in Admin; note it in LAUNCH.md).
9. **Footer**: existing brand block + SocialLinks, menu columns, tiny "Also on Etsy" link.

## Product page
Gallery left (existing), sticky buy panel right: title in Baloo, price pill, "Instant download, works with" icon row, sticker button "Add to cart", "What you get" list, description (normalized), FAQ accordion, reviews. Related: "More <Chat|Goal> widgets".

## Collections / search
Filter bar as sticker chips. Same product cards. Empty state with the planet.

## Must remove
- `MockShopNotice` and every `Hydrogen |` title. Titles: "Stream Widget Shop | Animated Twitch Chat + Goal Widgets" on home, "<Product> | Stream Widget Shop" elsewhere.
- Default skeleton grid/aside styling; restyle cart drawer and search aside to the glass look.
- Any leftover skeleton demo copy.

## Rules
- No em dashes or en dashes anywhere in copy.
- Real assets only; no placeholder images, no fake reviews or stats.
- Never crop non-square product art (see CLAUDE.md, no `aspectRatio` on `<Image>`).
- Mobile first: hero stacks, chips scroll horizontally, sticky bottom "Add to cart" on PDP.
- Lighthouse: fonts preloaded, images lazy below fold, no layout shift from the aurora layer.
