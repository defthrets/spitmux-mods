"""Render the ratboy seal as game-ready PNGs for CustomSprite.

Three files, all WHITE ON TRANSPARENT so Draw.File can tint them at draw time
the same way every other icon in the set is tinted:

    seal-face.png   the two rules, the grip and the face — everything still
    seal-ring.png   the katakana band on its own — the part that turns
    seal.png        both flattened, for where you just want the mark

THE CANVAS IS SQUARE AND CENTRED ON THE CIRCLE, NOT ON THE ARTWORK. That is
the whole reason this script exists rather than reusing the GIF's canvas.
CustomSprite rotates a sprite about its own centre, so if the image were
cropped to the artwork the circle's centre would sit off to one side of the
image centre and a rotating ring would orbit instead of spin. Padding the
canvas out to 1340 units square about (512,512) puts the two in the same
place, which means:

  * ring and face draw at the SAME position and the SAME size, and line up
  * the ring can be handed a rotation and it turns on the spot
  * the art is square, so Draw.File's square overload is the right one and
    there is no aspect constant to keep in step

Geometry is a hand copy of ratboy-seal.html. KEEP IT IN STEP — the two HTML
copies share theirs through a clone, this one does not.
"""

import math
import os
import sys
from PIL import Image, ImageDraw, ImageFont

OUTDIR = sys.argv[1] if len(sys.argv) > 1 else "."
SIZE = 1024              # final width and height in pixels
SS = 4                   # supersample, then downscale — ImageDraw has no AA
CENTRE = 512.0           # the circle's centre in the source geometry
HALF = 670.0             # canvas half-size, > the grip's 662.5 reach
OFF = HALF - CENTRE      # shift that puts the circle centre at the image centre
UNITS = HALF * 2         # 1340 units square
INK = (255, 255, 255, 255)

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\YuGothB.ttc",
    r"C:\Windows\Fonts\msgothic.ttc",
    r"C:\Windows\Fonts\meiryob.ttc",
]

RING = "\u3010\u30E9\u30C3\u30C8\u30DC\u30FC\u30A4\u5B9F\u884C\u3011" \
       "\u3010\u30C7\u30B9\u30EC\u30C3\u5B9F\u884C\u3011"
RING = RING * 2          # 36 glyphs, one per 10 degrees

S = SS
CAN = int(UNITS * S)


def px(v):
    """Source units to canvas pixels, with the centring shift applied."""
    return (v + OFF) * S


def cubic(p0, p1, p2, p3, n=48):
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append((u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
                    u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]))
    return out


def arc(cx, cy, rx, ry, a0, a1, n=72):
    """Elliptical arc, degrees, 0 at 3 o'clock, y down."""
    a0, a1 = math.radians(a0), math.radians(a1)
    return [(cx + rx * math.cos(a0 + (a1 - a0) * i / n),
             cy + ry * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n + 1)]


def rot(pts, deg, cx, cy):
    a = math.radians(deg)
    ca, sa = math.cos(a), math.sin(a)
    return [(cx + (x - cx) * ca - (y - cy) * sa,
             cy + (x - cx) * sa + (y - cy) * ca) for x, y in pts]


def scale(pts):
    return [(px(x), px(y)) for x, y in pts]


def stroke(d, pts, width, caps=True):
    """Thick polyline, round joins, round caps unless caps=False.

    caps=False is stroke-linecap="butt": the loop's cut ends want a straight
    edge, and a disc there bulges past the bar and rounds off the free end."""
    p = scale(pts)
    d.line(p, fill=INK, width=int(width * S), joint="curve")
    if not caps:
        return
    r = width * S / 2.0
    for q in (p[0], p[-1]):
        d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=INK)


