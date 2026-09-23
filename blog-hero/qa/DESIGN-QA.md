# DESIGN QA: blog hero, `what-is-multistreaming-and-what-a-multistream-widget-actually-does`

Gate: `~/Desktop/design-research/design-qa-checklist.md`. Run 2026-09-22 on the
2400x1260 master `out/what-is-multistreaming-and-what-a-multistream-widget-actually-does.png`
and the 1600x840 upload `upload/what-is-multistreaming-and-what-a-multistream-widget-actually-does.jpg`.

Scope: CHROME (`content/brand/brand.rules.json` scope.chrome, "storefront pages and hero").

## Stage 0, inputs

| Input | State |
|---|---|
| Brief | Hero card for a definitional blog article. Seen in the blog index grid and at the top of the article. One job: state the widget-versus-tool distinction before the reader scrolls. |
| Brand kit | `content/brand/brand.tokens.json`, `brand.rules.json`. Palette deltaE tolerance 3.0. |
| Format | 1600x840 JPEG sRGB, per the live article set (`upload/*.jpg`, all 1600x840). Authored at 2400x1260 and downscaled once. |
| Licences | Space Grotesk and Baloo 2, both SIL OFL, `fonts/*.woff2`. No AI-generated element. Art is a live render of a real SWS widget. |

## Stage 1, blockers

### B1 Message: PASS
- One message: the widget reads chat, the tool sends the stream. Headline states it outright, nothing competes with it.
- Legible at card size. Headline is 58px on a 1200 canvas, the largest type on the card.
- Every word proofread. Real composited type from the template, no AI letterforms, no cut words. `build_heroes.py` BLEED_MAX 0 plus 34px bottom margin, art fully contained.
- 12 words of type total. No CTA, so the CTA rule does not apply.
- Headline and image are complementary: the headline names the distinction, the art shows the merged feed it describes.

### B2 Brand rules: **FAIL**, template-wide, not specific to this card
Measured deltaE (CIE76, D65) of each chrome colour against the nearest
`palette.allowedHex`. Tolerance is 3.0.

| Element | Hex | Nearest allowed | deltaE | |
|---|---|---|---|---|
| field base1 | `#07040f` | `#0b0713` | 1.47 | pass |
| accent dot and rule | `#b79df2` | `#b79df2` | 0.00 | pass |
| field base2 | `#180e30` | `#180f28` | 6.66 | FAIL |
| field base3 | `#241448` | `#180f28` | 19.14 | FAIL |
| kicker text | `#ffe9fb` | `#f3ecff` | 5.31 | FAIL |
| headline gradient stop 1 | `#ffffff` | `#fef8e8` | 8.74 | FAIL |
| headline gradient stop 2 | `#ffd9f2` | `#f3ecff` | 12.21 | FAIL |
| headline gradient stop 3 | `#d9c4ff` | `#a89ec4` | 18.97 | FAIL |
| headline gradient stop 4 | `#a8e9ff` | `#f3ecff` | 23.40 | FAIL |

7 of 9 chrome colours are outside tolerance. **These values come from
`hero.html` and `themes.json`, so every one of the 44 heroes carries them,
including the 43 already live since 2026-09-15.** This card is not a new
divergence; it is the existing template measured for the first time. Repainting
this one card to the palette would make it the only card that does not match the
set, which fails System item 12 instead.

Not resolvable inside this run: whether the hero template's field and headline
ramp become canon or the set gets re-rendered is a standing brand decision.
Raised for Todd rather than decided here.

Other B2 items: typefaces are the two in the kit's display and UI faces, both
present as real woff2 and served over http so no silent fallback. Spacing is the
template's own 8pt-derived geometry, unchanged. No logo lockup on the card, so
clear space and minimum size do not apply; the footer is a wordmark plus the
domain. No fake urgency, no fabricated social proof. Chat lines in the art are
generic and name no real person.

### B3 Contrast, computed: PASS
Sampled from rendered pixels of the 2400 master. Method: threshold ink against
field, take the dimmest **solid** glyph pixel (upper half of the ink
distribution, so antialiased edges are excluded) against the brightest pixel of
the **actual backdrop that text sits on**, then WCAG 2.2 luminance formula.

| Element | Worst measured | Needs | |
|---|---|---|---|
| kicker MULTISTREAMING, on its pill interior | **5.59:1** | 4.5:1 | PASS |
| headline line 1 (58px bold, large) | **5.94:1** | 3:1 | PASS |
| headline line 2 | **6.05:1** | 3:1 | PASS |
| headline line 3 | **6.56:1** | 3:1 | PASS |
| headline line 4 | **6.96:1** | 3:1 | PASS |
| footer wordmark text | **9.77:1** | 4.5:1 | PASS |
| accent rule, non-text | **5.14:1** | 3:1 | PASS |

