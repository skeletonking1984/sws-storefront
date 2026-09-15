"""
Crop captured widget PNGs to their real alpha bounds.

A fixed 1100x1100 capture leaves every widget a different amount of dead space,
because each one is authored for its own OBS canvas. The composite cannot lay
out stickers predictably until each is tight to its own art.

The alpha threshold is deliberately NOT zero: a soft neon glow fades out to
alpha 1 or 2 across most of the frame, and getbbox() on the raw alpha would
return nearly the whole canvas and crop nothing at all.

    python3 crop_widgets.py
"""
import glob
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "widgets-raw")
OUT = os.path.join(HERE, "widgets")
THRESHOLD = 8
PAD = 8

os.makedirs(OUT, exist_ok=True)

for src in sorted(glob.glob(f"{RAW}/*.png")):
    name = os.path.basename(src)
    im = Image.open(src).convert("RGBA")
    alpha = im.getchannel("A")
    # Binarise above the threshold, THEN take the bbox.
    mask = alpha.point(lambda v: 255 if v > THRESHOLD else 0)
    box = mask.getbbox()
    if not box:
        print(f"SKIP  {name:36} fully transparent")
        continue
    l, t, r, b = box
    l, t = max(0, l - PAD), max(0, t - PAD)
    r, b = min(im.width, r + PAD), min(im.height, b + PAD)
    out = im.crop((l, t, r, b))
    out.save(os.path.join(OUT, name))
    pct = (out.width * out.height) / (im.width * im.height) * 100
    print(f"ok    {name:36} {out.width:5}x{out.height:<5} ({pct:.1f}% of frame)")
