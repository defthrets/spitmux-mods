#!/usr/bin/env python3
"""Inline the whole site into one file.

The site is normally served as index.html + styles.css + four scripts. This
flattens it into a single HTML document for anywhere that wants one file:
an Artifact, a pastebin, an email to somebody.

    python build-single.py            -> dist/spitmux-mods.html      (standalone)
    python build-single.py --artifact -> dist/spitmux-mods.body.html (no <html>/<head>)

The --artifact form drops the document wrapper, because the Artifact host
supplies its own <!doctype>, <head> and <body>.
"""

import base64
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPTS = ["matrix.js", "effects.js", "mods.js", "huds.js", "intro.js", "app.js"]


def read(name):
    return io.open(os.path.join(HERE, name), encoding="utf-8").read()


def build(artifact=False):
    html = read("index.html")

    body = re.search(r"<body[^>]*>(.*)</body>", html, re.S)
    if not body:
        raise SystemExit("index.html: no <body> found")
    body = body.group(1)

    # swap every <script src="x.js"> for the file itself, in place
    for name in SCRIPTS:
        src = read(name)
        body = body.replace(
            '<script src="%s"></script>' % name,
            "<script>\n%s\n</script>" % src,
        )
    left = re.findall(r'<script src="([^"]+)"></script>', body)
    if left:
        raise SystemExit("un-inlined scripts: %s" % ", ".join(left))

    # Screenshots are referenced by path from mods.js, which is fine on a
    # static host and useless in a single file, so they get embedded. Anything
    # missing is left alone rather than failing the build.
    def embed(match):
        rel = match.group(1)
        path = os.path.join(HERE, rel)
        if not os.path.isfile(path):
            print("  shot not found, left as a path: %s" % rel)
            return match.group(0)
        ext = os.path.splitext(rel)[1].lower().lstrip(".")
        mime = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png",
                "gif": "gif", "webp": "webp"}.get(ext, "png")
        with open(path, "rb") as fh:
            b64 = base64.b64encode(fh.read()).decode("ascii")
        print("  embedded %s (%.0f KB)" % (rel, len(b64) * 0.75 / 1024))
        return '"data:image/%s;base64,%s"' % (mime, b64)

    # The path only ever appears as a quoted string in mods.js — app.js
    # builds the src attribute from it at runtime — so that string literal
    # is what gets swapped, not an attribute in the markup.
    body = re.sub(r'"(shots/[^"]+)"', embed, body)

    # take the font request from index.html rather than keeping a second copy
    # of it here — they drifted apart once already
    fonts = re.search(r'<link href="(https://fonts\.googleapis\.com/[^"]+)"', html)
    if not fonts:
        raise SystemExit("index.html: no Google Fonts link found")

    head = (
        '<title>spitmux ~ mods</title>\n'
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        '<link href="%s" rel="stylesheet">\n'
        "<style>\n%s\n</style>\n" % (fonts.group(1), read("styles.css"))
    )

    if artifact:
        return head + body

    return (
        "<!doctype html>\n<html lang=\"en\">\n<head>\n"
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        + head
        + "</head>\n<body>"
        + body
        + "</body>\n</html>\n"
    )


def main():
    artifact = "--artifact" in sys.argv
    out_dir = os.path.join(HERE, "dist")
    if not os.path.isdir(out_dir):
        os.makedirs(out_dir)
    name = "spitmux-mods.body.html" if artifact else "spitmux-mods.html"
    path = os.path.join(out_dir, name)
    io.open(path, "w", encoding="utf-8", newline="\n").write(build(artifact))
    print("%s  (%.0f KB)" % (path, os.path.getsize(path) / 1024.0))


if __name__ == "__main__":
    main()
