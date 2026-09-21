# Product slug rename plan

**Status: PROPOSAL. Nothing has been changed.** Todd approves, then this is applied
through the Shopify MCP and verified.

## Why

Every product handle was auto-generated at import from a legacy Etsy title
template, `"<name> is fully customisable for Twitch Streamlabs TikTok Studio and
Streamelements"`. The titles have since been rewritten; **a Shopify handle does
not follow a title rename**, so all 123 froze at their 2025 import value.

Measured live from `sitemap/products/1.xml`, 123 products:

| | old | new |
|---|---|---|
| median handle length | 119 | 28 |
| max handle length | 135 | 43 |
| over 60 chars | 120 | 0 |

That is 10,593 characters removed from the catalogue's URLs.

Two things are wrong with the current handles, not one:

1. **Length.** A 135 character slug is truncated in every search result, every
   share card and every ad.
2. **Accuracy.** They assert platform support the product page deliberately does
   not claim. The Potion Bottle handle says `tiktok-studio`; its Etsy body says
   "THIS ITEM IS FOR OBS/OBS STUDIO, STREAMLABS, AND STREAMELEMENTS" and its live
   Works With reads StreamElements, StreamLabs, OBS Studio, Twitch. This is the
   same failure `audit-descriptions.mjs` already guards for description copy:
   never derive a platform claim from an Etsy title.

## The rule

```
<subject>-<product-type>        lowercase, hyphens, max 50 chars
```

- **Subject** comes from the current, cleaned product title, capped at 4 words.
- **Product type** comes from `productType`: `goal-widget`, `chat-widget`,
  `kit`, `overlay`, `decoration`, `emotes`.
- **No platform names in a slug, ever.** Not twitch, streamlabs, streamelements,
  tiktok, kick, youtube or obs. Compatibility belongs in the title, the
  description and `custom.works_with`, where it is checked against the listing
  body. Putting it in the URL is what created this mess, and a slug keyword is
  worth very little to Google next to the title and H1.
- Marketing filler is dropped: "fully customisable", "animated", "liquid
  filling", "cute", "minimal", "elegant", "clean vibe", "digital download".

Longest result is 43 chars, so the 50 cap has headroom for new products.

## Risk, and how it is handled

**A handle change through the API does NOT create a redirect.** That is a
convenience of the admin UI only; `productUpdate` just moves the URL and the old
one starts 404ing. Confirmed against the Admin API docs. So every rename is two
operations, and the redirect is not optional:

```
productUpdate(input: {id, handle})
urlRedirectCreate(urlRedirect: {path: "/products/<old>", target: "/products/<new>"})
```

With the 301 in place, existing links keep working: Etsy traffic, the X ads,
Typefully posts, Pinterest, anything already indexed. Google transfers ranking
across a 301.

**Two things must be fixed in the same pass:**

1. `scripts/verify-cutover.mjs:76` hardcodes
   `products/neon-aesthetic-glowy-transparent-chat-and-goal-stream-widgets-minimal-neon-light-elegant-glow-theme-clean-vibe-streamelement-only`.
   It breaks unless updated to the new handle.
2. One collision surfaced and it is worth a look on its own: **"Celestial Cute
   Moon"** and **"Celestial Moon Cute"** reduce to the same slug. They may be
   duplicate products. The plan disambiguates the second as
   `celestial-moon-goal-widget-2`, which is a placeholder, not a decision.

**Not touched by this plan:** titles, descriptions, prices, images, tags,
metafields, inventory, publications.

## Suggested order

Rename one product first, confirm the 301 resolves and the PDP renders, then
run the rest in batches with `npm run audit:site` after each.

## The full mapping

