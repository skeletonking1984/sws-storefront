# Digital delivery audit, 2026-09-10

Why this exists: paid ads are about to run. A completed purchase that delivers nothing, or a zip
with no setup instructions, is the worst outcome for paid traffic. This audit checks every
storefront-visible product against what its live Etsy listing actually ships, and stages every
locally-findable file for manual upload (Shopify's Digital Products app has no API, confirmed
twice, this cannot be automated).

Source data: `data/etsy-listing-files.json` (raw Etsy file manifest for all 103 mapped listings,
re-fetched 2026-09-10, re-runnable). Mapping: `data/etsy-video-map.json`. Staging log used to build
this report: matched by exact filename and exact byte size only, nothing guessed or substituted.

## Bucket counts (103 Etsy-mapped Shopify products)

| Bucket | Meaning | Count |
|---|---|---|
| A | Has a zip AND a setup doc (PDF or guide-named file). Good. | 96 |
| B | Has a zip, NO setup doc anywhere on the Etsy listing. | 7 |
| C | Has a setup doc but no archive. Suspicious. | 0 |
| D | No files at all on Etsy. Cannot be fulfilled. | 0 |

All 103 mapped listings returned at least one file from Etsy, none are bucket C or D. The risk is
concentrated in bucket B (no setup instructions exist anywhere, not on Etsy, not locally) and in a
separate, larger problem found while staging: many products' files simply are not present on this
Mac and have never been staged for upload at all.

## Bucket B, full list (no setup doc on the Etsy listing itself)

| Etsy ID | Shopify handle | Files Etsy ships | Staging status |
|---|---|---|---|
| 4333471272 | neon-aesthetic-glowy-transparent-chat-and-goal-stream-widgets-minimal-neon-light-elegant-glow-theme-clean-vibe-streamelement-only | MultistreamNeonChatCode.zip, GoalWidgetcode.zip | **#1 all-time revenue listing. ZERO files found locally. Folder 96 is empty except a MISSING note.** |
| 4536576701 | multistream-chat-widget-twitch-youtube-kick-overlay-digital-download-easy-setup-one-click-installation | PastelMultistreamchat.zip | Staged, folder 01 (part 1 pass) |
| 4551047317 | animated-moon-jar-goal-widget-twitch-sub-goal-overlay-falling-stars-tracker-instant-download | MoontipjarFixedStreamelements.zip | Staged, folder 04 (part 1 pass) |
| 4569882300 | demon-samurai-stream-overlay-pack-animated-katana-goal-bar-multistream-chat-alerts-digital-download | SoulBladeOverlayPack.zip | Staged, folder 07 (part 1 pass). Single-HTML product by design, see memory `soul-blade-pack-is-one-file`. |
| 1736513808 | 10x-frog-emotes-pack-1-2-for-twitch-cute-little-froggy-kawaii-twitch-add-on-stream-deco-cute-froggy | FroggyEmotes.zip | ZERO files found locally, folder 26 is empty except a MISSING note. Emotes add-on, may not need a guide, still flagged since Todd asked for one on every product. |
| 4570446087 | spooky-stream-kit | Spooky-Stream-Kit.zip | Staged, folder 09 (part 1 pass, bundle). Guide is likely bundled inside the zip per the standard bundle convention, not independently verified by opening it. |
| 4570739034 | multistream-chat-widget-pack | MultistreamChatPack.zip | Staged, folder 11 (part 1 pass, bundle). Same caveat as above, not independently verified. |

**Action needed:** 4333471272 and 1736513808 need a setup PDF written or a setup link added to
the Etsy/Shopify description, AND their zip files pulled from Etsy Shop Manager since they are not
anywhere on this Mac. 4333471272 is the single biggest revenue earner in the whole catalog, this
is the highest-priority fix in this entire audit.

## Staging: files found and copied vs. still needed

Extended `~/Desktop/SWS-Shopify-Uploads/` from the 11 products already staged to all 103 mapped
products (folders 12 to 104 added, 93 products). Every file was matched by exact filename AND
exact byte size against `data/etsy-listing-files.json` before being copied, no substitutions.

Sources searched: `content/catalog/<listing_id>/files/`, `products/bundles/*/upload/`, and
`~/Downloads` (including subfolders).

| Result | Products |
|---|---|
| Newly staged, everything found | 19 |
| Newly staged, some files found, some still missing | 66 |
| Nothing found locally at all | 8 |
| **Total newly processed** | **93** |
| **New files copied** | **124** |

Every folder that is missing anything contains its own `MISSING - GET FROM ETSY.txt` naming the
exact filename and byte size still needed, and pointing at Etsy Shop Manager > that listing >
Digital files. The 8 products with zero local files:

