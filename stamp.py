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
    if out != html:
        io.open(PAGE, "w", encoding="utf-8", newline="\n").write(out)

    for f, h in seen:
        print("  %-14s ?v=%s" % (f, h))
    print("%s: %d asset%s stamped%s" % (os.path.basename(PAGE), len(seen),
                                        "" if len(seen) == 1 else "s",
                                        "" if out != html else " (unchanged)"))


if __name__ == "__main__":
    sys.exit(main())
