"""Favicons and the social card, from the seal art make_seal_png.py produces.

Run make_seal_png.py first — this consumes seal-mark.png and seal.png.

The favicon is the MARK, not the whole seal. A tab icon is 16 or 32 pixels and
the full seal at that size is a smudge with a handle: the katakana turns to
noise and the grip welds a lump to one side of what should read as a circle.
The mark drops both and keeps the face, which is the part anyone would
recognise anyway.

Everything is baked amber-on-dark rather than left white-on-transparent. The
in-game art is tinted at draw time because six mods want six colours out of one
file; a favicon has exactly one colour and browsers do not tint.
"""

import os
import sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "icons")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(HERE)

INK = (255, 148, 24)
GROUND = (10, 6, 3)
DIM = (143, 81, 27)
BODY = (231, 147, 59)

MONO = [
    r"C:\Windows\Fonts\consolab.ttf",
    r"C:\Windows\Fonts\consola.ttf",
    r"C:\Windows\Fonts\lucon.ttf",
    r"C:\Windows\Fonts\cour.ttf",
]


def font(size, bold=True):
    order = MONO if bold else MONO[1:] + MONO[:1]
    for p in order:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def tint(im, rgb):
    """White-on-transparent art in one colour, alpha preserved."""
    out = Image.new("RGBA", im.size, rgb + (0,))
    out.putalpha(im.split()[3])
    return out


def favicons():
    mark = Image.open(os.path.join(SRC, "seal-mark.png"))

    # The mark's ink fills a circle of radius 493 in a 1340-unit canvas, so it
    # only covers about three quarters of the frame. Cropping to the ink and
    # re-padding gives the icon a proper margin instead of a dead border.
    box = mark.split()[3].getbbox()
    mark = mark.crop(box)

    for size, name in ((16, None), (32, None), (48, None),
                       (180, "apple-touch-icon.png"), (512, "icon-512.png")):
        pad = max(2, int(size * 0.06))
        inner = size - pad * 2
        art = tint(mark, INK).resize((inner, inner), Image.LANCZOS)

        # Opaque ground: a transparent favicon on a light tab strip is an
        # amber outline on white, which is not the mark.
        tile = Image.new("RGBA", (size, size), GROUND + (255,))
        tile.alpha_composite(art, (pad, pad))

        if name:
            tile.save(os.path.join(OUT, name))
            print("  %-22s %dx%d" % (name, size, size))
        else:
            ICO.append(tile)

    # One .ico carrying 16, 32 and 48 so the browser picks its own size.
    ico = os.path.join(OUT, "favicon.ico")
    ICO[0].save(ico, sizes=[(16, 16), (32, 32), (48, 48)],
                append_images=ICO[1:])
    print("  %-22s 16+32+48" % "favicon.ico")


ICO = []


def card():
    """1200x630 for og:image — what a link to the site unfurls as."""
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), GROUND)
    d = ImageDraw.Draw(im)

    # a scanline wash, the same idea as the page's own
    for y in range(0, H, 3):
        d.line([(0, y), (W, y)], fill=(14, 9, 4))

    d.rectangle([0, 0, W - 1, H - 1], outline=(61, 34, 12), width=2)

    seal = tint(Image.open(os.path.join(SRC, "seal.png")), INK)
    side = 380
    seal = seal.resize((side, side), Image.LANCZOS)
    im.paste(seal, (78, (H - side) // 2), seal)

    x = 520
    d.text((x, 214), "spitmux", font=font(96), fill=INK)
    d.text((x + 4, 330), "MOD ARCHIVE  \u00b7  GRAND THEFT AUTO V",
           font=font(25), fill=DIM)
    d.text((x + 4, 378), "\u00bb you will succumb to the poison",
           font=font(27, False), fill=BODY)
    d.text((x + 4, 412), "  you have tasted", font=font(27, False), fill=BODY)
    d.text((x + 4, 470), "10 MODS  \u00b7  SCRIPTHOOKVDOTNET  \u00b7  NO ASSET REPLACEMENT",
           font=font(19), fill=DIM)

    p = os.path.join(OUT, "og.png")
    im.save(p)
    print("  %-22s %dx%d  %.0f KB" % ("og.png", W, H, os.path.getsize(p) / 1024.0))


if __name__ == "__main__":
    print("writing to %s" % OUT)
    favicons()
    card()