| Etsy ID | Shopify handle | Files needed (all from Etsy) |
|---|---|---|
| 1730459480 | cute-bunny-chat-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-and-streamelements | BunnyChatandGoal.zip, ChatWidgetSetup.rtf, GoalWidgetSetup.rtf |
| 1730461418 | cute-rabbit-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements | Manualsetupgoalwidgetstreamelements.pdf, RabitGoalcodes.zip |
| 1736513808 | 10x-frog-emotes-pack-1-2-for-twitch-cute-little-froggy-kawaii-twitch-add-on-stream-deco-cute-froggy | FroggyEmotes.zip |
| 1763385692 | cute-froggy-goal-widget-liquid-filling-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements | ManuallySetupGuid.pdf, Streamlabs.zip, Streamelements.zip, OneClickFroggyGoalInstall.pdf |
| 1790033028 | combo-goal-widget-potion-bottle-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements | PotionBottleGoalWidgetupdateCodeAll.zip, ManuallySetupGuid.pdf |
| 4297334909 | minimal-line-chat-widget-simple-line-minimal-theme-with-pronouns-alerts-for-twitch-streams-streamelements-only-with-progress-goal | (see folder 86 MISSING note) |
| 4306870352 | valorant-brimstone-character-chat-and-goal-widget-gaming-modern-theme-with-pronouns-alerts-for-twitch-streamelements-only | (see folder 87 MISSING note) |
| 4333471272 | neon-aesthetic-glowy-transparent-chat-and-goal-stream-widgets-minimal-neon-light-elegant-glow-theme-clean-vibe-streamelement-only | MultistreamNeonChatCode.zip, GoalWidgetcode.zip |

Full per-product missing list (66 partial + these 8) is in
`~/Desktop/SWS-Shopify-Uploads/READ ME FIRST.txt`, part 2, so it doesn't need duplicating in full
here.

## The unmapped 28 (storefront products with no known Etsy source)

131 storefront-visible Shopify products, 103 have an Etsy listing mapped in
`data/etsy-video-map.json`. 28 do not.

