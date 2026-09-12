// ─── The archive ────────────────────────────────────────────────────────────
// One entry per mod. Everything the site draws comes from here, so adding a
// mod is adding an object and nothing else.
//
//   repo    a github url, or null while it is still private. null hides the
//           link and prints SOURCE · PRIVATE in its place.
//   lines   counted from the .cs under src/, excluding build, tools, release.
//   points  the body of the dossier: a heading and a paragraph.
//   ctrl    optional control table, [input, what it does].
//   strip   optional row of the mod's own pixel art: { kind, items }, each
//           item [path, caption]; kind picks the heading (product, menu).

window.MODS = [
  {
    id: "hoodrich",
    strip: { kind: "product", items: [
      ["strip/hoodrich/weed.png", "weed"],
      ["strip/hoodrich/coke.png", "coke"],
      ["strip/hoodrich/crack.png", "crack"],
      ["strip/hoodrich/meth.png", "meth"],
      ["strip/hoodrich/heroin.png", "heroin"],
      ["strip/hoodrich/lsd.png", "acid"],
      ["strip/hoodrich/ecstasy.png", "ecstasy"],
      ["strip/hoodrich/xanax.png", "xanax"]
    ] },
    shots: [
      { src: "shots/phone.png", cap: "the home screen — eleven apps, and the bank underneath" },
      { src: "shots/posted-up.webp", cap: "Gerald, and the lines you can answer with" },
      { src: "shots/dealing.webp", cap: "stood on a corner with something to sell" },
      { src: "shots/armoury.webp", cap: "Stretch's table, a gun picked out" }
    ],
    video: { id: "bcKNNGVBbXY", label: "Posted up on a corner" },
    install: ["scripts\\Hoodrich.dll", "scripts\\Hoodrich.ini", "scripts\\Hoodrich\\  (data + icons)"],
    name: "Hoodrich",
    tag: "drug-dealing and gang life, run off a phone that replaces the game's own",
    cat: "LIFE",
    key: "PHONE",
    lines: 148878,
    files: 206,
    status: "ACTIVE",
    repo: "https://github.com/defthrets/hoodrich",
    blurb:
      "You run with the Families. You buy weight off a plug, take it home and cut it, post up on a corner and let the trade come to you — and try to be gone before the police, or somebody else's people, decide you have been there long enough.",
    points: [
      {
        h: "Everything runs off the phone",
        t: "Press the phone button and the handset comes up on the right. Dealing, Contacts, Gangs, Inventory and Socials on the home screen; inside each one a list with the icon, the name, what it does and its value on a single line. Arrows move, Enter opens, Backspace goes back and puts it away. Your weapon wheel is untouched."
      },
      {
        h: "Zero external dependencies",
        t: "One DLL, some JSON, ScriptHookVDotNet. No Lua, no NativeUI, no config framework, no installer. The INI parser and the JSON parser are both hand-rolled and live in src/Hoodrich/Core."
      },
      {
        h: "The HUD stands down while it is up",
        t: "The handset stands where the posted-up readout and the licence strip live, so those step aside for as long as it is open."
      },
      {
        h: "105 icons drawn from scratch",
        t: "Ten data files and an icon set built rather than borrowed, because the game has no sprite for most of what this mod needs to say."
      }
    ],
    ctrl: [
      ["Phone button", "Open and close the handset"],
      ["Arrows", "Move between apps and rows"],
      ["Enter", "Open"],
      ["Backspace", "Back, and put it away"]
    ]
  },
  {
    id: "bare-minimum",
    strip: { kind: "menu", items: [
      ["strip/bare-minimum/burger.png", "burger"],
      ["strip/bare-minimum/chido_tacos.png", "tacos"],
      ["strip/bare-minimum/bp_fishchips.png", "fish & chips"],
      ["strip/bare-minimum/coop_donut.png", "donut"],
      ["strip/bare-minimum/cluck_bucket.png", "cluck bucket"],
      ["strip/bare-minimum/gv_pizza.png", "pizza"],
      ["strip/bare-minimum/deli_sub.png", "deli sub"],
      ["strip/bare-minimum/burrito.png", "burrito"],
      ["strip/bare-minimum/diner_breakfast.png", "diner breakfast"],
      ["strip/bare-minimum/bm_latte.png", "latte"],
      ["strip/bare-minimum/beer.png", "beer"],
      ["strip/bare-minimum/ecola.png", "e-cola"],
      ["strip/bare-minimum/hotdog.png", "hot dog"],
      ["strip/bare-minimum/fruit.png", "fruit"],
      ["strip/bare-minimum/cb_frappe.png", "frappe"],
      ["strip/bare-minimum/gv_salad.png", "salad"]
    ] },
    shots: [
      { src: "shots/hud-bars.png", cap: "the needs down the left of the minimap — health, sleep, food, water, energy" }
    ],
    name: "Bare Minimum",
    tag: "the needs the game left out, on a row of upright bars",
    cat: "LIFE",
    key: "F7",
    lines: 37339,
    files: 82,
    status: "ACTIVE",
    repo: "https://github.com/defthrets/bare-minimum",
    blurb:
      "Needs the game never gave Franklin, kept on game-clock time rather than real time — a full game day is roughly forty-eight minutes of play, so eating is something you do while getting on with the game rather than an errand.",
    points: [
      {
        h: "Tuned down on purpose",
        t: "Fifty-two game hours from a full stomach to an empty one, standing still. Slowed from twenty-eight, because under an hour from full to starving made eating the thing you were doing instead of the thing you did in passing."
      },
      {
        h: "The ini is the file you edit",
        t: "It is never overwritten by an update. The F7 menu does write to it — but only the single lines whose values you changed, and only once you stop pressing. Your comments, your ordering and anything else you have edited are left exactly as they are."
      },
      {
        h: "It knows about the others",
        t: "Drugs carried in Hoodrich's Posted Up show in this mod's pocket, and you can take one from there. They never take up a food slot. It does nothing at all if that mod is not installed."
      }
    ]
  },
  {
    id: "fumes",
    shots: [
      { src: "shots/fumes-pump.webp", cap: "mid-fill at the Xero on Davis Avenue" },
      { src: "shots/hud-bars.png", cap: "the gauge, standing right of the minimap" }
    ],
    video: { id: "eq0v2n-2XJw", label: "Filling up" },
    name: "Fumes",
    tag: "a real tank, and a nozzle you carry to the car yourself",
    cat: "VEHICLE",
    key: "Shift+F",
    lines: 19418,
    files: 39,
    status: "ACTIVE",
    repo: "https://github.com/defthrets/fumes",
    blurb:
      "Every vanilla and online vehicle carries a real tank that empties as you drive and is still empty when you come back to it tomorrow. Refuelling is the point of the mod, and it is not a menu.",
    points: [
      {
        h: "Get out and walk to the pump",
        t: "Take the nozzle off the pump — it goes in Franklin's hand and the hose comes with him. Walk it round to the side of the car, to wherever that model's filler actually is. Fill up. Walk it back and hang it up. Walk too far and the hose pulls the nozzle out of your hands."
      },
      {
        h: "Consumption is physical",
        t: "Tanks are sized from the model's own fPetrolTankVolume, so a Blista, a Phantom and a Bati all differ. Distance × litres-per-100km for the class, plus idle burn, times engine load taken from RPM. A damaged engine drinks more. Fuel persists per vehicle, keyed on model and plate, across sessions."
      },
      {
        h: "A black physics hose",
        t: "It runs from the pump to your hand and sags, swings and drapes on its own. GTA cannot tint a rope, so the rope does the physics and the colour is painted along its own vertices. If ropes will not come up on your install it draws one instead, and says so in the log."
      },
      {
        h: "The last half-litre",
        t: "An engine that keeps catching and dropping. On empty it stalls, and the starter will turn over as long as you keep trying it. A shot petrol tank leaks onto the road whether the engine is running or not. Electric vehicles read CHARGE instead of FUEL."
      },
      {
        h: "Found by object, not by coordinate",
        t: "Pumps are located by asking the game which pump object you are standing at, so it works at every station — including ones added by map mods."
      }
    ]
  },
  {
    id: "overspray",
    shots: [
      { src: "shots/graffiti.webp", cap: "a tag going up, one pass of the can at a time" }
    ],
    video: { id: "k0u4Gpqi_tw", label: "Spraying a wall" },
    name: "Overspray",
    tag: "spray paint on any surface in the city",
    cat: "WORLD",
    key: "F3",
    lines: 9057,
    files: 27,
    status: "ACTIVE",
    repo: "https://github.com/defthrets/overspray",
    blurb:
      "Hold the trigger with a can out and whatever you are aiming at takes paint. Walls, shutters, kerbs, the road, the side of a skip, a ceiling — anything solid. The paint stays where you put it and is still there when you come back.",
    points: [
      {
        h: "Thirteen colours and three caps",
        t: "Chrome and gold among them, and thin, stock and fat caps for the can — a fat cap lays a wide soft band, a thin one draws a line."
      },
      {
        h: "It persists",
        t: "A piece you put on a wall in Strawberry is on that wall the next time you drive past it."
      },
      {
        h: "One DLL, both editions",
        t: "Legacy and Enhanced from the same build. Needs ScriptHookVDotNet 3.9.0 or newer — an older one refuses to load it, and what that looks like is nothing at all."
      }
    ]
  },
  {
    id: "five0patrol",
    name: "Five0 Patrol",
    tag: "the heat bar that fills before the first wanted star",
    cat: "POLICE",
    key: "F10",
    lines: 33171,
    files: 61,
    status: "PUBLIC",
    repo: "https://github.com/defthrets/five0patrol",
    blurb:
      "GTA V's police have two states — nothing at all, and a wanted level — and the step between them is instant. There is no version of being noticed. Five0 Patrol is the missing middle.",
    points: [
      {
        h: "Heat, then stars",
        t: "Heat goes up when somebody sees you doing something petty and drains when nobody does. Stars are still the game's and still mean what they always did; this is what happens on the way there."
      },
      {
        h: "The bar fills and somebody walks over",
        t: "An officer asks you about it, searches you, and either sends you on your way or does not. Admitting it, denying it and saying nothing all have a path to walking away, and all three have a path to a star. What decides it is what you are actually carrying and whether it matches what you told him."
      },
      {
        h: "A star is what happens when that goes badly",
        t: "At one star the police carry stun guns rather than sidearms, and you can put your hands up and give yourself up rather than run."
      },
      {
        h: "And there are police out there to do it",
        t: "Foot patrols walk rounds on the pavements, some with a dog. Marked cars work the roads and the back alleys with a spotlight after dark."
      },
      {
        h: "It stands aside",
        t: "If LSPDFR is installed it steps back by default — that mod owns the wanted system, and two mods drawing over the same stars is very hard to diagnose from inside the game."
      }
    ]
  },
  {
    id: "vehicle-tweaks",
    name: "Vehicle Tweaks",
    tag: "manual ignition, and indicators you steer on",
    cat: "VEHICLE",
    key: "F10",
    lines: 17135,
    files: 41,
    status: "ACTIVE",
    repo: "https://github.com/defthrets/vehicle-tweaks",
    blurb:
      "Two small changes to how a car behaves. Neither of them says a word while it works, and neither adds a thing to the screen.",
    points: [
      {
        h: "The engine is something you operate",
        t: "Hold the exit key and the engine stops while you stay in the seat. Tap it and you get out with the car left exactly as it stands — running if it was running, dead if you turned it off first. Get back in and nothing starts until you touch the throttle, and then the starter turns over before the engine catches."
      },
      {
        h: "Left as it stands",
        t: "Running, playing, lit, and with the door open. The radio keeps its station, loud enough to hear from outside. The headlights stay on. The door hangs open until you get back in, or until a passing car shuts it for you. Turn the engine off first and it all goes with it — a dead car with a stereo on is a flat battery, not a feature."
      },
      {
        h: "Above a brisk walk the key goes back",
        t: "Past 2.5 m/s the exit key is handed straight to the game, whole and untouched, so vanilla's hold-to-bail works exactly as it always did. A tap that ejects you at sixty is not what a tap should do."
      },
      {
        h: "Indicators on the wheel",
        t: "Hold the wheel over for a second and that side comes on. Letting go does not cancel it — that is the whole design rather than a detail, because it is what lets you signal at a red light and then release the wheel. Only a held turn the other way cancels; a flick to line the car up does not."
      }
    ],
    ctrl: [
      ["Hold exit", "Kill the engine, stay in the seat"],
      ["Tap exit", "Get out, leave it as it stands"],
      ["J", "Hazards — both sides at once"],
      ["Hold R3 + D-pad down", "Hazards, on a pad"]
    ]
  },
  {
    id: "bloodymess",
    install: ["scripts\\BloodyMess.dll", "scripts\\BloodyMess.ini", "scripts\\BloodyMess\\gore.json"],
    name: "Bloody Mess",
    tag: "blood that stays on the world, and comes home on your shoes",
    cat: "WORLD",
    key: "F10",
    lines: 10043,
    files: 29,
    status: "PUBLIC",
    repo: "https://github.com/defthrets/bloodymess",
    blurb:
      "More blood comes out of people, the blood stays on the world, and you track it out of the puddles. One .dll, one .ini, one data file — no asset replacement, no RPF edits, no gameconfig.",
    points: [
      {
        h: "Shooting people is messier",
        t: "Every hit stamps extra wound decals, fires the game's own blood particles at entry and exit, and throws a cone of splatter out the far side that lands on whatever is actually behind them. Shotguns throw more of it than pistols. Kill somebody at arm's length and it comes back onto you."
      },
      {
        h: "Bodies bleed out",
        t: "A pool spreads from under anybody who goes down, growing over about half a minute — wet on tarmac, soaked-in on grass. Somebody wounded and still walking leaves a trail spaced by distance covered, so standing still leaves nothing and nobody bleeds forever."
      },
      {
        h: "And you walk it around",
        t: "Step in wet blood and it comes with you: a fading trail of footprints, left and right, pointing the way you are walking. It works for NPCs fleeing a scene, and for tyres driven through a pool."
      },
      {
        h: "One ledger, one hard cap",
        t: "The game has a fixed decal pool and script decals compete with its own bullet holes for it. Going over does not crash and does not log — decals just stop appearing. So everything this draws goes through a budget with a cap, a rate limit and a range limit, and it evicts its own oldest rather than letting the engine choose. That budget is deliberately not scaled by the gore level: turning the gore up cannot turn the safety off."
      },
      {
        h: "Every part of it switches off on its own",
        t: "Splatter, pooling, trails and footprints are four separate settings, from the ini or the F10 menu. Bleeding runs on a window that expires and is refreshed by being hurt, so nobody bleeds because they were scratched once. Every engine setting the mod touches is handed back on shutdown and on a script reload."
      }
    ]
  },
  {
    id: "franklin-rp",
    name: "Franklin RP",
    tag: "an emote panel with a man stood next to it doing the emote",
    cat: "PLAY",
    key: "F1",
    lines: 6814,
    files: 22,
    status: "ACTIVE",
    repo: "https://github.com/defthrets/franklin-rp",
    blurb:
      "Animations, searchable, with favourites — and a stand-in ped beside the panel playing whatever row the cursor is on.",
    points: [
      {
        h: "The preview is really standing there",
        t: "There is no way for a script to render a model into a picture, so he is an actual ped with no collision that nothing in the world can target. Against a wall or in a tight interior he clips into it, because there is nowhere else for him to be."
      },
      {
        h: "Sprinting ends a loop",
        t: "So you run out of an emote rather than stop it."
      },
      {
        h: "It takes GTA's own hotkeys back",
        t: "F1 is the Rockstar Editor's action replay. The mod suppresses the replay hotkeys and the on-screen hint, with a harder option that stops the recorder outright for anyone who never uses it."
      },
      {
        h: "Stop is on the numpad",
        t: "Because every F-key on this install already belongs to another mod."
      }
    ]
  },
  {
    id: "weapon-tweaks",
    name: "Weapon Tweaks",
    tag: "fifty-eight things the game does to a gun and never lets you change",
    cat: "WEAPON",
    key: "F7",
    lines: 9556,
    files: 20,
    status: "ACTIVE",
    repo: "https://github.com/defthrets/weapon-tweaks",
    blurb:
      "How fast it fires, how much it kicks, what comes out of it, how he holds it, what is bolted to it, and whether there is a red dot on whatever you are pointing at. All of it on a panel that applies a change the instant you make it.",
    points: [
      {
        h: "A script cannot change a weapon's cadence",
        t: "Rate of fire lives in weapons.meta, an asset file. Every mod that claims to change it from a script is doing something else and generally not saying what. So this does the something else, and says what."
      },
      {
        h: "Nothing is injected",
        t: "A semi-automatic fires on the rising edge of the attack control. The obvious trick — disable the control and hand it back through SET_CONTROL_VALUE_NEXT_FRAME — is a fight: the injection is for the next frame, the disable is for this one, and it works on one machine and stutters on another. Instead you really are holding the trigger down, and the mod takes the control away on the frames between shots."
      },
      {
        h: "What that gives you",
        t: "Every pistol, revolver and marksman rifle becomes fully automatic at whatever rate you set. Any weapon can be slowed down — a carbine held to three rounds a second is a burst discipline the game will not otherwise give you. It cannot make an automatic faster than its own cycle."
      },
      {
        h: "Fifty-eight settings, one panel",
        t: "Recoil and how far it climbs, spread, what comes out of the muzzle, the grip he holds it with, what is bolted to the rail, and whether there is a red dot on whatever you are pointing at. F7 opens it and a change applies the instant you make it — no reload, no restart."
      }
    ]
  },
  {
    id: "streetgolf",
    video: { id: "Cj3kspgmio0", label: "Teeing off into traffic" },
    install: ["scripts\\StreetGolf.cs", "scripts\\StreetGolf.ini"],
    name: "Street Golf",
    tag: "a driving range anywhere in Los Santos",
    cat: "PLAY",
    key: "—",
    lines: 8036,
    files: 5,
    status: "ACTIVE",
    repo: "https://github.com/defthrets/StreetGolf",
    blurb:
      "You stand where you are and hit ball after ball at the traffic. No hole, no course, no walking after the ball.",
    points: [
      {
        h: "Built on the game's own golf minigame",
        t: "The actual swing animations, the four real club props, prop_golf_ball flown by the game's physics, and the game's golf sound set and particles. It looks and sounds like the real thing because it is."
      },
      {
        h: "Two files",
        t: "A .cs and an .ini into scripts/. ScriptHookVDotNet compiles the source when the game starts, so Insert reloads it without restarting."
      }
    ]
  }
];
