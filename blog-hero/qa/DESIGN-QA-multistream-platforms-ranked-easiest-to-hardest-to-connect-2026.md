# DESIGN QA: blog hero, `multistream-platforms-ranked-easiest-to-hardest-to-connect-2026`

Gate: `~/Desktop/design-research/design-qa-checklist.md`. Run 2026-09-24 on the
2400x1260 master `out/multistream-platforms-ranked-easiest-to-hardest-to-connect-2026.png`
and the 1600x840 upload `upload/multistream-platforms-ranked-easiest-to-hardest-to-connect-2026.jpg`.

Scope: CHROME (`content/brand/brand.rules.json` scope.chrome, "storefront pages and hero").

## Stage 0, inputs

| Input | State |
|---|---|
| Brief | Hero card for the ranked-platforms roundup, scheduled 2026-09-29. One job: signal "ranking, easiest to hardest" before the reader scrolls, distinct from the explainer's hero which states the widget-vs-tool distinction. |
| Brand kit | `content/brand/brand.tokens.json`, `brand.rules.json`. Palette deltaE tolerance 3.0. |
| Format | 1600x840 JPEG sRGB, matching the live article set (`upload/*.jpg`, all 1600x840). Authored at 2400x1260 and downscaled once. |
| Licences | Space Grotesk and Baloo 2, both SIL OFL, `fonts/*.woff2`. No AI-generated element. Art is a live render of `celestial-multistream-chat`, a real SWS widget, captured via `render_article_widgets.mjs`. |

## Stage 1, blockers

### B1 Message: PASS
- One message: the ranking itself, easiest to hardest to connect. Headline "One click here. No path in over there." names the two ends of the ranking, nothing competes with it.
- Legible at card size: headline is 62px on the 1200 canvas (2x render), the largest type on the card.
- Every word proofread. Real composited type from the template, no AI letterforms, no cut words. `build_heroes.py` contains the art fully (`BLEED_MAX 0`, 34px bottom margin).
- 9 words of type total on the card. No CTA, so the CTA rule does not apply.
- Headline and image are complementary: the headline states the ranking's spread, the art shows a live merged chat feed, the thing being ranked.

### B2 Brand rules: **FAIL**, template-wide and theme-wide, not new to this card
Measured deltaE (CIE76, D65) of each chrome colour against the nearest `palette.allowedHex`, tolerance 3.0.

| Element | Hex | Nearest allowed | deltaE | |
|---|---|---|---|---|
| field base1 | `#12030f` | `#0b0713` | 3.65 | FAIL |
| field base2 | `#2a0724` | `#180f28` | 11.77 | FAIL |
| field base3 | `#3d0b33` | `#180f28` | 18.95 | FAIL |
| accent / kicker dot | `#ff5fd0` | `#f2a6d8` | 40.69 | FAIL |
| kicker text (hero.html fixed) | `#ffe9fb` | `#f3ecff` | 5.31 | FAIL |
| headline gradient stop 1 (fixed) | `#ffffff` | `#fef8e8` | 8.74 | FAIL |
| headline gradient stop 2 (fixed) | `#ffd9f2` | `#f3ecff` | 12.22 | FAIL |
| headline gradient stop 3 (fixed) | `#d9c4ff` | `#a89ec4` | 18.97 | FAIL |
| headline gradient stop 4 (fixed) | `#a8e9ff` | `#f3ecff` | 23.40 | FAIL |
| rule stop 1 (fixed) | `#f2a6d8` | `#f2a6d8` | 0.00 | pass |
| rule stop 2 (fixed) | `#b79df2` | `#b79df2` | 0.00 | pass |
| rule stop 3 (fixed) | `#7fe6ff` | `#f3ecff` | 33.07 | FAIL |
| footer text (fixed) | `#efe6ff` | `#f3ecff` | 3.69 | FAIL |

11 of 13 chrome colours are outside tolerance. This is the same standing issue raised 2026-09-22 on the explainer's hero: the kicker text, headline gradient and footer text are hardcoded in `hero.html` and carried by every card in the set. This card additionally shows the issue is not confined to the shared template markup: the per-hero **theme accent and field tones** (`themes.json` "ember", jittered by `build_heroes.py`) also sit outside the palette, and further outside than "violet" did on the explainer's card (deltaE 0.00 there vs 40.69 here for the accent alone), because the palette rotation was built to avoid visual monotony across the set and was never checked against `brand.rules.json`. **Not resolved here, same open decision as 2026-09-22**: whether the hero template's own colour system becomes a documented exception to chrome strictness, or the template and its theme rotation get rebuilt to the palette. Repainting only this card to the palette would make it the one card that does not match the set (System item 12), so it ships matching the set, fail recorded, decision still Todd's.

Other B2 items: typefaces are the two in the kit's display and UI faces, both real woff2 served over http, no silent fallback. Spacing is the template's own unchanged geometry. No logo lockup on the card (footer is wordmark plus domain), so clear space and minimum size do not apply. No fake urgency, no fabricated social proof. Chat lines in the art are generic, name no real person, name no platform the widget does not actually read.

