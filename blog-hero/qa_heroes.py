"""
Measure every rendered hero and fail the weak ones.

Todd rejected two full sets by eye ("these all look too similar", "kinda
boring, they mostly still look similar") and both times the cause was
measurable: the widget was too small to read, the field was the same hue on
every card, and several cards had almost no visible art at all. Waiting for a
human to notice that is the wrong gate.

Checks, per hero:
  ART PRESENCE  how much of the art zone is actually lit. A sticker that
                rendered faint or tiny leaves the zone nearly as dark as the
                background, which is what produced the three near empty cards.
  ART CONTRAST  peak brightness in the art zone against the card's own
                background. A pale outline widget on a dark field can cover
                plenty of pixels and still read as nothing.
  EDGE CLIP     lit content pressed against a canvas edge. This is the check
                that was MISSING when the bleed experiment shipped: coverage and
                contrast both passed while alert rows came off cut mid word
                ("Plumcircuit Tipped", "just tipped $25!"). A cut word reads as
                a broken image, so it has to be measured, not eyeballed.
  HUE SPREAD    across the whole set, not per card. If most cards share a hue
                the set looks repetitive no matter how good each one is.
  ADJACENCY     no two consecutive cards may share palette AND side AND
                background, because the blog index shows them in a grid.

    python3 qa_heroes.py            report
    python3 qa_heroes.py --strict   exit 1 on any FAIL
"""
import colorsys
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))

# Thresholds picked by measuring the sets Todd accepted and rejected, not guessed.
MIN_ART_COVERAGE = 0.10    # fraction of the art zone meaningfully brighter than bg
# Raised from 0.055 after comparing the gate against my own eye on the full 43
# card sheet. At 0.055 it passed cards that plainly read as empty, because
# fitting a widget's BOUNDING BOX to the art zone says nothing about how much
# ink is inside that box: a chat with few messages and large transparent gaps
# fills the zone geometrically and still looks blank.
MIN_ART_CONTRAST = 55      # peak art luma minus background luma, 0-255
MIN_DISTINCT_HUES = 5      # across the whole set
MAX_EDGE_INK = 0.16        # fraction of an edge band that may be lit content


def luma(px):
    return 0.2126 * px[0] + 0.7152 * px[1] + 0.0722 * px[2]


def analyse(path, side):
    im = Image.open(path).convert("RGB")
    W, H = im.size
    # Art occupies roughly the outer 45% on the side opposite the copy.
    if side == "right":          # copy right, art left
        box = (0, 0, int(W * 0.45), H)
        bg_box = (int(W * 0.55), 0, W, H)
    else:
        box = (int(W * 0.55), 0, W, H)
        bg_box = (0, 0, int(W * 0.45), H)

    art = im.crop(box).resize((160, 84))
    bg = im.crop(bg_box).resize((160, 84))

    bg_pixels = sorted(luma(p) for p in bg.getdata())
    bg_luma = bg_pixels[len(bg_pixels) // 2]          # median, ignores the headline
    art_pixels = [luma(p) for p in art.getdata()]
    peak = sorted(art_pixels)[int(len(art_pixels) * 0.99)]

    lit = sum(1 for v in art_pixels if v > bg_luma + 38) / len(art_pixels)

    # Dominant hue of the whole card, for set level spread.
    small = im.resize((60, 32))
    hues = []
    for p in small.getdata():
        r, g, b = [c / 255 for c in p]
        h, s, v = colorsys.rgb_to_hsv(r, g, b)
        if s > 0.25 and v > 0.12:
            hues.append(int(h * 12))               # 12 buckets
    hue = max(set(hues), key=hues.count) if hues else -1

    # Edge clipping: how much lit content sits in a thin band at each canvas
    # edge. Content touching an edge means the art was cut rather than framed.
    full = im.resize((240, 126))
    W2, H2 = full.size
    px = full.load()

    def band_ink(coords):
        hits = 0
        for x, y in coords:
            if luma(px[x, y]) > bg_luma + 60:
                hits += 1
        return hits / max(1, len(coords))

    edges = {
        "right": band_ink([(x, y) for x in range(W2 - 3, W2) for y in range(H2)]),
        "left": band_ink([(x, y) for x in range(0, 3) for y in range(H2)]),
        "bottom": band_ink([(x, y) for y in range(H2 - 3, H2) for x in range(W2)]),
        "top": band_ink([(x, y) for y in range(0, 3) for x in range(W2)]),
    }

    return {"coverage": lit, "contrast": peak - bg_luma, "hue": hue, "edges": edges}


heroes = json.load(open(f"{HERE}/heroes.json"))
rows = []
for h in heroes:
    p = f"{HERE}/out/{h['slug']}.png"
    if not os.path.exists(p):
        rows.append({"slug": h["slug"], "missing": True})
        continue
    m = analyse(p, h.get("side", "left"))
    m.update(slug=h["slug"], palette=h.get("accent"), side=h.get("side"), bg=h.get("bg"))
    rows.append(m)

fails = []
for r in rows:
    if r.get("missing"):
        fails.append(f"NO RENDER      {r['slug'][:58]}")
        continue
    clipped = [e for e, v in r["edges"].items() if v > MAX_EDGE_INK]
    if clipped:
        worst_edge = max(r["edges"], key=lambda e: r["edges"][e])
        fails.append(
            f"EDGE CLIPPED   {','.join(clipped):14} {r['edges'][worst_edge]*100:4.0f}%  {r['slug'][:44]}"
        )
    if r["coverage"] < MIN_ART_COVERAGE:
        fails.append(f"ART TOO FAINT  coverage {r['coverage']*100:4.1f}%  {r['slug'][:52]}")
    elif r["contrast"] < MIN_ART_CONTRAST:
        fails.append(f"LOW CONTRAST   {r['contrast']:5.0f}        {r['slug'][:52]}")

present = [r for r in rows if not r.get("missing")]
hues = {r["hue"] for r in present if r["hue"] >= 0}
if len(hues) < MIN_DISTINCT_HUES:
    fails.append(f"SET TOO MONOTONE  only {len(hues)} distinct hues across {len(present)} cards")

for a, b in zip(present, present[1:]):
    if (a["palette"], a["side"], a["bg"]) == (b["palette"], b["side"], b["bg"]):
        fails.append(f"ADJACENT TWINS   {a['slug'][:30]} / {b['slug'][:30]}")

print(f"{len(present)} heroes measured, {len(hues)} distinct hues")
if present:
    worst = sorted(present, key=lambda r: r["coverage"])[:5]
    print("\nfaintest art:")
    for r in worst:
        print(f"  coverage {r['coverage']*100:5.1f}%  contrast {r['contrast']:5.0f}  {r['slug'][:52]}")
print()
if fails:
    print(f"FAIL ({len(fails)})")
    for f in fails:
        print("  " + f)
    if "--strict" in sys.argv:
        sys.exit(1)
else:
    print("PASS: every hero has legible art and the set is not monotone.")
