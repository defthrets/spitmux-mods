"""Bring mods.js's line and file counts back in line with the mod repos.

The site prints how big each mod is. Those numbers are in mods.js, and mods.js
is not the source of them -- the repos are, and they grow every day. This
walks whichever of them are checked out beside this one and writes back only
the numbers that moved.

    python recount.py                 say what is out of date, change nothing
    python recount.py --write         rewrite mods.js, restamp, rebuild dist/
    python recount.py --write --push  ...and commit and push, if anything moved

A mod that is not checked out is left exactly as it is rather than counted as
nothing: this runs in two places -- the author's machine after a release, and
a cloud routine at three in the morning -- and neither always has all of them.

Counted: every *.cs in the repo, excluding build, tools, release, bin, obj and
the agent's worktrees, which is what the site's "counted from src, excluding
build, tools and release" line has always claimed.
"""

import io
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECTS = os.path.dirname(HERE)
MODS_JS = os.path.join(HERE, "mods.js")

# mod id in mods.js -> the repo folder beside this one
REPOS = {
    "hoodrich": "hoodrich",
    "bare-minimum": "bare-minimum",
    "fumes": "fumes",
    "overspray": "overspray",
    "five0patrol": "five0patrol",
    "vehicle-tweaks": "vehicle-tweaks",
    "bloodymess": "bloodymess",
    "franklin-rp": "franklin-rp",
    "weapon-tweaks": "weapon-tweaks",
    "streetgolf": "StreetGolf",
}

SKIP = {".git", "build", "tools", "release", "bin", "obj", ".claude", "packages", ".vs"}


def count(repo):
    files = lines = 0
    for base, dirs, names in os.walk(repo):
        dirs[:] = [d for d in dirs if d not in SKIP]
        for n in names:
            if not n.endswith(".cs"):
                continue
            files += 1
            with io.open(os.path.join(base, n), encoding="utf-8", errors="replace") as fh:
                lines += sum(1 for _ in fh)
    return files, lines


def entry_bounds(src, mid):
    """Where the entry for this mod starts and ends, by counting braces."""
    at = src.index('id: "%s"' % mid)
    start = src.rfind("\n  {", 0, at)
    depth, i = 0, start + 1
    while True:
        c = src[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return start, i + 1
        i += 1


def run(cmd, cwd=HERE):
    p = subprocess.run(cmd, cwd=cwd, shell=False, capture_output=True, text=True)
    if p.returncode != 0:
        raise SystemExit("  %s failed:\n%s%s" % (" ".join(cmd), p.stdout, p.stderr))
    return p.stdout


def main():
    write = "--write" in sys.argv
    push = "--push" in sys.argv

    src = io.open(MODS_JS, encoding="utf-8").read()
    moved, absent = [], []

    for mid, folder in REPOS.items():
        repo = os.path.join(PROJECTS, folder)
        if not os.path.isdir(repo):
            absent.append(mid)
            continue
        files, lines = count(repo)
        if not files:
            absent.append(mid)
            continue

        a, b = entry_bounds(src, mid)
        body = src[a:b]
        was_l = int(re.search(r"lines: (\d+)", body).group(1))
        was_f = int(re.search(r"files: (\d+)", body).group(1))
        if (was_l, was_f) == (lines, files):
            continue

        nb = re.sub(r"lines: \d+", "lines: %d" % lines, body, count=1)
        nb = re.sub(r"files: \d+", "files: %d" % files, nb, count=1)
        src = src[:a] + nb + src[b:]
        moved.append("%s %s->%s loc, %s->%s files" % (mid, was_l, lines, was_f, files))

    if absent:
        print("  not checked out, left alone: %s" % ", ".join(sorted(absent)))
    if not moved:
        print("  counts already true")
        return 0

    for m in moved:
        print("  " + m)
    if not write:
        print("  (nothing written; pass --write)")
        return 0

    io.open(MODS_JS, "w", encoding="utf-8", newline="\n").write(src)
    run([sys.executable, os.path.join(HERE, "stamp.py")])
    run([sys.executable, os.path.join(HERE, "build-single.py")])

    if not push:
        print("  mods.js rewritten, assets restamped")
        return 0

    if not subprocess.run(["git", "diff", "--quiet", "--", "mods.js"], cwd=HERE).returncode:
        print("  nothing to commit")
        return 0

    msg = "Recount: " + "; ".join(moved)
    if len(msg) > 68:
        msg = "Recount %d mod%s: %s" % (len(moved), "" if len(moved) == 1 else "s",
                                        ", ".join(m.split()[0] for m in moved))
    run(["git", "add", "mods.js", "index.html"])
    run(["git", "commit", "-m", msg + "\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>"])
    # the branch moves under this: a cloud routine and a person both push here
    subprocess.run(["git", "pull", "--rebase", "-q", "origin", "main"], cwd=HERE)
    run(["git", "push", "-q", "origin", "main"])
    print("  pushed: %s" % msg.splitlines()[0])
    return 0


if __name__ == "__main__":
    sys.exit(main())