| new handle | len | was | product |
|---|---|---|---|
| `10x-frog-little-froggy-emotes` | 29 | 99 | 10x FROG Emotes (Pack 1 & 2) for Twitch - Cute little Frog |
| `angel-love-bar-loading-goal-widget` | 34 | 106 | Angel Love Bar Loading Goal Widget is fully customisable f |
| `bat-goal-widget` | 15 | 112 | Cute Bat Liquid Filling Goal Widget is fully customisable  |
| `bloodworm-nature-insects-goal-widget` | 36 | 133 | Cute Bloodworm Nature Insects Liquid Filling Goal Widget i |
| `blue-whale-goal-widget` | 22 | 119 | Cute Blue Whale Liquid Filling Goal Widget is fully custom |
| `boba-drink-goal-widget` | 22 | 124 | Boba Drink Goal Widget for Twitch | Cute Progress Bar | St |
| `broken-heart-bar-goal-widget` | 28 | 108 | Broken Heart Bar Goal Widget for Twitch | OBS StreamElemen |
| `broken-heart-first-aid-goal-widget` | 34 | 126 | Broken Heart First Aid Liquid Filling Goal Widget is fully |
| `broken-star-bar-goal-widget` | 27 | 107 | Broken Star Bar Goal Widget for Twitch | OBS StreamElement |
| `bunny-goal-chat-widget` | 22 | 105 | Cute Bunny Chat & Liquid Filling Goal Widget is fully cust |
| `butterfly-combo-goal-widget` | 27 | 129 | Butterfly Vibe Combo Goal | Liquid Filling Goal Widget is  |
| `butterfly-galaxy-goal-chat-widget` | 33 | 135 | Butterfly Galaxy Chat & Goal Widgets for Twitch | Glass Th |
| `butterfly-goal-widget` | 21 | 113 | Butterfly Liquid Filling Goal Widget is fully customisable |
| `casino-card-slot-icon-goal-widget` | 33 | 118 | Casino Card Slot Icon Glass Goal Widget-Cute Minimal Custo |
| `cat-goth-goal-widget` | 20 | 134 | Cat Goth Goal Widget | Cat Skull Liquid Filling Goal Widge |
| `cat-paw-alert-goal-widget` | 25 | 129 | Cute Cat Paw Alert Widget | Liquid Filling Goal Widget is  |
| `celestial-butterfly-goal-chat-widget` | 36 | 110 | Celestial Butterfly Chat and Goal Widget for Twitch, Elega |
| `celestial-kit` | 13 | 20 | Celestial Stream Kit | 10 Moon and Star Twitch Overlays, 5 |
| `celestial-moon-goal-widget` | 26 | 123 | Celestial Cute Moon Liquid Filling Goal Widget is fully cu |
| `celestial-moon-goal-widget-2` | 28 | 123 | Celestial Moon Cute Liquid Filling Goal Widget is fully cu |
| `celestial-star-goal-widget` | 26 | 87 | Celestial Star Goal Widget for Twitch and Kick, Animated P |
| `chicken-goal-widget` | 19 | 116 | Cute Chicken Liquid Filling Goal Widget is fully customisa |
| `christmas-candy-cane-goal-widget` | 32 | 124 | Christmas Candy Cane Liquid Filling Goal Widget is fully c |
| `christmas-combo-goal-widget` | 27 | 119 | Christmas COMBO Liquid Filling Goal Widget is fully custom |
| `christmas-giftbox-goal-widget` | 29 | 121 | Christmas GiftBox Liquid Filling Goal Widget is fully cust |
| `christmas-holly-leaves-goal-widget` | 34 | 126 | Christmas Holly Leaves Liquid Filling Goal Widget is fully |
| `classical-floral-purple-goal-chat-widget` | 40 | 132 | Classical Floral Purple Chat and Goal Widget •Minimal, Sta |
| `classical-floral-red-goal-chat-widget` | 37 | 121 | Classical Floral Red Chat & Goal Widgets for Twitch | Eleg |
| `classical-tarot-card-goal-chat-widget` | 37 | 118 | Classical Tarot Card Chat and Goal Widget • Minimal, Mysti |
| `cosmic-galaxy-goal-chat-widget` | 30 | 134 | Cosmic Galaxy Chat and Goal Widget for Twitch, Glass Theme |
| `cow-goal-widget` | 15 | 112 | Cute Cow Liquid Filling Goal Widget is fully customisable  |
| `crystal-moon-chat-goal-overlay` | 30 | 112 | Crystal Moon Chat and Goal Widget for Twitch, Starry Night |
| `demon-samurai-pack-katana-overlay` | 33 | 99 | Demon Samurai Stream Overlay Pack, Animated Katana Goal Ba |
| `devil-angel-goal-widget` | 23 | 124 | Devil and Angel Goal Widget for Twitch | Combo Liquid Fill |
| `diamond-butterfly-goal-widget` | 29 | 122 | Diamond Butterfly Liquid Filling Goal Widget is fully cust |
| `dog-arrow-bar-loading-goal-widget` | 33 | 105 | Dog Arrow Bar Loading Goal Widget is fully customisable fo |
| `dog-goal-widget` | 15 | 112 | Cute Dog Liquid Filling Goal Widget is fully customisable  |
| `dog-toast-goal-widget` | 21 | 118 | Cute Dog Toast Liquid Filling Goal Widget is fully customi |
| `dreamy-lotus-goal-chat-widget` | 29 | 117 | Dreamy Lotus Chat & Goal Widgets for Twitch | Glass Theme  |
| `envelope-goal-widget` | 20 | 113 | Envelope Liquid Filling Goal Widget is fully customisable  |
| `floral-purple-starry-mystical-chat-widget` | 41 | 127 | Floral Purple Chat Widget • Minimal, Starry, Mystical Eleg |
| `froggy-animation-goal-widget` | 28 | 122 | Froggy Goal Widget for Twitch, Kick, YouTube, Liquid Fill  |
| `full-moon-bar-loading-goal-widget` | 33 | 105 | Full Moon Bar Loading Goal Widget is fully customisable fo |
| `game-machine-old-arcade-goal-widget` | 35 | 127 | Game Machine Old Arcade Liquid Filling Goal Widget is full |
| `ghost-goal-widget` | 17 | 114 | Cute Ghost Liquid Filling Goal Widget is fully customisabl |
| `goal-chat-widget` | 16 | 112 | Glassy Chat & Goal Widgets for Twitch | Modern Elegant | S |
| `goth-spell-book-spooky-goal-widget` | 34 | 132 | Goth Spell Book Spooky Vibes Liquid Filling Goal Widget is |
| `gothic-bottle-goal-widget` | 25 | 117 | Gothic Bottle Liquid Filling Goal Widget is fully customis |
| `halloween-eye-potion-bottle-goal-widget` | 39 | 131 | Halloween Eye potion bottle Liquid Filling Goal Widget is  |
| `halloween-neon-chat-widget` | 26 | 83 | Halloween Neon vibes Stream Chat Widgets: Transparent Neon |
| `halloween-pumpkin-goal-widget` | 29 | 121 | Halloween Pumpkin Goal Widget for Twitch | Cat Pumpkin Liq |
| `halloween-spider-goal-widget` | 28 | 120 | Halloween Spider Liquid Filling Goal Widget is fully custo |
| `halloween-spooky-tea-bag-goal-widget` | 36 | 128 | Halloween Spooky Tea Bag Liquid Filling Goal Widget is ful |
| `kettle-ghost-goal-widget` | 24 | 128 | Kettle Ghost Goal Widget Liquid Filling Goal Widget is ful |
| `lantern-aesthetic-goal-widget` | 29 | 121 | Lantern Aesthetic Liquid Filling Goal Widget is fully cust |
| `line-simple-pronouns-alerts-chat-widget` | 39 | 129 | Minimal Line Chat Widget • Simple Line, Minimal Theme With |
| `liquid-bar-star-alerts-goal-widget` | 34 | 98 | Twitch Liquid Goal Bar Widget - Vtuber Asset - Star Alerts |
| `liquid-combo-bar-alerts-goal-widget` | 35 | 99 | Twitch Liquid Combo Goal Bar Widget - Vtuber Asset - Alert |
| `lotus-butterfly-goal-chat-widget` | 32 | 120 | Lotus Butterfly Chat & Goal Widgets for Twitch | Glass The |
| `love-bottle-goal-widget` | 23 | 115 | Love Bottle Liquid Filling Goal Widget is fully customisab |
| `love-ghost-goal-widget` | 22 | 119 | Cute Love Ghost Liquid Filling Goal Widget is fully custom |
| `love-pumpkin-goal-widget` | 24 | 128 | Love Pumpkin Goal Widget | Liquid Filling Goal Widget is f |
| `love-skeleton-halloween-goal-widget` | 35 | 130 | Love Skeleton Goal Widget for Twitch, Halloween Liquid Fil |
| `lunar-cat-aesthetic-light-chat-widget` | 37 | 126 | Lunar Cat Aesthetic Light Purple Chat & Goal Stream Widget |
| `lunar-cat-goal-chat-widget` | 26 | 125 | Lunar Cat Chat & Goal Widgets for Twitch | Dark Purple | S |
| `mango-goal-widget` | 17 | 114 | Cute Mango Liquid Filling Goal Widget is fully customisabl |
| `melting-moon-goal-widget` | 24 | 121 | Cute Melting Moon Liquid Filling Goal Widget is fully cust |
| `minimalist-heart-goal-widget` | 28 | 125 | Cute Minimalist Heart Liquid Filling Goal Widget is fully  |
| `moon-cloud-donation-dreamy-goal-widget` | 38 | 77 | Moon Cloud Donation Goal Widget for Twitch, Dreamy Glass T |
| `moon-jar-real-falling-goal-widget` | 33 | 92 | Moon Jar Goal Widget for Twitch, YouTube, Kick, Real Falli |
| `moth-goal-widget` | 16 | 125 | Cute Moth Goal Widget | Liquid Filling Goal Widget is full |
| `multistream-chat-pack-kit` | 25 | 28 | Multistream Chat Widget Pack | 10 Overlay Skins for Twitch |
| `multistream-one-click-install-chat-widget` | 41 | 102 | Multistream Chat Widget for Twitch, YouTube, Kick, One Cli |
| `mushroom-goal-widget` | 20 | 124 | Mushroom Goal Widget | Liquid Filling Goal Widget is fully |
| `musical-ghost-goal-widget` | 25 | 131 | Musical Ghost Goal Widget | Halloween Liquid Goal Widget i |
| `nature-potion-bottle-glass-goal-widget` | 38 | 132 | Nature Potion Bottle Glass Goal Widget - Cute Minimal Cust |
| `neon-glow-goal-chat-widget` | 26 | 129 | Neon Glow Chat and Goal Widget for Twitch, Transparent Glo |
| `neon-moon-glow-goal-chat-widget` | 31 | 121 | Neon Moon Glow Chat and Goal Widget for Twitch, StreamElem |
| `neon-multistream-glow-chat-widget` | 33 | 82 | Neon Multistream Chat Widget for Twitch, YouTube, Kick, Gl |
| `octopus-goal-widget` | 19 | 117 | Cute Octopus Liquid Filling Goal Widget is fully customisa |
| `owl-goal-widget` | 15 | 112 | Cute Owl Liquid Filling Goal Widget is fully customisable  |
| `panda-moon-goal-widget` | 22 | 125 | Panda Moon Goal Widget for Twitch | 3 Style Combo Liquid F |
| `pastel-bubble-gradient-pronouns-chat-widget` | 43 | 132 | Pastel Bubble Chat Widget • Pastel Gradient, Minimal Theme |
| `pastel-cloud-goal-widget` | 24 | 124 | Pastel Cloud Stream Widget | Cute Rainbow Cloud Fully Cust |
| `pastel-color-bubble-streamers-chat-widget` | 41 | 90 | Pastel color minimal chat bubble for Twitch Streamers | St |
| `peach-glass-goal-widget` | 23 | 121 | Cute Peach Glass Goal Widget-Cute Minimal Customizable Goa |
| `photo-cam-shutter-pronouns-chat-widget` | 38 | 130 | Minimal Photo Chat Widget • Cam Shutter, Minimal Theme Wit |
| `plants-dreamy-goal-celestial-chat-widget` | 40 | 104 | Plants Vibe Dreamy Chat & Goal Stream Widgets - Minimal, c |
| `potion-bottle-goal-widget` | 25 | 135 | Potion Bottle Goal Widget for Twitch, Liquid Fill Progress |
| `pumpkin-goal-widget` | 19 | 116 | Pumpkin Goal Widget for Twitch | Liquid Fill Halloween Tra |
| `rabbit-animation-goal-widget` | 28 | 115 | Rabbit Goal Widget, Liquid Fill Animation, StreamElements  |
| `retro-file-love-pronouns-chat-widget` | 36 | 116 | Retro File Love Chat Widget •,Minimal Theme With Pronouns  |
| `saber-neon-goal-glowing-chat-widget` | 35 | 96 | Saber Neon Chat and Goal Widget for Twitch, Glowing Neon T |
| `sakura-butterfly-goal-chat-widget` | 33 | 116 | Sakura Butterfly Chat & Goal Widgets for Twitch | Pastel C |
| `sakura-dessert-loading-goal-widget` | 34 | 82 | Sakura Dessert Loading Goal Widget is fully customisable f |
| `sakura-floral-goal-glass-chat-widget` | 36 | 127 | Sakura Floral Chat and Goal Widget for Twitch, Glass Petal |
| `sakura-goal-chat-widget` | 23 | 86 | Sakura Chat and Goal Widget for Twitch | Cherry Blossom |  |
| `sakura-goal-floral-chat-widget` | 30 | 86 | Sakura Glassy Chat and Goal Widget for Twitch, Floral Glas |
| `sand-timer-goal-widget` | 22 | 119 | Cute Sand Timer Liquid Filling Goal Widget is fully custom |
| `santa-gloves-goal-widget` | 24 | 116 | Santa Gloves Liquid Filling Goal Widget is fully customisa |
| `santa-goal-widget` | 17 | 114 | Cute Santa Liquid Filling Goal Widget is fully customisabl |
| `sea-horse-goal-widget` | 21 | 118 | Cute Sea Horse Liquid Filling Goal Widget is fully customi |
| `seal-goal-widget` | 16 | 114 | Cute Seal Liquid Filling Goal Widget is fully customisable |
| `slow-pour-cozy-cafe-overlay` | 27 | 99 | Slow Pour Cozy Cafe Stream Overlay | StreamElements Widget |
| `snowman-goal-widget` | 19 | 111 | Snowman Liquid Filling Goal Widget is fully customisable f |
| `sparkling-diamond-goal-widget` | 29 | 121 | Sparkling Diamond Liquid Filling Goal Widget is fully cust |
| `spooky-bat-goal-widget` | 22 | 119 | Cute Spooky Bat Liquid Filling Goal Widget is fully custom |
| `spooky-cauldron-goal-widget` | 27 | 120 | Spooky Cauldron Goal Widget for Twitch | Halloween Liquid  |
| `spooky-halloween-goal-chat-widget` | 33 | 114 | Spooky Halloween Chat & Goal Widgets for Twitch | Starry N |
| `spooky-kit` | 10 | 17 | Spooky Stream Kit | 8 Halloween Twitch Overlays, 3 Chat Wi |
| `spooky-pastel-color-skull-goal-widget` | 37 | 133 | Spooky Pastel color Skull Ghost Combo Liquid Goal Widget i |
| `spooky-skull-ghost-goal-widget` | 30 | 122 | Spooky Skull Ghost Liquid Filling Goal Widget is fully cus |
| `spooky-skull-moon-ghost-goal-widget` | 35 | 127 | Spooky Skull Moon Ghost Liquid Filling Goal Widget is full |
| `star-bottle-glass-goal-widget` | 29 | 122 | Star Bottle Glass Goal Widget-Cute Minimal Customizable Go |
| `star-bottle-goal-widget` | 23 | 120 | Cute Star Bottle Liquid Filling Goal Widget is fully custo |
| `starry-goal-widget` | 18 | 129 | Starry Stream Widget | Moon Liquid Filling Goal Widget is  |
| `thanks-giving-tot-bag-goal-widget` | 33 | 125 | Thanks Giving Tot Bag Liquid Filling Goal Widget is fully  |
| `tombstone-ghost-goal-widget` | 27 | 119 | Tombstone Ghost Liquid Filling Goal Widget is fully custom |
| `twin-ghost-goal-widget` | 22 | 114 | Twin Ghost Liquid Filling Goal Widget is fully customisabl |
| `twin-skull-berry-goal-widget` | 28 | 107 | Twin skull berry Goal Widget | cute fully customisable for |
| `water-fire-nature-cloud-goal-widget` | 35 | 127 | Water, Fire, Nature & Cloud Liquid Filling Goal Widget is  |
| `y2k-sticker-retro-alerts-chat-widget` | 36 | 75 | Y2K Sticker Chat Widget for Twitch, YouTube, Kick, TikTok, |
| `yakitori-skewered-goal-widget` | 29 | 121 | Yakitori Skewered Liquid Filling Goal Widget is fully cust |

---

Created by: Claude claude-opus-5 2026-09-20
Last edited by: Claude claude-opus-5 2026-09-20 · Proposal drafted from 123 live handles, nothing applied
