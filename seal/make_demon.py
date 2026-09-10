"""Bring the dev page's demon head onto the archive's palette.

The source is 800x800 of flat yellow behind a blue-black head, three frames of
a slow turn. Two things have to happen for it to sit on this site:

  the yellow goes      -- it is a backdrop, not part of the mark, and a yellow
                          square in a panel that has none reads as a sticker
  the head is remapped -- blue on amber is the one thing the page has never
                          done; every other full-colour thing here (the pixel
                          icons) is pulled towards the amber too

Keyed on distance from yellow rather than an exact match, because GIF dithering
leaves the background as a spray of near-yellows (#fdfd01, #f3fe00, #fefb0a and
more), and an equality test keeps every one of them.
"""

import io
import os
import sys
from PIL import Image, ImageSequence

SRC = sys.argv[1]
OUT = sys.argv[2]
SIZE = int(sys.argv[3]) if len(sys.argv) > 3 else 200

# the amber ramp the rest of the page is drawn from, dark end first
RAMP = [(0x0a, 0x06, 0x03), (0x60, 0x36, 0x14), (0x8f, 0x51, 0x1b),
        (0xbf, 0x72, 0x24), (0xe7, 0x93, 0x3b), (0xff, 0xb2, 0x4d),
        (0xff, 0xd2, 0x83)]


def ramp(t):
    """A 0..1 position along the amber ramp."""
    t = max(0.0, min(1.0, t)) * (len(RAMP) - 1)
    i = int(t)
    if i >= len(RAMP) - 1:
        return RAMP[-1]
    f = t - i
    a, b = RAMP[i], RAMP[i + 1]
    return tuple(int(a[c] + (b[c] - a[c]) * f) for c in range(3))


def convert(frame):
    src = frame.convert("RGB")
    out = Image.new("RGBA", src.size, (0, 0, 0, 0))
    sp, op = src.load(), out.load()
    w, h = src.size
    for y in range(h):
        for x in range(w):
            r, g, b = sp[x, y]
            # The backdrop is not just yellow: GIF dithering sprays it with
            # reds too (#fd0001, #f30000), and a yellow-only test keeps every
            # one of them as speckle. What actually separates the two is RED --
            # the backdrop runs r=227..254, the head is blue-black at r=0..2.
            if r > 100 and b < r:
                continue
            # luminance of the head, stretched: the source sits in a narrow
            # dark band and a straight map would come out nearly flat
            lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255.0
            t = min(1.0, (lum ** 0.62) * 1.35)
            op[x, y] = ramp(t) + (255,)
    return out


src = Image.open(SRC)
frames = [convert(f) for f in ImageSequence.Iterator(src)]
frames = [f.resize((SIZE, SIZE), Image.LANCZOS) for f in frames]

# GIF carries one transparent index, so the alpha is thresholded rather than
# blended -- anything part-transparent is pushed to one side or the other.
out = []
for f in frames:
    a = f.split()[3].point(lambda v: 255 if v > 128 else 0)
    f.putalpha(a)
    p = f.convert("RGB").quantize(colors=255, method=Image.MEDIANCUT)
    p.paste(255, mask=a.point(lambda v: 255 if v == 0 else 0))
    pal = p.getpalette()
    pal[255 * 3:255 * 3 + 3] = [0, 0, 0]
    p.putpalette(pal)
    p.info["transparency"] = 255
    out.append(p)

out[0].save(OUT, save_all=True, append_images=out[1:],
            duration=src.info.get("duration", 100), loop=0,
            transparency=255, disposal=2, optimize=True)
print("wrote %s  %dx%d  %d frames  %.0f KB"
      % (OUT, SIZE, SIZE, len(out), os.path.getsize(OUT) / 1024.0))
