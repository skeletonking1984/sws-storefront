"""
Expand map.json + themes.json into heroes.json, sizing each sticker from the
widget's OWN aspect ratio.

Why this is not hand-written geometry: the captures range from a 498x754 goal
bar to a 1423x1519 chat box, and a single fixed width/height pair cuts some of
them mid-word at the canvas edge while leaving others floating in dead space.
That mid-word clip was the first version's worst fault, because it reads as a
broken image rather than a deliberate bleed.

The rule:
  - The sticker must fit the canvas HORIZONTALLY. No exceptions. A horizontal
    clip always looks like a bug.
  - It may bleed off the BOTTOM, up to BLEED_MAX, which reads as a live feed
    continuing past the frame. Tall chat boxes rely on this.

    python3 build_heroes.py
"""
import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))

CANVAS_W, CANVAS_H = 1200, 630
# Left edge of the art zone. The copy column is 66 + copyW wide, so this leaves
# a gutter rather than letting the widget crowd the headline.
# The art zone was 462px of a 1200px canvas and that was the single biggest
# reason the first full set read as "kinda boring, they mostly still look
# similar": at that width a chat widget renders too small for its own text to be
# legible, so it stops being a product and becomes texture. 600px, and the
# sticker is allowed to bleed off the right edge as well as the bottom.
#
# A bleed is only acceptable when the art is BIG. The earlier mid-word clipping
# looked broken because the widget was small and the cut looked accidental.
ZONE_X = 592
ZONE_RIGHT = 1188       # inside the 1200 canvas: CONTAINED, not bled
ZONE_TOP = 16
BLEED_MAX = 0           # fully contained: any bleed cut an alert row mid word
ZONE_BOTTOM = 34        # real margin, not just "no bleed"

# Setting BLEED_MAX to 0 was not enough on its own. Art that filled the zone
# ended FLUSH with the canvas edge at y=630, and flush still reads as cut: the
# QA gate kept reporting 20% bottom edge ink on three cards. Art needs a margin
# to sit in, not merely permission not to overflow.

# Bleeding was tried and rejected by looking at the output. At ZONE_RIGHT 1232
# and BLEED_MAX 96 the art was big and legible, which was the goal, but alert
# rows came off cut mid word: "Plumcircuit Tipped", "just tipped $25!". A cut
# word reads as a broken image no matter how deliberate the crop was meant to
# look. The art zone is 596px wide either way, so containment costs almost no
# size and removes the whole failure mode.
ROT = {"chat": -4, "goal": 3}
ROT_DEFAULT = -3        # anything else, e.g. kind "alert"

# A widget wider than this reduces to a sliver once it is fitted to the art
# zone, because the zone is only 462px wide and fitting is width-first.
# neon-goal is 2062x248, which lands at 462x56 on a 630px tall card and reads as
# a stray line. Raised from 3.0 to 2.0 after reviewing the first full render of
# all 43: at 2.4 (luna-chat, luna-alerts) the widget was technically visible but
# its own text was far too small to read, which defeats the point of showing a
# real widget at all. Rejected here rather than quietly rendered, so the mapping
# is forced to choose something with presence.
MAX_RATIO = 2.0

themes = json.load(open(f"{HERE}/themes.json"))
rows = json.load(open(f"{HERE}/map.json"))

STAGE_REPO = "/Users/todd/Documents/orgs/SWS/repos/sws-widget-stage"


def widget_kind(wid):
    p = f"{STAGE_REPO}/widgets/{wid}/widget.json"
    if os.path.exists(p):
        return json.load(open(p)).get("kind", "chat")
    return "chat"


def glow_for(theme):
    t = themes[theme]
    return (f"drop-shadow(0 0 30px {t['kickerGlow']}) "
            f"drop-shadow(0 0 76px {t['glow2']})")


heroes = []
missing = []
too_wide = []
PALETTE_ORDER = ["celestial", "cyber", "gold", "violet", "neon", "cozy", "ember", "pastel"]
SIDES = ["left", "right"]
BGS = ["aurora", "bloom", "duo", "beam"]