def build_face():
    """Everything that holds still: both rules, the grip, the face."""
    img = Image.new("RGBA", (CAN, CAN), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Both rules are broken on the right where the grip crosses them; left
    # whole, each draws a line straight through the paddle.
    stroke(d, arc(512, 512, 486, 486, 5.7, 350.3, 300), 14)
    stroke(d, arc(512, 512, 370, 370, 7.5, 185.0, 200), 27, caps=False)

    # The upper arc runs well past the bar — its outer edge has to stay left of
    # the bar's end at every height across it, or the curve crosses back inside
    # near the top and opens a hairline — then is cut flush at the bar's
    # underside. A square cap on a curve is angled and leaves a tab, so the cut
    # is made by clearing alpha below y=443.5 instead.
    upper = Image.new("RGBA", (CAN, CAN), (0, 0, 0, 0))
    ud = ImageDraw.Draw(upper)
    stroke(ud, arc(512, 512, 370, 370, 188.0, 347.2, 200), 27, caps=False)
    ud.rectangle([0, px(443.5), px(320), CAN], fill=(0, 0, 0, 0))
    img.alpha_composite(upper)

    # The grip: brow bar carried straight out, round the end, back underneath
    # onto the loop — one path, so the end really is a half circle and the
    # corners are joins rather than butted stubs. Straight ends, not round.
    stroke(d, ([(141, 430), (1096, 430)] +
               arc(1096, 495, 65, 65, -90, 90, 48) +
               [(866, 560)]), 27, caps=False)

    # the frown: flat underneath, domed over
    stroke(d, [(316, 762), (708, 762)] + arc(512, 762, 196, 140, 0, -180, 72), 26)

    _face(d)

    return img


def _face(d):
    """The shut eyes and the two tears. Shared by the full seal and the mark."""
    # shut eyes — filled crescents, two cubics each
    for e in ([(382, 486), (348, 548), (300, 584), (243, 592),
               (300, 620), (360, 586), (382, 486)],
              [(642, 486), (676, 548), (724, 584), (781, 592),
               (724, 620), (664, 586), (642, 486)]):
        d.polygon(scale(cubic(e[0], e[1], e[2], e[3]) +
                        cubic(e[3], e[4], e[5], e[6])), fill=INK)

    # Tears. The two are mirrors, so their bulbs sweep in OPPOSITE directions
    # and both pass UNDER the drop; forcing a1 above a0 sends the right one
    # over the top and folds it inside out. That is the svg's sweep flag and it
    # has to be carried here too.
    for (tip, c1, c2, right, ctr, r, left, c3, c4, deg, pivot, sweep) in (
        ((248, 615), (260, 635), (270, 652), (270, 668),
         (243, 668), 27, (216, 668), (218, 650), (228, 633), -8, (243, 663), +1),
        ((776, 615), (764, 635), (754, 652), (754, 668),
         (781, 668), 27, (808, 668), (806, 650), (796, 633), 8, (781, 663), -1),
    ):
        a0 = math.degrees(math.atan2(right[1] - ctr[1], right[0] - ctr[0]))
        a1 = math.degrees(math.atan2(left[1] - ctr[1], left[0] - ctr[0]))
        while sweep > 0 and a1 < a0:
            a1 += 360
        while sweep < 0 and a1 > a0:
            a1 -= 360
        pts = cubic(tip, c1, c2, right) + arc(ctr[0], ctr[1], r, r, a0, a1, 48)
        pts += cubic(left, c3, c4, tip)
        d.polygon(scale(rot(pts, deg, pivot[0], pivot[1])), fill=INK)


def build_mark():
    """The face inside a plain ring — the small version, for favicons.

    The full seal does not survive being shrunk: at 32 pixels the katakana is
    noise and the grip is a smudge welded to one side of a circle. So the mark
    drops both. With nothing crossing them the two rules close up into whole
    circles — they are only broken to let the paddle through — and the brow bar
    stops at the inner rule instead of running out past it.
    """
    img = Image.new("RGBA", (CAN, CAN), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    stroke(d, arc(512, 512, 486, 486, 0, 360, 300), 14, caps=False)
    stroke(d, arc(512, 512, 370, 370, 0, 360, 300), 27, caps=False)

    # The bar meets the inner rule at y=430, which is x = 512 +/- sqrt(370^2 -
    # 82^2) = 151 and 873. Run it a few units past each so the joins are
    # covered rather than butted up against the curve.
    stroke(d, [(145, 430), (879, 430)], 27, caps=False)

    stroke(d, [(316, 762), (708, 762)] + arc(512, 762, 196, 140, 0, -180, 72), 26)
    _face(d)
    return img


def build_ring():
    """The katakana band, drawn upright. In game this is the layer that turns."""
    font = None
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                font = ImageFont.truetype(path, int(70 * S), index=0)
                print("font: %s" % path)
                break
            except Exception:
                continue
    if font is None:
        raise SystemExit("no CJK font found")

    img = Image.new("RGBA", (CAN, CAN), (0, 0, 0, 0))
    radius = 431 * S
    cell = int(70 * S * 2.4)
    step = 360.0 / len(RING)
    cx0, cy0 = px(512), px(512)

    for i, ch in enumerate(RING):
        glyph = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
        ImageDraw.Draw(glyph).text((cell / 2, cell / 2), ch, font=font,
                                   fill=INK, anchor="mm")
        theta = -90 + (i + 0.5) * step
        glyph = glyph.rotate(-(theta + 90), resample=Image.BICUBIC)
        cx = cx0 + radius * math.cos(math.radians(theta))
        cy = cy0 + radius * math.sin(math.radians(theta))
        img.alpha_composite(glyph, (int(cx - cell / 2), int(cy - cell / 2)))

    # The band passes BEHIND the grip. On the site that is a mask; here the
    # alpha is simply cleared where the grip crosses, so the band never has to
    # know the grip exists.
    ImageDraw.Draw(img).rectangle(
        [px(820), px(402), CAN, px(588)], fill=(0, 0, 0, 0))
    return img


def save(img, name):
    out = img.resize((SIZE, SIZE), Image.LANCZOS)
    path = os.path.join(OUTDIR, name)
    out.save(path)
    print("  %-16s %dx%d  %.0f KB" % (name, SIZE, SIZE,
                                      os.path.getsize(path) / 1024.0))


def main():
    if OUTDIR != "." and not os.path.isdir(OUTDIR):
        os.makedirs(OUTDIR)
    face, ring = build_face(), build_ring()
    flat = Image.new("RGBA", (CAN, CAN), (0, 0, 0, 0))
    flat.alpha_composite(ring)
    flat.alpha_composite(face)

    print("writing to %s" % os.path.abspath(OUTDIR))
    save(build_mark(), "seal-mark.png")
    save(face, "seal-face.png")
    save(ring, "seal-ring.png")
    save(flat, "seal.png")
    print("\ncanvas %d units square, circle centre at the image centre —\n"
          "draw ring and face at the same x, y and size; only the ring\n"
          "gets a rotation." % UNITS)


if __name__ == "__main__":
    main()
