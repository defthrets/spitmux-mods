# spitmux ~ mods

A showcase for the GTA V script mods, in the same amber-on-warm-black CRT
terminal as [spitmux.dev](https://github.com/defthrets/spitmux.dev) — same
palette, same fonts, same bezel, same corner-bracketed buttons — laid out as a
catalogue rather than a shell.

No build step and no dependencies. Open `index.html`, or drop the folder on any
static host. Published with GitHub Pages off `main`.

`seal/` is the R4TB0Y$ mark: `make_seal_png.py` renders it white-on-transparent
for the mods to tint in game, `make_site_art.py` turns that into this site's
favicons and `og.png`. Both write files that are committed, so neither has to
run unless the mark changes.

```
index.html    the shell: titlebar, CRT head, three columns, statusbar
styles.css    the design system, lifted from spitmux.dev and re-cut
mods.js       the data — every mod, one object each
app.js        index, filter, dossier, spec panel, boot sequence
matrix.js     the amber rain, from spitmux.dev, matched to the ladder
effects.js    scramble, flash and keystroke audio, copied from spitmux.dev
```

## Adding or changing a mod

Everything the page draws comes out of `mods.js`, so a mod is an object and
nothing else:

```js
{
  id:     "doorboard",              // also the deep link, /#doorboard
  name:   "Doorboard",
  tag:    "kick a door off a car and ride it down the street",
  cat:    "PLAY",                   // POLICE WORLD VEHICLE WEAPON HUD LIFE PLAY
  key:    "N",                      // menu or mount key, or "—"
  lines:  2591,
  files:  11,
  repo:   null,                     // a github url, or null while private
  blurb:  "…",                      // the paragraph under the title
  points: [{ h: "heading", t: "paragraph" }],
  ctrl:   [["N", "what it does"]],  // optional control table
  install:["scripts\\Doorboard.dll"] // optional; otherwise inferred from name
}
```

`repo: null` prints `SOURCE · PRIVATE` and tags the row `LOCAL`. Set the URL
when a mod goes public and the link, the chip and the row tag all follow.

The install block is inferred from the mod's name (`Bare Minimum` →
`scripts\BareMinimum.dll` + `.ini`), which is right for most of them. Set
`install` explicitly where a mod ships a data folder or a loose `.cs`.

### Counting the source

The `lines` and `files` numbers were counted from the `.cs` under each mod,
excluding `build`, `tools`, `release`, `bin` and `obj`:

```bash
python -c "
import os
skip={'build','release','tools','bin','obj','.git','apiref','preview'}
loc=files=0
for root,dirs,fs in os.walk('.'):
    dirs[:]=[d for d in dirs if d.lower() not in skip]
    for f in fs:
        if f.endswith('.cs'):
            loc+=sum(1 for _ in open(os.path.join(root,f),encoding='utf-8',errors='ignore')); files+=1
print(loc,'lines',files,'files')"
```

## The palette

Amber on warm black, one hue family, nine steps — all of them in `:root` in
[styles.css](styles.css) as `--p-core` down to `--p-edge`. The steps were
solved against the page ground for even contrast rather than picked by eye,
and each carries its ratio in a comment. The original ladder had everything
either at 3.5:1 or above 11:1 with nothing in between, which is why it read
flat; the body copy in particular sat at 3.5:1 and now sits at 8.5:1.

`--p-signal` is the one rung not solved for. `#ff9418` is the identity, carried
over from spitmux.dev untouched; the ladder was built around it.

Nothing else in the stylesheet holds a colour. Every wash and glow that needs
an alpha goes through a channel triplet — `rgb(var(--rgb-signal) / 0.15)` —
so re-tubing the whole site means editing one block at the top — the green
phosphor variant this went through was a five-minute swap. The three columns
are the same ladder rotated: the index toward red (`--gh-*`), the dossier true
amber, the spec panel toward yellow (`--pb-*`), so they read as three
instruments rather than one field.

The rain in [matrix.js](matrix.js) carries its own four values, matched to the
ladder by hand — it draws to a canvas and cannot see the CSS.

To check a change hasn't broken anything, the site's own contrast can be
measured in the browser console; the numbers above are composited against the
real stacked backgrounds, not against the page ground, because most text here
sits on a panel with a 2–4% wash over it.

## The seal

The R4TB0Y$ mark leans in from behind the right-hand side of the CRT bezel.
It is inline SVG in [index.html](index.html) — no image file — and only its
katakana ring turns; the face and both rules hold still, which is what makes
the ring read as a bezel rather than the whole mark wobbling.

The bezel already clips its own overflow, so the tuck needs no mask. The seal
sits at `z-index: 0`, under the bezel's vignette rather than over it, so the
falloff darkens the half nearest the edge and it reads as being behind the
frame instead of pasted onto it.

It is drawn in `--p-signal` rather than its native green: the page holds one
hue, and a lone green mark on it reads as a mistake. Change `color` on
`.frame-head > .seal-peek` if you want the green back.

[ratboy-seal.html](ratboy-seal.html) is the standalone twin, in green, on its
own black stage. The two carry the same path data — if you reshape one, reshape
the other.

## Using it

| | |
|---|---|
| Click a row, or `↑` `↓` | Open a mod |
| `/` | Jump to the filter |
| `Esc` | Clear the filter |
| `/#five0patrol` | Deep link straight to one |
| Click the logo, the tagline, or a mod title | Glitch it |
| ↑↑↓↓←→←→BA | — |

The bars under **SIZE // ARCHIVE** are clickable too.

## One file

`build-single.py` inlines the CSS and all four scripts into a single document,
for anywhere that wants one file rather than six:

```bash
python build-single.py              # dist/spitmux-mods.html
python build-single.py --artifact   # dist/spitmux-mods.body.html
```

The `--artifact` form leaves out `<!doctype>`, `<html>` and `<body>`, for a host
that supplies its own.

## A note on the animations

Nothing that carries content is allowed to depend on an animation finishing.
The index rows animate their `transform` and never their `opacity`; the size
bars get their width from an inline style rather than a keyframe; and every
`scrambleEl` call is backed by a timer that puts the real text back. A paused
`requestAnimationFrame` — a background tab, a throttled embed, a preview pane
that only paints on demand — can otherwise leave the list blank or a heading
permanently scrambled. It is decoration, so it fails as decoration.
