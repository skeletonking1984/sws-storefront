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
ZONE_X = 706
ZONE_RIGHT = 1168
ZONE_TOP = 20
BLEED_MAX = 58          # how far past the bottom edge a sticker may run
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
    zone_h = CANVAS_H - ZONE_TOP + BLEED_MAX

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
        # Mirror the art zone: copy moves right, art moves left.
        x = 32 + (zone_w - w) / 2
    else:
        x = ZONE_X + (zone_w - w) / 2
    # Prefer vertical centring; let tall art sit at the top and bleed instead.
    y = ZONE_TOP if h >= CANVAS_H - ZONE_TOP else (CANVAS_H - h) / 2

    t = themes[theme]
    heroes.append({
        "slug": handle,
        "kicker": kicker,
        "title": title,
        "seed": (abs(hash(handle)) % 97) + 3,
        "accent": t["accent"], "glow1": t["glow1"], "glow2": t["glow2"],
        "glowX": t["glowX"], "glowY": t["glowY"],
        "titleGlow": t["titleGlow"], "kickerGlow": t["kickerGlow"],
        "side": side, "bg": bg,
        "copyW": "590px", "subW": "420px",
        # Nudge the headline size by article so the type block is not identical
        # everywhere either.
        "titleSize": f"{[58, 62, 66][idx % 3]}px",
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