The kicker is treated as normal text, not large: 17px bold is under the 18.5px
bold large-text threshold. It passes the stricter bar anyway.

Note on method, because it changed the answer: sampling the backdrop as "the
brightest pixel anywhere in the text's bounding box" returned 3.70:1 for the
kicker. That window was picking up the pill's own 1px border and its outer
`box-shadow` glow, neither of which sits behind the letters. Measured against the
pill interior, which is what the text is actually on, it is 5.59:1. Stated here
so the number is reproducible and the earlier figure is not quoted as a failure.

Transparent renders were composited before sampling: the widget capture is
alpha, and `compose.mjs` flattens it onto the card field before the PNG is
written, so the measured image is the one a viewer sees.

### B4 Licences and rights: PASS
- Space Grotesk: SIL OFL. Baloo 2: SIL OFL. Both rendered to raster here, not distributed as software.
- No stock asset.
- **No AI-generated element**, so no vendor terms check applies. The art is a headless-Chrome capture of `celestial-multistream-chat` running in Widget Stage, an SWS-owned widget.
- No third-party IP. No game, franchise or character named, on the card or in the chat lines. No traced or derived reference.
- No impersonation. Chat handles in the art are invented generic handles, not real accounts, and are decorative, not presented as testimonials.

### B5 Production integrity: PASS
- 1600x840 sRGB JPEG, matching all 43 live article heroes. Aspect 1.9048, identical to the 2400x1260 master, so the downscale is not a crop.
- sRGB ICC profile embedded, 588 bytes. Not profile-less. (The 43 existing uploads carry no profile; this is stricter than the set, not looser.)
- No alpha claimed on the JPEG. The source capture's alpha was composited, not dropped silently.
- 227 KB. Within budget for a blog hero.
- Not print, so bleed, DPI and rich black do not apply.
- Type is rendered from live woff2, outlined only in the raster output.

**Gate result: B1 PASS, B2 FAIL, B3 PASS, B4 PASS, B5 PASS.**

## Stage 2, quality score

Run despite the B2 fail, because the fail is inherited from the template and the
card still has to be judged against the set it joins.

| # | Item | Score |
|---|---|---|
| 1 | Idea states in one sentence, and is an idea not a decoration | 2 |
| 2 | Solves a named need: the widget-versus-tool confusion that generates the support tickets | 2 |
| 3 | Distinct from the category default | 1 (the format is the house template) |
| 4 | Hierarchy reads under 2s | 2 |
| 5 | Two families, Baloo 2 display and Space Grotesk UI | 2 |
| 6 | Line length and leading | 2 |
| 7 | Colour ramp evenness and 60/30/10 | 1 (ramp is a hand-picked HSL-era gradient, not OKLCH) |
| 8 | Alignment on grid, art contained | 2 |
| 9 | Whitespace deliberate | 2 |
| 10 | Gestalt grouping | 2 |
| 11 | Regenerable as a parameter change, not a redraw | 2 (one row in `map.json`, then three commands) |
| 12 | Sits beside the last three in the line as one brand | 2 |
| 13 | Survives worst delivery context | 1 (checked at card size and full size; not checked cropped to a square social crop) |
| 14 | Edges and kerning at 200% | 2 |
| 15 | No leftovers | 2 |

**27 / 30.** Weak: #3 and #7 template-inherited, #13 partially checked.

## Stage 3, critique

- **Objective, and does it meet it:** make the widget-versus-tool distinction the
  first thing a reader takes from the page. It does. The headline is the thesis,
  not a label.
- **Single change that would improve it most:** bring the headline gradient and
  the field bases inside the palette, at the template level, for all 44 cards at
  once. That closes B2 for the whole set rather than one card.
- **What was not checked, and why:** the automated set-level gate `qa_heroes.py
  --strict` passed (44 heroes, 8 distinct hues, no monotone flag, this card not
  among the five faintest), but the card was not checked cropped to a 1:1 social
  crop, because nothing in this pipeline emits one. Print output not checked:
  screen only. The other 43 heroes were not re-measured for B2 individually;
  the fail is asserted from the shared template source, not from 43 samples.
- **Uncertainty, and what would settle it:** whether the hero template palette is
  a deliberate exception to chrome strictness or a drift nobody had measured.
  Todd deciding it settles it, and the answer belongs in `brand.rules.json`
  either way.

Created by: Claude claude-opus-5 2026-09-22
Last edited by: Claude claude-opus-5 2026-09-22 · Design gate run on new multistream explainer hero
