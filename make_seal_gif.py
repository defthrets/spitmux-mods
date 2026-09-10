"""Render the ratboy seal as an animated GIF.

There is no SVG rasteriser on this machine, so the geometry from
ratboy-seal.html is redrawn here with Pillow: same coordinate space
(1200 x 1024), supersampled 4x and downscaled at the end, because ImageDraw
has no antialiasing of its own.

Everything curved or jointed goes through stroke() rather than ImageDraw's
arc() and line(). Those butt-cut their ends, which leaves notches wherever
two strokes meet and turns the paddle's round end into a bracket. stroke()
samples the path into points, draws it with joint="curve", and caps both
ends with a disc — the equivalent of SVG's round linecap and linejoin.

Only the katakana band turns. The string is two copies of an 18-character
unit, so the artwork repeats every half turn — this only has to cover 180
degrees to loop seamlessly, which halves the frames.

KEEP IN STEP WITH THE SVG. ratboy-seal.html and spitmux-mods/index.html
share their geometry through a clone; this is a hand copy, so any change to
the mark has to be made here too.
"""

import math
import os
from PIL import Image, ImageDraw, ImageFont

import sys

GREEN = "--green" in sys.argv      # P1 phosphor instead of amber

NAME = "ratboy-seal-green.gif" if GREEN else "ratboy-seal.gif"
OUT = os.path.join(os.path.expanduser("~"), "Pictures", NAME)
SIZE = 560               # final width in pixels
SS = 4                   # supersample factor
W = 1200                 # svg user units across (the grip makes it wide)
H = 1024                 # and down
INK = (87, 210, 47, 255) if GREEN else (255, 148, 24, 255)
GROUND = (8, 10, 8, 255) if GREEN else (5, 3, 1, 255)
FRAMES = 36              # over 180 degrees
MS = 80                  # per frame

FONT_CANDIDATES = [
    r"C:\Windows\Fonts\YuGothB.ttc",
    r"C:\Windows\Fonts\msgothic.ttc",
    r"C:\Windows\Fonts\meiryob.ttc",
]

RING = "\u3010\u30E9\u30C3\u30C8\u30DC\u30FC\u30A4\u5B9F\u884C\u3011" \
       "\u3010\u30C7\u30B9\u30EC\u30C3\u5B9F\u884C\u3011"
RING = RING * 2          # 36 glyphs, one per 10 degrees

S = SS
CANW, CANH = W * S, H * S
OUTH = int(round(SIZE * H / float(W)))


def px(v):
    return v * S


# ── path helpers, all in svg user units ────────────────────────────────────

def cubic(p0, p1, p2, p3, n=48):
    out = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        out.append((u*u*u*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t*t*t*p3[0],
                    u*u*u*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t*t*t*p3[1]))
    return out


def arc(cx, cy, rx, ry, a0, a1, n=72):
    """Elliptical arc, angles in degrees, 0 at 3 o'clock, y down."""
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
    """Thick polyline with round joins, and round caps unless caps=False.

    caps=False is the equivalent of stroke-linecap="butt": the loop's cut
    ends want a straight edge, and a disc there bulges past the bar's top
    edge and rounds off the free end below it."""
    p = scale(pts)
    w = int(px(width))
    d.line(p, fill=INK, width=w, joint="curve")
    if not caps:
        return
    r = px(width) / 2.0
    for q in (p[0], p[-1]):
        d.ellipse([q[0] - r, q[1] - r, q[0] + r, q[1] + r], fill=INK)


