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
  var SKULL = '<path d="M 0 -9 C 6 -9 9 -5 9 -1 C 9 2 7 4 6 5 L 6 8 ' +
              'L -6 8 L -6 5 C -7 4 -9 2 -9 -1 C -9 -5 -6 -9 0 -9 Z ' +
              'M -4 -2 A 2.2 2.2 0 1 0 -4 -1.9 M 4 -2 A 2.2 2.2 0 1 0 4 -1.9" ' +
              'fill-rule="evenodd"/>';
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

  // one app tile on the phone's home screen; `on` is the one under the cursor
  function app3(x, y, on) {
    return '<rect x="' + x + '" y="' + y + '" width="30" height="30" rx="4" ' +
      'fill="' + (on ? "var(--p-signal)" : "rgb(var(--rgb-signal) / 0.10)") + '" ' +
      'stroke="' + (on ? "var(--p-core)" : "var(--p-line)") + '" ' +
      'stroke-width="' + (on ? 2 : 1) + '"/>';
  }

  // a leader from a drawn part out to the label that names it
  function lead(x1, y, x2) {
    return '<line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y +
      '" stroke="var(--p-line)" stroke-width="1.2"/>';
  }

  // a dialogue line you did not pick
  function opt(y, text) {
    return '<circle cx="46" cy="' + (y - 5) + '" r="7" fill="none" ' +
      'stroke="var(--p-half)" stroke-width="1.2"/>' +
      '<text class="hlq" x="62" y="' + y + '" style="fill:var(--p-half)">' + text + '</text>';
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
    // ── the handset, the deal, the talk, and the table ──────────────────
    "hoodrich": [
      {
        w: 420, h: 330,
        cap: "The phone replaces the in-game one. Eleven apps three across, " +
             "the contact you last spoke to along the top, and the bank card " +
             "underneath. Overspray appears here as an app when it is " +
             "installed \u2014 the mods know about each other.",
        svg:
          '<rect x="34" y="16" width="152" height="298" rx="13" ' +
            'fill="rgb(var(--rgb-signal) / 0.05)" stroke="var(--p-signal)" stroke-width="2.5"/>' +
          '<rect x="42" y="30" width="136" height="270" rx="4" ' +
            'fill="rgb(var(--rgb-signal) / 0.04)" stroke="var(--p-line)" stroke-width="1.2"/>' +
          '<text class="hl dim" x="50" y="46" style="font-size:11px">POSTED UP</text>' +
          '<text class="hl dim" x="116" y="46" style="font-size:11px">06:35</text>' +
          '<rect x="150" y="39" width="18" height="8" rx="1" fill="var(--p-signal)"/>' +
          '<rect x="48" y="52" width="124" height="18" rx="2" fill="none" ' +
            'stroke="var(--p-line)" stroke-width="1" stroke-dasharray="3 3"/>' +
          app3(54, 76) + app3(92, 76) + app3(130, 76) +
          app3(54, 112) + app3(92, 112, true) + app3(130, 112) +
          app3(54, 148) + app3(92, 148) + app3(130, 148) +
          app3(54, 184) + app3(92, 184) +
          '<rect x="48" y="222" width="124" height="44" rx="3" ' +
            'fill="rgb(var(--rgb-signal) / 0.07)" stroke="var(--p-line)" stroke-width="1"/>' +
          '<text class="hlb" x="56" y="245" style="font-size:15px">$2,335,286</text>' +
          '<text class="hl dim" x="56" y="259" style="font-size:11px">FLEECA &#183; 4471</text>' +
          '<text class="hl dim" x="110" y="288" text-anchor="middle" ' +
            'style="font-size:11px">d-pad &#183; a &#183; b</text>' +
          lead(190, 46, 214) + '<text class="hl" x="220" y="50">time, signal, battery</text>' +
          lead(190, 61, 214) + '<text class="hl" x="220" y="65">who you last spoke to</text>' +
          lead(190, 130, 214) + '<text class="hl" x="220" y="124">eleven apps, three across</text>' +
          '<text class="hl dim" x="220" y="143">phone &#183; messages &#183; contacts</text>' +
          '<text class="hl dim" x="220" y="159">dealing &#183; socials &#183; gangs</text>' +
          '<text class="hl dim" x="220" y="175">inventory &#183; settings</text>' +
          '<text class="hl dim" x="220" y="191">overspray &#183; mask &#183; luber</text>' +
          lead(190, 244, 214) + '<text class="hl" x="220" y="248">the bank card</text>' +
          lead(190, 288, 214) + '<text class="hl dim" x="220" y="292">move &#183; open &#183; put away</text>'
      },
      {
        w: 420, h: 252,
        cap: "Talking to somebody is a panel, not a menu: who is speaking, " +
             "their face, what they said, and every line you could give back. " +
             "The one under the cursor explains itself on the right.",
        svg:
          '<rect x="16" y="14" width="388" height="220" rx="10" ' +
            'fill="rgb(var(--rgb-signal) / 0.05)" stroke="var(--p-signal)" stroke-width="2"/>' +
          '<text class="hlb" x="210" y="38" text-anchor="middle" ' +
            'style="letter-spacing:0.22em;fill:var(--p-core)">POSTED UP</text>' +
          '<rect x="30" y="50" width="3" height="42" fill="var(--p-glow)"/>' +
          '<rect x="35" y="50" width="42" height="42" ' +
            'fill="rgb(var(--rgb-signal) / 0.10)" stroke="var(--p-line)" stroke-width="1.2"/>' +
          '<circle cx="56" cy="66" r="8" fill="var(--p-half)" opacity="0.55"/>' +
          '<path d="M 42 92 C 44 80 68 80 70 92 Z" fill="var(--p-half)" opacity="0.55"/>' +
          '<text class="hl" x="88" y="62" style="fill:var(--p-glow)">GERALD</text>' +
          '<text class="hlq" x="88" y="84">We already did this part. Go work.</text>' +
          '<rect x="30" y="100" width="360" height="24" rx="2" ' +
            'fill="rgb(var(--rgb-signal) / 0.10)" stroke="var(--p-glow)" stroke-width="1.5"/>' +
          '<circle cx="46" cy="112" r="7" fill="none" stroke="var(--p-glow)" stroke-width="1.2"/>' +
          '<text class="hlq" x="62" y="117" style="fill:var(--p-core)">Where should I be working?</text>' +
          '<text class="hl dim" x="382" y="116" text-anchor="end" ' +
            'style="font-size:12px">ask which blocks are safe</text>' +
          opt(140, "How am I doing?") +
          opt(162, "About the port.") +
          opt(184, "Still got your work.") +
          '<text class="hlq" x="62" y="206" style="fill:var(--p-half)">I&#39;m out.</text>' +
          prompt(30, 228, "&#8597;", "choose") +
          prompt(120, 228, "A", "say it") +
          prompt(300, 228, "B", "walk off")
      },
      {
        w: 420, h: 200,
        cap: "Stood on a corner with something to sell. The bar is standing, " +
             "not a timer \u2014 what the block thinks of you, between a " +
             "reputation worth having and one that gets you robbed.",
        svg:
          '<text class="hlb" x="210" y="34" text-anchor="middle" ' +
            'style="letter-spacing:0.2em;fill:var(--p-core)">POSTED UP</text>' +
          '<text class="hl dim" x="210" y="54" text-anchor="middle">selling ecstasy</text>' +
          '<rect x="66" y="72" width="288" height="24" rx="2" ' +
            'fill="rgb(var(--rgb-signal) / 0.06)" stroke="var(--p-line)" stroke-width="1.5"/>' +
          '<rect x="68" y="74" width="188" height="20" fill="var(--p-signal)" opacity="0.85"/>' +
          '<text class="hl" x="162" y="89" text-anchor="middle" ' +
            'style="fill:var(--p-core)">reputation</text>' +
          '<g transform="translate(48,84)" fill="var(--p-half)">' + SKULL + '</g>' +
          '<g transform="translate(372,84)" fill="var(--p-glow)">' + HEART + '</g>' +
          '<text class="hlq" x="210" y="122" text-anchor="middle" ' +
            'style="fill:var(--p-glow);font-style:italic">word is it&#39;s decent</text>' +
          '<text class="hlb" x="210" y="148" text-anchor="middle">' +
            '17 PILLS LEFT &#160;&#183;&#160; 8 MORE SALES</text>' +
          '<text class="hl dim" x="210" y="172" text-anchor="middle">' +
            '6 passing &#183; 0 sold &#183; $0</text>'
      },
      {
        w: 420, h: 222,
        cap: "Stretch's armoury. The guns are laid out on the table in front " +
             "of you and the screen has no panel of its own \u2014 a count of " +
             "what the category holds, what this one is, and what a box costs.",
        svg:
          '<rect x="14" y="12" width="392" height="204" rx="6" fill="none" ' +
            'stroke="var(--p-edge)" stroke-width="1.5" stroke-dasharray="6 6"/>' +
          '<text class="hl dim" x="132" y="42" text-anchor="middle">handguns</text>' +
          '<text class="hl" x="210" y="42" text-anchor="middle">4 / 19</text>' +
          '<text class="hl" x="292" y="42" text-anchor="middle" ' +
            'style="fill:var(--p-glow)">6 held</text>' +
          '<text x="210" y="82" text-anchor="middle" ' +
            'style="font-size:27px;letter-spacing:0.04em;fill:var(--p-core)">VINTAGE PISTOL</text>' +
          '<text class="hl" x="210" y="106" text-anchor="middle" ' +
            'style="fill:var(--p-glow)">owned</text>' +
          '<text class="hlq" x="210" y="130" text-anchor="middle">Somebody&#39;s grandad&#39;s</text>' +
          '<text class="hlb" x="210" y="154" text-anchor="middle">1 BOX &#160;&#183;&#160; 20 ROUNDS &#160;&#183;&#160; ' +
            '<tspan style="fill:var(--p-glow)">$130</tspan></text>' +
          '<text class="hl dim" x="210" y="172" text-anchor="middle" ' +
            'style="font-size:13px">2 parts</text>' +
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