### B3 Contrast, computed: PASS
Sampled from rendered pixels of the 2400 master. Method: for each labelled region, threshold the crop's grayscale into a glyph mask (top 8% brightest, the ink) and a field mask (bottom 40%, the backdrop actually behind the text), take the dimmest glyph pixel from the upper half of the glyph luminance distribution (excludes antialiased edge pixels) against the brightest field pixel in the same crop, then the WCAG 2.2 luminance formula.

| Element | Worst measured | Needs | |
|---|---|---|---|
| kicker "MULTISTREAM PLATFORMS", pill interior | **12.91:1** | 4.5:1 | PASS |
| headline line 1, "One click here." (62px bold, large) | **12.30:1** | 3:1 | PASS |
| headline line 2, "No path in" | **11.72:1** | 3:1 | PASS |
| headline line 3, "over there." | **11.20:1** | 3:1 | PASS |
| accent rule, non-text | **4.78:1** | 3:1 | PASS |
| footer wordmark text | **8.22:1** | 4.5:1 | PASS |

All comfortably clear their thresholds. Numbers read higher than the 2026-09-22 card's 5.6-9.8:1 range because the sampling window here is a tighter percentile crop (top 8%/bottom 40%) rather than a fixed-box crop; both methods sample real rendered pixels rather than eyeballing, and both pass, so the difference is measurement granularity, not a different result.

Transparent renders were composited before sampling: the widget capture is alpha, `compose.mjs` flattens it onto the card field before the PNG is written, so the measured image is the one a viewer sees.

### B4 Licences and rights: PASS
- Space Grotesk: SIL OFL. Baloo 2: SIL OFL. Both rendered to raster here, not distributed as software.
- No stock asset.
- **No AI-generated element**, so no vendor terms check applies. The art is a headless-Chrome capture of `celestial-multistream-chat` running in Widget Stage, an SWS-owned widget, with a fresh chat feed seeded from this article's own handle.
- No third-party IP. No game, franchise or character named, on the card or in the chat lines. No traced or derived reference.
- No impersonation. Chat handles in the art are invented generic handles, decorative, not presented as testimonials.

### B5 Production integrity: PASS
- 1600x840 sRGB JPEG, matching the live article set. Aspect 1.9048, identical to the 2400x1260 master, so the downscale is not a crop.
- sRGB ICC profile embedded, 588 bytes, same as the 2026-09-22 upload. Not profile-less.
- No alpha claimed on the JPEG. Source capture's alpha was composited by `compose.mjs`, not dropped silently.
- 252 KB. Within budget for a blog hero.
- Not print, so bleed, DPI and rich black do not apply.
- Type is rendered from live woff2, outlined only in the raster output.

**Gate result: B1 PASS, B2 FAIL (inherited, template and theme rotation, raised 2026-09-22, still Todd's call), B3 PASS, B4 PASS, B5 PASS.**

## Stage 2, quality score

Run despite the B2 fail, same basis as 2026-09-22: the fail is inherited, the card is still judged against the set it joins.

| # | Item | Score |
|---|---|---|
| 1 | Idea states in one sentence, is an idea not a decoration | 2 |
| 2 | Solves a named need: which platform is worth the setup time before you start | 2 |
| 3 | Distinct from the category default | 1 (house template, same as every other card) |
| 4 | Hierarchy reads under 2s | 2 |
| 5 | Two families, Baloo 2 display and Space Grotesk UI | 2 |
| 6 | Line length and leading | 2 |
| 7 | Colour ramp evenness and 60/30/10 | 1 (hand-picked HSL-era gradient, not OKLCH) |
| 8 | Alignment on grid, art contained | 2 |
| 9 | Whitespace deliberate | 2 |
| 10 | Gestalt grouping | 2 |
| 11 | Regenerable as a parameter change, not a redraw | 2 (one row in `map.json`, then three commands) |
| 12 | Sits beside the last three in the line as one brand | 2 |
| 13 | Survives worst delivery context | 1 (checked at card size and full size only, not a 1:1 social crop) |
| 14 | Edges and kerning at 200% | 2 |
| 15 | No leftovers | 2 |

**26 / 30.** Weak: #3 and #7 template-inherited, #13 partially checked.

## Stage 3, critique

- **Objective, and does it meet it:** make "this is a ranking, not a definition" legible before the reader scrolls, and keep it visually distinct from the explainer's hero already on the blog index. It does: different theme (ember vs gold), different headline shape, different widget capture content.
- **Single change that would improve it most:** same as 2026-09-22, at the template level: bring the headline gradient and field bases inside the palette, or document the hero system as an approved chrome exception, for all cards at once rather than per card.
- **What was not checked, and why:** cropped to a 1:1 social crop, because nothing in this pipeline emits one. Print output not checked, screen only. The other 44 heroes were not re-measured for B2 individually; the fail is asserted from the shared template source plus this card's own theme values, not from a full re-audit of the set.
- **Uncertainty, and what would settle it:** identical open question to 2026-09-22, whether the hero template's palette and theme rotation are a deliberate chrome exception or unmeasured drift. Todd deciding it settles it for every card at once, this one included.

Created by: Claude claude-sonnet-5 2026-09-24
Last edited by: Claude claude-sonnet-5 2026-09-24 · Design gate run on new ranked-platforms article hero
