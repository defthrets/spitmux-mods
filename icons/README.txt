PIXEL ICONS
===========

Drop PNGs in here named after the mod. Nothing else to do - no list to
edit, no wiring. The page asks for icons/<mod id>.png at three places at
once, and any file that is not there removes itself and closes the gap.

    hoodrich.png      five0patrol.png   bloodymess.png
    fumes.png         bare-minimum.png  overspray.png
    franklin-rp.png   streetgolf.png    weapon-tweaks.png
    vehicle-tweaks.png

    archive.png       not a mod - the object in the top right of the
                      header, balancing the seal on the left

WHERE EACH ONE LANDS
--------------------
One file, four places, so it becomes that mod's mark rather than a
decoration sitting in one list:

    42px   in the index row, left column
    76px   at the head of its dossier, middle column
    20px   beside ID//BUILD in the spec panel, right column
    92px   (archive.png only) top right of the header

KEEP THEM AT NATIVE SIZE
------------------------
Do not scale them up in an editor first. They are drawn with
image-rendering: pixelated, which keeps the pixels square; art that
arrives pre-scaled is already soft and cannot be sharpened again.

32x32 or 64x64 square is ideal - both divide cleanly into the sizes
above. Non-square works but gets letterboxed into a square box.

COLOUR
------
They are full colour in a page that holds one hue, so at rest they sit
pulled most of the way down towards the amber and come up to full colour
only where colour means something: the row under the cursor, the row you
have selected, and the icon at the head of the open dossier. The colour
is the selection, not decoration.