def build_static():
    """Everything that holds still: both rules, the grip, the face."""
    img = Image.new("RGBA", (CANW, CANH), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Both rules are broken on the right where the grip crosses them. Left
    # whole, each draws a line straight through the paddle.
    stroke(d, arc(512, 512, 486, 486, 5.7, 350.3, 300), 14)   # outer
    # The inner rule is broken twice: on the right where the grip opens out of
    # it, and on the left where the brow bar crosses it.
    stroke(d, arc(512, 512, 370, 370, 7.5, 185.0, 200), 27, caps=False)
    # The upper arc runs well past the bar's underside — its outer edge has to
    # stay left of the bar's end at every height across the bar, or the curve
    # crosses back inside near the top and opens a hairline. It is then cut
    # flush at the bar's underside: a square end on a curve is angled and
    # always leaves a tab poking below, so the cut is made square instead by
    # clearing the alpha under y=443.5 on the left.
    upper = Image.new("RGBA", (CANW, CANH), (0, 0, 0, 0))
    ud = ImageDraw.Draw(upper)
    stroke(ud, arc(512, 512, 370, 370, 188.0, 347.2, 200), 27, caps=False)
    ud.rectangle([0, px(443.5), px(320), CANH], fill=(0, 0, 0, 0))
    img.alpha_composite(upper)

    # The grip: the brow bar carried straight out, round the end, and back
    # underneath onto the loop — one continuous path, so the end really is a
    # half circle and the corners are joins rather than butted stubs.
    # Straight ends, not round: the left one has to reach the loop's outer
    # edge to close the corner under the arc, and the right one tucks under
    # the loop's band rather than capping short of it.
    grip = ([(141, 430), (1096, 430)] +
            arc(1096, 495, 65, 65, -90, 90, 48) +
            [(866, 560)])
    stroke(d, grip, 27, caps=False)

    # the frown: flat underneath, domed over
    mouth = [(316, 762), (708, 762)] + arc(512, 762, 196, 140, 0, -180, 72)
    stroke(d, mouth, 26)

    # shut eyes — filled crescents, two cubics each
    for e in ([(382, 486), (348, 548), (300, 584), (243, 592),
               (300, 620), (360, 586), (382, 486)],
              [(642, 486), (676, 548), (724, 584), (781, 592),
               (724, 620), (664, 586), (642, 486)]):
        d.polygon(scale(cubic(e[0], e[1], e[2], e[3]) +
                        cubic(e[3], e[4], e[5], e[6])), fill=INK)

    # Tears — two cubics and a half circle, tilted outward.
    #
    # The two are mirror images, so their bulbs sweep in OPPOSITE directions:
    # the left runs 0 to 180 (increasing), the right 180 to 0 (decreasing).
    # Both pass under the drop. Forcing a1 above a0 in every case sent the
    # right one over the top instead, which folded its bulb inside out and
    # left a wedge stuck to the eye. That is the svg's sweep flag, and it has
    # to be carried here as well.
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
        pts = cubic(tip, c1, c2, right)
        pts += arc(ctr[0], ctr[1], r, r, a0, a1, 48)
        pts += cubic(left, c3, c4, tip)
        d.polygon(scale(rot(pts, deg, pivot[0], pivot[1])), fill=INK)

    return img


def build_ring():
    """The katakana band, drawn once upright; the frames just rotate it."""
    font = None
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                font = ImageFont.truetype(path, int(px(70)), index=0)
                print("font:", path)
                break
            except Exception:
                continue
    if font is None:
        raise SystemExit("no CJK font found")

    img = Image.new("RGBA", (CANW, CANH), (0, 0, 0, 0))
    radius = px(431)
    cell = int(px(70) * 2.4)
    step = 360.0 / len(RING)

    for i, ch in enumerate(RING):
        glyph = Image.new("RGBA", (cell, cell), (0, 0, 0, 0))
        ImageDraw.Draw(glyph).text((cell / 2, cell / 2), ch, font=font,
                                   fill=INK, anchor="mm")
        theta = -90 + (i + 0.5) * step
        glyph = glyph.rotate(-(theta + 90), resample=Image.BICUBIC)
        cx = px(512) + radius * math.cos(math.radians(theta))
        cy = px(512) + radius * math.sin(math.radians(theta))
        img.alpha_composite(glyph, (int(cx - cell / 2), int(cy - cell / 2)))

    return img


def main():
    static = build_static()
    ring = build_ring()

    frames = []
    for f in range(FRAMES):
        deg = 180.0 * f / FRAMES
        base = Image.new("RGBA", (CANW, CANH), GROUND)
        # pivot on the circle, not the canvas: the grip makes the two differ
        base.alpha_composite(ring.rotate(-deg, resample=Image.BICUBIC,
                                         center=(px(512), px(512))))
        # The band passes behind the grip. The SVG does that with a mask on a
        # still wrapper; here the blank is painted over the turned band before
        # the static layer lands on top.
        ImageDraw.Draw(base).rectangle(
            [px(820), px(402), px(W), px(588)], fill=GROUND)
        base.alpha_composite(static)
        frames.append(base.convert("RGB").resize((SIZE, OUTH), Image.LANCZOS)
                      .quantize(colors=64, method=Image.MEDIANCUT))
        print("frame %2d/%d" % (f + 1, FRAMES), end="\r")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    frames[0].save(OUT, save_all=True, append_images=frames[1:],
                   duration=MS, loop=0, optimize=True, disposal=2)
    print("\nwrote %s  (%.1f KB, %dx%d, %d frames, %.2fs loop)"
          % (OUT, os.path.getsize(OUT) / 1024.0, SIZE, OUTH, FRAMES,
             FRAMES * MS / 1000.0))


if __name__ == "__main__":
    main()