**1 is a bundle:** `celestial-stream-kit` (Celestial Stream Kit). Built locally under
`products/bundles/02-celestial-stream-kit/upload/` (both zips present, byte-verified against the
bundle's own manifest, not an Etsy question). It has no Etsy listing at all, which is expected for
a Shopify-only bundle, per `products/bundles/README.md` (org root).

**2 look like real matches missed by the mapping, found by title search, not yet verified as
correct or added to the map:**

| Shopify handle | Likely Etsy match | Etsy files | Status |
|---|---|---|---|
| butterfly-galaxy-theme-glassy-transparent-chat-and-goal-stream-widgets-minimal-starry-elegant-glass-theme-clean-vibe-streamelement-only | 4322607453, "Butterfly Galaxy Chat Widget", **#16 top-20 revenue ($207.48)** | manuallychatGoalWidgetTutorial.pdf, chatandgoalcoad.zip, OrnamentsMOV.zip, ornamentsmov1.zip, chatboxandwebcamornaments.zip | Content complete on Etsy (zip+PDF). Not staged, not officially in the 103, not touched here. Recommend adding to `data/etsy-video-map.json` and staging separately. |
| sakura-animated-twitch-chat-widget-kawaii-cherry-blossom-stream-decor-digital-download | 4505167275, "Sakura Animated Twitch Chat Widget, Kawaii Cherry Blossom" | ManuallySetupGoalWidgetTutorial.pdf, SakuraFloralChatHoraizontal.zip, SakuraFloralChatVertical.zip, SakuraFloralGoalWidget.zip | Content complete on Etsy (zip+PDF). Same recommendation. |

**25 are genuinely unknown**, mostly a "Liquid Filling Goal Widget is fully customisable for
Twitch Streamlabs, TikTok Studio, and Streamelements" naming family that never went through the
Etsy-Shopify mapping process at all:

twitch-liquid-goal-bar-widget-vtuber-asset-star-alerts-streamlabs-tiktok-studio-and-streamelements,
nature-portion-bottle-glass-goal-widget-cute-minimal-customizable-goal-widget-for-twitch-tiktok-studio-streamelements-streamlabs-obs,
cute-bulbasaur-pok-e-mon-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-stream-elements,
cute-auctopus-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements,
butterfly-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements,
sakura-butterfly-pastel-cozy-chat-and-goal-stream-widgets-minimal-elegant-pastel-theme-clean-vibe-streamelement-only,
diamond-butterfly-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-stream-elements,
star-bottle-glass-goal-widget-cute-minimal-customizable-goal-widget-for-twitch-tiktok-studio-streamelements-streamlabs-obs,
pokemon-eevee-character-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements,
cute-ghost-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements,
minimal-photo-chat-widget-cam-shutter-minimal-theme-with-pronouns-alerts-for-twitch-streams-streamelements-only-with-progress-goal,
pikachu-goal-pokemon-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-stream-elements,
twitch-liquid-combo-goal-bar-widget-vtuber-asset-alerts-streamlabs-tiktok-studio-and-streamelements,
sparkling-diamond-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements,
celestial-cute-moon-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements,
cute-star-bottle-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements,
broken-heart-first-aid-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements,
classical-floral-purple-chat-and-goal-widget-minimal-starry-mystical-chat-box-with-pronouns-alerts-for-twitch-streams-streamelements,
water-fire-nature-cloud-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements,
love-bottle-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements,
cute-ghost-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements-1,
genshin-theme-square-loading-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements,
christmas-combo-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements,
valorant-waylay-chat-widget-aesthetic-cyber-modern-theme-with-pronouns-alerts-for-twitch-streams-streamelements-only-and-goal-widget,
cute-bat-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements

Nobody knows what these should deliver until each is checked by hand against Etsy Shop Manager or
matched by title. These are the highest-risk items in the whole catalog: if any of them is a live,
purchasable Shopify product with no attached digital file, a paid-ad click that buys one gets
nothing, silently.

## Top 20 by revenue (all-time, $17,304.86 total, via `etsy_product_revenue`)

| Rank | Etsy ID | Revenue | On Shopify? | Bucket | Delivery status |
|---|---|---|---|---|---|
| 1 | 4333471272 | $3,685.82 | Yes | B | **ZERO local files, no setup doc on Etsy. Highest-priority fix.** |
| 2 | 1790018033 | $1,373.07 | Yes | A | Staged, folder 02, complete |
| 3 | 4536576701 | $1,120.72 | Yes | B | Staged, folder 01, no setup doc on Etsy |
| 4 | 4336740821 | $800.56 | Yes | A | Staged, folder 97, complete |
| 5 | 4322617816 | $531.93 | Yes | A | Staged, folder 91, complete |
| 6 | 1707756402 | $527.07 | Yes | A | Staged, folder 12, complete |
| 7 | 4551047317 | $483.82 | Yes | B | Staged, folder 04, no setup doc on Etsy |
| 8 | 4543765531 | $474.15 | Yes | A | Staged, folder 03 (part 1) |
| 9 | 1730461418 | $364.24 | Yes | A | **ZERO local files despite Etsy having both a zip and a PDF. Needs pulling from Etsy.** |
| 10 | 4336744223 | $345.91 | Yes | A | Staged, folder 98, complete |
| 11 | 4473894910 | $327.09 | Yes | A | Staged, folder 05 (part 1), missing `NeonChatandGoalCodefile.zip` locally (noted in part 1) |
| 12 | 4369470796 | $314.46 | Yes | A | Staged, folder 08 (part 1), missing `SakuraGlassyChatWidget.zip` locally (noted in part 1) |
| 13 | 4320003692 | $297.29 | Yes | A | Partially staged, folder 90, missing `WebcamandChatbox.zip`, `Ornaments.zip`, `GoalCode.zip`, `ChatCode.zip` |
| 14 | 1797449100 | $273.43 | Yes | A | Staged, folder 22, complete |
| 15 | 1723478277 | $241.81 | Yes | A | Partially staged, missing `peachupdatecode.zip` |
| 16 | 4322607453 | $207.48 | **Not in the mapped 103** (see unmapped section, probable match found) | n/a | Content complete on Etsy, not staged, mapping gap |
| 17 | 4361409311 | $201.03 | **Not found on Shopify storefront at all**, appears Etsy-only | n/a | Out of scope for this audit, flagged for awareness |
| 18 | 4378021918 | $184.26 | **Not found on Shopify storefront at all**, appears Etsy-only | n/a | Out of scope for this audit, flagged for awareness |
| 19 | 4403587938 | $183.00 | **Not found on Shopify storefront at all**, appears Etsy-only | n/a | Etsy listing itself only has 1 PDF, no zip. Suspicious even for Etsy. Flagged for awareness, not a Shopify problem. |
| 20 | 1728594513 | $176.85 | Yes | A | Staged, folder 21, complete |

**8 of the top 20 have a delivery problem today**: #1 and #9 have zero files anywhere on this Mac
and must be pulled from Etsy before ads run. #3 and #7 ship with no setup doc at all. #11, #12,
#13, #15 are missing at least one file locally (already flagged in part 1 or the new staging pass).
#16, #17, #18, #19 sit outside the mapped 103 entirely and were not part of the primary staging
pass; #19 additionally has no zip file on Etsy itself.

## Summary

- Bucket counts: A 96, B 7, C 0, D 0 (of 103 mapped products).
- Newly staged: 124 files across 85 products (folders 12 to 104), on top of the 17 files across
  11 products already staged in the part 1 pass.
- Fully missing locally (0 files found, must come entirely from Etsy): 8 products.
- Partially missing locally: 66 products, each with its own `MISSING - GET FROM ETSY.txt`.
- Unmapped: 28 products. 1 bundle (celestial-stream-kit, fine, local-only by design). 2 probable
  real Etsy matches found by title search, not yet added to the map, content looks fine on Etsy.
  25 genuinely unknown, unverified, highest risk in the catalog.
- Top 20 by revenue: 8 have a delivery problem today, including the single largest revenue
  listing in the shop (4333471272, $3,685.82, zero files anywhere and no setup doc on Etsy).

No file was deleted, overwritten, or fabricated. Nothing was committed or deployed. `LAUNCH.md`
was not touched.
