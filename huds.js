// ─── HUD diagrams ───────────────────────────────────────────────────────────
// Keyed by mod id: one drawing, or an array of them where a mod puts more than
// one thing on screen.
//
// There is one left. Hoodrich, Fumes and Bare Minimum all had drawings of
// their screens and all three now have photographs of the same screens, and a
// drawing of a thing you can already see is noise. Five0 Patrol keeps its one
// because nothing captures it: the heat bar is the step BEFORE the first star,
// so by the time there is anything to screenshot the thing it describes has
// already happened.
//
// If a capture ever lands for it, this file goes with it.
//

(function () {
  var STAR = "M 0 -9 L 2.6 -3.1 L 8.6 -2.8 L 4.1 1.4 L 5.6 7.3 " +
             "L 0 4.1 L -5.6 7.3 L -4.1 1.4 L -8.6 -2.8 L -2.6 -3.1 Z";

  window.HUDS = {

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
    }
  };
})();
