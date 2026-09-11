"""Collect every string the site shows into i18n/source.json.

Two halves: `ui`, the chrome (labels, chips, the status bar, the map page),
written here by hand and keyed; and `mods`, the prose out of mods.js --
tag, blurb, points, captions, controls -- keyed by mod id. A translation is
the same file with the values in another language; i18n/<code>.json.

Run it again whenever mods.js gains prose, then re-translate what is new.

    python make_i18n.py
"""

import io
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "i18n", "source.json")

UI = {
    "titlebar.conn": "conn",
    "titlebar.encrypted": "encrypted",
    "head.subrule": "mod archive · grand theft auto v",
    "head.tagline": "you will succumb to the poison you have tasted ...",

    "index.banner": "mods",
    "index.title": "MOD.INDEX",
    "index.filter": "filter — police, hud, fuel…",
    "index.filter_aria": "Filter mods",
    "index.nodes": "{n} nodes",
    "index.nomatch": "» no match",
    "index.public": "public",
    "index.local": "local",
    "index.loc": "loc",

    "spec.title": "BUILD//SPEC",
    "op.operator": "operator",
    "op.alias": "alias",
    "op.node": "node",
    "op.issued": "issued",
    "op.expires": "expires",
    "op.clearance": "clearance",
    "op.never": "NEVER",
    "op.root": "ROOT",

    "status.online": "online",
    "status.mods": "mods:",
    "status.visitors": "visitors:",
    "status.visitors_title": "where they came from",
    "status.src": "src:",
    "status.lines": "lines",
    "status.keys": "↑↓ select · / filter · esc clear",

    "crumb.archive": "archive",
    "chip.loc": "loc",
    "chip.files": "files",
    "chip.menu": "menu",
    "chip.download": "download",
    "chip.downloads": "downloads",
    "chip.count_title": "counted across every release, not just this one",
    "chip.source": "source ↗",
    "chip.private": "source · private",
    "meta.updated": "updated {when}",
    "meta.grabbed": "last grabbed {when}",
    "meta.from": "from",

    "time.today": "today",
    "time.yesterday": "yesterday",
    "time.days": "{n} days ago",
    "time.weeks": "{n} weeks ago",
    "time.months": "{n} months ago",
    "time.year": "1 year ago",
    "time.years": "{n} years ago",
    "time.justnow": "just now",
    "time.min": "{n} min ago",
    "time.hour": "1 hour ago",
    "time.hours": "{n} hours ago",

    "video.play": "Play",
    "video.footage": "footage",
    "video.watch": "watch on youtube ↗",
    "video.blocked": "can’t play here — opens on youtube",
    "sec.controls": "controls",
    "sec.install": "install",
    "install.requires": "; requires ScriptHookV + ScriptHookVDotNet 3",
    "install.onebuild": "; one build, GTA V Legacy and Enhanced",
    "foot.none": "no asset replacement · no RPF edits · no gameconfig",
    "foot.unpublished": "not yet published",

    "spec.archive": "BUILD // ARCHIVE",
    "spec.mod": "MOD",
    "spec.class": "CLASS",
    "spec.status": "STATUS",
    "spec.public": "PUBLIC",
    "spec.localbuild": "LOCAL BUILD",
    "spec.language": "LANGUAGE",
    "spec.runtime": "RUNTIME",
    "spec.editions": "EDITIONS",
    "spec.assets": "ASSETS",
    "spec.none": "NONE",
    "spec.menu": "MENU",
    "spec.source": "SOURCE",
    "spec.files": "FILES",
    "spec.size": "size across the archive",
    "spec.note": "{lines} lines of C# across {mods} mods and {files} files. Counted from src, excluding build, tools and release.",

    "lang.label": "language",

    "bubble.start": "download starting shortly…",
    "bubble.wip": "heads up: these mods are works in progress",
    "strip.product": "the product",
    "strip.menu": "on the menu",

    "map.title": "Where from",
    "map.tab": "where from",
    "map.sub": "visitor map · one pin per country · no addresses kept",
    "map.visits": "visits",
    "map.countries": "countries",
    "map.top": "top",
    "map.placed": "placed on the map",
    "map.of": "of {n} on it",
    "map.scope": "scope",
    "map.world": "world",
    "map.legend": "one pin per country · size follows the count",
    "map.bycountry": "by country",
    "map.foot": "counted once per address · click a row to find its pin",
    "map.back": "← back to the archive",
    "map.esc": "esc · back",
    "map.scanning": "scanning…",
    "map.scanning_n": "scanning {d}/{n}…",
    "map.nobody": "nobody yet",
    "map.none": "no countries recorded yet",
    "map.note": "{visits} visits from {countries} countries",
    "map.cached": "cached",
    "map.lastread": "last read {ago} · scanning…",
    "map.unreachable": "counter unreachable",
    "map.showing": "showing last read {ago}",
    "map.unanswered": "{n} unanswered",
    "map.tip": "{n} visits",
    "map.status_countries": "countries:",
    "map.status_visits": "visits:",
    "map.reading": "reading…",
}


def main():
    # mods.js is a script, not data; let node read it the way the page does
    js = ("global.window={}; require(%s); process.stdout.write(JSON.stringify(window.MODS));"
          % json.dumps(os.path.join(HERE, "mods.js")))
    mods = json.loads(subprocess.check_output(["node", "-e", js]).decode("utf-8"))

    prose = {}
    for m in mods:
        p = {"tag": m["tag"], "blurb": m["blurb"],
             "points": [{"h": x["h"], "t": x["t"]} for x in m.get("points", [])]}
        if m.get("shots"):
            p["shots"] = [s["cap"] if isinstance(s, dict) else "" for s in m["shots"]]
        if m.get("video"):
            p["video"] = m["video"]["label"]
        if m.get("ctrl"):
            p["ctrl"] = [r[1] for r in m["ctrl"]]
        prose[m["id"]] = p

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(
        json.dumps({"ui": UI, "mods": prose}, ensure_ascii=False, indent=1) + "\n")
    # English needs no fetch: the chrome strings ride along as a script, and
    # the prose is already in mods.js
    io.open(os.path.join(HERE, "i18n", "en.js"), "w", encoding="utf-8", newline="\n").write(
        "// Generated by make_i18n.py — do not edit. The English chrome strings.\n"
        "window.I18N_EN = " + json.dumps(UI, ensure_ascii=False, indent=1) + ";\n")
    words = sum(len(v.split()) for v in UI.values())
    for p in prose.values():
        words += len(p["tag"].split()) + len(p["blurb"].split())
        words += sum(len(x["h"].split()) + len(x["t"].split()) for x in p["points"])
        words += sum(len(c.split()) for c in p.get("shots", []))
        words += sum(len(c.split()) for c in p.get("ctrl", []))
        words += len(p.get("video", "").split())
    print("  wrote i18n/source.json: %d ui strings, %d mods, ~%d words" % (len(UI), len(prose), words))
    return 0


if __name__ == "__main__":
    sys.exit(main())
