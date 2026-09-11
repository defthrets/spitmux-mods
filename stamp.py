"""Stamp a content hash onto the asset URLs in index.html and map.html.

GitHub Pages serves styles.css and the scripts with Cache-Control: max-age=600
and a filename that never changes, so for ten minutes after a deploy a browser
can hold the old stylesheet while fetching the new markup -- which is how the
operator card came out unstyled, and the same reason a swapped icon kept
showing the old art.

Hashing the contents into the query string makes the URL change whenever the
file does, so the cache busts itself and an unchanged file still caches for the
full ten minutes. Idempotent: any existing ?v= is stripped before restamping,
so running it twice is the same as running it once.

Run from build-single.py, or on its own:  python stamp.py
"""

import hashlib
import io
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PAGES = [os.path.join(HERE, "index.html"), os.path.join(HERE, "map.html")]

# Only things the page itself pulls in. Images are addressed by convention and
# are handled by their own fallbacks; a hash on those would defeat the "drop a
# file in and it appears" arrangement.
PATTERN = re.compile(
    r'(?P<attr>href|src)="(?P<file>(?:styles\.css|[a-z0-9/-]+\.js))(?:\?v=[0-9a-f]+)?"')


def digest(path):
    with open(path, "rb") as fh:
        return hashlib.sha1(fh.read()).hexdigest()[:8]


# Icons and screenshots are addressed by name on purpose (drop a file in and
# it appears), so they cannot carry their own hash. One version over the lot
# goes into a meta tag the page reads, and onto any icon the markup names.
ART_DIRS = ["icons", "shots", "strip"]
ART_META = re.compile(r'<meta name="art-v" content="[0-9a-f]*" />\n')
ART_SRC = re.compile(r'src="(?P<file>icons/[A-Za-z0-9._-]+\.(?:gif|png))(?:\?v=[0-9a-f]+)?"')


def art_version():
    h = hashlib.sha1()
    for d in ART_DIRS:
        p = os.path.join(HERE, d)
        if not os.path.isdir(p):
            continue
        for base, dirs, files in os.walk(p):
            dirs.sort()
            for name in sorted(files):
                f = os.path.join(base, name)
                h.update(os.path.relpath(f, HERE).encode("utf-8"))
                with open(f, "rb") as fh:
                    h.update(fh.read())
    return h.hexdigest()[:8]


def main():
    for page in PAGES:
        stamp(page)
    return 0


def stamp(PAGE):
    html = io.open(PAGE, encoding="utf-8").read()
    seen = []

    def swap(m):
        f = m.group("file")
        path = os.path.join(HERE, f)
        if not os.path.isfile(path):
            return m.group(0)
        h = digest(path)
        seen.append((f, h))
        return '%s="%s?v=%s"' % (m.group("attr"), f, h)

    out = PATTERN.sub(swap, html)

    if os.path.basename(PAGE) == "index.html":
        v = art_version()
        meta = '<meta name="art-v" content="%s" />\n' % v
        if ART_META.search(out):
            out = ART_META.sub(meta, out)
        else:
            out = out.replace('<meta name="viewport"', meta + '  <meta name="viewport"', 1)
        out = ART_SRC.sub(lambda m: 'src="%s?v=%s"' % (m.group("file"), v), out)
        seen.append(("icons/ shots/", v))

    if out != html:
        io.open(PAGE, "w", encoding="utf-8", newline="\n").write(out)

    for f, h in seen:
        print("  %-14s ?v=%s" % (f, h))
    print("%s: %d asset%s stamped%s" % (os.path.basename(PAGE), len(seen),
                                        "" if len(seen) == 1 else "s",
                                        "" if out != html else " (unchanged)"))


if __name__ == "__main__":
    sys.exit(main())
