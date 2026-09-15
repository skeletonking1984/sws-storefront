# Blog hero art, QA handoff

**What this is.** New hero images for the streamwidgetshop.com blog. The 43
existing articles carry heroes ranging from 474x474 to 6000x3958, several are
stock photos, and one image is reused across four different articles. These two
are the first cut of a consistent 1200x630 replacement.

**How they were made.** Real stage widgets captured live on a transparent page
(`render_widgets.mjs`), cropped to their own alpha bounds (`crop_widgets.py`),
composited on a hand-built background with brand type (`hero.html` +
`compose.mjs`). No AI art, no stock photos, no Etsy listing collages.

**Files**
- `qa/vtuber-celestial.png` 2400x1260 (1200x630 at 2x), widget: `celestial-multistream-chat`
- `qa/goal-widgets.png` 2400x1260 (1200x630 at 2x), widget: `moon-jar-goal`

**Already caught and fixed in these, worth re-checking:**
1. The first capture harness fired a tip every 900ms to animate goal bars, so the
   chat hero came back with seven identical "Now tipped $90!" rows. Feed is now
   composed per widget kind.
2. `celestial-moon-goal` captured as kind=chat because the stage does not serve
   `widgets/` over HTTP and the 404 was being swallowed. Kind now read off disk.
3. A goal read "$420 / $100", a bar past full. Fill is now 68% of the widget's
   own `goalTarget`.
4. Chat cut mid-word at the right edge. Sticker now fits the canvas
   horizontally; only the bottom bleeds.

**Please check specifically**
- Any text clipped at a canvas edge, especially mid-word.
- Glow reading as a flat slab rather than light.
- Copy on the card contradicting anything the linked article or product claims.
- Legibility of the widget content at the size it renders in the article column.

**Not yet uploaded.** These are local only; nothing has been written to Shopify.
