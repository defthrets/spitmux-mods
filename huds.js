// ─── HUD diagrams ───────────────────────────────────────────────────────────
// Keyed by mod id: one drawing, or an array of them where a mod puts more than
// one thing on screen.
//
// These are DRAWINGS, not captures. Where a real screenshot exists it sits
// above them in the dossier and the drawing's job narrows to labelling — the
// capture shows what it looks like, this says what each part is. Anything in
// here that a capture contradicts is a bug in here, not in the capture.
//

(function () {
  var STAR = "M 0 -9 L 2.6 -3.1 L 8.6 -2.8 L 4.1 1.4 L 5.6 7.3 " +
             "L 0 4.1 L -5.6 7.3 L -4.1 1.4 L -8.6 -2.8 L -2.6 -3.1 Z";

  // ── glyphs, each drawn about its own origin ────────────────────────────
  var HEART = '<path d="M 0 4 C -7 -2 -6 -8 -2.5 -8 C -1 -8 0 -6.6 0 -6.6 ' +
              'C 0 -6.6 1 -8 2.5 -8 C 6 -8 7 -2 0 4 Z"/>';
  var BOLT = '<path d="M 1.5 -8 L -5 1 L -0.5 1 L -1.5 8 L 5 -1 L 0.5 -1 Z"/>';
  var MOON = '<path d="M 3 -8 A 8 8 0 1 0 3 8 A 6.4 6.4 0 1 1 3 -8 Z"/>';
  var DROP = '<path d="M 0 -9 C 5 -3 7.5 0.5 7.5 3.5 A 7.5 7.5 0 0 1 -7.5 3.5 ' +
             'C -7.5 0.5 -5 -3 0 -9 Z"/>';
  var FORK = '<path d="M -4 -8 L -4 -1 M -1.5 -8 L -1.5 8 M -4 -1 L 1 -1 ' +
             'M 4 -8 C 6.5 -8 6.5 -2 4 -2 L 4 8" stroke="var(--p-glow)" ' +
             'stroke-width="1.8" fill="none" stroke-linecap="round"/>';
  var PUMP = '<g stroke="var(--p-glow)" stroke-width="1.8" fill="none" ' +
             'stroke-linejoin="round" stroke-linecap="round">' +
             '<path d="M -9 7 L -9 -8 L 3 -8 L 3 7"/>' +
             '<path d="M -6 -5 L 0 -5 L 0 -1 L -6 -1 Z"/>' +
             '<path d="M 3 -3 L 6.5 -3 A 2 2 0 0 1 8.5 -1 L 8.5 3 ' +
             'A 1.8 1.8 0 0 1 4.9 3 L 4.9 0.5"/>' +
             '<path d="M -11 7 L 5 7"/></g>';

  // The game's own frame, which none of these mods draw — it is here so the
  // things that DO get drawn have something to sit against.
  function minimap(x, y, w, h) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
      '" fill="rgb(var(--rgb-signal) / 0.03)" stroke="var(--p-line)" ' +
      'stroke-width="2" stroke-dasharray="5 5"/>' +
      '<text class="hl dim" x="' + (x + w / 2) + '" y="' + (y + h / 2 + 5) +
      '" text-anchor="middle">minimap</text>';
  }

  // A slim upright bar: channel, then liquid with a bowed surface. The bow is
  // clamped to the headroom above the liquid, so a full bar reads flat rather
  // than bulging out through the top of its own channel.
  function slim(x, y, h, fill, tone) {
    var w = 13, pad = 2, inner = h - pad * 2;
    var lift = Math.max(2, Math.round(inner * fill));
    var top = y + h - pad - lift;
    var bow = Math.min(3, top - (y + pad));
    return '' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="2" ' +
        'fill="rgb(var(--rgb-signal) / 0.05)" stroke="var(--p-line)" stroke-width="1.5"/>' +
      '<path d="M ' + (x + pad) + ' ' + (top + bow) +
        ' Q ' + (x + w / 2) + ' ' + (top - bow) + ' ' + (x + w - pad) + ' ' + (top + bow) +
        ' L ' + (x + w - pad) + ' ' + (y + h - pad) +
        ' L ' + (x + pad) + ' ' + (y + h - pad) + ' Z" ' +
        'fill="var(--p-' + tone + ')" opacity="0.9"/>';
  }

  function icon(cx, cy, glyph) {
    return '<g transform="translate(' + cx + ',' + cy + ')" fill="var(--p-glow)">' +
      glyph + '</g>';
  }

  // legend row: a chip in the bar's own tone, then what that bar is
  function keyrow(x, y, tone, label) {
    return '<rect x="' + x + '" y="' + (y - 9) + '" width="11" height="11" rx="2" ' +
      'fill="var(--p-' + tone + ')"/>' +
      '<text class="hl" x="' + (x + 18) + '" y="' + y + '">' + label + '</text>';
  }

  // a button prompt: the key in its box, then what it does
  function prompt(x, y, glyph, label, w) {
    w = w || 18;
    return '<rect x="' + x + '" y="' + (y - 11) + '" width="' + w + '" height="14" rx="2" ' +
      'fill="rgb(var(--rgb-signal) / 0.14)" stroke="var(--p-line)" stroke-width="1"/>' +
      '<text x="' + (x + w / 2) + '" y="' + (y - 1) + '" text-anchor="middle" ' +
        'style="font-size:12px;fill:var(--p-glow)">' + glyph + '</text>' +
      '<text class="hl dim" x="' + (x + w + 6) + '" y="' + y + '">' + label + '</text>';
  }

  function app(x, y, label, on) {
    return '<g transform="translate(' + x + ',' + y + ')">' +
      '<rect x="0" y="0" width="40" height="40" rx="6" ' +
        'fill="' + (on ? "var(--p-signal)" : "rgb(var(--rgb-signal) / 0.10)") + '" ' +
        'stroke="' + (on ? "var(--p-glow)" : "var(--p-line)") + '" stroke-width="1.5"/>' +
      '<text class="hl" x="20" y="56" text-anchor="middle" ' +
        'style="fill:' + (on ? "var(--p-glow)" : "var(--p-half)") + '">' + label + '</text></g>';
  }

  window.HUDS = {

    // ── the bars down the left of the minimap ────────────────────────────
    "bare-minimum": {
      w: 420, h: 210,
      cap: "Upright bars down the left of the minimap, sized off the frame " +
           "rather than typed to match it. The capture above is this exact " +
           "layout — the key here is what each bar is.",
      svg:
        '<text class="hl dim" x="34" y="22">down the left of the minimap</text>' +
        slim(34, 32, 100, 1.00, "core") +
        slim(55, 32, 100, 1.00, "pale") +
        slim(76, 32, 100, 1.00, "glow") +
        slim(97, 32, 100, 0.60, "signal") +
        slim(118, 32, 100, 0.90, "mid") +
        icon(40.5, 152, HEART) + icon(61.5, 152, MOON) + icon(82.5, 152, FORK) +
        icon(103.5, 152, DROP) + icon(124.5, 152, BOLT) +
        minimap(146, 32, 100, 100) +
        keyrow(262, 48, "core", "health") +
        keyrow(262, 70, "pale", "sleep") +
        keyrow(262, 92, "glow", "food") +
        keyrow(262, 114, "signal", "water") +
        keyrow(262, 136, "mid", "energy") +
        '<text class="hl dim" x="34" y="182">game hours, not real ones</text>' +
        '<text class="hl dim" x="34" y="200">' +
          'a full day is about 48 minutes of play</text>'
    },

    // ── the step before the first star ───────────────────────────────────
    "five0patrol": {
      w: 420, h: 158,
      cap: "Heat fills while somebody can see you doing something petty, and " +
           "drains when nobody can. The star is what happens if it tops out.",
      svg:
        '<rect x="60" y="46" width="230" height="26" rx="3" ' +
          'fill="rgb(var(--rgb-signal) / 0.06)" stroke="var(--p-line)" stroke-width="2"/>' +
        '<rect x="63" y="49" width="146" height="20" fill="var(--p-signal)" opacity="0.9"/>' +
        '<line x1="252" y1="42" x2="252" y2="76" stroke="var(--p-glow)" stroke-width="2"/>' +
        '<text class="hl" x="252" y="34" text-anchor="middle">stop</text>' +
        '<g transform="translate(318,59)" fill="none" stroke="var(--p-line)" ' +
          'stroke-width="2"><path d="' + STAR + '"/></g>' +
        '<text class="hl dim" x="318" y="86" text-anchor="middle">first star</text>' +
        '<text class="hl" x="60" y="106">heat</text>' +
        '<text class="hl dim" x="60" y="128">seen with a gun out · driving badly</text>' +
        '<text class="hl dim" x="60" y="146">' +
          'the plate · stood somewhere that notices</text>'
    },

    // ── the gauge, and the forecourt panel while you fill ────────────────
    "fumes": {
      w: 420, h: 292,
      cap: "The gauge stands to the right of the minimap. Take the nozzle to " +
           "the car and the forecourt panel comes up: what is going in, what " +
           "it is costing, and what grade you are putting in.",
      svg:
        '<text class="hl dim" x="34" y="22">right of the minimap</text>' +
        minimap(150, 32, 100, 82) +
        slim(266, 32, 82, 0.62, "signal") +
        '<line x1="262" y1="98" x2="283" y2="98" stroke="var(--p-glow)" stroke-width="2"/>' +
        '<line x1="283" y1="44" x2="306" y2="44" stroke="var(--p-line)" stroke-width="1.5"/>' +
        '<text class="hl" x="310" y="48">fuel</text>' +
        '<line x1="283" y1="98" x2="306" y2="98" stroke="var(--p-line)" stroke-width="1.5"/>' +
        '<text class="hl dim" x="310" y="102">reserve</text>' +

        '<text class="hl dim" x="34" y="150">while filling</text>' +
        '<rect x="24" y="160" width="372" height="116" rx="4" ' +
          'fill="rgb(var(--rgb-signal) / 0.04)" stroke="var(--p-signal)" stroke-width="2"/>' +
        '<text class="hl" x="210" y="182" text-anchor="middle">' +
          '<tspan style="font-style:italic;font-size:18px;fill:var(--p-glow)">Xero</tspan>' +
          '<tspan style="fill:var(--p-half)">   —   DAVIS AVENUE</tspan></text>' +

        // the glass: open at the top, liquid at 46 per cent, reading below it
        '<path d="M 44 194 L 44 252 L 98 252 L 98 194" fill="none" ' +
          'stroke="var(--p-line)" stroke-width="2"/>' +
        '<line x1="39" y1="194" x2="49" y2="194" stroke="var(--p-line)" stroke-width="2"/>' +
        '<line x1="93" y1="194" x2="103" y2="194" stroke="var(--p-line)" stroke-width="2"/>' +
        '<path d="M 46 228 Q 71 222 96 228 L 96 250 L 46 250 Z" ' +
          'fill="var(--p-signal)" opacity="0.85"/>' +
        '<circle cx="58" cy="238" r="2" fill="var(--p-core)" opacity="0.3"/>' +
        '<circle cx="72" cy="243" r="1.6" fill="var(--p-core)" opacity="0.3"/>' +
        '<circle cx="84" cy="236" r="2.2" fill="var(--p-core)" opacity="0.3"/>' +
        '<text class="hlb" x="71" y="268" text-anchor="middle">46%</text>' +

        '<text class="hl dim" x="126" y="206">total</text>' +
        '<text x="318" y="206" text-anchor="end" ' +
          'style="font-size:22px;fill:var(--p-core)">$13.26</text>' +
        '<text class="hl dim" x="126" y="228">volume</text>' +
        '<text class="hlb" x="318" y="228" text-anchor="end">8.3 L</text>' +
        '<text class="hl dim" x="126" y="248">price</text>' +
        '<text class="hlb" x="318" y="248" text-anchor="end">$1.59/L</text>' +
        '<text class="hl dim" x="126" y="266">grade</text>' +
        '<text class="hlb" x="318" y="266" text-anchor="end">PREMIUM</text>' +

        icon(350, 200, DROP) +
        '<g transform="translate(350,240)">' + PUMP + '</g>'
    },

    // ── the handset, the panel when somebody talks, and the table ────────
    "hoodrich": [
      {
        w: 420, h: 220,
        cap: "The phone replaces the in-game one and stands on the right. " +
             "Apps on the home screen, lists inside them.",
        svg:
          '<rect x="252" y="16" width="132" height="190" rx="14" ' +
            'fill="rgb(var(--rgb-signal) / 0.05)" stroke="var(--p-signal)" stroke-width="2.5"/>' +
          '<rect x="262" y="34" width="112" height="154" rx="4" ' +
            'fill="rgb(var(--rgb-signal) / 0.04)" stroke="var(--p-line)" stroke-width="1.5"/>' +
          '<line x1="300" y1="25" x2="336" y2="25" stroke="var(--p-line)" ' +
            'stroke-width="3" stroke-linecap="round"/>' +
          app(272, 44, "deal", true) + app(324, 44, "cont", false) +
          app(272, 96, "gang", false) + app(324, 96, "inv", false) +
          app(272, 148, "soc", false) +
          '<text class="hl" x="60" y="46">dealing</text>' +
          '<text class="hl" x="60" y="72">contacts</text>' +
          '<text class="hl" x="60" y="98">gangs</text>' +
          '<text class="hl" x="60" y="124">inventory</text>' +
          '<text class="hl" x="60" y="150">socials</text>' +
          '<text class="hl dim" x="60" y="186">the weapon wheel is left alone</text>'
      },
      {
        w: 420, h: 196,
        cap: "Talking to somebody is a panel, not a menu: who is speaking, " +
             "their face, what they said, and the line you give back. The " +
             "header is set in blackletter in game.",
        svg:
          '<rect x="18" y="14" width="384" height="152" rx="10" ' +
            'fill="rgb(var(--rgb-signal) / 0.05)" stroke="var(--p-signal)" stroke-width="2"/>' +
          '<text class="hlb" x="210" y="42" text-anchor="middle" ' +
            'style="letter-spacing:0.22em;fill:var(--p-core)">POSTED UP</text>' +

          // portrait, with the speaker's accent stripe down its left
          '<rect x="34" y="54" width="3" height="46" fill="var(--p-glow)"/>' +
          '<rect x="39" y="54" width="46" height="46" ' +
            'fill="rgb(var(--rgb-signal) / 0.10)" stroke="var(--p-line)" stroke-width="1.5"/>' +
          '<circle cx="62" cy="72" r="9" fill="var(--p-half)" opacity="0.55"/>' +
          '<path d="M 47 100 C 49 87 75 87 77 100 Z" fill="var(--p-half)" opacity="0.55"/>' +
          '<text class="hl" x="96" y="66" style="fill:var(--p-glow)">GERALD</text>' +
          '<text class="hlq" x="96" y="86">Go on then. And don’t be standing round</text>' +
          '<text class="hlq" x="96" y="104">here with it neither, that’s my corner.</text>' +

          // the line you can give back, and the bar that runs along it
          '<rect x="250" y="113" width="132" height="23" fill="var(--p-signal)" opacity="0.16"/>' +
          '<rect x="250" y="113" width="46" height="23" fill="var(--p-signal)" opacity="0.28"/>' +
          '<rect x="38" y="112" width="346" height="25" rx="2" fill="none" ' +
            'stroke="var(--p-glow)" stroke-width="1.5"/>' +
          '<text class="hlq" x="50" y="130" style="fill:var(--p-core)">Say less.</text>' +

          prompt(38, 156, "&#8597;", "choose") +
          prompt(126, 156, "A", "say it") +
          prompt(300, 156, "B", "walk off")
      },
      {
        w: 420, h: 222,
        cap: "Stretch's armoury. The guns are laid out on the table in front " +
             "of you and the screen has no panel of its own — a count of what " +
             "the category holds, what this one is, and what a box costs.",
        svg:
          // no chrome in game: the type sits straight on the scene
          '<rect x="14" y="12" width="392" height="204" rx="6" fill="none" ' +
            'stroke="var(--p-edge)" stroke-width="1.5" stroke-dasharray="6 6"/>' +

          '<text class="hl dim" x="132" y="42" text-anchor="middle">handguns</text>' +
          '<text class="hl" x="210" y="42" text-anchor="middle">11 / 19</text>' +
          '<text class="hl" x="292" y="42" text-anchor="middle" ' +
            'style="fill:var(--p-glow)">9 held</text>' +

          '<text x="210" y="82" text-anchor="middle" ' +
            'style="font-size:27px;letter-spacing:0.04em;fill:var(--p-core)">CERAMIC PISTOL</text>' +
          '<text class="hl" x="210" y="106" text-anchor="middle" ' +
            'style="fill:var(--p-glow)">owned</text>' +
          '<text class="hlq" x="210" y="130" text-anchor="middle">Walks through a door</text>' +
          '<text class="hlb" x="210" y="154" text-anchor="middle">1 BOX  ·  24 ROUNDS  ·  ' +
            '<tspan style="fill:var(--p-glow)">$360</tspan></text>' +
          '<text class="hl dim" x="210" y="172" text-anchor="middle" ' +
            'style="font-size:13px">1 parts</text>' +

          prompt(34, 190, "&#8597;", "pick") +
          prompt(124, 190, "&#8596;", "rounds") +
          prompt(240, 190, "LB/RB", "rack", 40) +
          prompt(34, 210, "X", "parts") +
          prompt(124, 210, "A", "buy") +
          prompt(240, 210, "B", "out")
      }
    ]
  };
})();
