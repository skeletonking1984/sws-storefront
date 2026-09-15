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

## Before any hero ships

Art QA is mandatory, see `products/OVERLAY-PIPELINE.md`. Pixel-verify, then hand
`qa/` to SWS QA (Grok Bot) and wait for PASS or PASS WITH FIXES. Todd is not the
visual QA officer.
