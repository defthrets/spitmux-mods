// ─── Cold open: five seconds of bad signal, then the set switches off ───────
//
// The overlay div is in the markup so the page starts black rather than
// flashing the site before this runs. Everything inside it is built here.
//
// Nothing the reader needs is behind this. If this file throws, never loads,
// or the browser is mid-throttle, three separate things still clear the way:
// the failsafe animation on .crt-intro in the stylesheet, app.js's own start
// timeout, and the click/key skip below.

(function () {
  "use strict";

  var root = document.getElementById("crt-intro");
  if (!root) return;

  window.crtIntro = { pending: true };

  var rain = null, rainHome = null;

  var BROKEN_MS = 5000;      // how long the signal stays bad
  var done = false;

  function finish() {
    if (done) return;
    done = true;
    window.crtIntro.pending = false;
    if (rain && rainHome) {                 // put the rain back behind the page
      rain.classList.remove("in-crt");
      rain.style.transform = "";
      rainHome.insertBefore(rain, rainHome.firstChild);
    }
    root.parentNode && root.parentNode.removeChild(root);
    window.dispatchEvent(new CustomEvent("crt-intro-done"));
  }

  // ── build the set ───────────────────────────────────────────────────────
  var source = document.querySelector(".seal-peek svg");
  if (!source) { finish(); return; }

  var inner = document.createElement("div");
  inner.className = "crt-inner";

  var stage = document.createElement("div");
  stage.className = "crt-stage";

  // One seal, plus two clones that get torn into bands. Cloning keeps the
  // geometry in exactly one place — reshape the mark and this follows.
  var layers = [];
  for (var i = 0; i < 3; i++) {
    var wrap = document.createElement("div");
    wrap.className = "crt-seal l" + i;
    var svg = source.cloneNode(true);
    svg.removeAttribute("class");
    // the clone would otherwise duplicate the ring path's id
    var defsPath = svg.querySelector("defs path");
    var tp = svg.querySelector("textPath");
    if (defsPath && tp) {
      var id = "crt-ring-" + i;
      defsPath.setAttribute("id", id);
      tp.setAttribute("href", "#" + id);
    }
    wrap.appendChild(svg);
    stage.appendChild(wrap);
    layers.push(wrap);
  }

  var sig = document.createElement("div");
  sig.className = "crt-sig";
  stage.appendChild(sig);

  // The loader. It fills across the five seconds and stalls just short of the
  // end, the way every real one does, and the bar and the figure corrupt on
  // the same beats the picture tears — a loader on a broken signal should not
  // be the one thing on screen that is behaving.
  var CELLS = 18;
  var openedAt = Date.now();

  function drawSig() {
    var t = Math.min(1, (Date.now() - openedAt) / BROKEN_MS);
    var p = t < 0.9 ? t * 0.94 : 0.846 + (t - 0.9) * 1.54;   // crawl, then stall
    p = Math.min(1, p);

    var rough = Math.random() < 0.14;
    var filled = Math.round(p * CELLS);
    var bar = "";
    for (var i = 0; i < CELLS; i++) {
      if (i < filled) bar += (rough && Math.random() < 0.3) ? "▓" : "█";
      else bar += "░";
    }

    var pct = (rough && Math.random() < 0.45)
      ? String(Math.floor(Math.random() * 100))
      : String(Math.round(p * 100));
    while (pct.length < 2) pct = "0" + pct;

    var dots = ".".repeat(1 + Math.floor((Date.now() - openedAt) / 320) % 3);
    while (dots.length < 3) dots += " ";

    sig.innerHTML =
      '<span class="n">spitmux.exe</span>' +
      '<span class="w">loading' + dots + '</span>' +
      '<span class="b">' + bar + '</span>' +
      '<span class="p">' + pct + '%</span>';
  }
  drawSig();
  var sigTimer = setInterval(drawSig, 90);

  var roll = document.createElement("div");
  roll.className = "crt-roll";
  var scan = document.createElement("div");
  scan.className = "crt-scan";

  // The switch-off line is a sibling of .crt-inner, not a child: .crt-inner is
  // the thing that collapses, and anything inside it collapses with it.
  var line = document.createElement("div");
  line.className = "crt-line";

  // Borrow the page's own rain canvas instead of running a second copy of the
  // effect — same code, same look, and it goes home in finish().
  rain = document.getElementById("matrix");
  rainHome = rain && rain.parentNode;
  if (rain) { rain.classList.add("in-crt"); inner.appendChild(rain); }

  inner.appendChild(stage);
  inner.appendChild(roll);
  inner.appendChild(scan);
  root.appendChild(inner);
  root.appendChild(line);
  root.classList.add("live");            // cancels the stylesheet failsafe


  // ── the fault itself ────────────────────────────────────────────────────
  // Re-rolled on a random interval rather than run off a keyframe loop: a
  // fixed cycle reads as an animation, an irregular one reads as a fault.
  var glitchTimer = null;

  function clear(l) {
    l.style.clipPath = "";
    l.style.transform = "";
    l.style.opacity = "";
  }

  function band() {
    var top = Math.random() * 78;
    var h = 4 + Math.random() * 20;
    return "inset(" + top.toFixed(1) + "% 0 " + Math.max(0, 100 - top - h).toFixed(1) + "% 0)";
  }

  function roll_() {
    var r = Math.random();

    clear(layers[1]);
    clear(layers[2]);

    if (r < 0.10) {
      // dropout — the picture all but disappears for a beat
      layers[0].style.opacity = 0.08;
      layers[0].style.transform = "translateX(" + (Math.random() * 20 - 10).toFixed(0) + "px)";
    } else if (r < 0.22) {
      // clean frame. The pauses are what sell the rest of it.
      clear(layers[0]);
      if (rain) rain.style.transform = "";
    } else if (r < 0.42) {
      // whole picture shifted, as if the line has slipped
      clear(layers[0]);
      layers[0].style.transform =
        "translate(" + (Math.random() * 34 - 17).toFixed(0) + "px," +
                       (Math.random() * 14 - 7).toFixed(0) + "px)";
    } else {
      // torn bands displaced against the base picture
      clear(layers[0]);
      layers[0].style.transform = "translateX(" + (Math.random() * 8 - 4).toFixed(0) + "px)";
      if (rain) rain.style.transform =
        "translateX(" + (Math.random() * 46 - 23).toFixed(0) + "px)";
      layers[1].style.opacity = 0.95;
      layers[1].style.clipPath = band();
      layers[1].style.transform = "translateX(" + (Math.random() * 60 - 30).toFixed(0) + "px)";
      if (Math.random() > 0.4) {
        layers[2].style.opacity = 0.95;
        layers[2].style.clipPath = band();
        layers[2].style.transform = "translateX(" + (Math.random() * 60 - 30).toFixed(0) + "px)";
      }
    }

    inner.style.filter = "brightness(" + (0.72 + Math.random() * 0.62).toFixed(2) + ")";
    glitchTimer = setTimeout(roll_, 55 + Math.random() * 130);
  }
  roll_();

  // ── switch off ──────────────────────────────────────────────────────────
  function powerOff() {
    if (done) return;
    clearTimeout(glitchTimer);
    clearInterval(sigTimer);
    layers.forEach(clear);
    inner.style.filter = "";
    sig.style.opacity = 0;

    root.classList.add("off");
    // animationend can be missed on a throttled tab, so time it out as well
    var fired = false;
    inner.addEventListener("animationend", function () {
      if (fired) return;
      fired = true;
      root.classList.add("gone");
      setTimeout(finish, 340);
    }, { once: true });
    setTimeout(function () {
      if (fired) return;
      fired = true;
      root.classList.add("gone");
      setTimeout(finish, 340);
    }, 900);
  }

  var offTimer = setTimeout(powerOff, BROKEN_MS);

  // skip
  function skip() { clearTimeout(offTimer); powerOff(); }
  root.addEventListener("click", skip);
  window.addEventListener("keydown", skip, { once: true });

  // Someone who asked for less motion gets the mark and the switch-off,
  // without five seconds of tearing.
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    clearTimeout(glitchTimer);
    layers.forEach(clear);
    clearTimeout(offTimer);
    offTimer = setTimeout(powerOff, 1200);
  }
})();
