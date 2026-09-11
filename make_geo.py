"""Snapshot the visitor tallies into geo.json, so the map paints at once.

The counter has no way to list its keys, so the map page has to ask about
every country on earth one at a time -- 174 requests, six at a time, seven
to ten seconds of "scanning" before a first-time visitor sees a single pin.

This reads the same keys here, where the wait costs nobody anything, and
writes the answer next to the page. The page shows the snapshot the moment
it loads and then refreshes it live in the background. Run nightly; or by
hand:

    python make_geo.py

Read-only throughout: ?readonly=true, the same as the page, so taking the
snapshot does not count as a visit to anywhere.
"""

import io
import json
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "geo.json")
API = "https://counterapi.com/api/spitmux/geo/%s?readonly=true"


ERRORS = []


def read(cc):
    # A plain urllib call announces itself as Python-urllib, which some hosts
    # refuse; say who is asking instead.
    req = urllib.request.Request(API % cc, headers={
        "User-Agent": "spitmux.me make_geo.py (+https://spitmux.me)",
        "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            return cc, int(json.load(r).get("value") or 0)
    except Exception as e:
        ERRORS.append("%s: %s" % (cc, e))
        return cc, None


def main():
    src = io.open(os.path.join(HERE, "map-data.js"), encoding="utf-8").read()
    codes = re.findall(r"^    ([A-Z]{2}): \[", src, re.M)

    with ThreadPoolExecutor(16) as ex:
        results = list(ex.map(read, codes))

    failed = [cc for cc, n in results if n is None]
    if len(failed) > 10:
        print("  %d of %d reads failed; keeping the old snapshot" % (len(failed), len(codes)))
        print("  first error: " + ERRORS[0])
        return 1

    # A read that failed keeps whatever the last snapshot said about it,
    # rather than dropping a country off the map for a night.
    old = {}
    if os.path.isfile(OUT):
        try:
            for cc, n in json.load(io.open(OUT, encoding="utf-8"))["rows"]:
                old[cc] = n
        except Exception:
            pass

    rows = []
    for cc, n in results:
        if n is None:
            n = old.get(cc, 0)
        if n:
            rows.append([cc, n])
    rows.sort(key=lambda r: (-r[1], r[0]))

    snap = {"at": int(time.time() * 1000), "rows": rows}
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(
        json.dumps(snap, separators=(",", ":")) + "\n")
    print("  wrote geo.json: %d visits across %d countries%s" % (
        sum(r[1] for r in rows), len(rows),
        "" if not failed else " (%d reads failed, carried over)" % len(failed)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
