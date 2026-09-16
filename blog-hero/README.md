# Blog hero pipeline

Builds 1200x630 hero cards for the blog out of **real widgets**, not stock art
and not AI art (`no-ai-art-for-storefront-hero`).

## Why it exists

Surveyed 2026-09-15: 43 articles, heroes ranging from 474x474 to 6000x3958.
Several are stock photos (a Yoda still on a chat widget post), several are Etsy
listing collages complete with their own typos ("Organiged Chat Role"), and one
image is reused across four separate articles. The article route caps a hero to
its own width, so the small ones render as postage stamps in the column.

## Run order

```bash
node render_widgets.mjs <widget-id>...   # live capture, transparent -> widgets-raw/
python3 crop_widgets.py                  # crop to alpha bounds  -> widgets/
node compose.mjs [slug...]               # compose heroes.json   -> out/
```

Needs Widget Stage running on :8791. Todd starts it himself
(`npm --prefix repos/sws-widget-stage start`); never start a second copy, the
port is wired to his live OBS source.

## The traps, all of them hit once already

- **Do not capture through `widget-preview.html`.** Its demo loop fires a tip
  every 900ms to animate a goal filling. A chat widget renders those as
  messages, so the first hero came back with seven identical "Now tipped $90!"
  rows. `render_widgets.mjs` mounts the bundle itself and composes a feed per
  widget kind.
- **`widget.json` is read off disk, not over HTTP.** The stage serves only
  `public/`, and `widgets/` is a sibling, so `${STAGE}/widgets/<id>/widget.json`
  404s. Swallowing that made every widget capture as `kind: chat`, including
  goal widgets.
- **Fill a goal to a share of its OWN `goalTarget`.** Targets differ per widget
  (100 here, 50 there). A flat amount produced "goal $420 / $100", a bar past
  full, which is the one state that sells nothing.
- **`waitUntil: 'networkidle0'` hangs.** Several widgets keep a timer or media
  element alive so it never fires; one capture sat for three minutes. Use
  `domcontentloaded` and an explicit settle.
- **`URLSearchParams.get()` already percent-decodes.** Wrapping it in
  `decodeURIComponent` throws "URI malformed" the moment a config value holds a
  literal `%`, which every glow position does, and the card renders empty.
- **Serve over http, never `file://`.** A `file://` page cannot load the woff2
  faces and the headline silently falls back to system-ui.
- **Composite transparent captures before judging them** (`out/_contact.png`
  contact sheet). Viewers drop alpha and soft glows read as slabs.

## The QA gate

`python3 qa_heroes.py` (add `--strict` to exit 1). Run it on every set.

Todd rejected two complete sets by eye, "these all look too similar" and "kinda
boring, they mostly still look similar", and both times the cause was
measurable. Waiting for a human to spot it is the wrong gate.

It measures, per card: how much of the art zone is actually lit, peak art
contrast against the card's own background, and ink pressed against each canvas
edge. Across the set it measures hue spread and flags adjacent cards sharing
palette, side and background.

Three exclusion classes feed back into `assign_widgets.py`, all measured rather
than guessed:

- **TOO_WIDE** shrinks to a sliver in the art zone. Ratios 2.1 to 8.3.
- **TOO_DARK** renders dim at any size. `tarot-chat` filled 550x525 of the zone
  and still measured 2.5% coverage.
- The per-card thresholds catch the rest.

**Fitting a bounding box is not the same as filling it.** A chat with few
messages and large transparent gaps fills the art zone geometrically and still
looks blank, which is why the coverage threshold sits at 10% and not lower.

## Mistakes already made here, do not repeat them

- **Bleeding art off the canvas cut words in half.** "Plumcircuit Tipped", "just
  tipped $25!". A cut word reads as broken no matter how deliberate. Art is
  contained, with a real 34px bottom margin: setting bleed to 0 was not enough
  because flush with the edge still reads as cut.
- **Excluding a bad widget from ONE pool does not work.** `khepri-chat` was
  removed from CHAT_NEON and came straight back through CHAT_ANY, costing a full
  render. One `EXCLUDED` set, filtered from every pool.
- **The palette must NOT follow the article theme.** It sounds right and it
  produced exactly the monotony Todd rejected twice: the themes cluster, so the
  set collapsed to 4 hues across 43 cards. The palette rotates independently;
  the theme still picks the widget, which is the part that has to be relevant.
- **Passing a palette is not the same as using it.** themes.json defined eight
  distinct field colours and `build_heroes.py` never emitted base1/2/3, so every
  card rendered violet while the config looked perfect and the gate kept
  reporting 4 hues.

## Before any hero ships

Art QA is mandatory, see `products/OVERLAY-PIPELINE.md`. Pixel-verify, then hand
`qa/` to SWS QA (Grok Bot) and wait for PASS or PASS WITH FIXES. Todd is not the
visual QA officer.