for idx, (handle, theme, kicker, title, wid) in enumerate(rows):
    # Art is per ARTICLE now, not per widget: two articles using the same widget
    # still get different chat content. See render_article_widgets.mjs.
    png = f"{HERE}/widgets/{handle}.png"
    if not os.path.exists(png):
        missing.append((handle, wid))
        continue
    iw, ih = Image.open(png).size
    ratio = iw / ih
    if ratio > MAX_RATIO:
        too_wide.append((handle, wid, f"{iw}x{ih} ratio {ratio:.1f}"))
        continue

    # Alternate side and background so a grid of cards never shows the same
    # composition twice in a row. Periods 2 and 4 mean the first row of a
    # three-column grid is always three different treatments.
    side = SIDES[idx % 2]
    bg = BGS[idx % 4]

    zone_w = ZONE_RIGHT - ZONE_X
    zone_h = CANVAS_H - ZONE_TOP - ZONE_BOTTOM + BLEED_MAX

    # Fit to the zone, width first because width is the hard constraint.
    w = zone_w
    h = w / ratio
    if h > zone_h:
        h = zone_h
        w = h * ratio

    # Rotation pushes the corners out. Shrink enough that the rotated bounding
    # box still fits horizontally, otherwise the fit above is a lie.
    import math
    ang = math.radians(abs(ROT.get(widget_kind(wid), ROT_DEFAULT)))
    while w * math.cos(ang) + h * math.sin(ang) > zone_w and w > 80:
        w *= 0.98
        h = w / ratio

    if side == "right":
        # Mirror: copy right, art left. The 12px inset is NOT cosmetic. A -32
        # offset was tried and it pushed art off the left edge, which the QA
        # gate then caught at 41% edge ink on the StreamElements card.
        x = 12 + (zone_w - w) / 2
    else:
        x = ZONE_X + (zone_w - w) / 2
    # Prefer vertical centring; let tall art sit at the top and bleed instead.
    y = ZONE_TOP if h >= CANVAS_H - ZONE_TOP else (CANVAS_H - h) / 2

    # PALETTE ROTATES, it does not follow the theme.
    #
    # Taking the field colour from the article's theme sounds right and measured
    # wrong: the themes cluster (10 general, 9 celestial, 8 neon), so the set
    # collapsed to 4 distinct hues across 43 cards and read as one design again.
    # The field is a backdrop, not a description, and every widget reads on any
    # of these dark fields. Rotating guarantees the spread that the theme could
    # not, while the THEME still decides the widget, which is the part that
    # actually has to be relevant.
    palette_name = PALETTE_ORDER[idx % len(PALETTE_ORDER)]
    t = themes[palette_name]
    heroes.append({
        "slug": handle,
        "kicker": kicker,
        "title": title,
        "seed": (abs(hash(handle)) % 97) + 3,
        "accent": t["accent"], "glow1": t["glow1"], "glow2": t["glow2"],
        # base1/2/3 are the FIELD colours and they have to be passed through.
        # themes.json defined eight genuinely different bases and this dict
        # never emitted them, so hero.html fell back to its violet defaults on
        # all 43 cards. The palettes rotated correctly and nothing changed
        # colour, which is why the QA gate kept reporting 4 hues while the
        # config looked right.
        "base1": t["base1"], "base2": t["base2"], "base3": t["base3"],
        "glowX": t["glowX"], "glowY": t["glowY"],
        "titleGlow": t["titleGlow"], "kickerGlow": t["kickerGlow"],
        "side": side, "bg": bg,
        # Copy column narrows to make room for the bigger art.
        "copyW": "520px", "subW": "400px",
        # Nudge the headline size by article so the type block is not identical
        # everywhere either.
        "titleSize": f"{[54, 58, 62][idx % 3]}px",
        "stickers": [{
            # The article handle, NOT the widget id: art is captured per article
            # now and the file is named for the article. Leaving the widget id
            # here silently 404s the sticker and the card renders as background
            # only, which still looks deliberate enough to ship by mistake.
            "id": handle,
            "x": round(x), "y": round(y), "w": round(w), "h": round(h),
            "rotate": ROT.get(widget_kind(wid), ROT_DEFAULT), "z": 3, "glow": glow_for(theme),
        }],
    })

json.dump(heroes, open(f"{HERE}/heroes.json", "w"), indent=1)
print(f"wrote heroes.json with {len(heroes)} heroes")
if missing:
    print(f"\nMISSING widget captures ({len(missing)}), skipped:")
    for h, w in missing:
        print(f"  {w:32} {h}")
if too_wide:
    print(f"\nTOO WIDE to render with presence ({len(too_wide)}), skipped:")
    for h, w, d in too_wide:
        print(f"  {w:32} {d:24} {h}")
