"""Check every i18n/<code>.json against i18n/source.json.

A translation is only usable if it is the same shape as the source: the
same ui keys, the same mod ids, the same number of points, captions and
controls, and every {placeholder} carried across. Anything else and the page
would show a key name, or English, or the wrong caption under a picture.

    python check_i18n.py            exit 1 if any file is off
"""

import glob
import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "i18n", "source.json")
PH = re.compile(r"\{(\w+)\}")


def holders(s):
    return sorted(PH.findall(s or ""))


def check(path, src):
    name = os.path.basename(path)
    problems = []
    try:
        d = json.load(io.open(path, encoding="utf-8"))
    except Exception as e:
        return ["%s: does not parse: %s" % (name, e)]

    ui, sui = d.get("ui", {}), src["ui"]
    missing = sorted(set(sui) - set(ui))
    extra = sorted(set(ui) - set(sui))
    if missing:
        problems.append("ui missing: %s" % ", ".join(missing))
    if extra:
        problems.append("ui extra: %s" % ", ".join(extra))
    for k in sui:
        if k in ui:
            if not isinstance(ui[k], str) or not ui[k].strip():
                problems.append("ui %s: empty" % k)
            elif holders(ui[k]) != holders(sui[k]):
                problems.append("ui %s: placeholders %s, wanted %s" % (k, holders(ui[k]), holders(sui[k])))

    mods, smods = d.get("mods", {}), src["mods"]
    for mid, sp in smods.items():
        p = mods.get(mid)
        if not p:
            problems.append("mod %s: missing" % mid)
            continue
        for f in ("tag", "blurb"):
            if not isinstance(p.get(f), str) or not p[f].strip():
                problems.append("mod %s: %s empty" % (mid, f))
        if len(p.get("points", [])) != len(sp["points"]):
            problems.append("mod %s: %d points, wanted %d" % (mid, len(p.get("points", [])), len(sp["points"])))
        else:
            for i, x in enumerate(p["points"]):
                if not x.get("h") or not x.get("t"):
                    problems.append("mod %s: point %d empty" % (mid, i))
        for f in ("shots", "ctrl"):
            if f in sp and len(p.get(f, [])) != len(sp[f]):
                problems.append("mod %s: %d %s, wanted %d" % (mid, len(p.get(f, [])), f, len(sp[f])))
        if "video" in sp and not p.get("video"):
            problems.append("mod %s: video label missing" % mid)
    for mid in mods:
        if mid not in smods:
            problems.append("mod %s: not in source" % mid)
    return ["%s: %s" % (name, x) for x in problems]


def main():
    src = json.load(io.open(SRC, encoding="utf-8"))
    files = sorted(glob.glob(os.path.join(HERE, "i18n", "*.json")))
    files = [f for f in files if os.path.basename(f) != "source.json"]
    bad = 0
    for f in files:
        probs = check(f, src)
        if probs:
            bad += 1
            for p in probs:
                print("  " + p)
        else:
            d = json.load(io.open(f, encoding="utf-8"))
            print("  %-8s ok  (%d ui, %d mods, %d KB)" % (
                os.path.basename(f), len(d["ui"]), len(d["mods"]), os.path.getsize(f) // 1024))
    print("%d file%s checked, %d with problems" % (len(files), "" if len(files) == 1 else "s", bad))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
