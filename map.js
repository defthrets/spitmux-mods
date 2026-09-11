// ─── Where from ─────────────────────────────────────────────────────────────
// Draws the world from map-data.js, then asks the counter what each
// country's tally is and puts a pin on the ones above zero.
//
// Every read is ?readonly=true. The plain endpoint is a HIT counter: reading a
// key counts as a visit to it, so a page that polled 174 countries the ordinary
// way would add one to every country on earth each time somebody opened it,
// and the map would slowly fill in with people who had never been.
//
// Nothing here knows an address. The visitor's own country is looked up on the
// archive page and turned into a single +1 against a two-letter code; what is
// stored is "N from GB", never who.
//

(function () {
  var API = "https://counterapi.com/api/spitmux/geo/";
  var CACHE = "geo:v1";
  var CACHE_MS = 10 * 60 * 1000;
  var LANES = 8;                       // parallel reads; it is a free service
  var SWEEP_S = 9;                     // the beam's lap, and the pulse period

  var M = window.MAP;
  var svg = document.getElementById("map");
  var scope = document.getElementById("scope");
  var note = document.getElementById("note");
  var tally = document.getElementById("tally");
  var total = document.getElementById("tally-total");
  var tip = document.getElementById("tip");
  var coords = document.getElementById("coords");

  if (!M || !svg) return;

  var $ = function (id) { return document.getElementById(id); };
  function num(n) { return n.toLocaleString("en-GB"); }

  // ── the map itself ──────────────────────────────────────────────────────
  var NS = "http://www.w3.org/2000/svg";

  function el(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  svg.setAttribute("viewBox", "0 0 " + M.w + " " + M.h);

  var defs = el("defs", {}, svg);

  // Land as a dot matrix: one small pattern, clipped by the coastline path.
  // The browser tiles it, so there is one path in the DOM and not thirty
  // thousand circles.
  var pat = el("pattern", { id: "dots", width: 4, height: 4, patternUnits: "userSpaceOnUse" }, defs);
  el("circle", { cx: 2, cy: 2, r: 0.85, fill: "rgb(255 148 24 / 0.5)" }, pat);
  var clip = el("clipPath", { id: "land-clip" }, defs);
  el("path", { d: M.land }, clip);

  var bg = el("linearGradient", { id: "beam-g", x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
  el("stop", { offset: "0", "stop-color": "rgb(255 148 24 / 0)" }, bg);
  el("stop", { offset: "0.7", "stop-color": "rgb(255 148 24 / 0.16)" }, bg);
  el("stop", { offset: "1", "stop-color": "rgb(255 210 131 / 0.34)" }, bg);
  var hg = el("radialGradient", { id: "halo-g" }, defs);
  el("stop", { offset: "0", "stop-color": "rgb(255 148 24 / 0.32)" }, hg);
  el("stop", { offset: "1", "stop-color": "rgb(255 148 24 / 0)" }, hg);

  // graticule every 30 degrees, the equator a touch stronger
  var grat = el("g", {}, svg);
  for (var lon = -180; lon <= 180; lon += 30) {
    var x = (lon + 180) / 360 * M.w;
    el("line", { "class": "grat", x1: x, y1: 0, x2: x, y2: M.h }, grat);
  }
  for (var lat = -60; lat <= 60; lat += 30) {
    var y = (90 - lat) / 180 * M.h;
    el("line", { "class": "grat" + (lat === 0 ? " eq" : ""), x1: 0, y1: y, x2: M.w, y2: y }, grat);
  }
  // scope ticks along the top and left edges, every ten degrees
  for (var tl = -180; tl <= 180; tl += 10) {
    var tx = (tl + 180) / 360 * M.w;
    var big = tl % 30 === 0;
    el("line", { "class": "tick", x1: tx, y1: 0, x2: tx, y2: big ? 7 : 4 }, grat);
    if (big && tl > -180 && tl < 180) {
      el("text", { "class": "tick-lbl", x: tx + 2.5, y: 14 }, grat).textContent =
        (tl === 0 ? "0" : Math.abs(tl) + (tl < 0 ? "W" : "E"));
    }
  }
  for (var tt = -80; tt <= 80; tt += 10) {
    var ty = (90 - tt) / 180 * M.h;
    var bigt = tt % 30 === 0;
    el("line", { "class": "tick", x1: 0, y1: ty, x2: bigt ? 7 : 4, y2: ty }, grat);
    if (bigt) {
      el("text", { "class": "tick-lbl", x: 10, y: ty - 2.5 }, grat).textContent =
        (tt === 0 ? "0" : Math.abs(tt) + (tt < 0 ? "S" : "N"));
    }
  }

  el("rect", { width: M.w, height: M.h, fill: "url(#dots)", "clip-path": "url(#land-clip)" }, svg);
  el("path", { "class": "coast", d: M.land }, svg);

  // the beam, sweeping left to right; pins pulse as it passes them
  el("rect", { "class": "beam", x: 0, y: 0, width: 120, height: M.h }, svg);

  var pinLayer = el("g", {}, svg);

  // the crosshair that follows the pointer
  var xhV = el("line", { "class": "xh", x1: 0, y1: 0, x2: 0, y2: M.h }, svg);
  var xhH = el("line", { "class": "xh", x1: 0, y1: 0, x2: M.w, y2: 0 }, svg);

  // ── the seal, borrowed from the header and re-id'd ─────────────────────
  // A clone of the mark in the bezel above, sat faint behind the ocean. The
  // ids inside it are renamed so the two copies do not fight over the ring.
  (function watermark() {
    var host = $("scope-mark");
    var src = document.querySelector(".seal-peek svg");
    if (!host || !src) return;
    var c = src.cloneNode(true);
    c.removeAttribute("class");
    var ids = c.querySelectorAll("[id]");
    for (var i = 0; i < ids.length; i++) {
      var old = ids[i].id;
      var nu = "wm-" + old;
      ids[i].id = nu;
      var refs = c.querySelectorAll("[href='#" + old + "'],[clip-path='url(#" + old + ")'],[mask='url(#" + old + ")']");
      for (var j = 0; j < refs.length; j++) {
        var r = refs[j];
        if (r.getAttribute("href") === "#" + old) r.setAttribute("href", "#" + nu);
        if (r.getAttribute("clip-path") === "url(#" + old + ")") r.setAttribute("clip-path", "url(#" + nu + ")");
        if (r.getAttribute("mask") === "url(#" + old + ")") r.setAttribute("mask", "url(#" + nu + ")");
      }
    }
    host.appendChild(c);
  })();

  // ── pointer: crosshair, coordinates, hover card ────────────────────────
  function toMap(e) {
    var b = svg.getBoundingClientRect();
    return [(e.clientX - b.left) / b.width * M.w, (e.clientY - b.top) / b.height * M.h];
  }
  scope.addEventListener("mousemove", function (e) {
    var p = toMap(e);
    xhV.setAttribute("x1", p[0]); xhV.setAttribute("x2", p[0]);
    xhH.setAttribute("y1", p[1]); xhH.setAttribute("y2", p[1]);
    var lon = p[0] / M.w * 360 - 180;
    var lat = 90 - p[1] / M.h * 180;
    coords.textContent = "lat " + Math.abs(lat).toFixed(1) + (lat < 0 ? "S" : "N") +
                         " · lon " + Math.abs(lon).toFixed(1) + (lon < 0 ? "W" : "E");
    if (!tip.hidden) {
      var sb = scope.getBoundingClientRect();
      tip.style.left = (e.clientX - sb.left) + "px";
      tip.style.top = (e.clientY - sb.top) + "px";
    }
  });
  scope.addEventListener("mouseleave", function () {
    coords.textContent = "lat — · lon —";
    tip.hidden = true;
  });

  // ── reading the tallies ─────────────────────────────────────────────────
  function readOne(cc) {
    return fetch(API + cc + "?readonly=true")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return [cc, (d && +d.value) || 0]; })
      .catch(function () { return [cc, 0]; });
  }

  function readAll(codes, onProgress) {
    var out = [];
    var i = 0;
    var done = 0;

    function lane() {
      if (i >= codes.length) return Promise.resolve();
      var cc = codes[i++];
      return readOne(cc).then(function (pair) {
        out.push(pair);
        onProgress(++done, codes.length);
        return lane();
      });
    }

    var lanes = [];
    for (var n = 0; n < Math.min(LANES, codes.length); n++) lanes.push(lane());
    return Promise.all(lanes).then(function () { return out; });
  }

  function cached() {
    try {
      var raw = sessionStorage.getItem(CACHE);
      if (!raw) return null;
      var o = JSON.parse(raw);
      return (Date.now() - o.at < CACHE_MS) ? o.rows : null;
    } catch (e) { return null; }
  }

  function keep(rows) {
    try {
      sessionStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), rows: rows }));
    } catch (e) { /* private mode */ }
  }

  // ── drawing what came back ──────────────────────────────────────────────
  var pins = {};     // cc -> <g>
  var rowsEl = {};   // cc -> tally row
  var onCc = null;

  function focus(cc) {
    if (onCc && pins[onCc]) { pins[onCc].classList.remove("on"); rowsEl[onCc].classList.remove("on"); }
    onCc = (onCc === cc) ? null : cc;
    if (onCc && pins[onCc]) { pins[onCc].classList.add("on"); rowsEl[onCc].classList.add("on"); }
  }

  function render(rows) {
    var hits = rows.filter(function (r) { return r[1] > 0 && M.pins[r[0]]; });
    hits.sort(function (a, b) { return b[1] - a[1]; });

    var sum = hits.reduce(function (a, r) { return a + r[1]; }, 0);
    var max = hits.length ? hits[0][1] : 1;

    pinLayer.textContent = "";
    pins = {};
    rowsEl = {};

    hits.forEach(function (r, idx) {
      var cc = r[0], n = r[1];
      var p = M.pins[cc];
      // Area with the count, not radius -- a country with ten visits should
      // look ten times as much, and radius-scaling would make it a hundred.
      var rad = 2.4 + 7 * Math.sqrt(n / max);
      var g = el("g", { "class": "pin" + (idx < 6 ? " top" : ""),
                        style: "--d:" + ((p[0] + 120) / (M.w + 120) * SWEEP_S).toFixed(2) + "s" }, pinLayer);
      el("circle", { "class": "halo", cx: p[0], cy: p[1], r: rad * 3.2 }, g);
      el("circle", { "class": "pulse", cx: p[0], cy: p[1], r: rad + 1.5 }, g);
      el("circle", { "class": "ring", cx: p[0], cy: p[1], r: rad + 2.5 }, g);
      el("circle", { "class": "core", cx: p[0], cy: p[1], r: rad }, g);
      var right = p[0] < M.w * 0.8;
      var lbl = el("text", { "class": "lbl", x: right ? p[0] + rad + 5 : p[0] - rad - 5, y: p[1] + 3.5,
                             "text-anchor": right ? "start" : "end" }, g);
      lbl.textContent = cc + " · " + n;
      var hit = el("circle", { "class": "hit", cx: p[0], cy: p[1], r: Math.max(9, rad + 4) }, g);
      hit.addEventListener("mouseenter", function () {
        tip.innerHTML = "<b>" + n + "</b> " + (n === 1 ? "visit" : "visits") +
                        " <span>&#183;</span> " + p[2].replace(/</g, "&lt;") +
                        " <span>&#183; " + Math.round(n / sum * 100) + "%</span>";
        tip.hidden = false;
      });
      hit.addEventListener("mouseleave", function () { tip.hidden = true; });
      hit.addEventListener("click", function () { focus(cc); });
      pins[cc] = g;
    });

    total.textContent = sum;
    $("stat-seen").querySelector("b").textContent = hits.length;
    $("stat-visits").querySelector("b").textContent = num(sum);
    $("ro-visits").textContent = num(sum);
    $("ro-countries").textContent = hits.length;
    if (hits.length) {
      var t = hits[0];
      $("ro-top").textContent = t[0];
      $("ro-top-s").textContent = M.pins[t[0]][2] + " · " + Math.round(t[1] / sum * 100) + "%";
      $("ro-visits-s").textContent = "placed on the map";
      $("ro-countries-s").textContent = "of " + Object.keys(M.pins).length + " on it";
    }

    if (!hits.length) {
      tally.innerHTML = '<div class="tally-empty">nobody yet</div>';
      note.textContent = "no countries recorded yet";
      return;
    }

    tally.textContent = "";
    hits.forEach(function (r, idx) {
      var p = M.pins[r[0]];
      var row = document.createElement("div");
      row.className = "tally-row";
      row.innerHTML =
        '<span class="rk">' + (idx + 1 < 10 ? "0" : "") + (idx + 1) + "</span>" +
        '<span class="cc">' + r[0] + "</span>" +
        '<span class="nm">' + p[2].replace(/</g, "&lt;") + "</span>" +
        '<span class="n">' + r[1] + "<small>" + Math.round(r[1] / sum * 100) + "%</small></span>" +
        '<span class="bar"><i></i></span>';
      row.addEventListener("click", function () { focus(r[0]); });
      tally.appendChild(row);
      rowsEl[r[0]] = row;
      // the bars grow in after layout, so the first paint is not the full one
      var bar = row.querySelector(".bar i");
      setTimeout(function () { bar.style.width = (r[1] / max * 100) + "%"; }, 40 + idx * 30);
    });

    note.textContent = sum + (sum === 1 ? " visit" : " visits") + " from " +
      hits.length + (hits.length === 1 ? " country" : " countries");
  }

  var have = cached();
  if (have) {
    render(have);
    note.textContent += "  ·  cached";
  } else {
    var codes = Object.keys(M.pins);
    readAll(codes, function (d, n) {
      note.textContent = "scanning " + d + "/" + n + "…";
    }).then(function (rows) {
      keep(rows);
      render(rows);
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") location.href = "./";
  });
})();
